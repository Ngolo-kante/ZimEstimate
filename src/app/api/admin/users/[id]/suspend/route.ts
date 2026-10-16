import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { suspendUser } from '@/lib/services/admin-analytics';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: userId } = await params;
  if (userId === auth.userId) {
    return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : undefined;

  const { success, error } = await suspendUser(userId, auth.userId, reason);

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to suspend user.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
