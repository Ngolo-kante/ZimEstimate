-- ============================================
-- 036: Create quick_boqs, which 024 never actually created
-- ============================================
--
-- Opening "Quick Projects" while signed in failed with "Failed to load quick
-- estimates." listQuickBOQs was getting PGRST205 from PostgREST:
--
--   Could not find the table 'public.quick_boqs' in the schema cache
--
-- The table does not exist. Production has 46 tables and none of them is
-- quick_boqs, so this is not a stale schema cache.
--
-- Migration 024_quick_boqs.sql defines the table correctly and is *recorded* as
-- applied in supabase_migrations.schema_migrations, so `db push` considers it
-- done and will never re-run it. The history was marked without the SQL having
-- taken effect — the usual cause is a `migration repair` or a link against an
-- existing project that back-filled the history table.
--
-- So the repair has to be a new migration. Everything below mirrors 024 and is
-- written to be safe if any part of it does already exist, since the failure
-- mode above means the real state cannot be assumed from the history.

CREATE TABLE IF NOT EXISTS quick_boqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_type  TEXT NOT NULL CHECK (project_type IN ('septic','solar','water','borehole','fencing','paving')),
  answers       JSONB NOT NULL DEFAULT '{}',
  boq_items     JSONB NOT NULL DEFAULT '[]',
  labor_method  TEXT CHECK (labor_method IN ('daily_rate','percentage')),
  labor_value   NUMERIC,
  labor_days    INTEGER,
  labor_workers INTEGER DEFAULT 2,
  labor_enabled BOOLEAN DEFAULT false,
  markup_pct    NUMERIC DEFAULT 0,
  currency      TEXT DEFAULT 'USD' CHECK (currency IN ('USD','ZWG')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quick_boqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quick BOQs" ON quick_boqs;
CREATE POLICY "Users can view own quick BOQs"
  ON quick_boqs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quick BOQs" ON quick_boqs;
CREATE POLICY "Users can insert own quick BOQs"
  ON quick_boqs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quick BOQs" ON quick_boqs;
CREATE POLICY "Users can update own quick BOQs"
  ON quick_boqs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own quick BOQs" ON quick_boqs;
CREATE POLICY "Users can delete own quick BOQs"
  ON quick_boqs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS quick_boqs_user_id_idx      ON quick_boqs (user_id);
CREATE INDEX IF NOT EXISTS quick_boqs_project_id_idx   ON quick_boqs (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quick_boqs_project_type_idx ON quick_boqs (project_type);

DROP TRIGGER IF EXISTS update_quick_boqs_updated_at ON quick_boqs;
CREATE TRIGGER update_quick_boqs_updated_at
  BEFORE UPDATE ON quick_boqs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
