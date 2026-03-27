import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { upsertPackage } from '@/lib/services/admin-analytics';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: 'Package name is required.' }, { status: 400 });
  }

  const { success, error } = await upsertPackage(auth.userId, {
    name: body.name,
    description: body.description,
    items: body.items ?? [],
    discount_pct: body.discount_pct ?? 0,
    total_usd: body.total_usd,
    is_active: body.is_active ?? true,
    supplier_id: body.supplier_id ?? null,
  });

  if (!success) {
    return NextResponse.json({ error: error ?? 'Failed to create package.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
