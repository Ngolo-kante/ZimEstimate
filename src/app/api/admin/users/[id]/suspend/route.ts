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
  const body = await request.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  const { success, error } = await suspendUser(userId, auth.userId, reason);

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to suspend user.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
