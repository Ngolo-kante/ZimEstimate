import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { reactivateUser } from '@/lib/services/admin-analytics';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: userId } = await params;

  const { success, error } = await reactivateUser(userId, auth.userId);

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to reactivate user.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
