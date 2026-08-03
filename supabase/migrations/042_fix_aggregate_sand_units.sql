-- ============================================
-- Migration 042: correct river sand, quarantine pit sand
-- ============================================
-- Same family as the brick prices in 039: a scraped figure stored against a
-- material whose unit is something else. sand-river is 'per cube' in
-- materials.ts and the BOQ generates cubic-metre quantities, but the scraped
-- listing quotes a multi-cube delivery.
--
-- Verified against the source listing rather than inferred:
--
--   sand-river  https://www.zimplazaclassifieds.co.zw/city/harare/river-sand
--               "River sand for construction 200 per 5cubic"  (Danhire)
--               $200 / 5 cubic metres = $40 per cube, not $200.
--
--   sand-pit    https://www.zimplazaclassifieds.co.zw/city/harare/pit-sand
--               "$35.00 Fixed Price" (Chrisand Suppliers) with NO unit stated
--               anywhere in the advert. It could be per cube or per load; the
--               listing does not say and neither should we.
--
-- So river sand is corrected and pit sand is quarantined rather than guessed.
-- prices.ts only reads review_status IN ('auto','confirmed'), so moving pit
-- sand to 'pending' drops it out of displayed prices and into the existing
-- review queue at /admin/scraper-review, where a human can price it from a
-- source that states a unit.
--
-- Note the underlying weakness: price_observations.unit is NULL on every one
-- of these rows. Until the scraper captures the unit alongside the number,
-- this class of error will keep arriving and can only be caught by eye.

UPDATE price_observations
   SET price_usd = 40.00,
       unit = 'per cube'
 WHERE material_key = 'sand-river'
   AND price_usd = 200.00;

UPDATE price_observations
   SET review_status = 'pending'
 WHERE material_key = 'sand-pit'
   AND price_usd = 35.00
   AND review_status = 'auto';

-- Verify:
--   SELECT material_key, price_usd, unit, review_status
--     FROM price_observations
--    WHERE material_key IN ('sand-river','sand-pit')
--    ORDER BY material_key;
