import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { requireAdmin } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit, sanitizeNumber } from '@/lib/server/security';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';
import { prunePlanSamples } from '@/lib/server/planSamples';
import { runActiveScrapers } from '@/lib/server/scraperRunner';
import { sendEmail, escapeHtml } from '@/lib/server/email';
import { getSiteUrl } from '@/lib/siteUrl';
import { channelStatus, sendSms, sendTelegram, sendWhatsApp } from '@/lib/server/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Mondays also run the supplier price scrapers (below).
export const maxDuration = 60;

type DeliveryChannel = 'email' | 'sms' | 'whatsapp' | 'telegram';

type ReminderRow = Pick<Database['public']['Tables']['reminders']['Row'],
  'id' | 'user_id' | 'project_id' | 'message' | 'phone_number' | 'scheduled_date'
>;

type ProfileRow = Pick<Database['public']['Tables']['profiles']['Row'],
  'id' | 'email' | 'phone_number' | 'telegram_chat_id' | 'notify_project_reminders' | 'notify_email' | 'notify_whatsapp'
>;

type ProjectRow = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name'>;

const CHANNEL_PREFIX = /^\[(EMAIL|SMS|WHATSAPP|TELEGRAM)\]\s*/i;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function hasDispatcherSecret(request: Request): boolean {
  const expected = process.env.REMINDER_DISPATCH_SECRET;
  if (!expected) return false;

  const headerSecret = (request.headers.get('x-reminder-secret') || '').trim();
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  return headerSecret === expected || bearer === expected;
}

function parseReminderMessage(message: string): { channel: DeliveryChannel; body: string } {
  const match = message.match(CHANNEL_PREFIX);
  if (!match) return { channel: 'email', body: message.trim() };

  const raw = match[1].toLowerCase();
  const channel: DeliveryChannel = raw === 'email' || raw === 'sms' || raw === 'whatsapp' || raw === 'telegram'
    ? raw
    : 'email';

  return {
    channel,
    body: message.replace(CHANNEL_PREFIX, '').trim(),
  };
}

/**
 * Through the same verified sender as every other email
 * (src/lib/server/email.ts). Reminders used their own REMINDER_EMAIL_FROM,
 * which in production was Resend's sandbox address: Resend refused every
 * reminder ("You can only send testing emails to your own email address")
 * while all other mail went out from noreply@zimestimate.com. Not one email
 * reminder had ever been delivered. The variable is no longer read.
 */
async function sendEmailReminder(to: string, subject: string, message: string, projectId: string) {
  const link = `${getSiteUrl()}/projects/${projectId}`;
  const sent = await sendEmail({
    to,
    subject,
    html: `<p>${escapeHtml(message).replace(/\n/g, '<br />')}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#0b1f3b;color:#fff;border-radius:6px;text-decoration:none">Open the project</a></p><p style="color:#667;font-size:12px">You can turn reminders off in Settings.</p>`,
    text: `${message}\n\nOpen the project: ${link}`,
  });
  if (!sent) {
    throw new Error('Email could not be sent (check RESEND_API_KEY).');
  }
}

/**
 * The number to text. Reminder rows carry a phone only because the column
 * is NOT NULL, and the app fills it with "0000000000" when there is none —
 * which this used to prefer over the person's real number.
 */
function reminderPhone(reminderPhoneNumber: string | null, profilePhone: string | null): string {
  const own = (reminderPhoneNumber || '').replace(/\D/g, '');
  if (own && !/^0+$/.test(own)) return reminderPhoneNumber as string;
  return profilePhone || '';
}

