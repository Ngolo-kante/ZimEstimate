// The merged catalog for server routes (service-role client).

import type { SupabaseClient } from '@supabase/supabase-js';
import { materials, type Material } from '@/lib/materials';
import { CATALOG_COLUMNS, mergeCatalog, type CatalogRow } from './mergeCatalog';

export async function loadServerCatalog(db: SupabaseClient): Promise<{ all: Material[]; rows: CatalogRow[] }> {
  const { data, error } = await db.from('material_catalog').select(CATALOG_COLUMNS);
  const rows = error ? [] : ((data ?? []) as CatalogRow[]);
  return { all: mergeCatalog(materials, rows), rows };
}
