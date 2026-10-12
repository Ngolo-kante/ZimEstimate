-- ─── Invite people to a quick estimate, like a full build ─────────────────
--
-- A borehole, solar install or septic tank is built by someone, and the owner
-- wants to follow it the same way they follow a house: steps done, photos
-- from site, materials used. Full builds got that in migrations 055 and 058;
-- quick estimates had no way to give anyone access at all.
--
-- Same rules as the full-build site view: an invitee never reads quick_boqs
-- (it holds prices, the owner's savings and target date), only what these
-- SECURITY DEFINER functions return, and each one starts from a share for
-- this exact estimate.
--
--   get_quick_site_projects()          estimates shared with me (no figures)
--   get_quick_site_view(id)            steps, materials with quantities and
--                                      usage (no prices), recent usage
--   quick_site_set_step(...)           tick or untick a step (edit access)
--   quick_site_log_usage(...)          log materials used (edit access)
--
-- Invites and photos go through the server (/api/quick-estimates/[id]/...),
-- which can see whether an account exists and writes to the private bucket.
--
-- The steps are a fixed list per type rather than editable stages: the user
-- asked for no stage workspace on quick estimates, and "drilling done" is the
-- level of detail a borehole needs. The list lives here so the owner and the
-- builder can never see two different versions of it.

-- ── 1. Shares ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_boq_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_boq_id UUID NOT NULL REFERENCES public.quick_boqs(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level access_level NOT NULL DEFAULT 'edit',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quick_boq_id, shared_with_email)
);
CREATE INDEX IF NOT EXISTS idx_quick_boq_shares_user ON public.quick_boq_shares (shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_quick_boq_shares_pending_email
  ON public.quick_boq_shares (shared_with_email) WHERE shared_with_user_id IS NULL;

ALTER TABLE public.quick_boq_shares ENABLE ROW LEVEL SECURITY;
-- The owner lists, changes and removes; the invite route (service role) adds.
DROP POLICY IF EXISTS "Owners can view quick estimate shares" ON public.quick_boq_shares;
CREATE POLICY "Owners can view quick estimate shares" ON public.quick_boq_shares
  FOR SELECT USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()));
DROP POLICY IF EXISTS "Owners can update quick estimate shares" ON public.quick_boq_shares;
CREATE POLICY "Owners can update quick estimate shares" ON public.quick_boq_shares
  FOR UPDATE USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()))
  WITH CHECK (public.user_owns_quick_boq(quick_boq_id, auth.uid()));
DROP POLICY IF EXISTS "Owners can delete quick estimate shares" ON public.quick_boq_shares;
CREATE POLICY "Owners can delete quick estimate shares" ON public.quick_boq_shares
  FOR DELETE USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()));

-- ── 2. Progress, usage and photos ───────────────────────────────────────────
-- Done steps only: { "<step id>": { "done_at": ..., "by": "<name>" } }.
ALTER TABLE public.quick_boqs
  ADD COLUMN IF NOT EXISTS progress JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.quick_boq_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_boq_id UUID NOT NULL REFERENCES public.quick_boqs(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity_used NUMERIC(14,3) NOT NULL CHECK (quantity_used > 0),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_boq_usage_estimate ON public.quick_boq_usage (quick_boq_id, usage_date DESC);
ALTER TABLE public.quick_boq_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view quick estimate usage" ON public.quick_boq_usage;
CREATE POLICY "Owners can view quick estimate usage" ON public.quick_boq_usage
  FOR SELECT USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()));
DROP POLICY IF EXISTS "Owners can delete quick estimate usage" ON public.quick_boq_usage;
CREATE POLICY "Owners can delete quick estimate usage" ON public.quick_boq_usage
  FOR DELETE USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()));

-- Same private bucket as project photos, under quick/<id>/.
CREATE TABLE IF NOT EXISTS public.quick_boq_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_boq_id UUID NOT NULL REFERENCES public.quick_boqs(id) ON DELETE CASCADE,
  step_id TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_boq_photos_estimate ON public.quick_boq_photos (quick_boq_id, created_at DESC);
ALTER TABLE public.quick_boq_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view quick estimate photos" ON public.quick_boq_photos;
CREATE POLICY "Owners can view quick estimate photos" ON public.quick_boq_photos
  FOR SELECT USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()));
DROP POLICY IF EXISTS "Owners can delete quick estimate photos" ON public.quick_boq_photos;
CREATE POLICY "Owners can delete quick estimate photos" ON public.quick_boq_photos
  FOR DELETE USING (public.user_owns_quick_boq(quick_boq_id, auth.uid()));

