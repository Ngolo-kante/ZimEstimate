import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { Agent, fetch as pinnedFetch } from 'undici';
import type { Database } from '@/lib/database.types';
import { materials } from '@/lib/materials';
import { MaterialMatcher, type MatchResult } from '@/lib/services/material-matcher';
import { sanitizeNumber, sanitizeText, sanitizeUrl } from '@/lib/server/security';
import { resolvePublicHttpUrl } from '@/lib/server/outboundUrl';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class ScraperRunnerError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ScraperRunnerError';
    this.status = status;
  }
}

export type ScraperTestPayload = {
  configId?: string;
  url?: string;
  priceSelector?: string;
  nameSelector?: string;
  /** The site's name, recorded with each price so admins can see where it came from. */
  sourceName?: string;
};

export type CategoryScrapePayload = {
  configId?: string;
  url: string;
  containerSelector?: string;
  itemCardSelector: string;
  nameSelector: string;
  priceSelector: string;
  limit?: number;
  sourceName?: string;
};

export interface ScrapedItem {
  name: string;
  price: number;
  rawPrice: string;
  matchResult: MatchResult;
}

export type SingleScrapeResult = {
  success: true;
  name: string;
  price: number;
  rawPrice: string;
  originalName: string;
  match: MatchResult;
};

export type CategoryScrapeResult = {
  success: true;
  url: string;
  itemsFound: number;
  itemsMatched: number;
  itemsPending: number;
  items: ScrapedItem[];
};

type ScraperLogInsert = Database['public']['Tables']['scraper_logs']['Insert'];
type ScraperConfigUpdate = Database['public']['Tables']['scraper_configs']['Update'];

