-- ============================================
-- 015: Scraper Review System
-- Adds review workflow for matched/unmatched scraped items
-- ============================================

-- Add review_status to price_observations for tracking confirmation
ALTER TABLE price_observations 
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'auto'
    CHECK (review_status IN ('auto', 'pending', 'confirmed', 'rejected'));

-- Add scrape_mode to scraper_configs (single vs category)
ALTER TABLE scraper_configs
  ADD COLUMN IF NOT EXISTS scrape_mode TEXT DEFAULT 'single'
    CHECK (scrape_mode IN ('single', 'category'));

-- Add container/item selectors for category scraping
ALTER TABLE scraper_configs
  ADD COLUMN IF NOT EXISTS container_selector TEXT;

ALTER TABLE scraper_configs
  ADD COLUMN IF NOT EXISTS item_card_selector TEXT;

-- Create pending_matches table for low-confidence items requiring admin review
CREATE TABLE IF NOT EXISTS pending_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_name TEXT NOT NULL,
  scraped_price DECIMAL(12,2),
  source_url TEXT,
  scraper_config_id UUID REFERENCES scraper_configs(id) ON DELETE SET NULL,
  suggested_material_code TEXT,
  confidence DECIMAL(3,2),
  match_method TEXT,
  resolved_material_code TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_type TEXT CHECK (resolution_type IN ('confirmed', 'rejected', 'remapped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on pending_matches
ALTER TABLE pending_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pending_matches"
  ON pending_matches FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage pending_matches"
  ON pending_matches FOR ALL
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

-- Index for fast admin dashboard queries (unresolved items)
CREATE INDEX IF NOT EXISTS idx_pending_matches_unresolved 
  ON pending_matches(created_at DESC) 
  WHERE resolved_at IS NULL;

-- Index for looking up by suggested material
CREATE INDEX IF NOT EXISTS idx_pending_matches_suggested
  ON pending_matches(suggested_material_code);

-- Seed common cement aliases for better matching
INSERT INTO material_aliases (material_code, alias_name, confidence_score)
VALUES
  ('cement-325', 'ppc 325n', 1.0),
  ('cement-325', 'standard cement 325n', 1.0),
  ('cement-325', 'lafarge 325n', 1.0),
  ('cement-325', 'portland cement 325', 1.0),
  ('cement-425', 'ppc 425r', 1.0),
  ('cement-425', 'rapid cement 425r', 1.0),
  ('cement-425', 'khayah 425r', 1.0),
  ('cement-ppc-unicem-325r', 'ppc unicem', 1.0),
  ('cement-ppc-unicem-325r', 'unicem 325r', 1.0),
  ('cement-ppc-surecem-325r', 'ppc surecem', 1.0),
  ('cement-ppc-surecem-325r', 'surecem 325r', 1.0),
  ('cement-ppc-surebuild-425r', 'ppc surebuild', 1.0),
  ('cement-ppc-surebuild-425r', 'surebuild 425r', 1.0),
  ('cement-khayah-portland', 'khayah portland', 1.0),
  ('cement-khayah-portland', 'khayah cement', 1.0),
  ('cement-khayah-supaset-425r', 'khayah supaset', 1.0),
  ('cement-khayah-supaset-425r', 'supaset 425r', 1.0),
  ('cement-khayah-mc-225', 'khayah mc 225', 1.0),
  ('cement-khayah-mc-225', 'khayah masonry', 1.0),
  ('cement-khayah-watershield', 'khayah watershield', 1.0),
  ('cement-khayah-watershield', 'khayah waterproof', 1.0),
  ('cement-sino-portland-composite-325r', 'sino cement', 1.0),
  ('cement-sino-portland-composite-325r', 'sino zimbabwe 325', 1.0),
  ('cement-sino-portland-composite-325r', 'sinoma cement', 1.0),
  ('cement-sino-mc-225', 'sino mc 225', 1.0),
  ('cement-sino-mc-225', 'sino masonry', 1.0),
  ('cement-sino-sinoma-high-strength-425r', 'sinoma high strength', 1.0),
  ('cement-sino-sinoma-high-strength-425r', 'sino 425r', 1.0),
  ('cement-dangote-portland-325r', 'dangote 325', 1.0),
  ('cement-dangote-portland-325r', 'dangote portland', 1.0),
  ('cement-dangote-portland-325r', 'dangote cement', 1.0),
  ('cement-dangote-portland-425n', 'dangote 425n', 1.0),
  ('cement-white', 'white cement', 1.0),
  ('cement-white', 'white portland cement', 1.0)
ON CONFLICT DO NOTHING;
