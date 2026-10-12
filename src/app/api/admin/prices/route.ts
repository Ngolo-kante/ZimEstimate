import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { materials } from '@/lib/materials';
import { MANUAL_PRICE_SOURCE } from '@/lib/pricing/publishedPrice';
import { logAuditEvent } from '@/lib/services/audit';

const columns = 'id, material_key, price_usd, price_zwg, unit, source_name, supplier_name, scraped_at, review_status';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createServiceRoleClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [manual, scraped] = await Promise.all([
      db.from('price_observations').select(columns)
        .eq('source_name', MANUAL_PRICE_SOURCE).eq('review_status', 'confirmed')
        .order('scraped_at', { ascending: false }).limit(1000),
      db.from('price_observations').select(columns)
        .in('review_status', ['auto', 'confirmed'])
        .gte('scraped_at', since).order('scraped_at', { ascending: false }).limit(1000),
    ]);
    if (manual.error || scraped.error) throw manual.error ?? scraped.error;
    return NextResponse.json({ observations: [...(manual.data ?? []), ...(scraped.data ?? [])] });
  } catch {
    return NextResponse.json({ error: 'Could not load published prices.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'admin-prices', limit: 60, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const material = materials.find((item) => item.id === body?.materialKey);
  if (!material || !['publish', 'withdraw'].includes(body?.action)) {
    return NextResponse.json({ error: 'Choose a catalog material and a valid action.' }, { status: 400 });
  }

  let usd: number | null = null;
  let zwg: number | null = null;
  if (body.action === 'publish') {
    usd = Number(body.priceUsd);
    zwg = body.priceZwg === '' || body.priceZwg === null || body.priceZwg === undefined
      ? null : Number(body.priceZwg);
    if (!Number.isFinite(usd) || usd <= 0 || usd > 1_000_000_000 ||
        (zwg !== null && (!Number.isFinite(zwg) || zwg < 0 || zwg > 1_000_000_000))) {
      return NextResponse.json({ error: 'Enter a positive USD price and a valid optional ZWG price.' }, { status: 400 });
    }
  }

  try {
    const db = createServiceRoleClient();
    if (body.action === 'publish') {
      const { error } = await db.from('price_observations').insert({
        material_key: material.id,
        material_name: material.name,
        unit: material.unit,
        price_original: usd,
        currency: 'USD',
        price_usd: usd,
        price_zwg: zwg,
        source_name: MANUAL_PRICE_SOURCE,
        supplier_name: 'ZimEstimate editorial price',
        confidence: 5,
        review_status: 'confirmed',
        scraped_at: new Date().toISOString(),
        observed_at: new Date().toISOString().slice(0, 10),
      } as never);
      if (error) throw error;
    } else {
      const { error } = await db.from('price_observations')
        .update({ review_status: 'rejected' } as never)
        .eq('material_key', material.id).eq('source_name', MANUAL_PRICE_SOURCE)
        .eq('review_status', 'confirmed');
      if (error) throw error;
    }
    await logAuditEvent({ userId: auth.userId, action: `price.${body.action}`, resourceType: 'material',
      metadata: { materialKey: material.id, ...(body.action === 'publish' ? { priceUsd: usd, priceZwg: zwg } : {}) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'The price was not saved. Please try again.' }, { status: 500 });
  }
}
