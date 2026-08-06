import { NextResponse } from 'next/server';
import { enforceCsrf, enforceRateLimit, sanitizeNumber } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasDispatcherSecret(request: Request): boolean {
  const expected = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!expected) return false;

  const headerSecret = (request.headers.get('x-notification-secret') || '').trim();
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  return headerSecret === expected || bearer === expected;
}

/**
 * Manual and external entry point.
 *
 * There is no cron entry for this path in vercel.json: the Hobby plan allows
 * two scheduled jobs and both are already spoken for, so the daily sweep rides
 * along with the reminders cron instead. This GET exists so the queue can still
 * be drained on demand — by an admin, or by an external scheduler holding
 * CRON_SECRET, which is how you get notifications out in minutes rather than
 * once a day without paying for a third schedule.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dispatcherSecret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!dispatcherSecret) {
    return NextResponse.json(
      { error: 'NOTIFICATION_DISPATCH_SECRET is not set.' },
      { status: 500 }
    );
  }

  // No origin header on a server-issued request, so the CSRF origin check
  // passes through and the dispatcher secret satisfies authorisation.
  return POST(
    new Request(request.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${dispatcherSecret}`,
      },
      body: JSON.stringify({ limit: 50 }),
    })
  );
}

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, {
    keyPrefix: 'notifications:dispatch',
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  const hasSecretAuth = hasDispatcherSecret(request);
  if (!hasSecretAuth) {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;
  }

  const payload = await request.json().catch(() => ({}));
  const mock = Boolean((payload as { mock?: boolean }).mock);
  const limit = sanitizeNumber((payload as { limit?: number }).limit, { min: 1, max: 100, fallback: 25 });

  try {
    const result = await dispatchQueuedNotifications({ limit, mock });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispatch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
