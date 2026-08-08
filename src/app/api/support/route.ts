import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { enforceCsrf, enforceRateLimit, sanitizeText } from '@/lib/server/security';
import { escapeHtml, getSupportInbox, sendEmail } from '@/lib/server/email';
import { logger } from '@/lib/logger';

/**
 * Public support intake.
 *
 * Inserts with the service role rather than exposing a public INSERT policy on
 * support_tickets: that table is an admin work queue, and a direct policy would
 * make it writable by anyone with the anon key and no way to rate-limit.
 * Everything arriving here is untrusted, so it is length-capped and stripped of
 * control characters before it reaches the database.
 */

const CATEGORIES = ['general', 'account', 'billing', 'supplier', 'contractor', 'bug', 'privacy'] as const;
type Category = (typeof CATEGORIES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  // Support is free to contact and therefore free to abuse. The limit runs
  // before validation so a script cannot probe the endpoint cheaply — which
  // means a rejected submission also costs an attempt, so the ceiling has to
  // leave room for someone correcting a typo. Ten an hour is forgiving for a
  // person and useless for a spammer.
  const limited = await enforceRateLimit(request, {
    keyPrefix: 'support-intake',
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  const subject = sanitizeText(payload.subject, { maxLength: 200 });
  const description = sanitizeText(payload.description, { maxLength: 5000 });
  const contactName = sanitizeText(payload.contactName, { maxLength: 120 });
  const contactEmail = sanitizeText(payload.contactEmail, { maxLength: 200 }).toLowerCase();
  const rawCategory = sanitizeText(payload.category, { maxLength: 40 });
  const category: Category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : 'general';

  if (!subject) {
    return NextResponse.json({ error: 'Tell us what this is about.' }, { status: 400 });
  }
  if (description.length < 10) {
    return NextResponse.json(
      { error: 'Add a few more details so we can actually help.' },
      { status: 400 }
    );
  }
  if (!EMAIL_PATTERN.test(contactEmail)) {
    return NextResponse.json(
      { error: 'Enter an email address we can reply to.' },
      { status: 400 }
    );
  }

  // Attach the account when the request carries a valid session, so the ticket
  // shows up in the sender's own history. A bad or absent token is not an
  // error — it just means the ticket is anonymous.
  let userId: string | null = null;
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = createServiceRoleClient();

  if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken);
    userId = data.user?.id ?? null;
  }

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject,
      description,
      category,
      contact_name: contactName || null,
      contact_email: contactEmail,
      status: 'open',
      priority: category === 'privacy' ? 'high' : 'normal',
    } as never)
    .select('id')
    .single();

  if (error) {
    logger.error('Support ticket insert failed', { error: error.message });
    return NextResponse.json(
      { error: 'Could not submit your message. Please try again.' },
      { status: 500 }
    );
  }

  const ticketId = (ticket as { id: string } | null)?.id ?? null;
  // Something to quote back at us. Short enough to read over the phone.
  const reference = ticketId ? ticketId.slice(0, 8).toUpperCase() : null;

  // Awaited rather than fired and forgotten: this runs in a serverless
  // function, which can be frozen the moment the response is returned, and a
  // detached promise would be killed mid-flight. sendEmail never throws and
  // never rejects, so a failure here costs a few hundred milliseconds and
  // nothing else — the ticket is already saved and the reference already
  // earned.
  await sendEmail({
    to: getSupportInbox(),
    replyTo: contactEmail,
    subject: `[${reference ?? 'SUPPORT'}] ${category}: ${subject}`,
    text: [
      `From: ${contactName || 'Not given'} <${contactEmail}>`,
      `Category: ${category}`,
      `Account: ${userId ? `signed in (${userId})` : 'not signed in'}`,
      `Reference: ${reference ?? 'unknown'}`,
      '',
      description,
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
        <p style="margin:0 0 4px"><strong>${escapeHtml(contactName || 'Someone')}</strong>
          &lt;${escapeHtml(contactEmail)}&gt;</p>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px">
          ${escapeHtml(category)} &middot; ${userId ? 'signed in' : 'not signed in'}
          &middot; ref ${escapeHtml(reference ?? 'unknown')}
        </p>
        <p style="margin:0 0 8px;font-weight:600">${escapeHtml(subject)}</p>
        <div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(description)}</div>
        <p style="margin:20px 0 0;color:#64748b;font-size:12px">
          Reply to this email to answer them directly.
        </p>
      </div>
    `,
  });

  return NextResponse.json({ success: true, reference });
}
