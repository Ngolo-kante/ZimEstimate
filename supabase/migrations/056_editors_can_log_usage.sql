-- ─── Editors can log material usage ────────────────────────────────────────
--
-- Migration 004 declared "Shared editors can record material usage", but the
-- live database does not have it: an end-to-end test of project sharing
-- (migration 055) found an editor's usage insert refused by RLS while the
-- same row inserted fine as the service role. Logging what was used on site
-- is the main thing a site manager does, so it is recreated here.

DROP POLICY IF EXISTS "Shared editors can record material usage" ON public.material_usage;
CREATE POLICY "Shared editors can record material usage"
  ON public.material_usage FOR INSERT
  WITH CHECK (
    public.user_has_edit_access(project_id, auth.uid())
    AND recorded_by = auth.uid()
  );
