-- Scraper System Migration
-- Implements the exact schema requirements for the automated material price tracking system.

-- 1. Scraper Configs
CREATE TABLE IF NOT EXISTS scraper_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    price_selector TEXT NOT NULL,
    item_name_selector TEXT NOT NULL,
    cron_schedule TEXT NOT NULL DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_successful_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active RLS for scraper_configs
ALTER TABLE scraper_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read scraper_configs" ON scraper_configs
    FOR SELECT USING (true);

CREATE POLICY "Allow admin all scraper_configs" ON scraper_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- 2. Weekly Prices
CREATE TABLE IF NOT EXISTS weekly_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    average_price DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    source_url TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active RLS for weekly_prices
ALTER TABLE weekly_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read weekly_prices" ON weekly_prices
    FOR SELECT USING (true);

CREATE POLICY "Allow admin all weekly_prices" ON weekly_prices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- 3. Scraper Logs
CREATE TABLE IF NOT EXISTS scraper_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraper_config_id UUID REFERENCES scraper_configs(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
    message TEXT,
    scraped_data JSONB, -- Optional: store what was scraped for debugging
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active RLS for scraper_logs
ALTER TABLE scraper_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read scraper_logs" ON scraper_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow admin all scraper_logs" ON scraper_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_scraper_configs_updated_at
    BEFORE UPDATE ON scraper_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
