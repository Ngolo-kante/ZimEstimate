// ─── Draining the notification queue ─────────────────────────────────────────
//
// This lives here rather than inside the route handler so the reminders cron
// can drain the same queue on its own run.
//
// Vercel's Hobby plan allows a project two cron jobs, each running at most once
// a day, and vercel.json already spends both (the subscription sweep and the
// reminder sweep). Asking for a third schedule doesn't degrade gracefully —
// Vercel rejects the whole deployment, which is exactly how the first attempt
// at this failed. So notifications piggyback on the reminders sweep instead of
// owning a schedule, and this module is the seam that lets both callers share
// one implementation rather than one route importing the other's handler.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NotificationDelivery } from '@/lib/database.types';
import { sendEmail, escapeHtml } from '@/lib/server/email';

const whatsappApiUrl = process.env.WHATSAPP_API_URL;
const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;
const whatsappToken = process.env.WHATSAPP_TOKEN;

export interface NotificationDispatchResult {
  processed: number;
  sent: number;
  failed: number;
  results: Array<{ id: string; status: 'sent' | 'failed'; error?: string }>;
}

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

/**
 * Sends one queued row and throws on anything that stops it going out.
 *
 * Every row carries user_id, so the destination is read from profiles rather
 * than trusted from the payload. Some payloads do carry a usable address — a
 * supplier being told about a new RFQ — but others carry a third party's for
 * display, such as a builder being told a supplier quoted, where the supplier's
 * address describes the subject and not the recipient. Reading from profiles
 * is correct for both without the dispatcher having to tell the shapes apart.
 */
async function sendEmailDelivery(
  supabase: SupabaseClient,
  delivery: NotificationDelivery,
): Promise<void> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', delivery.user_id)
    .single();

  const email = (profile as { email?: string | null } | null)?.email;
  if (error || !email) {
    throw new Error('No email address on file for this user');
  }

  const payload = (delivery.payload || {}) as Record<string, unknown>;
  const title = typeof payload.title === 'string' ? payload.title : 'ZimEstimate notification';
  const body = typeof payload.body === 'string' ? payload.body : '';

  const sent = await sendEmail({
    to: email,
    subject: title,
    html: `<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>`,
    text: body,
  });

  if (!sent) {
    throw new Error('Resend did not accept the message');
  }
}

/**
 * Drains queued notification_deliveries rows.
 *
 * Throws only when it cannot start at all (no service credentials, unreadable
 * queue). A row that fails to send is recorded against that row and the sweep
 * carries on, so one bad address cannot hold up everyone else's mail.
 */
export async function dispatchQueuedNotifications(
  options: { limit?: number; mock?: boolean } = {},
): Promise<NotificationDispatchResult> {
  const { limit = 25, mock = false } = options;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role credentials');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: deliveries, error } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const results: NotificationDispatchResult['results'] = [];

  for (const delivery of (deliveries || []) as NotificationDelivery[]) {
    try {
      if (mock) {
        // Deliberately still writes the status through, so a dry run proves the
        // whole path including the write-back rather than just the send.
      } else if (delivery.channel === 'whatsapp') {
        await sendWhatsAppMessage((delivery.payload || {}) as Record<string, unknown>);
      } else if (delivery.channel === 'email') {
        await sendEmailDelivery(supabase, delivery);
      } else {
        throw new Error('Channel not configured');
      }

      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id);
      results.push({ id: delivery.id, status: 'sent' });
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Dispatch failed';
      await supabase
        .from('notification_deliveries')
        .update({ status: 'failed', last_error: message })
        .eq('id', delivery.id);
      results.push({ id: delivery.id, status: 'failed', error: message });
    }
  }

  return {
    processed: results.length,
    sent: results.filter((entry) => entry.status === 'sent').length,
    failed: results.filter((entry) => entry.status === 'failed').length,
    results,
  };
}
