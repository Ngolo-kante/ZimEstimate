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
import { getSiteUrl } from '@/lib/siteUrl';
import { sendWhatsApp } from '@/lib/server/messaging';

export interface NotificationDispatchResult {
  processed: number;
  sent: number;
  failed: number;
  results: Array<{ id: string; status: 'sent' | 'failed'; error?: string }>;
}

/**
 * WhatsApp to the number on the recipient's profile. A supplier told about a
 * quote request may have only the business number from their listing, which
 * the RFQ flow puts in the payload; that is used when the profile has none.
 */
async function sendWhatsAppDelivery(supabase: SupabaseClient, delivery: NotificationDelivery): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_number')
    .eq('id', delivery.user_id)
    .single();
  const payload = (delivery.payload || {}) as Record<string, unknown>;
  const phone = (profile as { phone_number?: string | null } | null)?.phone_number
    || (typeof payload.contact_phone === 'string' ? payload.contact_phone : '');
  if (!phone) throw new Error('No phone number on file for this user');
  await sendWhatsApp(phone, {
    title: typeof payload.title === 'string' ? payload.title : 'ZimEstimate',
    body: typeof payload.body === 'string' ? payload.body : String(payload.message ?? ''),
  });
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

  // Notices link back to the project or quick estimate they are about.
  const projectId = typeof payload.project_id === 'string' ? payload.project_id : null;
  const quickId = typeof payload.quick_boq_id === 'string' ? payload.quick_boq_id : null;
  const link = projectId
    ? `${getSiteUrl()}/projects/${projectId}`
    : quickId ? `${getSiteUrl()}/projects/quick/${quickId}` : null;

  const sent = await sendEmail({
    to: email,
    subject: title,
    html: `<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>${link
      ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#0b1f3b;color:#fff;border-radius:6px;text-decoration:none">Open the project</a></p><p style="color:#667;font-size:12px">You can turn these emails off in Settings.</p>`
      : ''}`,
    text: link ? `${body}\n\nOpen the project: ${link}` : body,
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
    // No email provider here (local development, a preview without the key):
    // leave the row queued for an environment that can send it. Marking it
    // failed would lose a real person's email, since both share one database.
    if (!mock && delivery.channel === 'email' && !process.env.RESEND_API_KEY) {
      continue;
    }
    try {
      if (mock) {
        // Deliberately still writes the status through, so a dry run proves the
        // whole path including the write-back rather than just the send.
      } else if (delivery.channel === 'whatsapp') {
        await sendWhatsAppDelivery(supabase, delivery);
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
