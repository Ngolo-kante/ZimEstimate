import { createClient } from '@supabase/supabase-js';
import Firecrawl from '@mendable/firecrawl-js';
import * as cheerio from 'cheerio';
import type { Database } from '@/lib/database.types';
import { materials } from '@/lib/materials';
import { MaterialMatcher, type MatchResult } from '@/lib/services/material-matcher';
import { sanitizeNumber, sanitizeText, sanitizeUrl } from '@/lib/server/security';

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
};

export type CategoryScrapePayload = {
  configId?: string;
  url: string;
  containerSelector?: string;
  itemCardSelector: string;
  nameSelector: string;
  priceSelector: string;
  limit?: number;
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

function getFirecrawlClient() {
  return new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
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
    const firecrawl = getFirecrawlClient();

    const scrapeResult = await firecrawl.scrape(url, { formats: ['html'] });
    const html = scrapeResult.html;
    if (!html) {
      throw new Error('Firecrawl returned no HTML content');
    }

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
  const firecrawl = getFirecrawlClient();

  const scrapeResult = await firecrawl.scrape(sanitizedUrl, { formats: ['html'] });
  const html = scrapeResult.html;
  if (!html) {
    throw new Error('Firecrawl returned no HTML content');
  }

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
      message: `Category scrape (Firecrawl): ${scrapedItems.length} items found, ${matchedCount} matched, ${pendingCount} pending review`,
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
