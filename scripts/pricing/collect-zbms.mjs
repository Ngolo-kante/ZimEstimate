// Hand-run ZBMS price collection (`npm run collect:prices`). The weekly run is
// the /api/cron/prices route, called by cron-job.org; both use the same module.
import './load-typescript.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { collectZbmsPrices, zbmsAlertText, zbmsNeedsAlert } = await import('../../src/lib/pricing/zbmsCollector.ts');
const dryRun = process.env.DRY_RUN === '1';
const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const summary = dbUrl && dbKey
  ? await collectZbmsPrices({ dbUrl, dbKey, dryRun })
  : { scrapedAt: new Date().toISOString(), dryRun, mapped: 0, priced: 0, written: 0, autoApproved: [], pending: [],
      materials: [], unpriced: [], failures: ['Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'], lowCoverage: false, failed: true };
if (summary.mapped === 0 && !summary.failed) console.log('No owner-confirmed mappings; nothing to collect.');
for (const row of summary.dryRunRows ?? []) console.log(JSON.stringify(row));
if (summary.failed) process.exitCode = 1;
if (zbmsNeedsAlert(summary)) {
  if (dryRun) console.log('DRY_RUN: alert suppressed (no writes or email).');
  else if (!process.env.RESEND_API_KEY) console.warn('RESEND_API_KEY not set — skipping alert.');
  else {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'ZimEstimate <noreply@zimestimate.com>', to: ['support@zimestimate.com'],
        subject: 'ZBMS price collection needs review', text: zbmsAlertText(summary) }),
    }).catch((error) => ({ ok: false, statusText: error.message }));
    summary.alert = response.ok ? 'sent' : `failed: ${response.statusText}`;
    if (!response.ok) process.exitCode = 1;
  }
}
const output = resolve(process.env.COLLECT_OUTPUT_DIR || 'output/prices');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'zbms-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
