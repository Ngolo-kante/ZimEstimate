// ─── Site progress photos ─────────────────────────────────────────────────────
// GET  /api/projects/:id/photos            → photos with short-lived links
// POST /api/projects/:id/photos (form)     → upload one (file, caption?, stageId?)
//
// Through the server because invitees have no direct access to project
// tables (migration 058): access is checked here with site_access, run as
// the caller. The owner and anyone invited can see the photos; the owner
// and invitees with "edit" can add them. The bucket is private, so photos
// are served by signed links that expire after an hour.

import { NextResponse, after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { dispatchQueuedNotifications } from '@/lib/server/notificationDispatch';

const BUCKET = 'project-progress';
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
const MAX_BYTES = 10 * 1024 * 1024;

async function caller(request: Request, projectId: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createServerClient(token);
  const { data: user } = await client.auth.getUser();
  if (!user?.user) return null;
  const { data: profile, error: profileError } = await client
    .from('profiles').select('is_suspended').eq('id', user.user.id).single();
  if (profileError || !profile || (profile as { is_suspended: boolean }).is_suspended) return null;
  const { data: access } = await client.rpc('site_access' as never, { p_project_id: projectId } as never);
  return { userId: user.user.id, access: (access as string | null) ?? null };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const who = await caller(request, projectId);
  if (!who?.access) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

  const db = createServiceRoleClient();
  const { data } = await db
    .from('project_progress_photos')
    .select('id, storage_path, caption, stage_id, created_at, uploaded_by, profiles:uploaded_by(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as unknown as {
    id: string; storage_path: string; caption: string | null; stage_id: string | null; created_at: string;
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
      stageId: r.stage_id,
      createdAt: r.created_at,
      uploadedBy: r.profiles?.full_name?.trim() || 'Someone',
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'progress-photo', limit: 20, windowMs: 10 * 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  const { id: projectId } = await params;
  const who = await caller(request, projectId);
  if (!who?.access) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  if (who.access !== 'owner' && who.access !== 'edit') {
    return NextResponse.json({ error: 'You can follow this project but not add photos to it.' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a photo.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is over 10MB.' }, { status: 400 });
  const caption = typeof form?.get('caption') === 'string' ? String(form.get('caption')).trim().slice(0, 300) : '';
  const stageId = typeof form?.get('stageId') === 'string' && /^[0-9a-f-]{36}$/i.test(String(form.get('stageId'))) ? String(form.get('stageId')) : null;

  const db = createServiceRoleClient();
  const path = `${projectId}/${new Date().toISOString().slice(0, 10)}_${randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('Progress photo upload failed', uploadError.message);
    return NextResponse.json({ error: 'Could not upload the photo. Please try again.' }, { status: 500 });
  }

  // A stage id from another project is dropped rather than trusted.
  let stage: { id: string; name: string } | null = null;
  if (stageId) {
    const { data } = await db.from('project_stages').select('id, name').eq('id', stageId).eq('project_id', projectId).maybeSingle();
    stage = data as { id: string; name: string } | null;
  }

  const { data: photo, error } = await db
    .from('project_progress_photos')
    .insert({ project_id: projectId, stage_id: stage?.id ?? null, uploaded_by: who.userId, storage_path: path, caption: caption || null } as never)
    .select('id')
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: 'Could not save the photo. Please try again.' }, { status: 500 });
  }

  if (who.access !== 'owner') {
    const [{ data: project }, { data: uploader }] = await Promise.all([
      db.from('projects').select('owner_id, name').eq('id', projectId).single(),
      db.from('profiles').select('full_name').eq('id', who.userId).single(),
    ]);
    const owner = project as { owner_id: string; name: string } | null;
    const name = (uploader as { full_name: string | null } | null)?.full_name?.trim() || 'Your builder';
    if (owner) {
      await db.from('project_notifications').insert({
        project_id: projectId,
        user_id: owner.owner_id,
        type: 'site_photo',
        title: `New site photo on ${owner.name}`,
        message: `${name} added a photo${stage ? ` for ${stage.name}` : ''}${caption ? `: "${caption}"` : '.'}`,
      } as never);
      after(async () => {
        try { await dispatchQueuedNotifications({ limit: 25 }); } catch (e) { console.error('Dispatch after photo failed', e); }
      });
    }
  }

  return NextResponse.json({ id: (photo as { id: string }).id });
}
