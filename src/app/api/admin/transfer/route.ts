// ─── Temporary admin file transfer (TM Data) ──────────────────────────────────
// TEMPORARY: to be removed once the owner's files are moved (2026-11-06).
//
// Files go from the admin's browser straight to the private `tm-transfer`
// storage bucket in pieces of at most 40 MB (Vercel caps a request at 4.5 MB,
// Supabase's free plan a file at 50 MB), then a manifest marks the file
// complete. scripts/tm-transfer-download.mjs on the owner's Mac joins the
// pieces into Documents/TM Data and deletes them from storage.
//
// POST { action: 'sign', id, part }                → signed upload URL for one piece
// POST { action: 'complete', id, name, size, parts } → writes the manifest
// GET                                                → files waiting to be collected

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';

const BUCKET = 'tm-transfer';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_PARTS = 10_000;

/** A relative path kept as folders on the Mac, with nothing that could climb out of TM Data. */
function safeRelativePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parts = value.replace(/\\/g, '/').split('/')
    .map((part) => part.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim())
    .filter((part) => part && part !== '.' && part !== '..');
  const joined = parts.join('/');
  return joined && joined.length <= 600 ? joined : null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const db = createServiceRoleClient();
  const { data, error } = await db.storage.from(BUCKET).list('manifests', { limit: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ waiting: (data ?? []).filter((file) => file.name.endsWith('.json')).length });
}

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'admin-transfer', limit: 600, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const db = createServiceRoleClient();
  const id = typeof body?.id === 'string' ? body.id.toLowerCase() : '';
  if (!ID.test(id)) return NextResponse.json({ error: 'Bad file id.' }, { status: 400 });

  if (body?.action === 'sign') {
    const part = Number(body.part);
    if (!Number.isInteger(part) || part < 0 || part >= MAX_PARTS) return NextResponse.json({ error: 'Bad part number.' }, { status: 400 });
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(`parts/${id}/${String(part).padStart(5, '0')}`, { upsert: true });
    if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare the upload.' }, { status: 500 });
    return NextResponse.json({ path: data.path, token: data.token });
  }

  if (body?.action === 'complete') {
    const name = safeRelativePath(body.name);
    const size = Number(body.size);
    const parts = Number(body.parts);
    if (!name || !Number.isFinite(size) || size < 0 || !Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) {
      return NextResponse.json({ error: 'Bad file details.' }, { status: 400 });
    }
    const manifest = JSON.stringify({ id, name, size, parts, uploadedBy: auth.userId, completedAt: new Date().toISOString() });
    const { error } = await db.storage.from(BUCKET).upload(`manifests/${id}.json`, new Blob([manifest], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
