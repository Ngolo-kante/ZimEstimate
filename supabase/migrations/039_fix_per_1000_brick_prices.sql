-- ============================================
-- Migration 039: Correct per-1000 brick prices to per-brick
-- ============================================
-- Zimbabwe sells bricks by the thousand, and seed-research-prices.ts loaded the
-- quoted per-1000 figures straight into price_observations.price_usd. Every one
-- of those material_keys is a unit 'each' material, and the BOQ generator
-- multiplies the unit price by a brick COUNT — so a face brick priced at $220
-- (and $395, and $450) was charged per single brick and inflated the largest
-- line in the BOQ a thousandfold.
--
-- price_observations is the live price source (src/lib/services/prices.ts reads
-- it first and only falls back to static data), so these rows were what users
-- actually saw.
--
-- Scoped by exact price so it is a no-op if run twice, and so it cannot touch
-- any correctly-priced row a scraper has since added. Verify before and after:
--
--   SELECT material_key, material_name, price_usd FROM price_observations
--    WHERE material_key IN
--          ('brick-common','farm-brick','brick-face-red','brick-face-brown')
--    ORDER BY material_key;

UPDATE price_observations SET price_usd = 0.065
 WHERE material_key = 'farm-brick'       AND price_usd = 65.00;

UPDATE price_observations SET price_usd = 0.395
 WHERE material_key = 'brick-face-red'   AND price_usd = 395.00;

UPDATE price_observations SET price_usd = 0.14
 WHERE material_key = 'brick-face-red'   AND price_usd = 140.00;

UPDATE price_observations SET price_usd = 0.108
 WHERE material_key = 'brick-common'     AND price_usd = 108.00;

UPDATE price_observations SET price_usd = 0.09
 WHERE material_key = 'brick-common'     AND price_usd = 90.00;

UPDATE price_observations SET price_usd = 0.45
 WHERE material_key = 'brick-face-brown' AND price_usd = 450.00;

-- Anything still above $1 for a single brick is wrong by definition. Left as a
-- check rather than a blanket UPDATE so a genuine future outlier is reviewed
-- rather than silently rewritten.
--   SELECT material_key, material_name, price_usd, review_status
--     FROM price_observations
--    WHERE material_key LIKE '%brick%' AND price_usd > 1;
