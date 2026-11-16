import './load-typescript.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { ZBMS_PRODUCTS } = await import('../../src/lib/pricing/zbmsProducts.ts');
const { materials, materialPrices } = await import('../../src/lib/materials.ts');
const { getVerifiedPrice } = await import('../../src/lib/pricing/verifiedPrices.ts');
const { convertedPrice, currentPrice, priceDecision } = await import('../../src/lib/pricing/collectorRules.ts');
const dryRun = process.env.DRY_RUN === '1';
const dbUrl = process.env.SUPABASE_URL;
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const now = Date.now();
const summary = {
  scrapedAt: new Date(now).toISOString(), dryRun, mapped: ZBMS_PRODUCTS.length,
  priced: 0, written: 0, autoApproved: [], pending: [], materials: [], unpriced: [], failures: [],
};
const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  return response;
};
const database = async (query, options = {}) => request(`${dbUrl.replace(/\/$/, '')}/rest/v1/price_observations${query}`, {
  ...options,
  headers: { apikey: dbKey, Authorization: `Bearer ${dbKey}`, 'Content-Type': 'application/json', ...options.headers },
});

try {
  if (!dryRun && (!dbUrl || !dbKey)) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  const seen = new Set();
  for (const mapping of ZBMS_PRODUCTS) {
    const material = materials.find((m) => m.id === mapping.materialId);
    if (!material || material.unit !== mapping.unit || seen.has(mapping.materialId)
      || !Number.isFinite(mapping.factor) || mapping.factor <= 0 || !mapping.zbmsProductIds.length
      || mapping.zbmsProductIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new Error(`Invalid mapping: ${mapping.materialId}`);
    }
    seen.add(mapping.materialId);
  }
  if (!ZBMS_PRODUCTS.length) console.log('No owner-confirmed mappings; nothing to collect.');
  const ids = [...new Set(ZBMS_PRODUCTS.flatMap((m) => m.zbmsProductIds))];
  const products = new Map();
  for (let offset = 0; offset < ids.length; offset += 100) {
    if (offset) await new Promise((done) => setTimeout(done, 300));
    try {
      const response = await request(`https://www.zbms.co.zw/wp-json/wc/store/v1/products?include=${ids.slice(offset, offset + 100).join(',')}&per_page=100`, {
        headers: { 'User-Agent': 'ZimEstimate price check (+https://zimestimate.com)' },
      });
      const batch = await response.json();
      if (!Array.isArray(batch)) throw new Error('Invalid ZBMS product response');
      for (const p of batch) products.set(p.id, p);
    } catch (error) { summary.failures.push(`Product batch ${offset / 100 + 1}: ${error.message}`); }
  }
  for (const mapping of ZBMS_PRODUCTS) {
    try {
      const valid = mapping.zbmsProductIds.map((id) => products.get(id)).filter((p) =>
        p?.is_in_stock === true && p.prices?.currency_code === 'USD'
        && Number.isInteger(p.prices.currency_minor_unit) && p.prices.currency_minor_unit >= 0
        && p.prices.currency_minor_unit <= 6 && Number(p.prices.price) > 0);
      const price = convertedPrice(valid.map((p) => Number(p.prices.price) / 10 ** p.prices.currency_minor_unit), mapping.factor);
      if (price === null) { summary.unpriced.push(`${mapping.materialId}: no usable in-stock USD price`); continue; }
      summary.priced++;
      let observations = [];
      if (dbUrl && dbKey) {
        // One material at a time, newest first: no REST row-limit truncation across materials.
        const query = new URLSearchParams({ select: 'price_usd,unit,review_status,scraped_at',
          material_key: `eq.${mapping.materialId}`, review_status: 'in.(auto,confirmed)',
          unit: `eq.${mapping.unit}`, price_usd: 'gt.0',
          scraped_at: `gt.${new Date(now - 30 * 86400000).toISOString()}`,
          and: `(scraped_at.lte.${summary.scrapedAt})`, order: 'scraped_at.desc', limit: '1' });
        observations = await (await database(`?${query}`)).json();
      }
      const catalogue = materialPrices.filter((p) => p.materialId === mapping.materialId && p.inStock && p.priceUsd > 0)
        .sort((a, b) => a.priceUsd - b.priceUsd)[0]?.priceUsd;
      const old = currentPrice(observations, mapping.unit, getVerifiedPrice(mapping.materialId)?.priceUsd, catalogue, now);
      const decision = priceDecision(price, old);
      const row = { source_name: 'ZBMS', supplier_name: 'ZBMS', material_key: mapping.materialId,
        unit: mapping.unit, price_usd: price, currency: 'USD', url: valid[0].permalink,
        scraped_at: summary.scrapedAt, confidence: 3, review_status: decision.review_status };
      if (dryRun) console.log(JSON.stringify(row));
      else { await database('', { method: 'POST', body: JSON.stringify([row]), headers: { Prefer: 'return=minimal' } }); summary.written++; }
      const detail = { materialId: mapping.materialId, oldPrice: old, newPrice: price, changePercent: decision.changePercent };
      summary.materials.push(detail);
      (decision.review_status === 'auto' ? summary.autoApproved : summary.pending).push(detail);
    } catch (error) { summary.failures.push(`${mapping.materialId}: ${error.message}`); }
  }
} catch (error) { summary.failures.push(error.message); }
summary.lowCoverage = summary.mapped > 0 && summary.priced / summary.mapped < 0.7;
summary.failed = summary.failures.length > 0 || summary.lowCoverage;
if (summary.failed) process.exitCode = 1;
if (summary.failed || summary.pending.length) {
  if (dryRun) console.log('DRY_RUN: alert suppressed (no writes or email).');
  else if (!process.env.RESEND_API_KEY) console.warn('RESEND_API_KEY not set — skipping alert.');
  else {
    const text = [
      `Materials priced: ${summary.priced}/${summary.mapped}; written: ${summary.written}`,
      `Auto-approved: ${summary.autoApproved.map((m) => m.materialId).join(', ') || 'none'}`,
      'Pending:', ...summary.pending.map((m) => `${m.materialId}: ${m.oldPrice ?? 'no current price'} → ${m.newPrice} USD (${m.changePercent === null ? 'N/A' : m.changePercent.toFixed(2) + '%'})`),
      `Under 70% coverage: ${summary.lowCoverage}`, 'Unpriced:', ...summary.unpriced, 'Failures:', ...summary.failures,
      'https://zimestimate.com/admin/scraper-review',
    ].join('\n');
    try {
      await request('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'ZimEstimate <noreply@zimestimate.com>', to: ['support@zimestimate.com'], subject: 'ZBMS price collection needs review', text }),
      });
      summary.alert = 'sent';
    } catch (error) { summary.alert = `failed: ${error.message}`; console.error(summary.alert); process.exitCode = 1; }
  }
}
const output = resolve(process.env.COLLECT_OUTPUT_DIR || 'output/prices');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'zbms-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
