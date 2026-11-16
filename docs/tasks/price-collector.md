# Weekly price collection from ZBMS

Owner decisions (16 Nov 2026), settled:
- **Source:** ZBMS only, through a **fixed list** linking each of our materials to exact ZBMS product ids, checked by a person. No name guessing at run time. The classified-ad sources in `scripts/pricing/sources.json` are dropped.
- **Scheduler:** the existing free GitHub Actions job (`.github/workflows/weekly-prices.yml`, Mondays 06:00 UTC). The owner will make `unified` the default branch; the job must run from current code.
- **Approval:** a new price within ±15% of the price the app uses now is saved `review_status = 'auto'` (goes live); a bigger change, or a material with no current price, is saved `'pending'` for Admin → Scraper review.
- **Alerts:** one email to `support@zimestimate.com` only when a run fails, finds far fewer prices than expected, or leaves prices pending. No email when all is well.
- **Coverage first:** the top 30 materials by cost (`research/zbms-2026-11/top-materials.tsv`, 85% of a standard house's material cost).

Read first: `AGENTS.md`; `src/lib/pricing/verifiedPrices.ts` (how prices were checked by hand on 11 Oct: unit-matched, median of suppliers, notes on doubtful listings); `src/lib/pricing/publishedPrice.ts` (`selectPublishedObservation`: a row reaches estimates only if `auto`/`confirmed`, under 30 days old, and its `unit` matches the catalogue unit); `src/lib/materials.ts` (catalogue ids, units, prices); `scripts/pricing/scrape.mjs` (the old scraper and how it writes `price_observations`).

## 1. Candidate table (for the owner to confirm)

Using only the offline file `research/zbms-2026-11/catalog.json` (ZBMS's product list, downloaded 16 Nov; fields: id, name, sku, price in USD, in_stock, categories, short description, permalink), write `docs/tasks/zbms-matches.md`: for each of the 30 materials in `top-materials.tsv`, up to 3 candidate ZBMS products, best first, with: ZBMS id, name, price, our unit, ZBMS's unit as stated in the name/description, the conversion factor to our unit (e.g. 1,000 bricks → `per each` = price / 1000; a 3.6 m cornice → our 4 m = price × 4/3.6), and a one-line reason. Mark "no good match" where none fits; never force one. Skip $0 ("price on request") products. Flag size or grade doubts (e.g. cement without a stated grade). Leave a checkbox column for the owner.

## 2. The mapping file

`src/lib/pricing/zbmsProducts.ts`: `export const ZBMS_PRODUCTS: ZbmsMapping[]` with `{ materialId, zbmsProductIds: number[], factor: number, unit: string, note: string }`. **Leave the array empty** with a comment pointing at `docs/tasks/zbms-matches.md`; Claude fills it after the owner ticks the table. Add a unit test that every entry's `materialId` exists in the catalogue and `unit` equals the catalogue unit.

## 3. The collector

`scripts/pricing/collect-zbms.mjs` (Node, no new packages), run by `npm run collect:prices`:
- For the mapped materials, fetch `https://www.zbms.co.zw/wp-json/wc/store/v1/products?include=<ids>&per_page=100` (batches of 100), with a `User-Agent` of `ZimEstimate price check (+https://zimestimate.com)` and a short pause between requests. Price is `prices.price / 10^currency_minor_unit`.
- Per material: ignore out-of-stock and $0 products; price = median of its mapped products × `factor`.
- Current price = the newest `confirmed`/`auto` observation under 30 days old for that material, else the verified price, else the catalogue price.
- Write one `price_observations` row per material: `source_name 'ZBMS'`, `supplier_name 'ZBMS'`, `material_key`, `unit` (catalogue unit), `price_usd`, `currency 'USD'`, `url` (first product permalink), `scraped_at` now, `confidence`, and `review_status` `'auto'` if within ±15% of the current price, otherwise `'pending'`.
- `DRY_RUN=1` prints what would be written and writes nothing. Without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` it exits with an error unless dry-run.
- Put the decision logic (median, factor, ±15% rule, current-price choice) in a pure module (`src/lib/pricing/collectorRules.ts`, imported by the script via a small build-free approach, or duplicated in plain JS with the same tests) and unit-test it.
- Exit code non-zero if the fetch fails or fewer than 70% of mapped materials got a price.

## 4. Alerts

At the end of a run, if it failed, priced under 70% of mapped materials, or wrote any `pending` rows, send one email through Resend (`RESEND_API_KEY`, from `ZimEstimate <noreply@zimestimate.com>`, to `support@zimestimate.com`; same REST call as `src/lib/server/email.ts`) listing: materials priced, auto-approved, pending (with old → new price and % change), failures, and a link to `https://zimestimate.com/admin/scraper-review`. No email otherwise. A missing `RESEND_API_KEY` just logs.

## 5. Weekly job

Update `.github/workflows/weekly-prices.yml` to run `npm run collect:prices` (keep the schedule and `workflow_dispatch`), passing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` from repository secrets. Remove the old classified-ads scrape from the workflow (keep `scrape.mjs` in the repo, unused). Upload the run's JSON summary as an artifact.

## Rules

- Do not commit, push, run database commands, or change `.env*`. No network access is available to you; use only the files above.
- Do not touch the home page, vision files, `src/app/api/**`, or `supabase/**`.
- No new npm packages.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass. Finish with a file-by-file summary and anything you could not do.
