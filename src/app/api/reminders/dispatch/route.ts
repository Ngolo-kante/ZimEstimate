import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { requireAdmin } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit, sanitizeNumber } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function normalizePhone(rawPhone: string): string {
  const cleaned = rawPhone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('+')) return cleaned;
  return `+${cleaned}`;
}

async function sendEmailReminder(to: string, subject: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('Email provider not configured (RESEND_API_KEY / REMINDER_EMAIL_FROM).');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: message,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Email delivery failed.');
  }
}

async function sendTwilioMessage(to: string, from: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const bodyParams = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Twilio delivery failed.');
  }
}

async function sendSmsReminder(phone: string, message: string) {
  const smsFrom = process.env.TWILIO_SMS_FROM;
  if (!smsFrom) {
    throw new Error('SMS sender not configured (TWILIO_SMS_FROM).');
  }

  await sendTwilioMessage(phone, smsFrom, message);
}

async function sendMetaWhatsApp(phone: string, message: string) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!apiUrl || !phoneId || !token) {
    throw new Error('WhatsApp API not configured.');
  }

  const response = await fetch(`${apiUrl}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace(/\D/g, ''),
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'WhatsApp delivery failed.');
  }
}

async function sendWhatsAppReminder(phone: string, message: string) {
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && twilioFrom);

  if (hasTwilio && twilioFrom) {
    const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
    const from = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;
    await sendTwilioMessage(to, from, message);
    return;
  }

  await sendMetaWhatsApp(phone, message);
}

async function sendTelegramReminder(chatId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Telegram bot not configured (TELEGRAM_BOT_TOKEN).');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Telegram delivery failed.');
  }
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
 * Vercel Cron entry point.
 *
 * Cron issues a GET carrying CRON_SECRET, while the dispatcher itself is a POST
 * authenticated with REMINDER_DISPATCH_SECRET. Without this the reminders table
 * filled up and nothing was ever delivered — the only scheduled job in
 * vercel.json was the subscription sweep.
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
  return POST(
    new Request(request.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${dispatcherSecret}`,
      },
      body: JSON.stringify({ limit: 100 }),
    })
  );
}

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, {
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

  for (const reminder of reminders) {
    const profile = profileById.get(reminder.user_id);
    const { channel, body } = parseReminderMessage(reminder.message || '');

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
        await sendEmailReminder(profile.email, subject, body);
      }

      if (channel === 'sms') {
        const phone = normalizePhone(reminder.phone_number || profile.phone_number || '');
        if (!phone) throw new Error('No phone number configured for SMS.');
        await sendSmsReminder(phone, body);
      }

      if (channel === 'whatsapp') {
        const phone = normalizePhone(reminder.phone_number || profile.phone_number || '');
        if (!phone) throw new Error('No phone number configured for WhatsApp.');
        await sendWhatsAppReminder(phone, body);
      }

      if (channel === 'telegram') {
        const chatId = (profile.telegram_chat_id || '').trim();
        if (!chatId) throw new Error('No Telegram chat ID configured.');
        await sendTelegramReminder(chatId, body);
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
