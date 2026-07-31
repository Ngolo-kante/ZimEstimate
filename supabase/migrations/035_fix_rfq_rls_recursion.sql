-- ============================================
-- 035: Break the RFQ row-level-security recursion
-- ============================================
--
-- Every RFQ table was unreadable for normal users. Postgres aborted each query
-- with 42P17 "infinite recursion detected in policy for relation rfq_requests",
-- surfacing as an HTTP 500 from PostgREST, because two policies referenced each
-- other:
--
--   rfq_requests SELECT   -> EXISTS (SELECT ... FROM rfq_recipients ...)
--   rfq_recipients SELECT -> EXISTS (SELECT ... FROM rfq_requests ...)
--
-- Reading either table re-entered the other's policy forever. Every child table
-- (rfq_items, rfq_quotes, rfq_quote_items, rfq_notification_queue) reaches
-- rfq_requests through its own policy, so all of them inherited the failure.
--
-- Migration 003 already solved this same class of bug for projects by moving
-- the membership check into SECURITY DEFINER helpers, which run as the function
-- owner and therefore do not re-trigger RLS. Migration 018 reintroduced it for
-- the RFQ tables. This migration applies the established pattern to them.

-- ============================================
-- 1. SECURITY DEFINER ACCESS HELPERS
-- ============================================

