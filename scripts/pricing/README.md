# Price Scraping Pipeline (Weekly)

This pipeline collects Zimbabwe construction material prices from classifieds/supplier sites,
normalizes them, and writes both raw observations and weekly averages to Supabase.

## How It Works

1. Load sources from `scripts/pricing/sources.json` (or fall back to Supabase `price_sources`).
2. Scrape each source and extract material name, price, unit, location, supplier, and URL.
3. Normalize material names to canonical `material_key` values.
4. Convert currencies using the latest exchange rate (if available).
5. Insert raw observations into `price_observations`.
6. Compute weekly aggregates and upsert into `price_weekly`.

## Environment Variables

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (required for write)
- `PRICE_SOURCES_FILE` (optional) - default: `scripts/pricing/sources.json`
- `SCRAPE_OUTPUT_DIR` (optional) - default: `output/prices`
- `DRY_RUN` (optional) - set to `1` to skip Supabase writes

## Run Locally

```bash
npm run scrape:prices
```

## Notes

- Add source selectors in `scripts/pricing/sources.json`.
- Expand `scripts/pricing/material-aliases.json` as you see new names in the wild.
- Prices are stored as raw observations and weekly aggregates to support the
  "average market price" disclaimer in the UI.
