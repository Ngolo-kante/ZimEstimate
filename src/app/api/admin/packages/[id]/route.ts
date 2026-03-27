import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { upsertPackage } from '@/lib/services/admin-analytics';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Request body is required.' }, { status: 400 });
  }

  const { success, error } = await upsertPackage(auth.userId, {
    id,
    name: body.name,
    description: body.description,
    items: body.items ?? [],
    discount_pct: body.discount_pct ?? 0,
    total_usd: body.total_usd,
    is_active: body.is_active ?? true,
    supplier_id: body.supplier_id ?? null,
  });

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to update package.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
