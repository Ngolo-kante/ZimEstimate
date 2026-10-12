// ─── Admin prices ─────────────────────────────────────────────────────────────
// GET  /api/admin/prices                     published-price candidates + catalog edits
// GET  /api/admin/prices?history=<key>       every price recorded for one material
// POST /api/admin/prices  { action: 'publish' | 'withdraw', materialKey, priceUsd?, priceZwg? }
// POST /api/admin/prices  { action: 'bulk', rows: [{ materialKey, priceUsd, priceZwg? }] }
//
// A published price is a confirmed "Admin manual price" row in
// price_observations; it wins over scrapes until withdrawn (rule in
// lib/pricing/publishedPrice.ts). Works for built-in materials and products
// added in the catalog editor. Every publish and withdraw is audit-logged.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { MANUAL_PRICE_SOURCE } from '@/lib/pricing/publishedPrice';
import { loadServerCatalog } from '@/lib/catalog/serverCatalog';
import { logAuditEvent } from '@/lib/services/audit';
import type { Material } from '@/lib/materials';

const columns = 'id, material_key, price_usd, price_zwg, unit, source_name, supplier_name, scraped_at, review_status';
const MAX = 1_000_000_000;

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createServiceRoleClient();
    const history = new URL(request.url).searchParams.get('history');
    if (history) {
      const { data, error } = await db.from('price_observations')
        .select(`${columns}, location`)
        .eq('material_key', history)
        .order('scraped_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return NextResponse.json({ history: data ?? [] });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [manual, scraped, catalog] = await Promise.all([
      db.from('price_observations').select(columns)
        .eq('source_name', MANUAL_PRICE_SOURCE).eq('review_status', 'confirmed')
        .order('scraped_at', { ascending: false }).limit(2000),
      db.from('price_observations').select(columns)
        .in('review_status', ['auto', 'confirmed'])
        .gte('scraped_at', since).order('scraped_at', { ascending: false }).limit(2000),
      loadServerCatalog(db),
    ]);
    if (manual.error || scraped.error) throw manual.error ?? scraped.error;
    return NextResponse.json({ observations: [...(manual.data ?? []), ...(scraped.data ?? [])], catalogRows: catalog.rows });
  } catch {
    return NextResponse.json({ error: 'Could not load published prices.' }, { status: 500 });
  }
}

/** A price as entered: a positive USD amount and an optional ZWG one. */
function parsePrice(usdRaw: unknown, zwgRaw: unknown): { usd: number; zwg: number | null } | null {
  const usd = Number(typeof usdRaw === 'string' ? usdRaw.replace(/[$,\s]/g, '') : usdRaw);
  const zwgText = typeof zwgRaw === 'string' ? zwgRaw.replace(/[,\s]/g, '') : zwgRaw;
  const zwg = zwgText === '' || zwgText === null || zwgText === undefined ? null : Number(zwgText);
  if (!Number.isFinite(usd) || usd <= 0 || usd > MAX) return null;
  if (zwg !== null && (!Number.isFinite(zwg) || zwg < 0 || zwg > MAX)) return null;
  return { usd, zwg };
}

const manualRow = (material: Material, usd: number, zwg: number | null) => {
  const now = new Date().toISOString();
  return {
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
    scraped_at: now,
    observed_at: now.slice(0, 10),
  };
};

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'admin-prices', limit: 60, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const db = createServiceRoleClient();
  const { all } = await loadServerCatalog(db);
  const byKey = new Map(all.map((m) => [m.id, m]));

  try {
    if (body?.action === 'bulk') {
      const input = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]).slice(0, 500) : [];
      if (input.length === 0) return NextResponse.json({ error: 'There are no prices to publish.' }, { status: 400 });
      const results = input.map((row, index) => {
        const material = byKey.get(String(row.materialKey ?? '').trim());
        const price = parsePrice(row.priceUsd, row.priceZwg);
        if (!material) return { index, ok: false as const, error: 'Unknown material code' };
        if (!price) return { index, ok: false as const, error: 'Price must be a positive number' };
        return { index, ok: true as const, material, price };
      });
      const good = results.filter((r) => r.ok);
      if (good.length > 0) {
        const { error } = await db.from('price_observations').insert(good.map((r) => manualRow(r.material, r.price.usd, r.price.zwg)) as never);
        if (error) throw error;
        await logAuditEvent({ userId: auth.userId, action: 'price.bulk_publish', resourceType: 'material',
          metadata: { count: good.length, materialKeys: good.map((r) => r.material.id) } });
      }
      return NextResponse.json({
        published: good.length,
        failed: results.filter((r) => !r.ok).map((r) => ({ index: r.index, error: 'error' in r ? r.error : '' })),
      });
    }

    const material = byKey.get(body?.materialKey);
    if (!material || !['publish', 'withdraw'].includes(body?.action)) {
      return NextResponse.json({ error: 'Choose a catalog material and a valid action.' }, { status: 400 });
    }

    let price: { usd: number; zwg: number | null } | null = null;
    if (body.action === 'publish') {
      price = parsePrice(body.priceUsd, body.priceZwg);
      if (!price) return NextResponse.json({ error: 'Enter a positive USD price and a valid optional ZWG price.' }, { status: 400 });
      const { error } = await db.from('price_observations').insert(manualRow(material, price.usd, price.zwg) as never);
      if (error) throw error;
    } else {
      const { error } = await db.from('price_observations')
        .update({ review_status: 'rejected' } as never)
        .eq('material_key', material.id).eq('source_name', MANUAL_PRICE_SOURCE)
        .eq('review_status', 'confirmed');
      if (error) throw error;
    }
    await logAuditEvent({ userId: auth.userId, action: `price.${body.action}`, resourceType: 'material', resourceId: material.id,
      metadata: { materialKey: material.id, ...(price ? { priceUsd: price.usd, priceZwg: price.zwg } : {}) } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'The price was not saved. Please try again.' }, { status: 500 });
  }
}
