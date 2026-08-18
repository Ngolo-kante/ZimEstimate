-- Harden privileged database interfaces reported by the Supabase advisor.
-- Keep trusted implementation functions outside the exposed API schema and
-- expose only wrappers that validate the authenticated caller.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS directory_projection;
REVOKE ALL ON SCHEMA directory_projection FROM PUBLIC, anon, authenticated;

-- Preserve the existing transaction implementations, but make them impossible
-- to call through PostgREST or directly as an API role.
ALTER FUNCTION public.create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) SET SCHEMA private;
ALTER FUNCTION private.create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) RENAME TO create_rfq_with_items_and_recipients_unchecked;
ALTER FUNCTION private.create_rfq_with_items_and_recipients_unchecked(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION private.create_rfq_with_items_and_recipients_unchecked(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_rfq_with_items_and_recipients(
    p_project_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_required_by DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_recipients JSONB DEFAULT '[]'::jsonb,
    p_quick_boq_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
    IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Not authorised to create an RFQ for this account';
    END IF;

    IF num_nonnulls(p_project_id, p_quick_boq_id) <> 1 THEN
        RAISE EXCEPTION 'An RFQ must belong to exactly one project or quick estimate';
    END IF;

    IF p_project_id IS NOT NULL
       AND NOT (
           public.user_owns_project(p_project_id, auth.uid())
           OR public.user_has_edit_access(p_project_id, auth.uid())
       ) THEN
        RAISE EXCEPTION 'Not authorised to create an RFQ for this project';
    END IF;

    IF p_quick_boq_id IS NOT NULL
       AND NOT public.user_owns_quick_boq(p_quick_boq_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised to create an RFQ for this quick estimate';
    END IF;

    RETURN private.create_rfq_with_items_and_recipients_unchecked(
        p_project_id,
        p_user_id,
        p_delivery_address,
        p_required_by,
        p_notes,
        p_items,
        p_recipients,
        p_quick_boq_id
    );
END;
$$;

-- Supplier approval functions previously trusted a caller-supplied reviewer id
-- and did not verify that the caller was an administrator.
ALTER FUNCTION public.approve_supplier_application(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION private.approve_supplier_application(UUID, UUID)
    RENAME TO approve_supplier_application_unchecked;
ALTER FUNCTION private.approve_supplier_application_unchecked(UUID, UUID)
    SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION private.approve_supplier_application_unchecked(UUID, UUID)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.approve_supplier_application(
    p_application_id UUID,
    p_reviewer_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR p_reviewer_id IS DISTINCT FROM auth.uid()
       OR NOT public.current_user_is_admin() THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    RETURN private.approve_supplier_application_unchecked(
        p_application_id,
        auth.uid()
    );
END;
$$;

ALTER FUNCTION public.reject_supplier_application(UUID, UUID, TEXT) SET SCHEMA private;
ALTER FUNCTION private.reject_supplier_application(UUID, UUID, TEXT)
    RENAME TO reject_supplier_application_unchecked;
ALTER FUNCTION private.reject_supplier_application_unchecked(UUID, UUID, TEXT)
    SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION private.reject_supplier_application_unchecked(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.reject_supplier_application(
    p_application_id UUID,
    p_reviewer_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
BEGIN
    IF auth.uid() IS NULL
       OR p_reviewer_id IS DISTINCT FROM auth.uid()
       OR NOT public.current_user_is_admin() THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    PERFORM private.reject_supplier_application_unchecked(
        p_application_id,
        auth.uid(),
        p_reason
    );
END;
$$;

-- weekly_prices can respect the existing price_weekly public-read policy.
ALTER VIEW public.weekly_prices
    SET (security_invoker = true, security_barrier = true);

-- The contractor directory needs a public projection while the underlying
-- owner record contains private settings. Put that projection in a narrowly
-- scoped private function, then make the API-facing view security-invoker.
CREATE OR REPLACE FUNCTION directory_projection.list_public_contractors()
RETURNS TABLE (
    id UUID,
    company_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    trades TEXT[],
    service_areas TEXT[],
    years_experience INTEGER,
    about TEXT,
    is_verified BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT
        c.id,
        c.company_name,
        c.contact_phone,
        c.contact_email,
        c.trades,
        c.service_areas,
        c.years_experience,
        c.about,
        c.is_verified,
        c.created_at,
        c.updated_at
    FROM public.contractors c
    WHERE c.is_listed = TRUE
      AND c.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION directory_projection.list_public_contractors()
    FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA directory_projection TO anon, authenticated;
GRANT EXECUTE ON FUNCTION directory_projection.list_public_contractors()
    TO anon, authenticated;

CREATE OR REPLACE VIEW public.public_contractors
WITH (security_invoker = true, security_barrier = true)
AS
SELECT * FROM directory_projection.list_public_contractors();

REVOKE ALL ON TABLE public.public_contractors FROM PUBLIC;
GRANT SELECT ON TABLE public.public_contractors TO anon, authenticated;

-- These helpers referenced project_milestones after that table was removed in
-- migration 021. Nothing can depend on them now, and they make database lint fail.
DROP FUNCTION IF EXISTS public.user_owns_milestone_project(UUID, UUID);
DROP FUNCTION IF EXISTS public.milestone_project_shared_with_user(UUID, UUID);

-- The original function used selected_stages as both a variable and a column,
-- which is ambiguous in PL/pgSQL and can abort project creation at runtime.
CREATE OR REPLACE FUNCTION public.create_default_stages(
    p_project_id UUID,
    p_scope TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    stage_config RECORD;
    new_stage_id UUID;
    task_item JSONB;
    task_sort INTEGER;
    v_selected_stages TEXT[];
BEGIN
    SELECT p.selected_stages
    INTO v_selected_stages
    FROM public.projects p
    WHERE p.id = p_project_id;

    FOR stage_config IN
        SELECT dsc.*
        FROM public.default_stage_config dsc
        ORDER BY dsc.sort_order
    LOOP
        INSERT INTO public.project_stages (
            project_id,
            boq_category,
            name,
            description,
            sort_order,
            is_applicable,
            status
        ) VALUES (
            p_project_id,
            stage_config.boq_category,
            stage_config.name,
            stage_config.description,
            stage_config.sort_order,
            CASE
                WHEN v_selected_stages IS NULL
                     OR array_length(v_selected_stages, 1) IS NULL THEN
                    p_scope = 'entire_house'
                    OR p_scope = stage_config.boq_category
                ELSE stage_config.boq_category = ANY(v_selected_stages)
            END,
            'planning'
        )
        RETURNING id INTO new_stage_id;

        task_sort := 0;
        FOR task_item IN
            SELECT value
            FROM jsonb_array_elements(stage_config.default_tasks)
        LOOP
            INSERT INTO public.stage_tasks (
                stage_id,
                title,
                description,
                sort_order,
                is_default,
                is_completed
            ) VALUES (
                new_stage_id,
                task_item->>'title',
                task_item->>'description',
                task_sort,
                TRUE,
                FALSE
            );
            task_sort := task_sort + 1;
        END LOOP;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_create_project_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    PERFORM public.create_default_stages(NEW.id, NEW.scope::TEXT);
    RETURN NEW;
END;
$$;

-- Pin every advisor-reported mutable function to trusted schemas. Using a name
-- list intentionally covers every overload without altering extension-owned
-- functions that may also live in public.
DO $$
DECLARE
    fn REGPROCEDURE;
BEGIN
    FOR fn IN
        SELECT p.oid::REGPROCEDURE
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = ANY (ARRAY[
              'approve_supplier_application',
              'can_create_project',
              'create_default_stages',
              'create_rfq_with_items_and_recipients',
              'current_user_is_admin',
              'enqueue_due_project_reminders',
              'get_pending_reminders',
              'get_project_purchase_stats',
              'get_user_project_count',
              'handle_new_user',
              'log_rfq_supplier_notifications',
              'mark_reminder_sent',
              'project_shared_with_user',
              'register_as_contractor',
              'reject_supplier_application',
              'rfq_project_id',
              'stage_project_shared_with_user',
              'sync_boq_item_purchase_totals',
              'trigger_create_project_stages',
              'update_boq_item_purchase_totals',
              'update_project_totals',
              'update_stage_updated_at',
              'update_updated_at_column',
              'user_can_view_quote',
              'user_has_edit_access',
              'user_has_stage_edit_access',
              'user_is_rfq_supplier',
              'user_owns_project',
              'user_owns_quote_supplier',
              'user_owns_stage_project',
              'user_owns_supplier'
          ])
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %s SET search_path = pg_catalog, public',
            fn
        );
    END LOOP;
END;
$$;

-- PostgreSQL grants function execution to PUBLIC by default. Remove that
-- implicit API surface from every privileged function in the exposed schema.
DO $$
DECLARE
    fn REGPROCEDURE;
BEGIN
    FOR fn IN
        SELECT p.oid::REGPROCEDURE
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef
    LOOP
        EXECUTE format(
            'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
            fn
        );
    END LOOP;
END;
$$;

-- Deliberate public aggregate: it returns counts, never source rows.
GRANT EXECUTE ON FUNCTION public.public_demand_stats() TO anon, authenticated;

-- Deliberate signed-in commands with caller validation in their bodies.
GRANT EXECUTE ON FUNCTION public.register_as_contractor(
    TEXT, TEXT, TEXT, TEXT[], TEXT[], INTEGER, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_rfq_supplier_notifications(UUID, JSONB)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_supplier_application(UUID, UUID)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_supplier_application(UUID, UUID, TEXT)
    TO authenticated;

-- RLS policies call these helpers as the signed-in user. Their outputs are
-- booleans or owning ids; none returns protected row contents.
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_shared_with_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_edit_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_stage_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stage_project_shared_with_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_stage_edit_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_rfq_supplier(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_supplier(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_quick_boq(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_rfq(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_rfq(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_quote(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_quote_supplier(UUID, UUID) TO authenticated;

-- Reminder dispatch is server-only and uses the service-role client.
GRANT EXECUTE ON FUNCTION public.get_pending_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_reminder_sent(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_due_project_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER)
    TO service_role;

COMMENT ON FUNCTION public.create_rfq_with_items_and_recipients(
    UUID, UUID, TEXT, DATE, TEXT, JSONB, JSONB, UUID
) IS
'Authenticated RFQ transaction boundary. The caller must own or edit the supplied project or own the quick estimate.';

COMMENT ON FUNCTION public.approve_supplier_application(UUID, UUID) IS
'Admin-only supplier approval boundary. The reviewer must be the authenticated administrator.';

COMMENT ON FUNCTION public.reject_supplier_application(UUID, UUID, TEXT) IS
'Admin-only supplier rejection boundary. The reviewer must be the authenticated administrator.';
