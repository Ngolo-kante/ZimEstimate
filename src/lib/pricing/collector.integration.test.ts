import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function run(options: { dry?: boolean; fetchFails?: boolean; unavailable?: boolean; old?: number; missingCredentials?: boolean; missingTable?: string; empty?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'zbms-test-'));
  directories.push(dir);
  const preload = join(dir, 'mock.mjs');
  writeFileSync(preload, `
    import { appendFileSync } from 'node:fs';
    globalThis.fetch = async (url, options = {}) => {
      appendFileSync(${JSON.stringify(join(dir, 'calls.jsonl'))}, JSON.stringify({url, ...options, signal: undefined}) + '\\n');
      if (url.includes('/price_source_matches')) {
        if (${!!options.missingTable}) return Response.json({ code: ${JSON.stringify(options.missingTable || '')} }, {status:404});
        return Response.json(${options.empty ? '[]' : JSON.stringify([{material_id:'brick-common',product_ids:[123,124,125],factor:0.001,unit:'each'}])});
      }
      if (url.includes('zbms.co.zw')) {
        if (${!!options.fetchFails}) throw new Error('mock fetch failure');
        return Response.json([123,124,125].map((id, i) => ({ id, is_in_stock: ${!options.unavailable}, permalink: 'https://www.zbms.co.zw/product/' + id,
          prices: { price: [11000,11000,0][i].toString(), currency_code: 'USD', currency_minor_unit: 2 } })));
      }
      if (url.includes('api.resend.com')) return Response.json({id:'sent'});
      if (options.method === 'POST') return new Response(null, {status:204});
      return Response.json([{price_usd: ${options.old ?? 0.11}, unit:'each', review_status:'confirmed', scraped_at:new Date(Date.now()-1000).toISOString()}]);
    };
  `);
  const result = spawnSync(process.execPath, ['--import', preload, resolve('scripts/pricing/collect-zbms.mjs')], {
    encoding: 'utf8', env: { ...process.env,
      SUPABASE_URL: options.missingCredentials ? '' : 'https://database.invalid',
      SUPABASE_SERVICE_ROLE_KEY: options.missingCredentials ? '' : 'test-key',
      RESEND_API_KEY: 'test-resend', DRY_RUN: options.dry ? '1' : '0', COLLECT_OUTPUT_DIR: dir,
    },
  });
  const summary = JSON.parse(readFileSync(join(dir, 'zbms-summary.json'), 'utf8'));
  let calls: { url: string; method?: string; headers?: Record<string, string>; body?: string }[] = [];
  try { calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line)); } catch { /* no requests */ }
  return { result, summary, calls };
}

describe('collector CLI with offline mocked HTTP', () => {
  it('writes one normalized auto row and sends no healthy-run email', () => {
    const { result, summary, calls } = run();
    expect(result.status, result.stderr).toBe(0);
    expect(summary.written).toBe(1);
    const write = calls.find((c) => c.method === 'POST');
    expect(JSON.parse(write!.body!)).toEqual([expect.objectContaining({ material_key: 'brick-common', price_usd: 0.11, review_status: 'auto', unit: 'each', source_name: 'ZBMS', supplier_name: 'ZBMS', currency: 'USD' })]);
    expect(calls[0].url).toContain('price_source_matches?source=eq.zbms&status=eq.confirmed');
    const productCall = calls.find(c => c.url.includes('zbms.co.zw'));
    expect(productCall?.url).toContain('include=123,124,125&per_page=100');
    expect(productCall?.headers?.['User-Agent']).toBe('ZimEstimate price check (+https://zimestimate.com)');
    expect(calls.some((c) => c.url.includes('api.resend.com'))).toBe(false);
  });
  it('writes a pending price and sends exactly one review email with the change', () => {
    const { result, summary, calls } = run({ old: 1 });
    expect(result.status, result.stderr).toBe(0);
    expect(summary.pending).toHaveLength(1);
    const emails = calls.filter((c) => c.url.includes('api.resend.com'));
    expect(emails).toHaveLength(1);
    expect(JSON.parse(emails[0].body!)).toMatchObject({to: ['support@zimestimate.com']});
    expect(JSON.parse(emails[0].body!).text).toContain('1 → 0.11 USD (-89.00%)');
  });
  it('dry run prints rows without posting to the database or sending email', () => {
    const { result, summary, calls } = run({ dry: true, old: 1 });
    expect(result.status, result.stderr).toBe(0);
    expect(summary.written).toBe(0);
    expect(summary.pending).toHaveLength(1);
    expect(calls.every((c) => c.method !== 'POST')).toBe(true);
    expect(result.stdout).toContain('"review_status":"pending"');
  });
  it.each([{ fetchFails: true }, { unavailable: true }])('fails and alerts once for missing coverage: %j', (options) => {
    const { result, summary, calls } = run(options);
    expect(result.status).toBe(1);
    expect(summary.lowCoverage).toBe(true);
    expect(summary.written).toBe(0);
    expect(calls.filter((c) => c.url.includes('api.resend.com'))).toHaveLength(1);
  });
  it.each(['42P01', 'PGRST205'])('fails clearly when migration is missing (%s)', (code) => {
    const { result, summary, calls } = run({ missingTable: code });
    expect(result.status).toBe(1);
    expect(summary.failures).toContain('Price matches need a database update. Ask your developer to apply migration 068.');
    expect(calls.some(c => c.url.includes('zbms.co.zw'))).toBe(false);
    expect(calls.filter(c => c.url.includes('api.resend.com'))).toHaveLength(1);
  });
  it('does nothing when no matches are confirmed', () => {
    const { result, summary, calls } = run({ empty: true });
    expect(result.status).toBe(0);
    expect(summary.mapped).toBe(0);
    expect(calls).toHaveLength(1);
  });
  it('requires database credentials outside dry run and still records failure', () => {
    const { result, summary, calls } = run({ missingCredentials: true });
    expect(result.status).toBe(1);
    expect(summary.failures).toContain('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    expect(calls.filter((c) => c.url.includes('zbms.co.zw'))).toHaveLength(0);
  });
});
