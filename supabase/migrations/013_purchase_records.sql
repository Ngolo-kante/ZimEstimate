-- Purchase records for multi-supplier tracking

-- ============================================
-- 1. PURCHASE RECORDS TABLE
-- ============================================

-- Ensure edit-access helper exists
CREATE OR REPLACE FUNCTION user_has_edit_access(project_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_shares ps
        WHERE ps.project_id = $1
        AND ps.shared_with_user_id = $2
        AND ps.access_level = 'edit'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE TABLE IF NOT EXISTS purchase_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    boq_item_id UUID NOT NULL REFERENCES boq_items(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name TEXT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit_price_usd DECIMAL(12,2) NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_records_project_id ON purchase_records(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_boq_item_id ON purchase_records(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_supplier_name ON purchase_records(supplier_name);

-- Update updated_at on changes
CREATE TRIGGER update_purchase_records_updated_at
    BEFORE UPDATE ON purchase_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. BOQ ITEMS SYNC (ACTUALS + PURCHASED STATUS)
-- ============================================

CREATE OR REPLACE FUNCTION update_boq_item_purchase_totals(p_boq_item_id UUID)
RETURNS VOID AS $$
DECLARE
    total_qty NUMERIC;
    weighted_price NUMERIC;
    latest_purchase TIMESTAMPTZ;
    est_qty NUMERIC;
BEGIN
    SELECT
        COALESCE(SUM(quantity), 0),
        CASE WHEN SUM(quantity) > 0 THEN SUM(quantity * unit_price_usd) / SUM(quantity) ELSE NULL END,
        MAX(purchased_at)
    INTO total_qty, weighted_price, latest_purchase
    FROM purchase_records
    WHERE boq_item_id = p_boq_item_id;

    SELECT quantity INTO est_qty
    FROM boq_items
    WHERE id = p_boq_item_id;

    UPDATE boq_items
    SET actual_quantity = CASE WHEN total_qty = 0 THEN NULL ELSE total_qty END,
        actual_price_usd = weighted_price,
        is_purchased = CASE WHEN est_qty IS NOT NULL AND total_qty >= est_qty THEN TRUE ELSE FALSE END,
        purchased_date = latest_purchase
    WHERE id = p_boq_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sync_boq_item_purchase_totals()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_boq_item_purchase_totals(COALESCE(NEW.boq_item_id, OLD.boq_item_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_boq_item_purchase_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_records
    FOR EACH ROW EXECUTE FUNCTION sync_boq_item_purchase_totals();

-- ============================================
-- 3. RLS POLICIES
-- ============================================

ALTER TABLE purchase_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project purchase records"
    ON purchase_records FOR SELECT
    USING (
        user_owns_project(project_id, auth.uid())
        OR project_shared_with_user(project_id, auth.uid())
    );

CREATE POLICY "Users can create purchase records"
    ON purchase_records FOR INSERT
    WITH CHECK (
        (user_owns_project(project_id, auth.uid()) OR user_has_edit_access(project_id, auth.uid()))
        AND auth.uid() = created_by
    );

CREATE POLICY "Users can update purchase records"
    ON purchase_records FOR UPDATE
    USING (
        user_owns_project(project_id, auth.uid())
        OR user_has_edit_access(project_id, auth.uid())
    );

CREATE POLICY "Users can delete purchase records"
    ON purchase_records FOR DELETE
    USING (
        user_owns_project(project_id, auth.uid())
        OR user_has_edit_access(project_id, auth.uid())
    );