-- ── 3. Notifications can be about a quick estimate ─────────────────────────
ALTER TABLE public.project_notifications
  ADD COLUMN IF NOT EXISTS quick_boq_id UUID REFERENCES public.quick_boqs(id) ON DELETE CASCADE;
ALTER TABLE public.project_notifications ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.project_notifications DROP CONSTRAINT IF EXISTS project_notifications_about_something;
ALTER TABLE public.project_notifications
  ADD CONSTRAINT project_notifications_about_something
  CHECK (project_id IS NOT NULL OR quick_boq_id IS NOT NULL);

-- The email links back to whichever it is about (notificationDispatch.ts).
CREATE OR REPLACE FUNCTION public.queue_project_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.type NOT IN ('project_shared', 'collaborator_joined', 'usage', 'low_stock', 'progress', 'site_photo') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.user_id AND COALESCE(p.notify_email, TRUE)
  ) THEN
    INSERT INTO public.notification_deliveries (user_id, channel, template_key, status, payload)
    VALUES (
      NEW.user_id, 'email', 'project_notification', 'queued',
      jsonb_build_object('title', NEW.title, 'body', NEW.message, 'project_id', NEW.project_id,
                         'quick_boq_id', NEW.quick_boq_id, 'notification_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- ── 4. Helpers ──────────────────────────────────────────────────────────────
-- 'owner', 'edit', 'view', or NULL for no access.
CREATE OR REPLACE FUNCTION public.quick_site_access(p_quick_boq_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.quick_boqs q WHERE q.id = p_quick_boq_id AND q.user_id = auth.uid()) THEN 'owner'
    ELSE (SELECT s.access_level::TEXT FROM public.quick_boq_shares s
          WHERE s.quick_boq_id = p_quick_boq_id AND s.shared_with_user_id = auth.uid()
          LIMIT 1)
  END;
$$;
REVOKE ALL ON FUNCTION public.quick_site_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_site_access(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.quick_estimate_name(p_project_type TEXT, p_answers JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  -- Mirrors estimateName() in src/lib/quick-projects/savedEstimate.ts.
  SELECT COALESCE(
    NULLIF(trim(p_answers->>'project_name'), ''),
    CASE p_project_type
      WHEN 'solar' THEN 'Solar' WHEN 'borehole' THEN 'Borehole' WHEN 'septic' THEN 'Septic'
      WHEN 'water' THEN 'Water' WHEN 'fencing' THEN 'Fencing' WHEN 'paving' THEN 'Paving'
      ELSE 'Quick' END || ' estimate');
$$;

-- The steps a job of this type goes through, in order.
CREATE OR REPLACE FUNCTION public.quick_progress_steps(p_project_type TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE p_project_type
    WHEN 'solar' THEN '[
      {"id":"survey","title":"Site visit done and system agreed"},
      {"id":"delivery","title":"Panels, batteries and inverter delivered"},
      {"id":"mounting","title":"Panels mounted"},
      {"id":"inverter","title":"Inverter and batteries installed"},
      {"id":"wiring","title":"Wiring, protection and earthing done"},
      {"id":"commission","title":"Switched on and tested"},
      {"id":"handover","title":"Handed over and shown how it works"}]'::jsonb
    WHEN 'borehole' THEN '[
      {"id":"survey","title":"Siting survey done"},
      {"id":"permits","title":"Permits in hand"},
      {"id":"drilling","title":"Drilling done"},
      {"id":"casing","title":"Casing and gravel pack in"},
      {"id":"yield","title":"Flushed and yield tested"},
      {"id":"pump","title":"Pump installed and wired"},
      {"id":"handover","title":"Water flowing and handed over"}]'::jsonb
    WHEN 'septic' THEN '[
      {"id":"setout","title":"Site marked out"},
      {"id":"excavation","title":"Excavation done"},
      {"id":"tank","title":"Tank built or placed"},
      {"id":"soakaway","title":"Soakaway done"},
      {"id":"pipes","title":"Inlet and outlet pipes connected"},
      {"id":"test","title":"Tested and backfilled"},
      {"id":"handover","title":"Inspected and handed over"}]'::jsonb
    WHEN 'water' THEN '[
      {"id":"stand","title":"Tank stand built"},
      {"id":"tank","title":"Tank in place"},
      {"id":"pipes","title":"Pipework connected"},
      {"id":"pump","title":"Pump installed, if there is one"},
      {"id":"test","title":"Tested for leaks"},
      {"id":"handover","title":"Handed over"}]'::jsonb
    WHEN 'fencing' THEN '[
      {"id":"setout","title":"Boundary marked out"},
      {"id":"posts","title":"Posts or pillars set"},
      {"id":"panels","title":"Mesh, panels or wall up"},
      {"id":"gate","title":"Gate fitted"},
      {"id":"electric","title":"Electric fence live, if there is one"},
      {"id":"finish","title":"Painted and finished"},
      {"id":"handover","title":"Handed over"}]'::jsonb
    WHEN 'paving' THEN '[
      {"id":"setout","title":"Area marked and levels set"},
      {"id":"excavation","title":"Excavation done"},
      {"id":"subbase","title":"Sub-base laid and compacted"},
      {"id":"edging","title":"Kerbs and edging set"},
      {"id":"paving","title":"Paving laid"},
      {"id":"finish","title":"Joints filled and sealed"},
      {"id":"handover","title":"Handed over"}]'::jsonb
    ELSE '[
      {"id":"started","title":"Work started"},
      {"id":"done","title":"Work finished"},
      {"id":"handover","title":"Handed over"}]'::jsonb
  END;
