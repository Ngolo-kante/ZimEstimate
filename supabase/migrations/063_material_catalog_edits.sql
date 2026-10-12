-- ─── Admins can edit the material catalog ─────────────────────────────────
--
-- The catalog (names, descriptions, categories, units) is written in code,
-- src/lib/materials.ts, so changing a description or adding a product meant
-- a deploy. This table holds what an admin changes on top of it:
--
--   - an edit to a built-in material: a row with its key and the fields that
--     differ (NULL = keep the built-in value). The unit of a built-in
--     material cannot change here — estimates already calculate quantities
--     in that unit, and changing it would make them quietly wrong;
--   - a new product: is_custom, with every field filled in;
--   - hiding a material from public lists and pickers: is_hidden;
--   - the three prices on the home page: featured_rank 1–3.
--
-- Everyone can read it (it is what the public catalog shows). Only the admin
-- API writes it, with the service role, and each change is audit-logged.
-- lib/catalog/mergeCatalog.ts applies it.

CREATE TABLE IF NOT EXISTS public.material_catalog (
  material_key TEXT PRIMARY KEY CHECK (material_key ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  name TEXT CHECK (name IS NULL OR length(trim(name)) BETWEEN 2 AND 120),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  category TEXT CHECK (category IS NULL OR category IN (
    'bricks', 'cement', 'sand', 'aggregates', 'steel', 'roofing', 'timber',
    'electrical', 'plumbing', 'finishes', 'hardware', 'labor')),
  subcategory TEXT CHECK (subcategory IS NULL OR length(subcategory) <= 80),
  unit TEXT CHECK (unit IS NULL OR length(trim(unit)) BETWEEN 1 AND 40),
  milestones TEXT[],
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  featured_rank SMALLINT CHECK (featured_rank BETWEEN 1 AND 3),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A new product must say what it is, how it is sold and where it is used.
  CONSTRAINT material_catalog_custom_complete CHECK (
    NOT is_custom OR (name IS NOT NULL AND category IS NOT NULL AND unit IS NOT NULL)
  )
);

-- One material per home-page slot.
CREATE UNIQUE INDEX IF NOT EXISTS material_catalog_featured_slot
  ON public.material_catalog (featured_rank) WHERE featured_rank IS NOT NULL;

ALTER TABLE public.material_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read the catalog" ON public.material_catalog;
CREATE POLICY "Anyone can read the catalog" ON public.material_catalog
  FOR SELECT USING (TRUE);
GRANT SELECT ON public.material_catalog TO anon, authenticated;
