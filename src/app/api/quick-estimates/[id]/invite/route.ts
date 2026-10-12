// ─── Invite someone to a quick estimate ───────────────────────────────────────
// POST /api/quick-estimates/:id/invite  { email, accessLevel: 'view' | 'edit' }
//
// The quick-estimate twin of /api/projects/:id/invite: a borehole driller or
// solar installer reports progress the same way a builder does on a house.
// On the server for the same reason — only it can see whether the email
// already has an account.
//
// - Invitee has an account: linked now, told in the app and by email.
// - No account yet: the share waits under the email and they are emailed a
//   sign-up link; link_my_project_invites() attaches it once they confirm
//   that address (migration 061).

import { NextResponse, after } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { sendEmail, escapeHtml } from '@/lib/server/email';
import { getSiteUrl } from '@/lib/siteUrl';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';
import { estimateName } from '@/lib/quick-projects/savedEstimate';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'quick-invite', limit: 20, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: quickId } = await params;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const accessLevel = body?.accessLevel === 'view' ? 'view' : 'edit';
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: estimate } = await db.from('quick_boqs').select('id, user_id, project_type, answers').eq('id', quickId).maybeSingle();
  const quick = estimate as { id: string; user_id: string | null; project_type: string; answers: Record<string, unknown> } | null;
  // Only the owner invites. "Not found" either way, so ids are not revealed.
  if (!quick || quick.user_id !== auth.userId) {
    return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 });
  }
  const name = estimateName(quick.project_type, quick.answers);

  const [{ data: owner }, { data: invitee }] = await Promise.all([
    db.from('profiles').select('full_name, email').eq('id', auth.userId).single(),
    db.from('profiles').select('id').ilike('email', email.replace(/[\\%_]/g, (c: string) => `\\${c}`)).maybeSingle(),
  ]);
  const ownerProfile = owner as { full_name: string | null; email: string | null } | null;
  if (ownerProfile?.email?.toLowerCase() === email) {
    return NextResponse.json({ error: 'That is your own email — this estimate is already yours.' }, { status: 400 });
  }
  const inviteeId = (invitee as { id: string } | null)?.id ?? null;

  const { data: existing } = await db
    .from('quick_boq_shares').select('id').eq('quick_boq_id', quickId).eq('shared_with_email', email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'This person has already been invited. Change their access in the list instead.' }, { status: 409 });
  }

  const { data: share, error: shareError } = await db
    .from('quick_boq_shares')
    .insert({
      quick_boq_id: quickId,
      shared_with_email: email,
      shared_with_user_id: inviteeId,
      access_level: accessLevel,
      invited_by: auth.userId,
      accepted_at: inviteeId ? new Date().toISOString() : null,
    } as never)
    .select()
    .single();
  if (shareError || !share) {
    console.error('Quick estimate invite failed', shareError?.message);
    return NextResponse.json({ error: 'Could not send the invitation. Please try again.' }, { status: 500 });
  }

  const inviter = ownerProfile?.full_name?.trim() || ownerProfile?.email || 'A ZimEstimate user';
  const what = accessLevel === 'edit' ? 'report progress on' : 'follow progress on';
  const path = `/projects/quick/${quickId}`;
  let emailed = false;

  if (inviteeId) {
    await db.from('project_notifications').insert({
      quick_boq_id: quickId,
      user_id: inviteeId,
      type: 'project_shared',
      title: `${inviter} shared “${name}” with you`,
      message: `You can now ${what} ${name}. Find it under Projects.`,
    } as never);
    after(async () => {
      try { await dispatchQueuedNotifications({ limit: 25 }); } catch (error) { console.error('Dispatch after quick invite failed', error); }
    });
    emailed = true;
  } else {
    const signUpUrl = `${getSiteUrl()}/auth/login?redirect=${encodeURIComponent(path)}`;
    emailed = await sendEmail({
      to: email,
      subject: `${inviter} invited you to “${name}” on ZimEstimate`,
      html: `<p>${escapeHtml(inviter)} invited you to ${what} <strong>${escapeHtml(name)}</strong> on ZimEstimate.</p>
<p><a href="${escapeHtml(signUpUrl)}" style="display:inline-block;padding:10px 16px;background:#0b1f3b;color:#fff;border-radius:6px;text-decoration:none">Open the job</a></p>
<p>Sign in or create a free account with <strong>${escapeHtml(email)}</strong> — it appears once that address is confirmed.</p>`,
      text: `${inviter} invited you to ${what} "${name}" on ZimEstimate.\n\nOpen it: ${signUpUrl}\n\nSign in or create a free account with ${email}; it appears once that address is confirmed.`,
    });
  }

  return NextResponse.json({ share, linked: Boolean(inviteeId), emailed, url: `${getSiteUrl()}${path}` });
}
