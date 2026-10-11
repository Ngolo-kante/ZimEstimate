-- ─── People invited to a project see the site, not the money ──────────────
--
-- An owner invites a builder or site manager to report progress: tick off
-- tasks, move a stage along, log materials used, upload photos. Until now an
-- invite opened the whole project to them — every row-level policy that
-- mentioned project_shares granted plain table access, so an invitee could
-- read the budget and totals on projects, every price in boq_items, purchase
-- records, procurement and RFQs, and project documents, and (with "edit")
-- change most of it. Hiding that in the page would not have been enough:
-- the browser holds the anon key, so anything RLS allows can be queried.
--
-- So invitees lose direct access to project tables entirely, and get a small
-- set of SECURITY DEFINER functions instead, each checking the share and
-- returning or changing only site information:
--
--   get_site_projects()           projects shared with me (no figures)
--   get_site_view(project)        stages + tasks, materials with quantities
--                                 and usage (no prices), recent usage, photos
--   site_log_usage(...)           log materials used (edit access)
--   site_set_task(...)            tick or untick a task (edit access)
--   site_set_stage_status(...)    move a stage along (edit access)
--
-- Each change notifies the owner. Photos are uploaded through the server
-- (/api/projects/[id]/photos) into a private bucket. Other projects are never
-- visible: every function starts from a share for this exact project.
--
-- Access levels keep their stored values: 'edit' = can report progress,
-- 'view' = can follow progress.

-- ── 1. Close direct access for invitees ─────────────────────────────────────
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Shared editors can update projects" ON public.projects;

DROP POLICY IF EXISTS "Shared users can view BOQ items" ON public.boq_items;
DROP POLICY IF EXISTS "Shared editors can add BOQ items" ON public.boq_items;
DROP POLICY IF EXISTS "Shared editors can update BOQ items" ON public.boq_items;
DROP POLICY IF EXISTS "Shared editors can delete BOQ items" ON public.boq_items;

DROP POLICY IF EXISTS "Shared users can view project stages" ON public.project_stages;
DROP POLICY IF EXISTS "Shared editors can add project stages" ON public.project_stages;
DROP POLICY IF EXISTS "Shared editors can update project stages" ON public.project_stages;
DROP POLICY IF EXISTS "Shared editors can delete project stages" ON public.project_stages;

DROP POLICY IF EXISTS "Shared users can view stage tasks" ON public.stage_tasks;
DROP POLICY IF EXISTS "Shared editors can create stage tasks" ON public.stage_tasks;
DROP POLICY IF EXISTS "Shared editors can update stage tasks" ON public.stage_tasks;

DROP POLICY IF EXISTS "Shared users can view material usage" ON public.material_usage;
DROP POLICY IF EXISTS "Shared editors can record material usage" ON public.material_usage;
DROP POLICY IF EXISTS "Shared editors can update material usage" ON public.material_usage;
DROP POLICY IF EXISTS "Shared editors can delete material usage" ON public.material_usage;

DROP POLICY IF EXISTS "Shared users can view utility configs" ON public.project_utility_configs;
DROP POLICY IF EXISTS "Shared editors can manage utility configs" ON public.project_utility_configs;

DROP POLICY IF EXISTS "Shared users can view project documents" ON public.project_documents;

-- Money tables: owner only from now on.
DROP POLICY IF EXISTS "Users can view project purchase records" ON public.purchase_records;
DROP POLICY IF EXISTS "Users can create purchase records" ON public.purchase_records;
DROP POLICY IF EXISTS "Users can update purchase records" ON public.purchase_records;
DROP POLICY IF EXISTS "Users can delete purchase records" ON public.purchase_records;
CREATE POLICY "Users can view project purchase records" ON public.purchase_records
  FOR SELECT USING (public.user_owns_project(project_id, auth.uid()));
CREATE POLICY "Users can create purchase records" ON public.purchase_records
  FOR INSERT WITH CHECK (public.user_owns_project(project_id, auth.uid()) AND auth.uid() = created_by);
CREATE POLICY "Users can update purchase records" ON public.purchase_records
  FOR UPDATE USING (public.user_owns_project(project_id, auth.uid()));
