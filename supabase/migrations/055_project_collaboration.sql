-- ─── Inviting people to manage a project, and telling them things ─────────
--
-- Sharing existed in the schema and the UI but did not work end to end:
--
-- 1. An invite stored the email but never the invitee's account. The browser
--    looked the account up in profiles, which RLS only lets people read for
--    themselves, so shared_with_user_id was always NULL — and nothing linked
--    it later. Every policy that grants access checks shared_with_user_id, so
--    no invitee ever saw the project.
-- 2. "Can edit" granted nothing beyond what "Can view" did: projects, BOQ
--    items and stages were writable by the owner only.
-- 3. There was no UPDATE policy on project_shares, so changing someone's
--    access silently did nothing.
--
-- Invites are now created by the server (/api/projects/[id]/invite), which
-- can see the account if one exists. When there is none yet, the share waits
-- under the email and link_my_project_invites() attaches it after that person
-- signs up and confirms the address — only a confirmed email, so nobody can
-- claim an invite by registering someone else's address unverified.
--
-- Editors can change the project, its BOQ, stages, usage and utilities. They
-- cannot delete the project, hand it to someone else, or share it onward:
-- those stay with the owner.

-- ── 1. Who invited whom ─────────────────────────────────────────────────────
ALTER TABLE public.project_shares
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Emails are matched case-insensitively from now on.
UPDATE public.project_shares SET shared_with_email = lower(trim(shared_with_email))
WHERE shared_with_email <> lower(trim(shared_with_email));

CREATE INDEX IF NOT EXISTS idx_project_shares_pending_email
  ON public.project_shares (shared_with_email)
  WHERE shared_with_user_id IS NULL;

-- ── 2. Owners can change someone's access ───────────────────────────────────
DROP POLICY IF EXISTS "Project owners can update shares" ON public.project_shares;
CREATE POLICY "Project owners can update shares"
  ON public.project_shares FOR UPDATE
  USING (public.user_owns_project(project_id, auth.uid()))
  WITH CHECK (public.user_owns_project(project_id, auth.uid()));

-- ── 3. Editors can manage the project ───────────────────────────────────────
DROP POLICY IF EXISTS "Shared editors can update projects" ON public.projects;
CREATE POLICY "Shared editors can update projects"
  ON public.projects FOR UPDATE
  USING (public.user_has_edit_access(id, auth.uid()))
  WITH CHECK (public.user_has_edit_access(id, auth.uid()));

-- RLS cannot compare old and new values, so the owner column is guarded here:
-- an editor can rename or re-budget a project but not make it theirs.
CREATE OR REPLACE FUNCTION public.keep_project_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only the owner can transfer a project';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_project_owner ON public.projects;
CREATE TRIGGER keep_project_owner
  BEFORE UPDATE OF owner_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.keep_project_owner();

DROP POLICY IF EXISTS "Shared editors can add BOQ items" ON public.boq_items;
CREATE POLICY "Shared editors can add BOQ items"
  ON public.boq_items FOR INSERT
  WITH CHECK (public.user_has_edit_access(project_id, auth.uid()));
DROP POLICY IF EXISTS "Shared editors can update BOQ items" ON public.boq_items;
CREATE POLICY "Shared editors can update BOQ items"
  ON public.boq_items FOR UPDATE
  USING (public.user_has_edit_access(project_id, auth.uid()))
  WITH CHECK (public.user_has_edit_access(project_id, auth.uid()));
DROP POLICY IF EXISTS "Shared editors can delete BOQ items" ON public.boq_items;
CREATE POLICY "Shared editors can delete BOQ items"
  ON public.boq_items FOR DELETE
  USING (public.user_has_edit_access(project_id, auth.uid()));

DROP POLICY IF EXISTS "Shared editors can add project stages" ON public.project_stages;
CREATE POLICY "Shared editors can add project stages"
  ON public.project_stages FOR INSERT
  WITH CHECK (public.user_has_edit_access(project_id, auth.uid()));
DROP POLICY IF EXISTS "Shared editors can update project stages" ON public.project_stages;
CREATE POLICY "Shared editors can update project stages"
  ON public.project_stages FOR UPDATE
  USING (public.user_has_edit_access(project_id, auth.uid()))
  WITH CHECK (public.user_has_edit_access(project_id, auth.uid()));
DROP POLICY IF EXISTS "Shared editors can delete project stages" ON public.project_stages;
CREATE POLICY "Shared editors can delete project stages"
  ON public.project_stages FOR DELETE
  USING (public.user_has_edit_access(project_id, auth.uid()));

DROP POLICY IF EXISTS "Shared editors can update material usage" ON public.material_usage;
CREATE POLICY "Shared editors can update material usage"
  ON public.material_usage FOR UPDATE
  USING (public.user_has_edit_access(project_id, auth.uid()))
  WITH CHECK (public.user_has_edit_access(project_id, auth.uid()));
DROP POLICY IF EXISTS "Shared editors can delete material usage" ON public.material_usage;
CREATE POLICY "Shared editors can delete material usage"
  ON public.material_usage FOR DELETE
  USING (public.user_has_edit_access(project_id, auth.uid()));

DROP POLICY IF EXISTS "Shared users can view utility configs" ON public.project_utility_configs;
CREATE POLICY "Shared users can view utility configs"
  ON public.project_utility_configs FOR SELECT
  USING (public.project_shared_with_user(project_id, auth.uid()));
DROP POLICY IF EXISTS "Shared editors can manage utility configs" ON public.project_utility_configs;
CREATE POLICY "Shared editors can manage utility configs"
  ON public.project_utility_configs FOR ALL
  USING (public.user_has_edit_access(project_id, auth.uid()))
  WITH CHECK (public.user_has_edit_access(project_id, auth.uid()));

-- Notifications: the invite route (service role) writes the invitee's; the
-- owner reads and clears their own. Anyone on the project may still only
-- notify the owner (policy from migration 011).
DROP POLICY IF EXISTS "Users can update own notifications" ON public.project_notifications;
CREATE POLICY "Users can update own notifications"
  ON public.project_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.project_notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.project_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ── 4. Attaching waiting invites to the account they were sent to ─────────
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
    -- Tell the owner their invite was taken up.
    INSERT INTO public.project_notifications (project_id, user_id, type, title, message)
    SELECT pr.id, pr.owner_id, 'collaborator_joined',
           COALESCE(v_name, 'Someone') || ' joined ' || pr.name,
           COALESCE(v_name, 'Someone') || ' accepted your invitation and can now open ' || pr.name || '.'
    FROM public.projects pr
    WHERE pr.id = v_share.project_id AND pr.owner_id IS DISTINCT FROM v_uid;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_project_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_project_invites() TO authenticated;

-- ── 5. Email for the notifications that matter, if the person wants email ─
-- Queued, then sent by the dispatcher (src/lib/server/notificationDispatch.ts),
-- which now also runs right after something is queued rather than only on
-- the daily job. Price-update notices are in-app only: they are created on
-- every visit and would be noise by email.
CREATE OR REPLACE FUNCTION public.queue_project_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.type NOT IN ('project_shared', 'collaborator_joined', 'usage', 'low_stock') THEN
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
  -- An email that cannot be queued must never undo the in-app notice.
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_project_notification_email() FROM PUBLIC;

DROP TRIGGER IF EXISTS queue_project_notification_email ON public.project_notifications;
CREATE TRIGGER queue_project_notification_email
  AFTER INSERT ON public.project_notifications
  FOR EACH ROW EXECUTE FUNCTION public.queue_project_notification_email();

CREATE INDEX IF NOT EXISTS idx_project_notifications_user_unread
  ON public.project_notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;
