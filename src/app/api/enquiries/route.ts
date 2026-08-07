import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { enforceCsrf, enforceRateLimit, sanitizeText } from '@/lib/server/security';
import { logger } from '@/lib/logger';

/**
 * Public enquiry intake for a contractor or a supplier.
 *
 * Inserts with the service role rather than exposing a public INSERT policy on
 * contact_requests — the same reasoning as /api/support: that table is read by
 * two other parties, and a direct policy would make it writable by anyone
 * holding the anon key with no way to rate-limit. Everything arriving here is
 * untrusted, so it is length-capped and stripped of control characters before
 * it reaches the database.
 *
 * The enquiry is also queued into notification_deliveries so the recipient is
 * actually told about it. That queue is drained by the notifications
 * dispatcher, which means an enquiry reaches a contractor by email without this
 * route having to send anything itself — and without a slow mail call sitting
 * between the sender and their confirmation.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  // Runs before validation so a script cannot probe the endpoint cheaply. A
  // rejected submission therefore costs an attempt, so the ceiling leaves room
  // for someone fixing a typo: generous for a person, useless for a spammer.
  const limited = enforceRateLimit(request, {
    keyPrefix: 'enquiry-intake',
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  const contractorId = sanitizeText(payload.contractorId, { maxLength: 64 });
  const supplierId = sanitizeText(payload.supplierId, { maxLength: 64 });
  const message = sanitizeText(payload.message, { maxLength: 3000 });
  const senderName = sanitizeText(payload.name, { maxLength: 120 });
  const senderEmail = sanitizeText(payload.email, { maxLength: 200 }).toLowerCase();
  const senderPhone = sanitizeText(payload.phone, { maxLength: 40 });

  // Mirrors contact_requests_exactly_one_recipient rather than trusting the
  // caller to send one or the other.
  if (Boolean(contractorId) === Boolean(supplierId)) {
    return NextResponse.json(
      { error: 'Send this to exactly one contractor or supplier.' },
      { status: 400 }
    );
  }

  if (message.length < 10) {
    return NextResponse.json(
      { error: 'Add a few more details so they can give you a useful answer.' },
      { status: 400 }
    );
  }

  // Reachability, checked here so the sender gets a sentence rather than a
  // constraint violation. An email or a phone number will do — plenty of
  // people in this market would rather be called back.
  const hasEmail = EMAIL_PATTERN.test(senderEmail);
  if (!hasEmail && !senderPhone) {
    return NextResponse.json(
      { error: 'Leave an email address or a phone number so they can reply.' },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  // Attach the account when the request carries a valid session, so the
  // enquiry shows up in the sender's own history. A bad or absent token is not
  // an error — it just means the enquiry is anonymous.
  let builderId: string | null = null;
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken);
    builderId = data.user?.id ?? null;
  }

  // Look up who this is for, both to reject a bad id before writing and to
  // learn the account to notify. An unclaimed listing has no user_id — the
  // enquiry is still recorded, it just cannot be emailed to anybody yet.
  let recipientUserId: string | null = null;
  let recipientName = 'your listing';

  if (contractorId) {
    const { data } = await supabase
      .from('contractors')
      .select('user_id, company_name')
      .eq('id', contractorId)
      .maybeSingle();
    const row = data as { user_id?: string | null; company_name?: string | null } | null;
    if (!row) {
      return NextResponse.json({ error: 'That contractor no longer exists.' }, { status: 404 });
    }
    recipientUserId = row.user_id ?? null;
    recipientName = row.company_name || recipientName;
  } else {
    const { data } = await supabase
      .from('suppliers')
      .select('user_id, name')
      .eq('id', supplierId)
      .maybeSingle();
    const row = data as { user_id?: string | null; name?: string | null } | null;
    if (!row) {
      return NextResponse.json({ error: 'That supplier no longer exists.' }, { status: 404 });
    }
    recipientUserId = row.user_id ?? null;
    recipientName = row.name || recipientName;
  }

  const { data: inserted, error } = await supabase
    .from('contact_requests')
    .insert({
      builder_id: builderId,
      contractor_id: contractorId || null,
      supplier_id: supplierId || null,
      message,
      builder_name: senderName || null,
      builder_email: hasEmail ? senderEmail : null,
      builder_phone: senderPhone || null,
      status: 'new',
    } as never)
    .select('id')
    .single();

  if (error) {
    logger.error('Enquiry insert failed', { error: error.message });
    return NextResponse.json(
      { error: 'Could not send your enquiry. Please try again.' },
      { status: 500 }
    );
  }

  const enquiryId = (inserted as { id: string } | null)?.id ?? null;

  // Queue rather than send. The dispatcher owns delivery, so this route stays
  // fast and an enquiry is never lost to a mail provider having a bad minute.
  if (recipientUserId) {
    const replyVia = [
      hasEmail ? senderEmail : null,
      senderPhone || null,
    ].filter(Boolean).join(' · ');

    const { error: queueError } = await supabase
      .from('notification_deliveries')
      .insert({
        user_id: recipientUserId,
        channel: 'email',
        template_key: 'rfq_received',
        status: 'queued',
        payload: {
          title: `New enquiry for ${recipientName}`,
          body: `${senderName || 'Someone'} sent you an enquiry through ZimEstimate.\n\n${message}\n\nReply to them on: ${replyVia}`,
          enquiry_id: enquiryId,
          contractor_id: contractorId || null,
          supplier_id: supplierId || null,
        },
      } as never);

    // A queued notification that fails to queue must not lose the enquiry —
    // it is already saved, and the recipient can still see it in their inbox.
    if (queueError) {
      logger.error('Enquiry notification queue failed', { error: queueError.message });
    }
  }

  return NextResponse.json({ success: true, id: enquiryId, notified: Boolean(recipientUserId) });
}