CREATE POLICY "Users can delete purchase records" ON public.purchase_records
  FOR DELETE USING (public.user_owns_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members can view procurement requests" ON public.procurement_requests;
DROP POLICY IF EXISTS "Project members can create procurement requests" ON public.procurement_requests;
DROP POLICY IF EXISTS "Project members can update procurement requests" ON public.procurement_requests;
CREATE POLICY "Project members can view procurement requests" ON public.procurement_requests
  FOR SELECT USING (public.user_owns_project(project_id, auth.uid()));
CREATE POLICY "Project members can create procurement requests" ON public.procurement_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid() AND public.user_owns_project(project_id, auth.uid()));
CREATE POLICY "Project members can update procurement requests" ON public.procurement_requests
  FOR UPDATE USING (public.user_owns_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Project members can view RFQ requests" ON public.rfq_requests;
DROP POLICY IF EXISTS "Project members can create RFQ requests" ON public.rfq_requests;
DROP POLICY IF EXISTS "Project members can update RFQ requests" ON public.rfq_requests;
CREATE POLICY "Project members can view RFQ requests" ON public.rfq_requests
  FOR SELECT USING (
    (project_id IS NOT NULL AND public.user_owns_project(project_id, auth.uid()))
    OR (quick_boq_id IS NOT NULL AND public.user_owns_quick_boq(quick_boq_id, auth.uid()))
    -- Suppliers still see the RFQs they were invited to.
    OR public.user_is_rfq_supplier(id, auth.uid())
  );
CREATE POLICY "Project members can create RFQ requests" ON public.rfq_requests
  FOR INSERT WITH CHECK (
    (project_id IS NOT NULL AND public.user_owns_project(project_id, auth.uid()))
    OR (quick_boq_id IS NOT NULL AND public.user_owns_quick_boq(quick_boq_id, auth.uid()))
  );
CREATE POLICY "Project members can update RFQ requests" ON public.rfq_requests
  FOR UPDATE USING (
    (project_id IS NOT NULL AND public.user_owns_project(project_id, auth.uid()))
    OR (quick_boq_id IS NOT NULL AND public.user_owns_quick_boq(quick_boq_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can manage own reminders for owned/shared projects" ON public.project_recurring_reminders;
CREATE POLICY "Users can manage own reminders for owned/shared projects" ON public.project_recurring_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_owns_project(project_id, auth.uid()));

-- ── 2. Progress photos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_progress_photos_project
  ON public.project_progress_photos (project_id, created_at DESC);

ALTER TABLE public.project_progress_photos ENABLE ROW LEVEL SECURITY;
-- Owners read and remove their projects' photos directly; uploads and
-- invitees' reads go through the server route (service role).
DROP POLICY IF EXISTS "Owners can view progress photos" ON public.project_progress_photos;
CREATE POLICY "Owners can view progress photos" ON public.project_progress_photos
  FOR SELECT USING (public.user_owns_project(project_id, auth.uid()));
DROP POLICY IF EXISTS "Owners can delete progress photos" ON public.project_progress_photos;
CREATE POLICY "Owners can delete progress photos" ON public.project_progress_photos
  FOR DELETE USING (public.user_owns_project(project_id, auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-progress', 'project-progress', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 3. Who may do what on a site ────────────────────────────────────────────
-- 'owner', 'edit', 'view', or NULL for no access.
CREATE OR REPLACE FUNCTION public.site_access(p_project_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.owner_id = auth.uid()) THEN 'owner'
    ELSE (SELECT ps.access_level::TEXT FROM public.project_shares ps
          WHERE ps.project_id = p_project_id AND ps.shared_with_user_id = auth.uid()
          LIMIT 1)
  END;
$$;
REVOKE ALL ON FUNCTION public.site_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_access(UUID) TO authenticated;

-- Notify the owner of something an invitee did. Internal only.
CREATE OR REPLACE FUNCTION public.notify_site_owner(p_project_id UUID, p_type TEXT, p_title TEXT, p_message TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  INSERT INTO public.project_notifications (project_id, user_id, type, title, message)
  SELECT p.id, p.owner_id, p_type, p_title, p_message
  FROM public.projects p
  WHERE p.id = p_project_id AND p.owner_id IS DISTINCT FROM auth.uid();
$$;
REVOKE ALL ON FUNCTION public.notify_site_owner(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.site_actor_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Your builder') FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.site_actor_name() FROM PUBLIC;

-- ── 4. What an invitee can read ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_site_projects()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'location', p.location,
    'status', p.status,
    'access_level', ps.access_level,
    'owner_name', COALESCE(NULLIF(trim(o.full_name), ''), 'the owner'),
    'updated_at', p.updated_at
  ) ORDER BY p.updated_at DESC), '[]'::jsonb)
  FROM public.project_shares ps
  JOIN public.projects p ON p.id = ps.project_id
  LEFT JOIN public.profiles o ON o.id = p.owner_id
  WHERE ps.shared_with_user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_site_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_projects() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_site_view(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_access TEXT := public.site_access(p_project_id);
BEGIN
  IF v_access IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'access', v_access,
    'project', (
      SELECT jsonb_build_object(
        'id', p.id, 'name', p.name, 'location', p.location, 'status', p.status,
        'usage_tracking_enabled', p.usage_tracking_enabled,
        'owner_name', COALESCE(NULLIF(trim(o.full_name), ''), 'the owner'))
      FROM public.projects p LEFT JOIN public.profiles o ON o.id = p.owner_id
      WHERE p.id = p_project_id),
    'stages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'category', s.boq_category, 'status', s.status,
        'tasks', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', t.id, 'title', t.title, 'is_completed', t.is_completed,
            'completed_at', t.completed_at, 'note', t.verification_note)
            ORDER BY t.sort_order, t.created_at)
          FROM public.stage_tasks t WHERE t.stage_id = s.id), '[]'::jsonb))
        ORDER BY s.sort_order)
      FROM public.project_stages s
      WHERE s.project_id = p_project_id AND s.is_applicable), '[]'::jsonb),
    -- Materials with quantities and what has been used. No prices.
    'materials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.material_name, 'category', b.category, 'unit', b.unit,
        'quantity', COALESCE(b.actual_quantity, b.quantity),
        'used', COALESCE((SELECT SUM(u.quantity_used) FROM public.material_usage u WHERE u.boq_item_id = b.id), 0))
        ORDER BY b.category, b.sort_order)
      FROM public.boq_items b WHERE b.project_id = p_project_id), '[]'::jsonb),
    'recent_usage', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT u.id, u.usage_date, u.quantity_used, u.notes, b.material_name, b.unit,
               COALESCE(NULLIF(trim(pr.full_name), ''), 'Someone') AS recorded_by
        FROM public.material_usage u
        JOIN public.boq_items b ON b.id = u.boq_item_id
        LEFT JOIN public.profiles pr ON pr.id = u.recorded_by
        WHERE u.project_id = p_project_id
        ORDER BY u.usage_date DESC, u.created_at DESC
        LIMIT 30
      ) r), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_view(UUID) TO authenticated;

