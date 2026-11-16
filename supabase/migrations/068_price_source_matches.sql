-- Which supplier products the weekly price collector reads for each material.
--
-- An admin confirms these on Admin → Price matches (or marks "no good match").
-- The collector (scripts/pricing/collect-zbms.mjs) reads confirmed rows with
-- the service role, so a new or changed match takes effect at the next run
-- without a code change. Candidate suggestions are not stored here; they live
-- in src/lib/pricing/zbmsCandidates.json and only become rows when confirmed.

CREATE TABLE IF NOT EXISTS public.price_source_matches (
    source TEXT NOT NULL DEFAULT 'zbms' CHECK (source IN ('zbms')),
    material_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'no_match')),
    product_ids INTEGER[] NOT NULL DEFAULT '{}',
    factor NUMERIC NOT NULL DEFAULT 1 CHECK (factor > 0),
    unit TEXT NOT NULL,
    note TEXT,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source, material_id),
    CONSTRAINT confirmed_has_products CHECK (status <> 'confirmed' OR cardinality(product_ids) > 0)
);

ALTER TABLE public.price_source_matches ENABLE ROW LEVEL SECURITY;

-- Admins only (current_user_is_admin() from 034 reads the role without RLS recursion).
DROP POLICY IF EXISTS "Admins read price matches" ON public.price_source_matches;
CREATE POLICY "Admins read price matches" ON public.price_source_matches
    FOR SELECT TO authenticated USING (current_user_is_admin());

DROP POLICY IF EXISTS "Admins add price matches" ON public.price_source_matches;
CREATE POLICY "Admins add price matches" ON public.price_source_matches
    FOR INSERT TO authenticated WITH CHECK (current_user_is_admin());

DROP POLICY IF EXISTS "Admins change price matches" ON public.price_source_matches;
CREATE POLICY "Admins change price matches" ON public.price_source_matches
    FOR UPDATE TO authenticated USING (current_user_is_admin()) WITH CHECK (current_user_is_admin());

DROP POLICY IF EXISTS "Admins remove price matches" ON public.price_source_matches;
CREATE POLICY "Admins remove price matches" ON public.price_source_matches
    FOR DELETE TO authenticated USING (current_user_is_admin());

-- Required for new public tables (see supabase/AGENTS.md). Closed to anon at the
-- privilege level too: this project's older defaults would otherwise grant it.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_source_matches TO authenticated;
GRANT ALL ON public.price_source_matches TO service_role;
REVOKE ALL ON public.price_source_matches FROM anon;
