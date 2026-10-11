// ─── Connect Telegram ─────────────────────────────────────────────────────────
// POST /api/telegram/link → { url }
// Makes a one-time code (30 minutes) and returns t.me/<bot>?start=<code>.
// Opening it and pressing Start sends the code to /api/telegram/webhook,
// which saves the chat against this account. See migration 057.

import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireAuth } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { telegramApi } from '@/lib/server/messaging';

let botUsername: string | null = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') || null;

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'telegram-link', limit: 10, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Telegram reminders are not available yet.' }, { status: 503 });
  }
  try {
    if (!botUsername) {
      const me = await telegramApi('getMe', {}) as { result?: { username?: string } };
      botUsername = me.result?.username ?? null;
    }
  } catch {
    // Reported below.
  }
  if (!botUsername) {
    return NextResponse.json({ error: 'Could not reach Telegram. Please try again.' }, { status: 502 });
  }

  // Telegram allows A–Z, a–z, 0–9, _ and - in a start code, up to 64 long.
  const code = randomBytes(18).toString('base64url');
  const { error } = await createServiceRoleClient()
    .from('profiles')
    .update({ telegram_link_token: code, telegram_link_expires_at: new Date(Date.now() + 30 * 60_000).toISOString() } as never)
    .eq('id', auth.userId);
  if (error) {
    return NextResponse.json({ error: 'Could not start connecting Telegram.' }, { status: 500 });
  }
  return NextResponse.json({ url: `https://t.me/${botUsername}?start=${code}` });
}
