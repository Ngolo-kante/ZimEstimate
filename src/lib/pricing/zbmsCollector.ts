/**
 * ZBMS weekly price collection.
 *
 * Reads the owner-confirmed product matches (`price_source_matches`, source
 * `zbms`), fetches those products from the ZBMS WooCommerce store API, and
 * writes one `price_observations` row per material. A price within 15% of the
 * current one is auto-approved; anything else waits in /admin/scraper-review.
 *
 * Shared by the `/api/cron/prices` route (run weekly by cron-job.org) and the
 * `npm run collect:prices` script. Talks to Supabase over REST with the
 * service key so the script can use it without the Next.js runtime.
 */
import { materials, materialPrices } from '@/lib/materials';
import { getVerifiedPrice } from '@/lib/pricing/verifiedPrices';
import { convertedPrice, currentPrice, priceDecision, type CollectorObservation } from '@/lib/pricing/collectorRules';

export interface ZbmsMaterialResult {
  materialId: string;
  oldPrice: number | null;
  newPrice: number;
  changePercent: number | null;
}

export interface ZbmsSummary {
  scrapedAt: string;
  dryRun: boolean;
  mapped: number;
  priced: number;
  written: number;
  autoApproved: ZbmsMaterialResult[];
  pending: ZbmsMaterialResult[];
  materials: ZbmsMaterialResult[];
  unpriced: string[];
  failures: string[];
  lowCoverage: boolean;
  failed: boolean;
  dryRunRows?: unknown[];
}

interface ZbmsProduct {
  id: number;
  permalink?: string;
  is_in_stock?: boolean;
  prices?: { price?: string; currency_code?: string; currency_minor_unit?: number };
}

interface Mapping { materialId: string; zbmsProductIds: number[]; factor: number; unit: string }

export const ZBMS_STORE_API = 'https://www.zbms.co.zw/wp-json/wc/store/v1/products';
const USER_AGENT = 'ZimEstimate price check (+https://zimestimate.com)';
const DAY = 86_400_000;

