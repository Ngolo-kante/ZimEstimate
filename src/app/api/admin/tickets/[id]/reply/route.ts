import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { addTicketReply } from '@/lib/services/admin-analytics';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: ticketId } = await params;
  const body = await request.json().catch(() => ({}));
  const body_text = body.body as string;
  const is_internal = body.is_internal === true;

  if (!body_text?.trim()) {
    return NextResponse.json({ error: 'Reply body is required.' }, { status: 400 });
  }

  const { success, error } = await addTicketReply(ticketId, auth.userId, body_text.trim(), is_internal);

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to add reply.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
