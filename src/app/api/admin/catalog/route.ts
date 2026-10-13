// ─── Admin catalog edits ──────────────────────────────────────────────────────
// POST /api/admin/catalog  { action, ... }
//
//   save     { materialKey?, name, description, category, subcategory, unit? }
//            Edits a built-in material (not its unit) or a product added here;
//            with no materialKey, adds a new product (unit required).
//   hide     { materialKey }   kept, but off public lists and pickers
//   show     { materialKey }
//   reset    { materialKey }   built-in: back to the original; added: removed
//
// Writes material_catalog (migration 063) with the service role; each change
// is audit-logged. Reads are public, through lib/catalog.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { createServiceRoleClient } from '@/lib/supabase';
import { categoryInfo, materials, type MaterialCategory } from '@/lib/materials';
import { keyForNewProduct } from '@/lib/catalog/mergeCatalog';
import { loadServerCatalog } from '@/lib/catalog/serverCatalog';
import { logAuditEvent } from '@/lib/services/audit';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export async function POST(request: Request) {
  const rateLimit = await enforceRateLimit(request, { keyPrefix: 'admin-catalog', limit: 60, windowMs: 60_000 });
  if (rateLimit) return rateLimit;
  const csrf = enforceCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  const db = createServiceRoleClient();
  const { all } = await loadServerCatalog(db);
  const builtIn = new Set(materials.map((m) => m.id));
  const now = new Date().toISOString();
  const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

  try {
    if (action === 'save') {
      const name = clean(body.name, 120);
      const description = clean(body.description, 500);
      const subcategory = clean(body.subcategory, 80);
      const category = body.category as MaterialCategory;
      if (name.length < 2) return fail('Give the product a name.');
      if (!(category in categoryInfo)) return fail('Choose a category.');

      let key = typeof body.materialKey === 'string' ? body.materialKey : '';
      const isNew = !key;
      if (isNew) {
        const unit = clean(body.unit, 40);
        if (!unit) return fail('Say how it is sold, e.g. "per bag" or "each".');
        key = keyForNewProduct(name);
        if (all.some((m) => m.id === key)) return fail('A product with that name already exists.', 409);
        const { error } = await db.from('material_catalog').insert({
          material_key: key, name, description: description || null, category, subcategory: subcategory || null,
          unit, is_custom: true, updated_by: auth.userId, updated_at: now,
        } as never);
        if (error) throw error;
      } else {
        const existing = all.find((m) => m.id === key);
        if (!existing) return fail('That material is not in the catalog.', 404);
        const { error } = await db.from('material_catalog').upsert({
          material_key: key,
          name,
          // '' clears a built-in description; NULL would keep the built-in one.
          description,
          category,
          subcategory: subcategory || null,
          // A built-in material's unit stays as estimates use it; an added
          // product's can be corrected.
          ...(builtIn.has(key) ? {} : { unit: clean(body.unit, 40) || existing.unit, is_custom: true }),
          updated_by: auth.userId,
          updated_at: now,
        } as never, { onConflict: 'material_key' });
        if (error) throw error;
      }
      await logAuditEvent({ userId: auth.userId, action: isNew ? 'catalog.add' : 'catalog.edit', resourceType: 'material', resourceId: key, metadata: { name, category } });
      return NextResponse.json({ success: true, materialKey: key });
    }

    const key = typeof body?.materialKey === 'string' ? body.materialKey : null;

    if (action === 'hide' || action === 'show') {
      if (!key || !all.some((m) => m.id === key)) return fail('That material is not in the catalog.', 404);
      const { error } = await db.from('material_catalog').upsert({
        material_key: key, is_hidden: action === 'hide',
        updated_by: auth.userId, updated_at: now,
      } as never, { onConflict: 'material_key' });
      if (error) throw error;
      await logAuditEvent({ userId: auth.userId, action: `catalog.${action}`, resourceType: 'material', resourceId: key });
      return NextResponse.json({ success: true });
    }

    if (action === 'reset') {
      if (!key) return fail('Choose a material.');
      // Built-in: drop the edits. Added:
      // the product is removed; its price history stays in the price table.
      const { error } = await db.from('material_catalog').delete().eq('material_key', key);
      if (error) throw error;
      await logAuditEvent({ userId: auth.userId, action: builtIn.has(key) ? 'catalog.reset' : 'catalog.remove', resourceType: 'material', resourceId: key });
      return NextResponse.json({ success: true });
    }

    return fail('Unknown action.');
  } catch (error) {
    console.error('Admin catalog change failed', error);
    return NextResponse.json({ error: 'The change was not saved. Please try again.' }, { status: 500 });
  }
}
