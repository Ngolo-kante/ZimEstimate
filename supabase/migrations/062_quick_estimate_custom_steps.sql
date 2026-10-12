-- ─── Owners can add and remove a quick estimate's steps ───────────────────
--
-- Migration 061 gave every job of a type the same fixed steps. Jobs vary —
-- one borehole needs a ZINWA registration step, a solar retrofit has nothing
-- to deliver — so the type's list is now only the starting point.
--
-- quick_boqs.steps is NULL until the owner changes something, and then holds
-- this estimate's own list ([{ "id", "title" }], in order). Everything that
-- reads steps goes through quick_job_steps(), so the view, ticking and photo
-- tagging can never disagree about which steps exist.
--
-- Only the owner edits the list. Invitees tick steps off; they do not decide
-- what the job is.

ALTER TABLE public.quick_boqs ADD COLUMN IF NOT EXISTS steps JSONB;

-- This estimate's steps: its own list once edited, else its type's.
CREATE OR REPLACE FUNCTION public.quick_job_steps(p_quick_boq_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(q.steps, public.quick_progress_steps(q.project_type))
  FROM public.quick_boqs q WHERE q.id = p_quick_boq_id;
$$;
REVOKE ALL ON FUNCTION public.quick_job_steps(UUID) FROM PUBLIC, anon, authenticated;

-- ── Read: same view as 061, reading this estimate's steps ──────────────────
CREATE OR REPLACE FUNCTION public.get_quick_site_view(p_quick_boq_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_access TEXT := public.quick_site_access(p_quick_boq_id);
  v_q RECORD;
BEGIN
  IF v_access IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_q FROM public.quick_boqs WHERE id = p_quick_boq_id;

  RETURN jsonb_build_object(
    'access', v_access,
    'estimate', jsonb_build_object(
      'id', v_q.id,
      'name', public.quick_estimate_name(v_q.project_type, v_q.answers),
      'project_type', v_q.project_type,
      'location', NULLIF(trim(v_q.answers->>'project_location'), ''),
      'owner_name', COALESCE((SELECT NULLIF(trim(full_name), '') FROM public.profiles WHERE id = v_q.user_id), 'the owner'),
      'steps_customised', v_q.steps IS NOT NULL),
    'steps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', step->>'id',
        'title', step->>'title',
        'is_completed', v_q.progress ? (step->>'id'),
        'completed_at', v_q.progress->(step->>'id')->>'done_at',
        'completed_by', v_q.progress->(step->>'id')->>'by') ORDER BY n)
      FROM jsonb_array_elements(COALESCE(v_q.steps, public.quick_progress_steps(v_q.project_type))) WITH ORDINALITY AS t(step, n)), '[]'::jsonb),
    'materials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item->>'id',
        'name', item->>'description',
        'category', item->>'category',
        'unit', item->>'unit',
        'quantity', COALESCE((item->>'quantity')::NUMERIC, 0),
        'used', COALESCE((SELECT SUM(u.quantity_used) FROM public.quick_boq_usage u
                          WHERE u.quick_boq_id = v_q.id AND u.item_id = item->>'id'), 0)) ORDER BY n)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_q.boq_items) = 'array' THEN v_q.boq_items ELSE '[]'::jsonb END)
           WITH ORDINALITY AS t(item, n)
      WHERE public.quick_item_is_material(item)), '[]'::jsonb),
    'recent_usage', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT u.id, u.usage_date, u.quantity_used, u.notes,
               COALESCE(i.item->>'description', 'Removed item') AS material_name,
               COALESCE(i.item->>'unit', '') AS unit,
               COALESCE(NULLIF(trim(pr.full_name), ''), 'Someone') AS recorded_by
        FROM public.quick_boq_usage u
        LEFT JOIN LATERAL (
          SELECT e AS item FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(v_q.boq_items) = 'array' THEN v_q.boq_items ELSE '[]'::jsonb END) e
          WHERE e->>'id' = u.item_id LIMIT 1) i ON TRUE
        LEFT JOIN public.profiles pr ON pr.id = u.recorded_by
        WHERE u.quick_boq_id = v_q.id
        ORDER BY u.usage_date DESC, u.created_at DESC
        LIMIT 30
      ) r), '[]'::jsonb)
  );
END;
$$;