async function markReminderSent(supabase: SupabaseClient<Database>, reminderId: string) {
  const { error } = await supabase
    .from('reminders')
    .update({ is_sent: true } as never)
    .eq('id', reminderId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Vercel Cron entry point — the daily outbound sweep.
 *
 * Cron issues a GET carrying CRON_SECRET, while the dispatcher itself is a POST
 * authenticated with REMINDER_DISPATCH_SECRET. Without this the reminders table
 * filled up and nothing was ever delivered — the only scheduled job in
 * vercel.json was the subscription sweep.
 *
 * It drains the notification queue on the same run. That queue wants its own,
 * far more frequent schedule, but the Hobby plan allows two cron jobs at one
 * run a day each and vercel.json already spends both; a third entry is refused
 * at deploy time rather than ignored, taking the whole deployment with it.
 * Riding along here means supplier notifications go out at least daily on the
 * free plan. For anything faster, point an external scheduler at
 * /api/notifications/dispatch with CRON_SECRET — this stays as the floor.
 *
 * A failure in either queue must not take the other down with it, so the two
 * are reported side by side and neither can throw past this handler.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dispatcherSecret = process.env.REMINDER_DISPATCH_SECRET;
  if (!dispatcherSecret) {
    return NextResponse.json(
      { error: 'REMINDER_DISPATCH_SECRET is not set.' },
      { status: 500 }
    );
  }

  // No origin header on a server-issued request, so the CSRF origin check
  // passes through and the dispatcher secret satisfies authorisation.
  const remindersResponse = await POST(
    new Request(request.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${dispatcherSecret}`,
      },
      body: JSON.stringify({ limit: 100 }),
    })
  );

  const reminders = await remindersResponse.json().catch(() => ({ error: 'Unreadable reminder result.' }));

  let notifications: unknown;
  try {
    notifications = await dispatchQueuedNotifications({ limit: 100 });
  } catch (error) {
    notifications = { error: error instanceof Error ? error.message : 'Notification dispatch failed.' };
  }

  // Plan samples past their twelve months, as the privacy policy promises.
  // Its own try, like the jobs above: one failing must not stop the others.
  let planSamples: unknown;
  try {
    planSamples = await prunePlanSamples();
  } catch (error) {
    planSamples = { error: error instanceof Error ? error.message : 'Plan sample pruning failed.' };
  }

  // Supplier prices, once a week (Monday). They ride on this daily job
  // because Vercel's free plan allows two scheduled jobs and both are taken.
  let scrapers: unknown = 'not scheduled today';
  if (new Date().getUTCDay() === 1) {
    try {
      const { results, notReached } = await runActiveScrapers(45_000);
      scrapers = {
        ran: results.length,
        succeeded: results.filter((r) => r.success).length,
        matched: results.reduce((sum, r) => sum + (r.itemsMatched ?? 0), 0),
        notReached,
      };
    } catch (error) {
      scrapers = { error: error instanceof Error ? error.message : 'Scrapers failed.' };
    }
  }

  return NextResponse.json({ reminders, notifications, planSamples, scrapers });
}

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, {
    keyPrefix: 'reminders:dispatch',
    limit: 30,
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
    return NextResponse.json({ error: 'Missing Supabase service credentials.' }, { status: 500 });
  }

  const payload = await request.json().catch(() => ({}));
  const limit = sanitizeNumber((payload as { limit?: number }).limit, { min: 1, max: 200, fallback: 40 });

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  // First enqueue due recurring reminders into one-off reminder rows.
  const { error: enqueueError } = await supabase.rpc('enqueue_due_project_reminders');
  if (enqueueError) {
    return NextResponse.json({ error: enqueueError.message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { data: dueReminders, error: reminderError } = await supabase
    .from('reminders')
    .select('id, user_id, project_id, message, phone_number, scheduled_date')
    .eq('is_sent', false)
    .lte('scheduled_date', nowIso)
    .order('scheduled_date', { ascending: true })
    .limit(limit);

  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 500 });
  }

  const reminders = (dueReminders || []) as ReminderRow[];
  if (reminders.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, skipped: 0, results: [] });
  }

  const userIds = Array.from(new Set(reminders.map((entry) => entry.user_id)));
  const projectIds = Array.from(new Set(reminders.map((entry) => entry.project_id)));

  const { data: profilesData, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, phone_number, telegram_chat_id, notify_project_reminders, notify_email, notify_whatsapp')
    .in('id', userIds);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: projectsData, error: projectError } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds);

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const profiles = (profilesData || []) as ProfileRow[];
  const projects = (projectsData || []) as ProjectRow[];

  const profileById = new Map(profiles.map((entry) => [entry.id, entry]));
  const projectById = new Map(projects.map((entry) => [entry.id, entry]));

  const results: Array<{ id: string; status: 'sent' | 'failed' | 'skipped'; channel?: DeliveryChannel; error?: string }> = [];

  const sendable = channelStatus();

  for (const reminder of reminders) {
    const profile = profileById.get(reminder.user_id);
    const parsed = parseReminderMessage(reminder.message || '');
    const body = parsed.body;
    // A channel this deployment cannot send on goes by email instead, so a
    // reminder saved for WhatsApp or SMS before those are set up still
    // arrives rather than failing every morning.
    const channel: DeliveryChannel = parsed.channel !== 'email' && !sendable[parsed.channel] ? 'email' : parsed.channel;

    if (!profile) {
      results.push({ id: reminder.id, status: 'failed', channel, error: 'Profile not found.' });
      continue;
    }

    if (!profile.notify_project_reminders) {
      try {
        await markReminderSent(supabase, reminder.id);
        results.push({ id: reminder.id, status: 'skipped', channel, error: 'User disabled project reminders.' });
      } catch (markError) {
        const markErrorMessage = markError instanceof Error ? markError.message : 'Failed to mark reminder as skipped.';
        results.push({ id: reminder.id, status: 'failed', channel, error: markErrorMessage });
      }
      continue;
    }

    const projectName = projectById.get(reminder.project_id)?.name || 'Your project';
    const subject = `Project reminder: ${projectName}`;

    if (channel === 'email' && !profile.notify_email) {
      try {
        await markReminderSent(supabase, reminder.id);
        results.push({ id: reminder.id, status: 'skipped', channel, error: 'User disabled email notifications.' });
      } catch (markError) {
        const markErrorMessage = markError instanceof Error ? markError.message : 'Failed to mark reminder as skipped.';
        results.push({ id: reminder.id, status: 'failed', channel, error: markErrorMessage });
      }
      continue;
    }

    if (channel === 'whatsapp' && !profile.notify_whatsapp) {
      try {
        await markReminderSent(supabase, reminder.id);
        results.push({ id: reminder.id, status: 'skipped', channel, error: 'User disabled WhatsApp notifications.' });
      } catch (markError) {
        const markErrorMessage = markError instanceof Error ? markError.message : 'Failed to mark reminder as skipped.';
        results.push({ id: reminder.id, status: 'failed', channel, error: markErrorMessage });
      }
      continue;
    }

    try {
      if (channel === 'email') {
        await sendEmailReminder(profile.email, subject, body, reminder.project_id);
      }

      if (channel === 'sms') {
        await sendSms(reminderPhone(reminder.phone_number, profile.phone_number), `${subject}\n${body}`);
      }

      if (channel === 'whatsapp') {
        await sendWhatsApp(reminderPhone(reminder.phone_number, profile.phone_number), { title: subject, body });
      }

      if (channel === 'telegram') {
        await sendTelegram(profile.telegram_chat_id || '', `${subject}\n\n${body}`);
      }

      await markReminderSent(supabase, reminder.id);
      results.push({ id: reminder.id, status: 'sent', channel });
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : 'Reminder delivery failed.';
      results.push({ id: reminder.id, status: 'failed', channel, error: errorMessage });
    }
  }

  const sent = results.filter((entry) => entry.status === 'sent').length;
  const failed = results.filter((entry) => entry.status === 'failed').length;
  const skipped = results.filter((entry) => entry.status === 'skipped').length;

  return NextResponse.json({
    processed: results.length,
    sent,
    failed,
    skipped,
    results,
  });
}
