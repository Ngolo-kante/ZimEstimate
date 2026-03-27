-- ============================================
-- Migration 027: Monetization Core
-- Adds subscription plans, supplier subscriptions, and payment history
-- ============================================

-- subscription_plans: static plan definitions
CREATE TABLE IF NOT EXISTS subscription_plans (
    id            TEXT PRIMARY KEY,           -- 'basic' | 'pro' | 'premium'
    name          TEXT NOT NULL,
    price_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_zwg     NUMERIC(12,2) NOT NULL DEFAULT 0,
    features      JSONB NOT NULL DEFAULT '{}',
    max_products  INTEGER,                    -- NULL = unlimited
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans (id, name, price_usd, price_zwg, max_products, features) VALUES
(
    'basic',
    'Basic',
    0,
    0,
    10,
    '{"priority_search":false,"advanced_analytics":false,"contact_requests":false,"verified_badge":false,"featured_listing":false,"api_access":false,"product_packages":false}'
),
(
    'pro',
    'Pro',
    15,
    570,
    NULL,
    '{"priority_search":true,"advanced_analytics":true,"contact_requests":true,"verified_badge":true,"featured_listing":false,"api_access":false,"product_packages":false}'
),
(
    'premium',
    'Premium',
    35,
    1330,
    NULL,
    '{"priority_search":true,"advanced_analytics":true,"contact_requests":true,"verified_badge":true,"featured_listing":true,"api_access":true,"product_packages":true}'
)
ON CONFLICT (id) DO NOTHING;

-- supplier_subscriptions: one active subscription per supplier
CREATE TABLE IF NOT EXISTS supplier_subscriptions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id               UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    plan_id                   TEXT NOT NULL REFERENCES subscription_plans(id),
    status                    TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
    payment_provider          TEXT CHECK (payment_provider IN ('stripe', 'paynow', 'manual')),
    provider_subscription_id  TEXT,
    current_period_start      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    cancel_at_period_end      BOOLEAN NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_subscriptions_supplier_id ON supplier_subscriptions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_subscriptions_status ON supplier_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_supplier_subscriptions_period_end ON supplier_subscriptions(current_period_end);

ALTER TABLE supplier_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own subscription"
    ON supplier_subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_id
              AND suppliers.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all subscriptions"
    ON supplier_subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

CREATE POLICY "Admins can manage subscriptions"
    ON supplier_subscriptions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- subscription_payments: payment history ledger
CREATE TABLE IF NOT EXISTS subscription_payments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id       UUID NOT NULL REFERENCES supplier_subscriptions(id) ON DELETE CASCADE,
    supplier_id           UUID NOT NULL REFERENCES suppliers(id),
    amount                NUMERIC(12,2) NOT NULL,
    currency              TEXT NOT NULL CHECK (currency IN ('USD', 'ZWG')),
    payment_provider      TEXT NOT NULL CHECK (payment_provider IN ('stripe', 'paynow', 'manual')),
    provider_payment_id   TEXT,
    status                TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    billing_period_start  TIMESTAMPTZ,
    billing_period_end    TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate payment recording
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_provider_id
    ON subscription_payments(provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_supplier_id ON subscription_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created_at ON subscription_payments(created_at DESC);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own payments"
    ON subscription_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM suppliers
            WHERE suppliers.id = supplier_id
              AND suppliers.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all payments"
    ON subscription_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.tier = 'admin'
        )
    );

-- Seed basic plan subscription for all existing approved suppliers
INSERT INTO supplier_subscriptions (supplier_id, plan_id, payment_provider)
SELECT id, 'basic', 'manual'
FROM suppliers
WHERE deleted_at IS NULL
ON CONFLICT (supplier_id) DO NOTHING;
