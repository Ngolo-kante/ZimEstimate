-- ============================================
-- 012: Price update tracking + scraper categories
-- ============================================

-- Track matched material code from scrapers
ALTER TABLE weekly_prices
    ADD COLUMN IF NOT EXISTS material_code TEXT;

CREATE INDEX IF NOT EXISTS idx_weekly_prices_material_code
    ON weekly_prices(material_code);

-- Allow alias matching against static material codes
ALTER TABLE material_aliases
    ADD COLUMN IF NOT EXISTS material_code TEXT;

CREATE INDEX IF NOT EXISTS idx_material_aliases_material_code
    ON material_aliases(material_code);

-- Add category to scraper configs for per-category runs
ALTER TABLE scraper_configs
    ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE scraper_configs
SET category = CASE
    WHEN category IS NOT NULL THEN category
    WHEN site_name ILIKE '%timber%' OR base_url ILIKE '%timber%' THEN 'timber'
    WHEN site_name ILIKE '%cement%' OR base_url ILIKE '%cement%' THEN 'cement'
    WHEN base_url ILIKE '%building-materials%' THEN 'general'
    ELSE 'general'
END
WHERE category IS NULL;
