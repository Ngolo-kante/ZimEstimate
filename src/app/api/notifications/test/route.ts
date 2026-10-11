// ─── Send myself a test message ───────────────────────────────────────────────
// POST /api/notifications/test { channel: 'email' | 'sms' | 'whatsapp' | 'telegram' }
// Sends one short message to the signed-in person's own address, number or
// Telegram chat, and reports exactly what the provider said if it fails —
// the quickest way to know a channel works before relying on it for a
// reminder. Each SMS and WhatsApp costs money, hence the tight limit.

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/server/email';
import { sendSms, sendTelegram, sendWhatsApp } from '@/lib/server/messaging';

const TITLE = 'ZimEstimate test message';
const BODY = 'This is a test. Your project reminders will arrive here.';

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'notifications-test', limit: 5, windowMs: 10 * 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const channel = body?.channel;
  if (!['email', 'sms', 'whatsapp', 'telegram'].includes(channel)) {
    return NextResponse.json({ error: 'Choose email, SMS, WhatsApp or Telegram.' }, { status: 400 });
  }

  const { data } = await createServiceRoleClient()
    .from('profiles').select('email, phone_number, telegram_chat_id').eq('id', auth.userId).single();
  const profile = data as { email: string | null; phone_number: string | null; telegram_chat_id: string | null } | null;

  try {
    if (channel === 'email') {
      if (!profile?.email) throw new Error('No email address on your account.');
      if (!(await sendEmail({ to: profile.email, subject: TITLE, html: `<p>${BODY}</p>`, text: BODY }))) {
        throw new Error('The email could not be sent.');
      }
    } else if (channel === 'sms') {
      if (!profile?.phone_number) throw new Error('Add your phone number first.');
      await sendSms(profile.phone_number, `${TITLE}: ${BODY}`);
    } else if (channel === 'whatsapp') {
      if (!profile?.phone_number) throw new Error('Add your phone number first.');
      await sendWhatsApp(profile.phone_number, { title: TITLE, body: BODY });
    } else {
      if (!profile?.telegram_chat_id) throw new Error('Connect Telegram first.');
      await sendTelegram(profile.telegram_chat_id, `${TITLE}\n\n${BODY}`);
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    return NextResponse.json({ sent: false, error: error instanceof Error ? error.message : 'Could not send.' }, { status: 502 });
  }
}