-- ── Tick: a step must be one of this estimate's ────────────────────────────
CREATE OR REPLACE FUNCTION public.quick_site_set_step(p_quick_boq_id UUID, p_step_id TEXT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_access TEXT := public.quick_site_access(p_quick_boq_id);
  v_q RECORD;
  v_title TEXT;
  v_name TEXT;
BEGIN
  IF v_access IS NULL OR v_access NOT IN ('owner', 'edit') THEN
    RAISE EXCEPTION 'You can only follow this job, not update it.';
  END IF;
  SELECT id, project_type, progress, answers INTO v_q FROM public.quick_boqs WHERE id = p_quick_boq_id;
  SELECT step->>'title' INTO v_title
  FROM jsonb_array_elements(public.quick_job_steps(p_quick_boq_id)) step
  WHERE step->>'id' = p_step_id;
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'That step is not part of this job.';
  END IF;

  v_name := COALESCE((SELECT NULLIF(trim(full_name), '') FROM public.profiles WHERE id = auth.uid()), 'Someone');

  IF p_completed THEN
    IF v_q.progress ? p_step_id THEN
      RETURN;
    END IF;
    UPDATE public.quick_boqs
    SET progress = progress || jsonb_build_object(p_step_id, jsonb_build_object('done_at', NOW(), 'by', v_name))
    WHERE id = p_quick_boq_id;
    PERFORM public.notify_quick_owner(p_quick_boq_id, 'progress', 'Step done: ' || v_title,
      v_name || ' marked "' || v_title || '" done on ' || public.quick_estimate_name(v_q.project_type, v_q.answers) || '.');
  ELSE
    UPDATE public.quick_boqs SET progress = progress - p_step_id WHERE id = p_quick_boq_id;
  END IF;
END;
$$;

-- ── Edit the list (owner only) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.quick_add_step(p_quick_boq_id UUID, p_title TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_title TEXT := regexp_replace(trim(COALESCE(p_title, '')), '\s+', ' ', 'g');
  v_steps JSONB;
  v_id TEXT;
BEGIN
  IF public.quick_site_access(p_quick_boq_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change the steps.';
  END IF;
  IF v_title = '' OR length(v_title) > 120 THEN
    RAISE EXCEPTION 'Give the step a name of up to 120 characters.';
  END IF;
  v_steps := public.quick_job_steps(p_quick_boq_id);
  IF jsonb_array_length(v_steps) >= 30 THEN
    RAISE EXCEPTION 'A job can have up to 30 steps.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_steps) s WHERE lower(s->>'title') = lower(v_title)) THEN
    RAISE EXCEPTION 'There is already a step with that name.';
  END IF;

  -- Lower-case letters, digits and _ only: the photo route accepts nothing else.
  v_id := 'c_' || substr(md5(gen_random_uuid()::TEXT), 1, 10);
  UPDATE public.quick_boqs
  SET steps = v_steps || jsonb_build_array(jsonb_build_object('id', v_id, 'title', v_title))
  WHERE id = p_quick_boq_id;
  RETURN jsonb_build_object('id', v_id, 'title', v_title);
END;
$$;
REVOKE ALL ON FUNCTION public.quick_add_step(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_add_step(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.quick_remove_step(p_quick_boq_id UUID, p_step_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_steps JSONB;
BEGIN
  IF public.quick_site_access(p_quick_boq_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change the steps.';
  END IF;
  v_steps := public.quick_job_steps(p_quick_boq_id);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_steps) s WHERE s->>'id' = p_step_id) THEN
    RAISE EXCEPTION 'That step is not part of this job.';
  END IF;

  UPDATE public.quick_boqs
  SET steps = COALESCE((
        SELECT jsonb_agg(s ORDER BY n)
        FROM jsonb_array_elements(v_steps) WITH ORDINALITY AS t(s, n)
        WHERE s->>'id' <> p_step_id), '[]'::jsonb),
      progress = progress - p_step_id
  WHERE id = p_quick_boq_id;
  -- Photos filed under it stay, just no longer tied to a step.
  UPDATE public.quick_boq_photos SET step_id = NULL WHERE quick_boq_id = p_quick_boq_id AND step_id = p_step_id;
END;
$$;
REVOKE ALL ON FUNCTION public.quick_remove_step(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_remove_step(UUID, TEXT) TO authenticated;

-- Back to the type's list.
CREATE OR REPLACE FUNCTION public.quick_reset_steps(p_quick_boq_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_q RECORD;
BEGIN
  IF public.quick_site_access(p_quick_boq_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change the steps.';
  END IF;
  SELECT project_type, progress INTO v_q FROM public.quick_boqs WHERE id = p_quick_boq_id;
  -- Keep ticks only for steps that exist in the type's list.
  UPDATE public.quick_boqs
  SET steps = NULL,
      progress = COALESCE((
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(v_q.progress)
        WHERE key IN (SELECT s->>'id' FROM jsonb_array_elements(public.quick_progress_steps(v_q.project_type)) s)), '{}'::jsonb)
  WHERE id = p_quick_boq_id;
END;
$$;
REVOKE ALL ON FUNCTION public.quick_reset_steps(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_reset_steps(UUID) TO authenticated;
