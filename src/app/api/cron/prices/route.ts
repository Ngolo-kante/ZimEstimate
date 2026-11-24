// Weekly ZBMS price collection.
// Called by cron-job.org (Vercel's free plan allows only two scheduled jobs and
// both are taken). Send `Authorization: Bearer <PRICE_COLLECT_SECRET>`; the
// route falls back to CRON_SECRET when PRICE_COLLECT_SECRET is not set.
// Add `?dry=1` to see what would be written without writing anything.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { collectZbmsPrices, zbmsAlertText, zbmsNeedsAlert } from '@/lib/pricing/zbmsCollector';
import { sendEmail, escapeHtml } from '@/lib/server/email';
import { getSiteUrl } from '@/lib/siteUrl';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const expected = process.env.PRICE_COLLECT_SECRET || process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const given = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !dbKey) {
    return NextResponse.json({ error: 'Server is missing Supabase settings' }, { status: 500 });
  }

  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  const summary = await collectZbmsPrices({ dbUrl, dbKey, dryRun });

  let alert: 'not needed' | 'sent' | 'not sent' | 'skipped (dry run)' = 'not needed';
  if (zbmsNeedsAlert(summary)) {
    if (dryRun) alert = 'skipped (dry run)';
    else {
      const text = zbmsAlertText(summary, getSiteUrl());
      const sent = await sendEmail({
        to: 'support@zimestimate.com',
        subject: summary.failed ? 'ZBMS price collection had problems' : 'ZBMS price collection needs review',
        text,
        html: `<pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      });
      alert = sent ? 'sent' : 'not sent';
    }
  }
  logger.info('cron/prices: ZBMS collection finished', {
    mapped: summary.mapped, priced: summary.priced, written: summary.written,
    pending: summary.pending.length, failures: summary.failures.length, alert,
  });

  // 200 even when some materials failed, so cron-job.org does not disable the
  // job after a few partial runs; the email and `failed` carry the problem.
  return NextResponse.json({ ...summary, alert });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
