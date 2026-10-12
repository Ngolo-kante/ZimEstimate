// ─── Site photos on a quick estimate ──────────────────────────────────────────
// GET  /api/quick-estimates/:id/photos            → photos with short-lived links
// POST /api/quick-estimates/:id/photos (form)     → upload one (file, caption?, stepId?)
//
// The quick-estimate twin of /api/projects/:id/photos. Access is checked with
// quick_site_access, run as the caller: the owner and anyone invited can see
// the photos; the owner and invitees with "edit" can add them. Same private
// bucket, under quick/<id>/, served by links that expire after an hour.

import { NextResponse, after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';
import { estimateName } from '@/lib/quick-projects/savedEstimate';

const BUCKET = 'project-progress';
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
const MAX_BYTES = 10 * 1024 * 1024;

async function caller(request: Request, quickId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createServerClient(token);
  const { data: user } = await client.auth.getUser();
  if (!user?.user) return null;
  const { data: access } = await client.rpc('quick_site_access' as never, { p_quick_boq_id: quickId } as never);
  return { userId: user.user.id, access: (access as string | null) ?? null };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: quickId } = await params;
  const who = await caller(request, quickId);
  if (!who?.access) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 });

  const db = createServiceRoleClient();
  const { data } = await db
    .from('quick_boq_photos')
    .select('id, storage_path, caption, step_id, created_at, uploaded_by, profiles:uploaded_by(full_name)')
    .eq('quick_boq_id', quickId)
    .order('created_at', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as unknown as {
    id: string; storage_path: string; caption: string | null; step_id: string | null; created_at: string;
    uploaded_by: string | null; profiles: { full_name: string | null } | null;
  }[];
  const { data: signed } = rows.length
    ? await db.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600)
    : { data: [] as { signedUrl: string | null; path: string | null }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return NextResponse.json({
    canUpload: who.access === 'owner' || who.access === 'edit',
    photos: rows.map((r) => ({
      id: r.id,
      url: urlByPath.get(r.storage_path) ?? null,
      caption: r.caption,
      stageId: r.step_id,
      createdAt: r.created_at,
      uploadedBy: r.profiles?.full_name?.trim() || 'Someone',
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'quick-photo', limit: 20, windowMs: 10 * 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  const { id: quickId } = await params;
  const who = await caller(request, quickId);
  if (!who?.access) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 });
  if (who.access !== 'owner' && who.access !== 'edit') {
    return NextResponse.json({ error: 'You can follow this job but not add photos to it.' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a photo.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is over 10MB.' }, { status: 400 });
  const caption = typeof form?.get('caption') === 'string' ? String(form.get('caption')).trim().slice(0, 300) : '';
  const rawStep = form?.get('stageId');
  const stepId = typeof rawStep === 'string' && /^[a-z0-9_]{1,40}$/.test(rawStep) ? rawStep : null;

  const db = createServiceRoleClient();
  const { data: estimate } = await db.from('quick_boqs').select('user_id, project_type, answers').eq('id', quickId).single();
  const quick = estimate as { user_id: string | null; project_type: string; answers: Record<string, unknown> } | null;
  if (!quick) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 });

  // A step id that is not one of this estimate's steps is dropped, not trusted.
  let step: { id: string; title: string } | null = null;
  if (stepId) {
    const { data: steps } = await db.rpc('quick_job_steps' as never, { p_quick_boq_id: quickId } as never);
    step = ((steps as { id: string; title: string }[] | null) ?? []).find((s) => s.id === stepId) ?? null;
  }

  const path = `quick/${quickId}/${new Date().toISOString().slice(0, 10)}_${randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('Quick estimate photo upload failed', uploadError.message);
    return NextResponse.json({ error: 'Could not upload the photo. Please try again.' }, { status: 500 });
  }

  const { data: photo, error } = await db
    .from('quick_boq_photos')
    .insert({ quick_boq_id: quickId, step_id: step?.id ?? null, uploaded_by: who.userId, storage_path: path, caption: caption || null } as never)
    .select('id')
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: 'Could not save the photo. Please try again.' }, { status: 500 });
  }

  if (who.access !== 'owner' && quick.user_id) {
    const { data: uploader } = await db.from('profiles').select('full_name').eq('id', who.userId).single();
    const by = (uploader as { full_name: string | null } | null)?.full_name?.trim() || 'Your builder';
    const name = estimateName(quick.project_type, quick.answers);
    await db.from('project_notifications').insert({
      quick_boq_id: quickId,
      user_id: quick.user_id,
      type: 'site_photo',
      title: `New site photo on ${name}`,
      message: `${by} added a photo${step ? ` for "${step.title}"` : ''}${caption ? `: "${caption}"` : '.'}`,
    } as never);
    after(async () => {
      try { await dispatchQueuedNotifications({ limit: 25 }); } catch (e) { console.error('Dispatch after quick photo failed', e); }
    });
  }

  return NextResponse.json({ id: (photo as { id: string }).id });
}
