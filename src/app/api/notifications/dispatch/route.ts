import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NotificationDelivery } from '@/lib/database.types';
import { enforceCsrf, enforceRateLimit, sanitizeNumber } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';
import { sendEmail, escapeHtml } from '@/lib/server/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const whatsappApiUrl = process.env.WHATSAPP_API_URL;
const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;
const whatsappToken = process.env.WHATSAPP_TOKEN;

async function sendWhatsAppMessage(payload: Record<string, unknown>) {
  if (!whatsappApiUrl || !whatsappPhoneId || !whatsappToken) {
    throw new Error('WhatsApp API not configured');
  }

  const to = (payload.contact_phone || payload.to) as string | undefined;
  const body = (payload.body || payload.message) as string | undefined;
  if (!to || !body) {
    throw new Error('Missing WhatsApp destination or message');
  }

  const response = await fetch(`${whatsappApiUrl}/${whatsappPhoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whatsappToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'WhatsApp API error');
  }
}

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
 * Vercel Cron entry point, mirroring /api/reminders/dispatch exactly.
 *
 * Cron issues a GET carrying CRON_SECRET (Vercel's own convention); the
 * dispatcher itself is a POST authenticated with NOTIFICATION_DISPATCH_SECRET.
 * Without this, this route existed and worked but nothing ever called it —
 * notification_deliveries filled up and nothing was ever sent, for full
 * projects and quick estimates alike, regardless of channel.
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

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase service role credentials' }, { status: 500 });
  }

  const payload = await request.json().catch(() => ({}));
  const mock = Boolean((payload as { mock?: boolean }).mock);
  const limit = sanitizeNumber((payload as { limit?: number }).limit, { min: 1, max: 100, fallback: 25 });

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: deliveries, error } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const delivery of (deliveries || []) as NotificationDelivery[]) {
    try {
      if (mock) {
        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'sent' });
        continue;
      }

      if (delivery.channel === 'whatsapp') {
        const payload = (delivery.payload || {}) as Record<string, unknown>;
        await sendWhatsAppMessage(payload);
        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'sent' });
      } else if (delivery.channel === 'email') {
        // Every row here carries user_id, so the destination is resolved from
        // profiles rather than trusted from the payload — some payloads carry
        // a direct contact_email (a supplier being told about a new RFQ),
        // others only carry a third party's address for display (a builder
        // being told a supplier quoted, where supplier_email describes the
        // supplier, not the recipient). Reading from profiles.email works for
        // both without the dispatcher needing to know which shape it is.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', delivery.user_id)
          .single();

        const email = (profile as { email?: string | null } | null)?.email;
        if (profileError || !email) {
          throw new Error('No email address on file for this user');
        }

        const emailPayload = (delivery.payload || {}) as Record<string, unknown>;
        const title = typeof emailPayload.title === 'string' ? emailPayload.title : 'ZimEstimate notification';
        const body = typeof emailPayload.body === 'string' ? emailPayload.body : '';

        const sent = await sendEmail({
          to: email,
          subject: title,
          html: `<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>`,
          text: body,
        });
        if (!sent) {
          throw new Error('Resend did not accept the message');
        }

        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'sent' });
      } else {
        await supabase
          .from('notification_deliveries')
          .update({ status: 'failed', last_error: 'Channel not configured' })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'failed', error: 'Channel not configured' });
      }
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Dispatch failed';
      await supabase
        .from('notification_deliveries')
        .update({ status: 'failed', last_error: message })
        .eq('id', delivery.id);
      results.push({ id: delivery.id, status: 'failed', error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
