-- Price scraping pipeline tables

-- ============================================
-- 1. PRICE SOURCES
-- ============================================

CREATE TABLE IF NOT EXISTS price_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('supplier', 'classified', 'retailer', 'other')),
    base_url TEXT,
    parser TEXT NOT NULL DEFAULT 'listing-card',
    selectors JSONB,
    headers JSONB,
    trust_level SMALLINT NOT NULL DEFAULT 2 CHECK (trust_level >= 1 AND trust_level <= 5),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE price_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price sources"
    ON price_sources FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage price sources"
    ON price_sources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

CREATE TRIGGER update_price_sources_updated_at
    BEFORE UPDATE ON price_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. PRICE OBSERVATIONS (RAW SCRAPED DATA)
-- ============================================

CREATE TABLE IF NOT EXISTS price_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES price_sources(id) ON DELETE SET NULL,
    source_name TEXT,
    material_key TEXT NOT NULL,
    material_name TEXT,
    unit TEXT,
    price_original DECIMAL(12,2),
    currency currency,
    price_usd DECIMAL(12,2),
    price_zwg DECIMAL(12,2),
    location TEXT,
    supplier_name TEXT,
    supplier_contact TEXT,
    url TEXT,
    confidence SMALLINT NOT NULL DEFAULT 2 CHECK (confidence >= 1 AND confidence <= 5),
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    observed_at DATE
);

ALTER TABLE price_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price observations"
    ON price_observations FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage price observations"
    ON price_observations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

CREATE INDEX IF NOT EXISTS price_observations_material_key_idx ON price_observations (material_key);
CREATE INDEX IF NOT EXISTS price_observations_scraped_at_idx ON price_observations (scraped_at DESC);

-- ============================================
-- 3. WEEKLY AGGREGATES (MARKET AVERAGES)
-- ============================================

CREATE TABLE IF NOT EXISTS price_weekly (
    material_key TEXT NOT NULL,
    week_start DATE NOT NULL,
    avg_price_usd DECIMAL(12,2),
    avg_price_zwg DECIMAL(12,2),
    median_price_usd DECIMAL(12,2),
    median_price_zwg DECIMAL(12,2),
    min_price_usd DECIMAL(12,2),
    max_price_usd DECIMAL(12,2),
    min_price_zwg DECIMAL(12,2),
    max_price_zwg DECIMAL(12,2),
    sample_count INTEGER NOT NULL DEFAULT 0,
    last_scraped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (material_key, week_start)
);

ALTER TABLE price_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view weekly prices"
    ON price_weekly FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage weekly prices"
    ON price_weekly FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

CREATE TRIGGER update_price_weekly_updated_at
    BEFORE UPDATE ON price_weekly
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
