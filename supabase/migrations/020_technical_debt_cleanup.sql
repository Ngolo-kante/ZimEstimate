-- Technical debt cleanup: indexes, soft deletes, pricing consolidation, supplier API keys

-- ============================================
-- 1. SOFT DELETES FOR SUPPLIERS
-- ============================================
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at);

-- Update supplier select/update policies to hide soft-deleted records
DROP POLICY IF EXISTS "Suppliers can view own profile" ON suppliers;
DROP POLICY IF EXISTS "Suppliers can update own profile" ON suppliers;

CREATE POLICY "Suppliers can view own profile"
    ON suppliers FOR SELECT
    USING (
        deleted_at IS NULL
        AND (
            user_id = auth.uid()
            OR is_trusted = true
            OR verification_status IN ('verified', 'trusted', 'premium')
        )
    );

CREATE POLICY "Suppliers can update own profile"
    ON suppliers FOR UPDATE
    USING (user_id = auth.uid() AND deleted_at IS NULL);

-- ============================================
-- 2. CONSOLIDATE weekly_prices INTO price_weekly
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'weekly_prices'
    ) THEN
        INSERT INTO price_weekly (
            material_key,
            week_start,
            avg_price_usd,
            sample_count,
            last_scraped_at
        )
        SELECT
            material_code,
            date_trunc('week', last_updated)::date,
            average_price,
            1,
            last_updated
        FROM weekly_prices
        WHERE material_code IS NOT NULL
        ON CONFLICT (material_key, week_start) DO UPDATE SET
            avg_price_usd = EXCLUDED.avg_price_usd,
            last_scraped_at = EXCLUDED.last_scraped_at,
            updated_at = NOW();

        DROP TABLE weekly_prices;
    END IF;
END $$;

-- Note: materials.id is UUID but price_weekly.material_key is TEXT (string key like 'cement_50kg')
-- These are incompatible for join. The view uses material_key directly as identifier.
CREATE OR REPLACE VIEW weekly_prices AS
SELECT
    gen_random_uuid() AS id,
    pw.material_key AS item_name,
    pw.material_key AS material_code,
    pw.avg_price_usd AS average_price,
    'USD'::text AS currency,
    NULL::text AS source_url,
    COALESCE(pw.last_scraped_at, pw.updated_at) AS last_updated
FROM price_weekly pw;

-- ============================================
-- 3. FREQUENT QUERY INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_project_id ON boq_items(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_project_id ON purchase_records(project_id);
CREATE INDEX IF NOT EXISTS idx_rfq_requests_project_id ON rfq_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq_id ON rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_rfq_id ON rfq_quotes(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_supplier_id ON rfq_quotes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_recipients_supplier_id ON rfq_recipients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notifications_user_id ON project_notifications(user_id);

-- ============================================
-- 4. SUPPLIER API KEYS
-- ============================================
CREATE TABLE IF NOT EXISTS supplier_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supplier_api_keys_supplier_id ON supplier_api_keys(supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_api_keys_prefix ON supplier_api_keys(key_prefix);

ALTER TABLE supplier_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own api keys"
    ON supplier_api_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_api_keys.supplier_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Suppliers can manage own api keys"
    ON supplier_api_keys FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_api_keys.supplier_id
            AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_api_keys.supplier_id
            AND s.user_id = auth.uid()
        )
    );
