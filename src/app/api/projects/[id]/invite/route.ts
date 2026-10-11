// ─── Invite someone to a project ──────────────────────────────────────────────
// POST /api/projects/:id/invite  { email, accessLevel: 'view' | 'edit' }
//
// On the server because the browser cannot see whether an email already has
// an account (profiles is readable only by its owner), which is why invites
// made from the browser were never linked to anyone (migration 055).
//
// - Invitee has an account: the share is linked now, they get an in-app
//   notification, and the email it queues is sent straight away.
// - No account yet: the share waits under the email, and they get an email
//   with a link to sign up. link_my_project_invites() attaches it once they
//   have confirmed that address.

import { NextResponse, after } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { sendEmail, escapeHtml } from '@/lib/server/email';
import { getSiteUrl } from '@/lib/siteUrl';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'project-invite', limit: 20, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const accessLevel = body?.accessLevel === 'edit' ? 'edit' : 'view';
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: project } = await db.from('projects').select('id, name, owner_id').eq('id', projectId).single();
  const proj = project as { id: string; name: string; owner_id: string } | null;
  // Only the owner shares. Answered as "not found" either way, so the route
  // does not reveal which project ids exist.
  if (!proj || proj.owner_id !== auth.userId) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const [{ data: owner }, { data: invitee }] = await Promise.all([
    db.from('profiles').select('full_name, email').eq('id', auth.userId).single(),
    // ilike for case; _ and % escaped so they match only themselves.
    db.from('profiles').select('id').ilike('email', email.replace(/[\\%_]/g, (c: string) => `\\${c}`)).maybeSingle(),
  ]);
  const ownerProfile = owner as { full_name: string | null; email: string | null } | null;
  if (ownerProfile?.email?.toLowerCase() === email) {
    return NextResponse.json({ error: 'That is your own email — you already own this project.' }, { status: 400 });
  }
  const inviteeId = (invitee as { id: string } | null)?.id ?? null;

  const { data: existing } = await db
    .from('project_shares').select('id').eq('project_id', projectId).eq('shared_with_email', email).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'This person has already been invited. Change their access in the list instead.' }, { status: 409 });
  }

  const { data: share, error: shareError } = await db
    .from('project_shares')
    .insert({
      project_id: projectId,
      shared_with_email: email,
      shared_with_user_id: inviteeId,
      access_level: accessLevel,
      invited_by: auth.userId,
      accepted_at: inviteeId ? new Date().toISOString() : null,
    } as never)
    .select()
    .single();
  if (shareError || !share) {
    console.error('Invite failed', shareError?.message);
    return NextResponse.json({ error: 'Could not send the invitation. Please try again.' }, { status: 500 });
  }

  const inviter = ownerProfile?.full_name?.trim() || ownerProfile?.email || 'A ZimEstimate user';
  const what = accessLevel === 'edit' ? 'report progress on' : 'follow progress on';
  const projectUrl = `${getSiteUrl()}/projects/${projectId}`;
  let emailed = false;

  if (inviteeId) {
    // The notification's trigger queues the email (if they allow email);
    // it is sent below, after the response, rather than on tomorrow's sweep.
    await db.from('project_notifications').insert({
      project_id: projectId,
      user_id: inviteeId,
      type: 'project_shared',
      title: `${inviter} shared “${proj.name}” with you`,
      message: `You can now ${what} ${proj.name}. Find it under Projects.`,
    } as never);
    after(async () => {
      try { await dispatchQueuedNotifications({ limit: 25 }); } catch (error) { console.error('Dispatch after invite failed', error); }
    });
    emailed = true;
  } else {
    const signUpUrl = `${getSiteUrl()}/auth/login?redirect=${encodeURIComponent(`/projects/${projectId}`)}`;
    emailed = await sendEmail({
      to: email,
      subject: `${inviter} invited you to “${proj.name}” on ZimEstimate`,
      html: `<p>${escapeHtml(inviter)} invited you to ${what} the project <strong>${escapeHtml(proj.name)}</strong> on ZimEstimate.</p>
<p><a href="${escapeHtml(signUpUrl)}" style="display:inline-block;padding:10px 16px;background:#0b1f3b;color:#fff;border-radius:6px;text-decoration:none">Open the project</a></p>
<p>Sign in or create a free account with <strong>${escapeHtml(email)}</strong> — the project appears once that address is confirmed.</p>`,
      text: `${inviter} invited you to ${what} the project "${proj.name}" on ZimEstimate.\n\nOpen it: ${signUpUrl}\n\nSign in or create a free account with ${email}; the project appears once that address is confirmed.`,
    });
  }

  return NextResponse.json({ share, linked: Boolean(inviteeId), emailed, projectUrl });
}
