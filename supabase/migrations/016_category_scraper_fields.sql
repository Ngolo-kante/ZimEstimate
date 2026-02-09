-- Add category scraper fields to scraper_configs
-- This enables scraping multiple products from category/listing pages

ALTER TABLE scraper_configs
ADD COLUMN IF NOT EXISTS scrape_mode text DEFAULT 'single',
ADD COLUMN IF NOT EXISTS container_selector text,
ADD COLUMN IF NOT EXISTS item_card_selector text;

-- Add comment for documentation
COMMENT ON COLUMN scraper_configs.scrape_mode IS 'single = scrape one product, category = scrape multiple products from listing page';
COMMENT ON COLUMN scraper_configs.container_selector IS 'CSS selector for the container holding all product cards (category mode only)';
COMMENT ON COLUMN scraper_configs.item_card_selector IS 'CSS selector for each product card within the container (category mode only)';

-- Add check constraint to validate scrape_mode values
ALTER TABLE scraper_configs
ADD CONSTRAINT scrape_mode_check CHECK (scrape_mode IN ('single', 'category'));
