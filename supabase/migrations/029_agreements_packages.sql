-- ============================================
-- Migration 029: Supplier Agreements & Product Packages
-- ============================================

-- supplier_agreements: track T&C acceptance per supplier
CREATE TABLE IF NOT EXISTS supplier_agreements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    agreement_type  TEXT NOT NULL DEFAULT 'supplier_terms',
    version         TEXT NOT NULL DEFAULT '1.0',
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address      TEXT,
    user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_agreements_supplier_id ON supplier_agreements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_agreements_type ON supplier_agreements(agreement_type, version);

ALTER TABLE supplier_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own agreements"
    ON supplier_agreements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_id
              AND suppliers.user_id = auth.uid()
        )
    );

CREATE POLICY "Suppliers can record acceptance"
    ON supplier_agreements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_id
              AND suppliers.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all agreements"
    ON supplier_agreements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- product_packages: combo material bundles (Premium tier feature)
CREATE TABLE IF NOT EXISTS product_packages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id   UUID REFERENCES suppliers(id) ON DELETE CASCADE,  -- NULL = platform-wide
    name          TEXT NOT NULL,
    description   TEXT,
    items         JSONB NOT NULL DEFAULT '[]',
    -- items format: [{ material_key, material_name, quantity, unit, unit_price_usd }]
    discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0
                    CHECK (discount_pct >= 0 AND discount_pct <= 100),
    total_usd     NUMERIC(12,2),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_by    UUID REFERENCES profiles(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_packages_supplier_id ON product_packages(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_packages_is_active ON product_packages(is_active);

ALTER TABLE product_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
    ON product_packages FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage all packages"
    ON product_packages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- Premium suppliers can create and manage their own packages
CREATE POLICY "Premium suppliers can manage own packages"
    ON product_packages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM suppliers s
            JOIN supplier_subscriptions ss ON ss.supplier_id = s.id
            WHERE s.id = supplier_id
              AND s.user_id = auth.uid()
              AND ss.plan_id = 'premium'
              AND ss.status = 'active'
        )
    );