function getSupabaseAdminClient() {
  if (!supabaseServiceKey) {
    throw new ScraperRunnerError('Server configuration error: Missing Service Role Key', 500);
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

// Browser-like headers. The Zimbabwe supplier sources are server-rendered
// WordPress/WooCommerce pages, so a plain fetch returns the same HTML a
// headless renderer would — no third-party scraping service needed.
const SCRAPE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

const SCRAPE_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

async function readHtmlWithLimit(response: Awaited<ReturnType<typeof pinnedFetch>>): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_HTML_BYTES) {
    throw new ScraperRunnerError('Scraper response exceeded the 5MB limit.', 502);
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new ScraperRunnerError('Scraper response exceeded the 5MB limit.', 502);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Fetch a page's HTML directly. Retries once with a Referer when a site
 * answers 403, which is what the standalone pricing scraper does.
 */
async function fetchHtml(url: string): Promise<string> {
  let currentUrl = new URL(url);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let safeUrl: URL;
    let dispatcher: Agent | null = null;
    try {
      const destination = await resolvePublicHttpUrl(currentUrl);
      safeUrl = destination.url;
      // Pin the connection to the IP address we just checked. A second DNS
      // lookup by fetch could otherwise resolve the same hostname to a private
      // address (DNS rebinding) after validation. The URL hostname remains in
      // the HTTP Host header and TLS certificate/SNI checks.
      const pinned = destination.addresses[0];
      dispatcher = new Agent({
        connect: {
          lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
        },
      });
      const attempt = (headers: Record<string, string>) => pinnedFetch(safeUrl.toString(), {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
        dispatcher: dispatcher!,
      });
      let response = await attempt(SCRAPE_HEADERS);
      if (response.status === 403) {
        await response.body?.cancel();
        response = await attempt({
          ...SCRAPE_HEADERS,
          Referer: safeUrl.origin,
          'Upgrade-Insecure-Requests': '1',
        });
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new ScraperRunnerError('Scraper redirect had no destination.', 502);
        currentUrl = new URL(location, safeUrl);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new ScraperRunnerError(
          `Scraper destination returned HTTP ${response.status}`,
          response.status === 404 ? 404 : 502
        );
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        await response.body?.cancel();
        throw new ScraperRunnerError('Scraper destination did not return HTML.', 502);
      }

      const html = await readHtmlWithLimit(response);
      if (!html.trim()) {
        throw new ScraperRunnerError('No HTML content returned from scraper destination.', 502);
      }
      return html;
    } catch (error) {
      if (error instanceof ScraperRunnerError) throw error;
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new ScraperRunnerError(`Failed to fetch scraper URL: ${reason}`, 502);
    } finally {
      await dispatcher?.destroy();
    }
  }

  throw new ScraperRunnerError(`Scraper exceeded ${MAX_REDIRECTS} redirects.`, 502);
}

export async function runSingleScrape(payload: ScraperTestPayload): Promise<SingleScrapeResult> {
  const configId = typeof payload.configId === 'string' ? payload.configId : null;

  try {
    const url = sanitizeUrl(payload.url);
    const priceSelector = sanitizeText(payload.priceSelector, { maxLength: 200 });
    const nameSelector = sanitizeText(payload.nameSelector, { maxLength: 200 });

    if (!url || !priceSelector || !nameSelector) {
      throw new ScraperRunnerError('Missing required configuration fields', 400);
    }

    const supabase = getSupabaseAdminClient();
    const matcher = new MaterialMatcher(supabase);

    const html = await fetchHtml(url);

    const $ = cheerio.load(html);
    const priceText = $(priceSelector).first().text().trim() || '';
    const nameText = $(nameSelector).first().text().trim() || '';

    if (!priceText) {
      throw new ScraperRunnerError(`Price selector "${priceSelector}" returned empty text`, 400);
    }

    const cleanPriceString = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleanPriceString);
    if (Number.isNaN(price)) {
      throw new ScraperRunnerError(`Failed to parse price from "${priceText}"`, 400);
    }

    const matchResult = await matcher.match(nameText);

    let finalItemName = nameText;
    let matchedMaterialCode: string | null = null;

    if (matchResult.materialCode) {
      matchedMaterialCode = matchResult.materialCode;
      const matched = materials.find((material) => material.id === matchedMaterialCode);
      if (matched) {
        finalItemName = matched.name;
      }
    }

    if (matchedMaterialCode) {
      const confidenceScale = Math.max(1, Math.min(5, Math.round(matchResult.confidence * 4 + 1)));
      await supabase.from('price_observations').insert({
        material_key: matchedMaterialCode,
        material_name: finalItemName,
        price_usd: price,
        confidence: confidenceScale,
        source_name: sanitizeText(payload.sourceName, { maxLength: 120 }) || null,
        supplier_name: sanitizeText(payload.sourceName, { maxLength: 120 }) || null,
        url,
        scraped_at: new Date().toISOString(),
        review_status: matchResult.needsReview ? 'pending' : 'auto',
      } as never);
    }

    if (matchResult.needsReview) {
      await matcher.addToPendingReview(nameText, price, url, configId, matchResult);
    }

    if (configId) {
      const configUpdate: ScraperConfigUpdate = {
        last_successful_run_at: new Date().toISOString(),
      };
      await supabase.from('scraper_configs').update(configUpdate as never).eq('id', configId);

      const logEntry: ScraperLogInsert = {
        scraper_config_id: configId,
        status: 'success',
        message: matchedMaterialCode
          ? `Scraped & Matched: ${finalItemName} @ $${price}`
          : `Scraped (Unmatched): ${nameText} @ $${price}`,
        scraped_data: { raw_name: nameText, raw_price: priceText, match_method: matchResult.method },
      };
      await supabase.from('scraper_logs').insert(logEntry as never);
    }

    return {
      success: true,
      name: finalItemName,
      price,
      rawPrice: priceText,
      originalName: nameText,
      match: matchResult,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');

    try {
      if (configId && supabaseServiceKey) {
        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
        const logEntry: ScraperLogInsert = {
          scraper_config_id: configId,
          status: 'failure',
          message: err.message || 'Unknown error',
        };
        await supabase.from('scraper_logs').insert(logEntry as never);
      }
    } catch {
      // Best-effort failure logging only.
    }

    throw err;
  }
}

export async function runCategoryScrape(payload: CategoryScrapePayload): Promise<CategoryScrapeResult> {
  const sanitizedUrl = sanitizeUrl(payload.url);
  const safeConfigId = payload.configId ? sanitizeText(payload.configId, { maxLength: 80 }) : null;
  const safeContainerSelector = sanitizeText(payload.containerSelector, { maxLength: 200 });
  const safeItemCardSelector = sanitizeText(payload.itemCardSelector, { maxLength: 200 });
  const safeNameSelector = sanitizeText(payload.nameSelector, { maxLength: 200 });
  const safePriceSelector = sanitizeText(payload.priceSelector, { maxLength: 200 });
  const safeLimit = sanitizeNumber(payload.limit, { min: 1, max: 200, fallback: 50 });

  if (!sanitizedUrl || !safeItemCardSelector || !safeNameSelector || !safePriceSelector) {
    throw new ScraperRunnerError('Missing required fields: url, itemCardSelector, nameSelector, priceSelector', 400);
  }

  const supabase = getSupabaseAdminClient();
  const matcher = new MaterialMatcher(supabase);

  const html = await fetchHtml(sanitizedUrl);

  const $ = cheerio.load(html);
  const containerSelector = safeContainerSelector || 'body';
  const rawItems: Array<{ name: string; price: string }> = [];
  const $container = $(containerSelector);

  if ($container.length > 0) {
    $container.find(safeItemCardSelector).each((_, element) => {
      const name = $(element).find(safeNameSelector).text().trim();
      const price = $(element).find(safePriceSelector).text().trim();

      if (name && price) {
        rawItems.push({ name, price });
      }
    });
  }

  const limitedItems = rawItems.slice(0, safeLimit);
  const scrapedItems: ScrapedItem[] = [];
  let matchedCount = 0;
  let pendingCount = 0;

  for (const item of limitedItems) {
    const cleanPriceString = item.price.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleanPriceString);

    if (Number.isNaN(price)) {
      continue;
    }

    const matchResult = await matcher.match(item.name);

    scrapedItems.push({
      name: item.name,
      price,
      rawPrice: item.price,
      matchResult,
    });

    if (matchResult.materialCode && !matchResult.needsReview) {
      matchedCount++;
    } else if (matchResult.needsReview) {
      pendingCount++;
    }

    if (matchResult.materialCode) {
      const material = materials.find((entry) => entry.id === matchResult.materialCode);
      const confidenceScale = Math.max(1, Math.min(5, Math.round(matchResult.confidence * 4 + 1)));

      await supabase.from('price_observations').insert({
        material_key: matchResult.materialCode,
        material_name: material?.name || item.name,
        price_usd: price,
        confidence: confidenceScale,
        source_name: sanitizeText(payload.sourceName, { maxLength: 120 }) || null,
        supplier_name: sanitizeText(payload.sourceName, { maxLength: 120 }) || null,
        url: sanitizedUrl,
        scraped_at: new Date().toISOString(),
        review_status: matchResult.needsReview ? 'pending' : 'auto',
      } as never);
    }

    if (matchResult.needsReview) {
      await matcher.addToPendingReview(item.name, price, sanitizedUrl, safeConfigId || null, matchResult);
    }
  }

  if (safeConfigId) {
    await supabase.from('scraper_configs').update({
      last_successful_run_at: new Date().toISOString(),
    } as never).eq('id', safeConfigId);

    await supabase.from('scraper_logs').insert({
      scraper_config_id: safeConfigId,
      status: 'success',
      message: `Category scrape: ${scrapedItems.length} items found, ${matchedCount} matched, ${pendingCount} pending review`,
      scraped_data: { itemCount: scrapedItems.length, matchedCount, pendingCount },
    } as never);
  }

  return {
    success: true,
    url: sanitizedUrl,
    itemsFound: scrapedItems.length,
    itemsMatched: matchedCount,
    itemsPending: pendingCount,
    items: scrapedItems,
  };
}