$$;

-- Lines a builder uses up on site. Services, labour, permits, transport and
-- contingency are on the estimate but are not "used".
CREATE OR REPLACE FUNCTION public.quick_item_is_material(p_item JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((p_item->>'included')::BOOLEAN, TRUE)
     AND lower(COALESCE(p_item->>'category', '')) NOT IN (
       'labor', 'labour', 'contingency', 'transport', 'transport & logistics',
       'professional services', 'permits & compliance', 'drilling')
     AND lower(COALESCE(p_item->>'unit', '')) NOT IN ('lump sum', 'trip', 'job', 'visit', 'test');
$$;

CREATE OR REPLACE FUNCTION public.notify_quick_owner(p_quick_boq_id UUID, p_type TEXT, p_title TEXT, p_message TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.project_notifications (quick_boq_id, user_id, type, title, message)
  SELECT q.id, q.user_id, p_type, p_title, p_message
  FROM public.quick_boqs q
  WHERE q.id = p_quick_boq_id AND q.user_id IS NOT NULL AND q.user_id IS DISTINCT FROM auth.uid();
$$;
REVOKE ALL ON FUNCTION public.notify_quick_owner(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ── 5. What an invitee can read ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_quick_site_projects()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'name', public.quick_estimate_name(q.project_type, q.answers),
    'project_type', q.project_type,
    'location', NULLIF(trim(q.answers->>'project_location'), ''),
    'access_level', s.access_level,
    'owner_name', COALESCE(NULLIF(trim(o.full_name), ''), 'the owner'),
    'updated_at', q.updated_at
  ) ORDER BY q.updated_at DESC), '[]'::jsonb)
  FROM public.quick_boq_shares s
  JOIN public.quick_boqs q ON q.id = s.quick_boq_id
  LEFT JOIN public.profiles o ON o.id = q.user_id
  WHERE s.shared_with_user_id = auth.uid() AND q.archived_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_quick_site_projects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quick_site_projects() TO authenticated;

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
      'owner_name', COALESCE((SELECT NULLIF(trim(full_name), '') FROM public.profiles WHERE id = v_q.user_id), 'the owner')),
    'steps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', step->>'id',
        'title', step->>'title',
        'is_completed', v_q.progress ? (step->>'id'),
        'completed_at', v_q.progress->(step->>'id')->>'done_at',
        'completed_by', v_q.progress->(step->>'id')->>'by') ORDER BY n)
      FROM jsonb_array_elements(public.quick_progress_steps(v_q.project_type)) WITH ORDINALITY AS t(step, n)), '[]'::jsonb),
    -- Quantities and what has been used. No prices.
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
REVOKE ALL ON FUNCTION public.get_quick_site_view(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quick_site_view(UUID) TO authenticated;

-- ── 6. What an invitee with 'edit' (and the owner) can change ──────────────
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
  FROM jsonb_array_elements(public.quick_progress_steps(v_q.project_type)) step
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
REVOKE ALL ON FUNCTION public.quick_site_set_step(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_site_set_step(UUID, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.quick_site_log_usage(
  p_quick_boq_id UUID, p_item_id TEXT, p_quantity NUMERIC, p_usage_date DATE DEFAULT CURRENT_DATE, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_access TEXT := public.quick_site_access(p_quick_boq_id);
  v_q RECORD;
  v_item JSONB;
  v_used NUMERIC;
  v_total NUMERIC;
BEGIN
  IF v_access IS NULL OR v_access NOT IN ('owner', 'edit') THEN
    RAISE EXCEPTION 'You can only follow this job, not log usage on it.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 1000000 THEN
    RAISE EXCEPTION 'Enter a quantity above zero.';
  END IF;

  SELECT id, project_type, answers, boq_items INTO v_q FROM public.quick_boqs WHERE id = p_quick_boq_id;
  SELECT e INTO v_item
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_q.boq_items) = 'array' THEN v_q.boq_items ELSE '[]'::jsonb END) e
  WHERE e->>'id' = p_item_id AND public.quick_item_is_material(e)
  LIMIT 1;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'That material is not on this estimate.';
  END IF;

  INSERT INTO public.quick_boq_usage (quick_boq_id, item_id, quantity_used, usage_date, notes, recorded_by)
  VALUES (p_quick_boq_id, p_item_id, p_quantity, COALESCE(p_usage_date, CURRENT_DATE),
          NULLIF(trim(COALESCE(p_notes, '')), ''), auth.uid());

  SELECT COALESCE(SUM(quantity_used), 0) INTO v_used
  FROM public.quick_boq_usage WHERE quick_boq_id = p_quick_boq_id AND item_id = p_item_id;
  v_total := COALESCE((v_item->>'quantity')::NUMERIC, 0);

  PERFORM public.notify_quick_owner(p_quick_boq_id, 'usage', 'Usage updated',
    COALESCE((SELECT NULLIF(trim(full_name), '') FROM public.profiles WHERE id = auth.uid()), 'Someone')
    || ' logged ' || trim(to_char(p_quantity, 'FM999999990.##')) || ' ' || COALESCE(v_item->>'unit', '')
    || ' of ' || COALESCE(v_item->>'description', 'a material')
    || ' on ' || public.quick_estimate_name(v_q.project_type, v_q.answers) || '.');

  RETURN jsonb_build_object('used', v_used, 'remaining', GREATEST(v_total - v_used, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.quick_site_log_usage(UUID, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_site_log_usage(UUID, TEXT, NUMERIC, DATE, TEXT) TO authenticated;

-- ── 7. Waiting invites attach on sign-up, for both kinds ───────────────────
CREATE OR REPLACE FUNCTION public.link_my_project_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_name TEXT;
  v_share RECORD;
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid AND u.email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.full_name), ''), v_email) INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  FOR v_share IN
    UPDATE public.project_shares s
    SET shared_with_user_id = v_uid, accepted_at = NOW()
    WHERE s.shared_with_user_id IS NULL
      AND s.shared_with_email = v_email
    RETURNING s.project_id
  LOOP
    v_count := v_count + 1;
    INSERT INTO public.project_notifications (project_id, user_id, type, title, message)
    SELECT pr.id, pr.owner_id, 'collaborator_joined',
           COALESCE(v_name, 'Someone') || ' joined ' || pr.name,
           COALESCE(v_name, 'Someone') || ' accepted your invitation and can now open ' || pr.name || '.'
    FROM public.projects pr
    WHERE pr.id = v_share.project_id AND pr.owner_id IS DISTINCT FROM v_uid;
  END LOOP;

  FOR v_share IN
    UPDATE public.quick_boq_shares s
    SET shared_with_user_id = v_uid, accepted_at = NOW()
    WHERE s.shared_with_user_id IS NULL
      AND s.shared_with_email = v_email
    RETURNING s.quick_boq_id
  LOOP
    v_count := v_count + 1;
    INSERT INTO public.project_notifications (quick_boq_id, user_id, type, title, message)
    SELECT q.id, q.user_id, 'collaborator_joined',
           COALESCE(v_name, 'Someone') || ' joined ' || public.quick_estimate_name(q.project_type, q.answers),
           COALESCE(v_name, 'Someone') || ' accepted your invitation and can now open '
             || public.quick_estimate_name(q.project_type, q.answers) || '.'
    FROM public.quick_boqs q
    WHERE q.id = v_share.quick_boq_id AND q.user_id IS NOT NULL AND q.user_id IS DISTINCT FROM v_uid;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.link_my_project_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_my_project_invites() TO authenticated;