export async function collectZbmsPrices(options: {
  dbUrl: string;
  dbKey: string;
  dryRun?: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<ZbmsSummary> {
  const { dbKey, dryRun = false, fetchImpl = fetch } = options;
  const dbUrl = options.dbUrl.replace(/\/$/, '');
  const now = options.now ?? Date.now();
  const summary: ZbmsSummary = {
    scrapedAt: new Date(now).toISOString(), dryRun, mapped: 0, priced: 0, written: 0,
    autoApproved: [], pending: [], materials: [], unpriced: [], failures: [], lowCoverage: false, failed: false,
    ...(dryRun ? { dryRunRows: [] } : {}),
  };

  const request = async (url: string, init: RequestInit = {}) => {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
      if (error.code && ['42P01', 'PGRST205'].includes(error.code)) {
        throw new Error('Price matches need a database update. Ask your developer to apply migration 068.');
      }
      throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}: ${error.message || 'Request failed'}`);
    }
    return response;
  };
  const dbHeaders = { apikey: dbKey, Authorization: `Bearer ${dbKey}` };
  const observations = (query: string, init: RequestInit = {}) => request(`${dbUrl}/rest/v1/price_observations${query}`, {
    ...init, headers: { ...dbHeaders, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  });

  try {
    const confirmed = await (await request(
      `${dbUrl}/rest/v1/price_source_matches?source=eq.zbms&status=eq.confirmed&select=material_id,product_ids,factor,unit&order=material_id&limit=10000`,
      { headers: dbHeaders },
    )).json() as Array<{ material_id: string; product_ids: number[]; factor: number | string; unit: string }>;
    if (!Array.isArray(confirmed)) throw new Error('Invalid price matches response');

    const mappings: Mapping[] = confirmed.map((row) => ({
      materialId: row.material_id, zbmsProductIds: row.product_ids, factor: Number(row.factor), unit: row.unit,
    }));
    summary.mapped = mappings.length;

    const seen = new Set<string>();
    for (const mapping of mappings) {
      const material = materials.find((m) => m.id === mapping.materialId);
      if (!material || material.unit !== mapping.unit || seen.has(mapping.materialId)
        || !Number.isFinite(mapping.factor) || mapping.factor <= 0
        || !Array.isArray(mapping.zbmsProductIds) || !mapping.zbmsProductIds.length
        || mapping.zbmsProductIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error(`Invalid mapping: ${mapping.materialId}`);
      }
      seen.add(mapping.materialId);
    }

    const ids = [...new Set(mappings.flatMap((m) => m.zbmsProductIds))];
    const products = new Map<number, ZbmsProduct>();
    for (let offset = 0; offset < ids.length; offset += 100) {
      if (offset) await new Promise((done) => setTimeout(done, 300));
      try {
        const response = await request(`${ZBMS_STORE_API}?include=${ids.slice(offset, offset + 100).join(',')}&per_page=100`, {
          headers: { 'User-Agent': USER_AGENT },
        });
        const batch = await response.json() as ZbmsProduct[];
        if (!Array.isArray(batch)) throw new Error('Invalid ZBMS product response');
        for (const product of batch) products.set(product.id, product);
      } catch (error) {
        summary.failures.push(`Product batch ${offset / 100 + 1}: ${(error as Error).message}`);
      }
    }

    for (const mapping of mappings) {
      try {
        const valid = mapping.zbmsProductIds.map((id) => products.get(id)).filter((p): p is ZbmsProduct =>
          p?.is_in_stock === true && p.prices?.currency_code === 'USD'
          && Number.isInteger(p.prices.currency_minor_unit) && p.prices.currency_minor_unit! >= 0
          && p.prices.currency_minor_unit! <= 6 && Number(p.prices.price) > 0);
        const price = convertedPrice(
          valid.map((p) => Number(p.prices!.price) / 10 ** p.prices!.currency_minor_unit!), mapping.factor,
        );
        if (price === null) { summary.unpriced.push(`${mapping.materialId}: no usable in-stock USD price`); continue; }
        summary.priced++;

        // One material at a time, newest first: no REST row-limit truncation across materials.
        const query = new URLSearchParams({
          select: 'price_usd,unit,review_status,scraped_at',
          material_key: `eq.${mapping.materialId}`, review_status: 'in.(auto,confirmed)',
          unit: `eq.${mapping.unit}`, price_usd: 'gt.0',
          scraped_at: `gt.${new Date(now - 30 * DAY).toISOString()}`,
          and: `(scraped_at.lte.${summary.scrapedAt})`, order: 'scraped_at.desc', limit: '1',
        });
        const recent = await (await observations(`?${query}`)).json() as CollectorObservation[];
        const catalogue = materialPrices.filter((p) => p.materialId === mapping.materialId && p.inStock && p.priceUsd > 0)
          .sort((a, b) => a.priceUsd - b.priceUsd)[0]?.priceUsd;
        const old = currentPrice(recent, mapping.unit, getVerifiedPrice(mapping.materialId)?.priceUsd, catalogue, now);
        const decision = priceDecision(price, old);
        const row = {
          source_name: 'ZBMS', supplier_name: 'ZBMS', material_key: mapping.materialId,
          unit: mapping.unit, price_usd: price, currency: 'USD', url: valid[0].permalink,
          scraped_at: summary.scrapedAt, confidence: 3, review_status: decision.review_status,
        };
        if (dryRun) summary.dryRunRows!.push(row);
        else {
          await observations('', { method: 'POST', body: JSON.stringify([row]), headers: { Prefer: 'return=minimal' } });
          summary.written++;
        }
        const detail = { materialId: mapping.materialId, oldPrice: old, newPrice: price, changePercent: decision.changePercent };
        summary.materials.push(detail);
        (decision.review_status === 'auto' ? summary.autoApproved : summary.pending).push(detail);
      } catch (error) {
        summary.failures.push(`${mapping.materialId}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    summary.failures.push((error as Error).message);
  }

  summary.lowCoverage = summary.mapped > 0 && summary.priced / summary.mapped < 0.7;
  summary.failed = summary.failures.length > 0 || summary.lowCoverage;
  return summary;
}

/** Whether the run deserves an email to support@ (failures or prices to review). */
export function zbmsNeedsAlert(summary: ZbmsSummary): boolean {
  return summary.failed || summary.pending.length > 0;
}

export function zbmsAlertText(summary: ZbmsSummary, siteUrl = 'https://zimestimate.com'): string {
  const pct = (m: ZbmsMaterialResult) => (m.changePercent === null ? 'N/A' : `${m.changePercent.toFixed(2)}%`);
  return [
    `Materials priced: ${summary.priced}/${summary.mapped}; written: ${summary.written}`,
    `Auto-approved: ${summary.autoApproved.map((m) => m.materialId).join(', ') || 'none'}`,
    'Pending:', ...summary.pending.map((m) => `${m.materialId}: ${m.oldPrice ?? 'no current price'} → ${m.newPrice} USD (${pct(m)})`),
    `Under 70% coverage: ${summary.lowCoverage}`, 'Unpriced:', ...summary.unpriced, 'Failures:', ...summary.failures,
    `${siteUrl.replace(/\/$/, '')}/admin/scraper-review`,
  ].join('\n');
}
