-- ─── Quick estimates are real projects ───────────────────────────────────────
--
-- A quick estimate was treated as a throwaway calculation: a BOQ, a total, and
-- nothing else. But someone estimating a borehole wants the same things
-- someone building a house wants — to find a contractor, to get quotes and know
-- they are still waiting on them, to put money aside for a job three months
-- out, and to know what the job has to clear legally before it can be used.
--
-- What they do NOT want is a house workspace bolted on. Stages do not apply to
-- a borehole: there is no substructure, no roofing, no occupation certificate.
-- So this adds the parts that travel and leaves the parts that do not.

-- ============================================
-- 1. PLANNING AND COMPLIANCE ON THE ESTIMATE
-- ============================================

ALTER TABLE quick_boqs
  -- When they want it done. Null means "no date yet", which is a real and
  -- common answer, not a missing value to be defaulted.
  ADD COLUMN IF NOT EXISTS target_date DATE,
  -- What they have put aside so far.
  ADD COLUMN IF NOT EXISTS funds_saved_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- requirement id -> 'not_started' | 'in_progress' | 'done' | 'not_applicable'.
  -- JSONB rather than a table: the catalogue lives in application code and
  -- changes with it, so rows keyed on ids that code owns would drift and need
  -- migrating every time a requirement is added.
  ADD COLUMN IF NOT EXISTS compliance JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE quick_boqs
  DROP CONSTRAINT IF EXISTS quick_boqs_funds_saved_non_negative;
ALTER TABLE quick_boqs
  ADD CONSTRAINT quick_boqs_funds_saved_non_negative CHECK (funds_saved_usd >= 0);

COMMENT ON COLUMN quick_boqs.target_date IS
  'When the user wants this done. Drives the monthly savings figure.';
COMMENT ON COLUMN quick_boqs.funds_saved_usd IS
  'Money set aside so far. Forward-looking: not spend, which needs actuals.';
COMMENT ON COLUMN quick_boqs.compliance IS
  'Requirement id -> status. Catalogue lives in src/lib/quick-projects/compliance.ts.';

-- ============================================
-- 2. QUOTES AGAINST A QUICK ESTIMATE
-- ============================================
-- rfq_requests.project_id was NOT NULL against projects, so there was no way to
-- ask suppliers to quote a borehole. Rather than build a second, parallel quote
-- system, the existing one now accepts either owner.

ALTER TABLE rfq_requests
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE rfq_requests
  ADD COLUMN IF NOT EXISTS quick_boq_id UUID REFERENCES quick_boqs(id) ON DELETE CASCADE;

-- Exactly one owner. Without this a row could belong to both, or to neither and
-- be visible to nobody — RLS below is written assuming precisely one is set.
ALTER TABLE rfq_requests
  DROP CONSTRAINT IF EXISTS rfq_requests_exactly_one_owner;
ALTER TABLE rfq_requests
  ADD CONSTRAINT rfq_requests_exactly_one_owner CHECK (
    (project_id IS NOT NULL AND quick_boq_id IS NULL)
    OR (project_id IS NULL AND quick_boq_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_rfq_requests_quick_boq_id ON rfq_requests(quick_boq_id);

-- Ownership test for the quick side. SECURITY DEFINER and a pinned search_path
-- for the same reason the project helpers are: an RLS policy that reads a table
-- which is itself under RLS recurses.
CREATE OR REPLACE FUNCTION user_owns_quick_boq(p_quick_boq_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quick_boqs
    WHERE id = p_quick_boq_id AND user_id = p_user_id
  );
$$;

-- ============================================
-- 3. RLS
-- ============================================
-- Each policy gains the quick branch. The project branches are unchanged, so a
-- null project_id simply fails them and falls through to the new test.

DROP POLICY IF EXISTS "Project members can view RFQ requests" ON rfq_requests;
CREATE POLICY "Project members can view RFQ requests"
    ON rfq_requests FOR SELECT
    USING (
        (project_id IS NOT NULL AND (
            user_owns_project(project_id, auth.uid())
            OR project_shared_with_user(project_id, auth.uid())
        ))
        OR (quick_boq_id IS NOT NULL AND user_owns_quick_boq(quick_boq_id, auth.uid()))
        -- Suppliers still see the RFQs they were invited to, whichever kind.
        OR user_is_rfq_supplier(id, auth.uid())
    );

DROP POLICY IF EXISTS "Project members can create RFQ requests" ON rfq_requests;
CREATE POLICY "Project members can create RFQ requests"
    ON rfq_requests FOR INSERT
    WITH CHECK (
        (project_id IS NOT NULL AND (
            user_owns_project(project_id, auth.uid())
            OR user_has_edit_access(project_id, auth.uid())
        ))
        OR (quick_boq_id IS NOT NULL AND user_owns_quick_boq(quick_boq_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Project members can update RFQ requests" ON rfq_requests;
CREATE POLICY "Project members can update RFQ requests"
    ON rfq_requests FOR UPDATE
    USING (
        (project_id IS NOT NULL AND (
            user_owns_project(project_id, auth.uid())
            OR user_has_edit_access(project_id, auth.uid())
        ))
        OR (quick_boq_id IS NOT NULL AND user_owns_quick_boq(quick_boq_id, auth.uid()))
    );

-- ============================================
-- 4. CHILD TABLES: ITEMS, RECIPIENTS, QUOTES
-- ============================================
-- rfq_items, rfq_recipients and rfq_quotes do not test ownership directly; they
-- go through these two helpers. Both bail out early when the RFQ has no
-- project_id, which is now the normal case rather than a corrupt row — so
-- without this a quick estimate could create an RFQ and then not see its own
-- line items or the suppliers it had invited.

CREATE OR REPLACE FUNCTION rfq_quick_boq_id(p_rfq_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT quick_boq_id FROM rfq_requests WHERE id = p_rfq_id;
$$;

CREATE OR REPLACE FUNCTION user_can_view_rfq(p_rfq_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
    v_quick_boq_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- An invited supplier can see it whichever kind it is, so this is checked
    -- before either ownership branch.
    IF user_is_rfq_supplier(p_rfq_id, p_user_id) THEN
        RETURN TRUE;
    END IF;

    v_project_id := rfq_project_id(p_rfq_id);
    IF v_project_id IS NOT NULL THEN
        RETURN user_owns_project(v_project_id, p_user_id)
            OR project_shared_with_user(v_project_id, p_user_id);
    END IF;

    v_quick_boq_id := rfq_quick_boq_id(p_rfq_id);
    IF v_quick_boq_id IS NOT NULL THEN
        RETURN user_owns_quick_boq(v_quick_boq_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION user_can_edit_rfq(p_rfq_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
    v_quick_boq_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_project_id := rfq_project_id(p_rfq_id);
    IF v_project_id IS NOT NULL THEN
        RETURN user_owns_project(v_project_id, p_user_id)
            OR user_has_edit_access(v_project_id, p_user_id);
    END IF;

    -- No shared-edit equivalent on the quick side: a quick estimate has one
    -- owner and is not shared with collaborators.
    v_quick_boq_id := rfq_quick_boq_id(p_rfq_id);
    IF v_quick_boq_id IS NOT NULL THEN
        RETURN user_owns_quick_boq(v_quick_boq_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION user_owns_quick_boq(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rfq_quick_boq_id(UUID) TO authenticated;
