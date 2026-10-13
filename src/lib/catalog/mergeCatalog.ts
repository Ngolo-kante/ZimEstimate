// ─── The catalog people see: built-in materials plus admin edits ─────────────
// The built-in catalog lives in code (lib/materials.ts). Admin changes live in
// the material_catalog table (migration 063) and are applied here, in one
// place, so the price list, marketplace, BOQ picker and admin pages cannot
// disagree about a material's name or whether it is shown.

import type { Material, MaterialCategory } from '@/lib/materials';

export type CatalogRow = {
  material_key: string;
  name: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  milestones: string[] | null;
  is_custom: boolean;
  is_hidden: boolean;
  featured_rank: number | null;
};

export const CATALOG_COLUMNS = 'material_key, name, description, category, subcategory, unit, milestones, is_custom, is_hidden, featured_rank';

/** Where a new product is offered in the BOQ, by category, unless the admin says otherwise. */
export const DEFAULT_MILESTONES: Record<MaterialCategory, string[]> = {
  bricks: ['substructure', 'superstructure'],
  cement: ['substructure', 'superstructure', 'finishing', 'exterior'],
  sand: ['substructure', 'superstructure', 'finishing'],
  aggregates: ['substructure', 'superstructure', 'exterior'],
  steel: ['substructure', 'superstructure'],
  roofing: ['roofing'],
  timber: ['roofing', 'finishing'],
  electrical: ['finishing'],
  plumbing: ['finishing', 'exterior'],
  finishes: ['finishing'],
  hardware: ['superstructure', 'roofing', 'finishing'],
  labor: ['substructure', 'superstructure', 'roofing', 'finishing', 'exterior'],
};

const text = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

/**
 * Every material with admin edits applied, built-in ones first in their
 * usual order, then admin-added products by name. Hidden ones are kept and
 * flagged; callers that show the catalog to the public filter them out.
 * A built-in material's unit never changes (estimates depend on it).
 */
export function mergeCatalog(base: Material[], rows: CatalogRow[]): Material[] {
  const byKey = new Map(rows.map((row) => [row.material_key, row]));
  const builtIn = new Set(base.map((m) => m.id));

  const edited = base.map((material) => {
    const row = byKey.get(material.id);
    if (!row) return material;
    return {
      ...material,
      name: text(row.name) ?? material.name,
      specifications: row.description === null ? material.specifications : text(row.description) ?? undefined,
      category: (text(row.category) as MaterialCategory | null) ?? material.category,
      subcategory: text(row.subcategory) ?? material.subcategory,
      milestones: row.milestones?.length ? row.milestones : material.milestones,
      hidden: row.is_hidden || undefined,
    };
  });

  const added = rows
    .filter((row) => row.is_custom && !builtIn.has(row.material_key) && text(row.name) && text(row.category) && text(row.unit))
    .map((row): Material => {
      const category = row.category as MaterialCategory;
      return {
        id: row.material_key,
        name: text(row.name) as string,
        category,
        subcategory: text(row.subcategory) ?? 'Other',
        unit: text(row.unit) as string,
        specifications: text(row.description) ?? undefined,
        milestones: row.milestones?.length ? row.milestones : DEFAULT_MILESTONES[category] ?? [],
        custom: true,
        hidden: row.is_hidden || undefined,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...edited, ...added];
}

/** A key for a new product from its name: "Waterproof membrane 4mm" → "custom-waterproof-membrane-4mm". */
export function keyForNewProduct(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return `custom-${slug || 'product'}`;
}