-- ── 5. What an invitee with 'edit' can change ──────────────────────────────
CREATE OR REPLACE FUNCTION public.site_log_usage(
  p_project_id UUID, p_boq_item_id UUID, p_quantity NUMERIC, p_usage_date DATE DEFAULT CURRENT_DATE, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_access TEXT := public.site_access(p_project_id);
  v_item RECORD;
  v_project RECORD;
  v_before NUMERIC;
  v_after NUMERIC;
  v_total NUMERIC;
  v_pct_before NUMERIC;
  v_pct_after NUMERIC;
BEGIN
  IF v_access NOT IN ('owner', 'edit') OR v_access IS NULL THEN
    RAISE EXCEPTION 'You can only follow this project, not log usage on it.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 1000000 THEN
    RAISE EXCEPTION 'Enter a quantity above zero.';
  END IF;

  SELECT b.id, b.material_name, b.unit, COALESCE(b.actual_quantity, b.quantity) AS qty INTO v_item
  FROM public.boq_items b WHERE b.id = p_boq_item_id AND b.project_id = p_project_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'That material is not on this project.';
  END IF;

  SELECT COALESCE(SUM(quantity_used), 0) INTO v_before FROM public.material_usage WHERE boq_item_id = p_boq_item_id;

  INSERT INTO public.material_usage (project_id, boq_item_id, recorded_by, quantity_used, usage_date, notes)
  VALUES (p_project_id, p_boq_item_id, auth.uid(), p_quantity, COALESCE(p_usage_date, CURRENT_DATE), NULLIF(trim(COALESCE(p_notes, '')), ''));

  v_after := v_before + p_quantity;
  v_total := v_item.qty;

  PERFORM public.notify_site_owner(p_project_id, 'usage', 'Usage updated',
    public.site_actor_name() || ' logged ' || trim(to_char(p_quantity, 'FM999999990.##')) || ' ' || COALESCE(v_item.unit, '') || ' of ' || v_item.material_name || '.');

  SELECT usage_low_stock_alert_enabled, usage_low_stock_threshold INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_total > 0 AND v_project.usage_low_stock_alert_enabled THEN
    v_pct_before := GREATEST(v_total - v_before, 0) / v_total * 100;
    v_pct_after := GREATEST(v_total - v_after, 0) / v_total * 100;
    IF v_pct_before > v_project.usage_low_stock_threshold AND v_pct_after <= v_project.usage_low_stock_threshold THEN
      INSERT INTO public.project_notifications (project_id, user_id, type, title, message)
      SELECT p.id, p.owner_id, 'low_stock', 'Low stock alert',
             v_item.material_name || ' is at ' || round(v_pct_after) || '% remaining (' ||
             trim(to_char(GREATEST(v_total - v_after, 0), 'FM999999990.##')) || ' ' || COALESCE(v_item.unit, '') || ').'
      FROM public.projects p WHERE p.id = p_project_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('used', v_after, 'remaining', GREATEST(v_total - v_after, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.site_log_usage(UUID, UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_log_usage(UUID, UUID, NUMERIC, DATE, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.site_set_task(p_task_id UUID, p_completed BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_task RECORD;
  v_access TEXT;
BEGIN
  SELECT t.id, t.title, t.is_completed, s.project_id, s.name AS stage_name INTO v_task
  FROM public.stage_tasks t JOIN public.project_stages s ON s.id = t.stage_id
  WHERE t.id = p_task_id;
  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found.';
  END IF;
  v_access := public.site_access(v_task.project_id);
  IF v_access NOT IN ('owner', 'edit') OR v_access IS NULL THEN
    RAISE EXCEPTION 'You can only follow this project, not update it.';
  END IF;

  UPDATE public.stage_tasks
  SET is_completed = p_completed,
      completed_at = CASE WHEN p_completed THEN NOW() ELSE NULL END,
      verification_note = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), verification_note)
  WHERE id = p_task_id;

  IF p_completed AND NOT v_task.is_completed THEN
    PERFORM public.notify_site_owner(v_task.project_id, 'progress', 'Task done: ' || v_task.title,
      public.site_actor_name() || ' marked "' || v_task.title || '" done (' || v_task.stage_name || ').');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.site_set_task(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_set_task(UUID, BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.site_set_stage_status(p_stage_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_stage RECORD;
  v_access TEXT;
BEGIN
  IF p_status NOT IN ('planning', 'in_progress', 'on_hold', 'completed') THEN
    RAISE EXCEPTION 'Unknown stage status.';
  END IF;
  SELECT id, project_id, name, status INTO v_stage FROM public.project_stages WHERE id = p_stage_id;
  IF v_stage.id IS NULL THEN
    RAISE EXCEPTION 'Stage not found.';
  END IF;
  v_access := public.site_access(v_stage.project_id);
  IF v_access NOT IN ('owner', 'edit') OR v_access IS NULL THEN
    RAISE EXCEPTION 'You can only follow this project, not update it.';
  END IF;
  IF v_stage.status = p_status THEN
    RETURN;
  END IF;

  UPDATE public.project_stages SET status = p_status, updated_at = NOW() WHERE id = p_stage_id;

  PERFORM public.notify_site_owner(v_stage.project_id, 'progress', v_stage.name || ': ' || replace(p_status, '_', ' '),
    public.site_actor_name() || ' set ' || v_stage.name || ' to ' || replace(p_status, '_', ' ') || '.');
END;
$$;
REVOKE ALL ON FUNCTION public.site_set_stage_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_set_stage_status(UUID, TEXT) TO authenticated;

-- ── 6. Email the owner about progress too ───────────────────────────────────
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
      jsonb_build_object('title', NEW.title, 'body', NEW.message, 'project_id', NEW.project_id, 'notification_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;