export type ScraperConfigRow = {
  id: string;
  site_name: string;
  base_url: string;
  price_selector: string;
  item_name_selector: string;
  scrape_mode?: string | null;
  container_selector?: string | null;
  item_card_selector?: string | null;
};

export type ScraperRunOutcome = {
  configId: string;
  siteName: string;
  success: boolean;
  itemsFound?: number;
  itemsMatched?: number;
  error?: string;
};

/** Runs one saved scraper, in whichever mode it is set up for. Never throws. */
export async function runScraperConfig(config: ScraperConfigRow): Promise<ScraperRunOutcome> {
  try {
    if ((config.scrape_mode || 'single') === 'category') {
      const result = await runCategoryScrape({
        configId: config.id,
        url: config.base_url,
        containerSelector: config.container_selector ?? undefined,
        itemCardSelector: config.item_card_selector || '',
        nameSelector: config.item_name_selector,
        priceSelector: config.price_selector,
        sourceName: config.site_name,
      });
      return { configId: config.id, siteName: config.site_name, success: true, itemsFound: result.itemsFound, itemsMatched: result.itemsMatched };
    }
    const result = await runSingleScrape({
      configId: config.id,
      url: config.base_url,
      priceSelector: config.price_selector,
      nameSelector: config.item_name_selector,
      sourceName: config.site_name,
    });
    return { configId: config.id, siteName: config.site_name, success: true, itemsFound: 1, itemsMatched: result.match.materialCode ? 1 : 0 };
  } catch (error) {
    return { configId: config.id, siteName: config.site_name, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Every active scraper, one after another (one request per site at a time),
 * stopping before the time budget runs out so a scheduled job is never cut
 * off half way. Those not reached run first next time: oldest run first.
 */
export async function runActiveScrapers(budgetMs = 45_000): Promise<{ results: ScraperRunOutcome[]; notReached: number }> {
  const started = Date.now();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('scraper_configs')
    .select('*')
    .eq('is_active', true)
    .order('last_successful_run_at', { ascending: true, nullsFirst: true });
  if (error) throw new ScraperRunnerError(error.message, 500);
  const configs = (data ?? []) as unknown as ScraperConfigRow[];

  const results: ScraperRunOutcome[] = [];
  for (const config of configs) {
    // A fetch can take up to SCRAPE_TIMEOUT_MS; do not start one that cannot finish.
    if (Date.now() - started > budgetMs - SCRAPE_TIMEOUT_MS) break;
    results.push(await runScraperConfig(config));
  }
  return { results, notReached: configs.length - results.length };
}
