// ─── Transactional email ──────────────────────────────────────────────────────
// Thin wrapper over Resend's REST API. Deliberately not the `resend` SDK: one
// POST does not justify a dependency, and fetch is already available in the
// Node runtime this deploys to.
//
// Sending is always best-effort. Every caller here is notifying us about
// something that has already been written to the database — a notification
// failing must never take down the request that produced it, or a support
// request would be lost because an email provider had a bad minute.

import { logger } from '@/lib/logger';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Verified sending identity — see the Resend domain setup for zimestimate.com. */
const DEFAULT_FROM = 'ZimEstimate <noreply@zimestimate.com>';

/** Forwards to the team inbox via ImprovMX. */
const DEFAULT_SUPPORT_INBOX = 'support@zimestimate.com';

export function getSupportInbox(): string {
  return process.env.SUPPORT_NOTIFY_TO || DEFAULT_SUPPORT_INBOX;
}

/**
 * Escapes text destined for an HTML email body.
 *
 * Everything notified here originates from an untrusted form. Without this a
 * subject line containing a stray `<` silently swallows the rest of the message,
 * and anything worse is an injection into whatever renders the mail.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

/**
 * Returns false rather than throwing. Callers are expected to carry on.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Expected in local development and in any environment that has not been
    // given a key. Not an error — the caller's primary work already succeeded.
    logger.warn('RESEND_API_KEY not set — skipping email', { subject: input.subject });
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from || DEFAULT_FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        // So hitting reply in the inbox reaches the person who wrote in,
        // rather than the no-reply address the mail was sent from.
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error('Resend send failed', {
        status: response.status,
        detail: detail.slice(0, 300),
        subject: input.subject,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Resend request threw', {
      error: error instanceof Error ? error.message : String(error),
      subject: input.subject,
    });
    return false;
  }
}
