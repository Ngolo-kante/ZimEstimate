// ─── Send myself a test message ───────────────────────────────────────────────
// POST /api/notifications/test { channel: 'email' | 'whatsapp' | 'sms' }
// Sends one short message to the signed-in person's own address or number,
// and reports exactly what the provider said if it fails —
// the quickest way to know a channel works before relying on it for a
// reminder. Each SMS and WhatsApp costs money, hence the tight limit.

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/server/email';
import { sendSms, sendWhatsApp } from '@/lib/server/messaging';

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
  if (!['email', 'whatsapp', 'sms'].includes(channel)) {
    return NextResponse.json({ error: 'Choose email, WhatsApp or SMS.' }, { status: 400 });
  }

  const { data } = await createServiceRoleClient()
    .from('profiles').select('email, phone_number').eq('id', auth.userId).single();
  const profile = data as { email: string | null; phone_number: string | null } | null;

  try {
    if (channel === 'email') {
      if (!profile?.email) throw new Error('No email address on your account.');
      if (!(await sendEmail({ to: profile.email, subject: TITLE, html: `<p>${BODY}</p>`, text: BODY }))) {
        throw new Error('The email could not be sent.');
      }
    } else if (channel === 'sms') {
      if (!profile?.phone_number) throw new Error('Add your phone number first.');
      await sendSms(profile.phone_number, `${TITLE}: ${BODY}`);
    } else {
      if (!profile?.phone_number) throw new Error('Add your phone number first.');
      await sendWhatsApp(profile.phone_number, { title: TITLE, body: BODY });
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    return NextResponse.json({ sent: false, error: error instanceof Error ? error.message : 'Could not send.' }, { status: 502 });
  }
}
