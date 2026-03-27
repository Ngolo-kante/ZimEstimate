import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { updateTicketStatus } from '@/lib/services/admin-analytics';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id: ticketId } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as string;

  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
  }

  const { success, error } = await updateTicketStatus(ticketId, status);

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to update ticket.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
