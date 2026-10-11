// ─── Send queued notifications now ────────────────────────────────────────────
// POST /api/notifications/flush
//
// Notifications created in the browser (usage logged, stock running low) queue
// their email through a database trigger. The queue was only emptied by the
// daily reminders job, so those emails arrived up to a day late. The browser
// calls this right after creating one; it only sends what is already queued,
// to the people it was queued for, so calling it more often cannot send
// anything that would not have gone out anyway.

import { NextResponse, after } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'notifications-flush', limit: 10, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  after(async () => {
    try { await dispatchQueuedNotifications({ limit: 25 }); } catch (error) { console.error('Notification flush failed', error); }
  });
  return NextResponse.json({ queued: true }, { status: 202 });
}
