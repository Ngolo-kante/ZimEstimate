// ─── What each listed user has done ───────────────────────────────────────────
// POST /api/admin/users/activity  { ids: string[] }  (one page of the Users tab)
//
// The Users tab lists profiles from the browser, which can see neither when
// someone last signed in (auth.users) nor how much work they have saved
// (other people's projects are closed to everyone but their owner). This
// returns both for the people on screen, and nothing else.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { createServiceRoleClient } from '@/lib/supabase';

const UUID = /^[0-9a-f-]{36}$/i;

export type UserActivity = {
  projects: number;
  quickEstimates: number;
  lastSignInAt: string | null;
  lastWorkAt: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]).filter((id): id is string => typeof id === 'string' && UUID.test(id)).slice(0, 100) : [];
  if (ids.length === 0) return NextResponse.json({ activity: {} });

  try {
    const db = createServiceRoleClient();
    const [projects, quick, ...users] = await Promise.all([
      db.from('projects').select('owner_id, updated_at').in('owner_id', ids),
      db.from('quick_boqs').select('user_id, updated_at').in('user_id', ids),
      ...ids.map((id) => db.auth.admin.getUserById(id)),
    ]);

    const activity: Record<string, UserActivity> = Object.fromEntries(
      ids.map((id, index) => [id, {
        projects: 0,
        quickEstimates: 0,
        lastSignInAt: users[index]?.data?.user?.last_sign_in_at ?? null,
        lastWorkAt: null,
      }]),
    );
    const touch = (entry: UserActivity, at: string | null) => {
      if (at && (!entry.lastWorkAt || at > entry.lastWorkAt)) entry.lastWorkAt = at;
    };
    for (const row of (projects.data ?? []) as { owner_id: string; updated_at: string | null }[]) {
      const entry = activity[row.owner_id];
      if (entry) { entry.projects += 1; touch(entry, row.updated_at); }
    }
    for (const row of (quick.data ?? []) as { user_id: string | null; updated_at: string | null }[]) {
      const entry = row.user_id ? activity[row.user_id] : undefined;
      if (entry) { entry.quickEstimates += 1; touch(entry, row.updated_at); }
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Admin user activity failed', error);
    return NextResponse.json({ error: 'Could not load user activity.' }, { status: 500 });
  }
}
