-- ============================================
-- Migration 040: sub-cent precision for observed prices
-- ============================================
-- price_usd was DECIMAL(12,2), which is fine for a bag of cement and wrong for
-- a brick. Migration 039 corrected the per-1000 brick prices to per-brick, and
-- three of them could not be stored as written:
--
--   farm brick    $0.065 -> $0.07   (+7.7%)
--   common brick  $0.108 -> $0.11   (+1.9%)
--   rustic face   $0.395 -> $0.40   (+1.3%)
--
-- A fraction of a cent is immaterial per unit and is not immaterial when the
-- BOQ multiplies it by ten thousand bricks — roughly $50 on a single masonry
-- line for a 120m2 house.
--
-- Widened to (14,4): four decimal places, and precision raised from 12 to 14 so
-- the number of digits ahead of the point is unchanged. Narrowing that range is
-- the one way this migration could lose data, so it is deliberately avoided.
--
-- price_original is left at (12,2) on purpose: it records the figure as the
-- source quoted it, and sources quote in cents.

ALTER TABLE price_observations
    ALTER COLUMN price_usd TYPE DECIMAL(14,4),
    ALTER COLUMN price_zwg TYPE DECIMAL(14,4);

-- Restore the values 039 had to round. Scoped to the rounded figure so this is
-- idempotent and cannot touch a genuine $0.07 observation added later.
UPDATE price_observations SET price_usd = 0.065
 WHERE material_key = 'farm-brick'     AND price_usd = 0.07;

UPDATE price_observations SET price_usd = 0.108
 WHERE material_key = 'brick-common'   AND price_usd = 0.11;

UPDATE price_observations SET price_usd = 0.395
 WHERE material_key = 'brick-face-red' AND price_usd = 0.40;

-- Verify:
--   SELECT material_key, material_name, price_usd FROM price_observations
--    WHERE material_key LIKE '%brick%' ORDER BY material_key;