-- Is this user the supplier on the given RFQ? Reads rfq_recipients and
-- suppliers with RLS bypassed, which is what breaks the cycle.
CREATE OR REPLACE FUNCTION user_is_rfq_supplier(p_rfq_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1
        FROM rfq_recipients rr
        JOIN suppliers s ON s.id = rr.supplier_id
        WHERE rr.rfq_id = p_rfq_id
          AND s.user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Does this user own the supplier record? Used where a policy only needs the
-- supplier side and would otherwise trigger the suppliers table's own RLS.
CREATE OR REPLACE FUNCTION user_owns_supplier(p_supplier_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM suppliers s
        WHERE s.id = p_supplier_id
          AND s.user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Resolve the owning project of an RFQ without reading rfq_requests under RLS.
CREATE OR REPLACE FUNCTION rfq_project_id(p_rfq_id UUID)
RETURNS UUID AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM rfq_requests WHERE id = p_rfq_id;
    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Can the user see this RFQ: as project member, or as an invited supplier.
CREATE OR REPLACE FUNCTION user_can_view_rfq(p_rfq_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    v_project_id := rfq_project_id(p_rfq_id);
    IF v_project_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN user_owns_project(v_project_id, p_user_id)
        OR project_shared_with_user(v_project_id, p_user_id)
        OR user_is_rfq_supplier(p_rfq_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Can the user change this RFQ: project owner or shared-with-edit only.
CREATE OR REPLACE FUNCTION user_can_edit_rfq(p_rfq_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    v_project_id := rfq_project_id(p_rfq_id);
    IF v_project_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN user_owns_project(v_project_id, p_user_id)
        OR user_has_edit_access(v_project_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Quote-scoped variants, so quote-item policies need only one hop.
CREATE OR REPLACE FUNCTION user_can_view_quote(p_quote_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_rfq_id UUID;
    v_supplier_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    SELECT rfq_id, supplier_id INTO v_rfq_id, v_supplier_id
    FROM rfq_quotes WHERE id = p_quote_id;
    IF v_rfq_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN user_can_view_rfq(v_rfq_id, p_user_id)
        OR user_owns_supplier(v_supplier_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_owns_quote_supplier(p_quote_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_supplier_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    SELECT supplier_id INTO v_supplier_id FROM rfq_quotes WHERE id = p_quote_id;
    RETURN user_owns_supplier(v_supplier_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 2. RFQ REQUESTS
-- ============================================
DROP POLICY IF EXISTS "Project members can view RFQ requests" ON rfq_requests;
CREATE POLICY "Project members can view RFQ requests"
    ON rfq_requests FOR SELECT
    USING (
        user_owns_project(project_id, auth.uid())
        OR project_shared_with_user(project_id, auth.uid())
        OR user_is_rfq_supplier(id, auth.uid())
    );

-- ============================================
-- 3. RFQ RECIPIENTS
-- ============================================
DROP POLICY IF EXISTS "Project members can view RFQ recipients" ON rfq_recipients;
CREATE POLICY "Project members can view RFQ recipients"
    ON rfq_recipients FOR SELECT
    USING (
        user_can_view_rfq(rfq_id, auth.uid())
        OR user_owns_supplier(supplier_id, auth.uid())
    );

DROP POLICY IF EXISTS "Project members can create RFQ recipients" ON rfq_recipients;
CREATE POLICY "Project members can create RFQ recipients"
    ON rfq_recipients FOR INSERT
    WITH CHECK (user_can_edit_rfq(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Suppliers can update own RFQ recipient status" ON rfq_recipients;
CREATE POLICY "Suppliers can update own RFQ recipient status"
    ON rfq_recipients FOR UPDATE
    USING (user_owns_supplier(supplier_id, auth.uid()));

-- ============================================
-- 4. RFQ ITEMS
-- ============================================
DROP POLICY IF EXISTS "Project members can view RFQ items" ON rfq_items;
CREATE POLICY "Project members can view RFQ items"
    ON rfq_items FOR SELECT
    USING (user_can_view_rfq(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Project members can create RFQ items" ON rfq_items;
CREATE POLICY "Project members can create RFQ items"
    ON rfq_items FOR INSERT
    WITH CHECK (user_can_edit_rfq(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Project members can update RFQ items" ON rfq_items;
CREATE POLICY "Project members can update RFQ items"
    ON rfq_items FOR UPDATE
    USING (user_can_edit_rfq(rfq_id, auth.uid()));

-- ============================================
-- 5. RFQ QUOTES
-- ============================================
DROP POLICY IF EXISTS "Project members can view RFQ quotes" ON rfq_quotes;
CREATE POLICY "Project members can view RFQ quotes"
    ON rfq_quotes FOR SELECT
    USING (
        user_can_view_rfq(rfq_id, auth.uid())
        OR user_owns_supplier(supplier_id, auth.uid())
    );

DROP POLICY IF EXISTS "Suppliers can create RFQ quotes" ON rfq_quotes;
CREATE POLICY "Suppliers can create RFQ quotes"
    ON rfq_quotes FOR INSERT
    WITH CHECK (user_owns_supplier(supplier_id, auth.uid()));

DROP POLICY IF EXISTS "Project members and suppliers can update RFQ quotes" ON rfq_quotes;
CREATE POLICY "Project members and suppliers can update RFQ quotes"
    ON rfq_quotes FOR UPDATE
    USING (
        user_can_edit_rfq(rfq_id, auth.uid())
        OR user_owns_supplier(supplier_id, auth.uid())
    );

-- ============================================
-- 6. RFQ QUOTE ITEMS
-- ============================================
DROP POLICY IF EXISTS "Project members can view RFQ quote items" ON rfq_quote_items;
CREATE POLICY "Project members can view RFQ quote items"
    ON rfq_quote_items FOR SELECT
    USING (user_can_view_quote(quote_id, auth.uid()));

DROP POLICY IF EXISTS "Suppliers can create RFQ quote items" ON rfq_quote_items;
CREATE POLICY "Suppliers can create RFQ quote items"
    ON rfq_quote_items FOR INSERT
    WITH CHECK (user_owns_quote_supplier(quote_id, auth.uid()));

DROP POLICY IF EXISTS "Suppliers can update RFQ quote items" ON rfq_quote_items;
CREATE POLICY "Suppliers can update RFQ quote items"
    ON rfq_quote_items FOR UPDATE
    USING (user_owns_quote_supplier(quote_id, auth.uid()));

-- Suppliers must be able to delete their own quote lines: submitSupplierQuote
-- clears them before re-inserting when a quote is revised. Without this the
-- delete silently affected zero rows and revised quotes accumulated duplicates.
DROP POLICY IF EXISTS "Suppliers can delete own RFQ quote items" ON rfq_quote_items;
CREATE POLICY "Suppliers can delete own RFQ quote items"
    ON rfq_quote_items FOR DELETE
    USING (user_owns_quote_supplier(quote_id, auth.uid()));

-- ============================================
-- 7. RFQ NOTIFICATION QUEUE
-- ============================================
DROP POLICY IF EXISTS "Project members can view RFQ notification queue" ON rfq_notification_queue;
CREATE POLICY "Project members can view RFQ notification queue"
    ON rfq_notification_queue FOR SELECT
    USING (
        user_can_view_rfq(rfq_id, auth.uid())
        OR user_owns_supplier(supplier_id, auth.uid())
    );

DROP POLICY IF EXISTS "Project members can create RFQ notification queue" ON rfq_notification_queue;
CREATE POLICY "Project members can create RFQ notification queue"
    ON rfq_notification_queue FOR INSERT
    WITH CHECK (user_can_edit_rfq(rfq_id, auth.uid()));

DROP POLICY IF EXISTS "Project members can update RFQ notification queue" ON rfq_notification_queue;
CREATE POLICY "Project members can update RFQ notification queue"
    ON rfq_notification_queue FOR UPDATE
    USING (user_can_edit_rfq(rfq_id, auth.uid()));

-- ============================================
-- 8. SUPPLIER NOTIFICATION DELIVERY LOGS
-- ============================================
-- notification_deliveries restricts inserts to auth.uid() = user_id, which is
-- correct: nobody should be able to forge notifications for another account.
-- But raising an RFQ has to write a delivery row addressed to each *supplier*,
-- so the builder's insert was rejected 403 and suppliers were never told an RFQ
-- existed. Route it through a definer function that verifies the caller may
-- edit the RFQ and only writes rows for suppliers actually invited to it.
CREATE OR REPLACE FUNCTION log_rfq_supplier_notifications(
    p_rfq_id UUID,
    p_rows JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_row JSONB;
    v_user_id UUID;
    v_count INTEGER := 0;
BEGIN
    IF NOT user_can_edit_rfq(p_rfq_id, auth.uid()) THEN
        RAISE EXCEPTION 'Not authorised to notify suppliers for this RFQ';
    END IF;

    FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
        v_user_id := (v_row ->> 'user_id')::UUID;

        -- Only suppliers invited to this RFQ may be addressed.
        IF NOT user_is_rfq_supplier(p_rfq_id, v_user_id) THEN
            CONTINUE;
        END IF;

        INSERT INTO notification_deliveries (user_id, channel, template_key, payload)
        VALUES (
            v_user_id,
            v_row ->> 'channel',
            v_row ->> 'template_key',
            v_row -> 'payload'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_rfq_supplier_notifications(UUID, JSONB) TO authenticated;
