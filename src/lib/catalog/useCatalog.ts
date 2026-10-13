'use client';

// The merged catalog (built-in materials + admin edits) for client pages.
// Loaded once per page load and shared; until it arrives, pages see the
// built-in catalog, so nothing waits on it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { materials } from '@/lib/materials';
import { CATALOG_COLUMNS, mergeCatalog, type CatalogRow } from './mergeCatalog';

let pending: Promise<CatalogRow[]> | null = null;

export function loadCatalogRows(force = false): Promise<CatalogRow[]> {
  if (!pending || force) {
    pending = Promise.resolve(supabase.from('material_catalog').select(CATALOG_COLUMNS))
      .then(({ data, error }) => (error ? [] : ((data ?? []) as CatalogRow[])))
      .catch(() => []);
  }
  return pending;
}

export function useCatalog() {
  const [rows, setRows] = useState<CatalogRow[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadCatalogRows().then((loaded) => { if (active) setRows(loaded); });
    return () => { active = false; };
  }, []);

  const reload = useCallback(async () => {
    setRows(await loadCatalogRows(true));
  }, []);

  const all = useMemo(() => mergeCatalog(materials, rows ?? []), [rows]);
  const visible = useMemo(() => all.filter((m) => !m.hidden), [all]);

  return { all, visible, rows: rows ?? [], loaded: rows !== null, reload };
}
