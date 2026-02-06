-- Seed File for Scraper Configs and Matching Logic

-- 1. Create table for Material Aliases (Best method for product matching)
CREATE TABLE IF NOT EXISTS material_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for aliases
ALTER TABLE material_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read material_aliases" ON material_aliases
    FOR SELECT USING (true);

CREATE POLICY "Allow admin all material_aliases" ON material_aliases
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.tier = 'admin'
        )
    );

-- 2. Seed Default Scraper Configurations
INSERT INTO scraper_configs (site_name, base_url, price_selector, item_name_selector, cron_schedule)
VALUES 
    -- 1. Major Construction & Hardware Suppliers
    ('Halsted Builders Express', 'https://halsteds.co.zw/msasa/categories/building-materials', '.price', '.product-name', 'daily'),
    ('Electrosales (Powders)', 'https://www.electrosales.co.zw/shop/catalog/building_powders', '.price-amount', '.product-title', 'weekly'),
    ('Electrosales (Timber)', 'https://www.electrosales.co.zw/shop/catalog/building_timber', '.price-amount', '.product-title', 'weekly'),
    ('Union Hardware (General)', 'https://unionhardware.co.zw/shop/product-category/building-materials/', '.woocommerce-Price-amount', '.woocommerce-loop-product__title', 'weekly'),
    ('PG Industries', 'https://www.pgiz.co.zw/category', '.price', '.product-title', 'weekly'),
    ('Vakisa Builders Express', 'https://www.vakisa.co.zw/', '.product-price', '.product-name', 'weekly'),
    ('Bhola Hardware', 'https://www.bholahardware.com/diy', '.price', '.title', 'weekly'),

    -- 2. Aggregated Marketplaces
    ('ZBMS', 'https://www.zbms.co.zw/product-category/building-materials/', '.price', '.product-title', 'daily'),

    -- 3. Specific Cement Brand Feeds
    ('Lafarge Cement (Union)', 'https://unionhardware.co.zw/msasa/product-category/building-materials/cement/lafarge/', '.woocommerce-Price-amount', '.woocommerce-loop-product__title', 'daily'),
    ('PPC Cement (Union)', 'https://unionhardware.co.zw/pomona/product-category/building-materials/ppc/', '.woocommerce-Price-amount', '.woocommerce-loop-product__title', 'daily'),
    ('Sino-Zimbabwe Cement (ZBMS)', 'https://www.zbms.co.zw/shop/building-materials/cement/premiummidlands/', '.price', '.product-title', 'daily')
ON CONFLICT DO NOTHING;
