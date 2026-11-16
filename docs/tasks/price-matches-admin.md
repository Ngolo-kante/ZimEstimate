# Admin → Price matches

The owner wants to confirm which ZBMS products the weekly collector reads, in the admin panel, instead of ticking `docs/tasks/zbms-matches.md`. Settled 16 Nov 2026.

Read first: `AGENTS.md`; `docs/tasks/price-collector.md` and `docs/tasks/zbms-matches.md` (the 30 materials and their candidates); `supabase/migrations/068_price_source_matches.sql` (already written; **do not edit or run it**); `scripts/pricing/collect-zbms.mjs`, `src/lib/pricing/collectorRules.ts`, `src/lib/pricing/zbmsProducts.ts`; an existing admin page for patterns (`src/app/admin/scraper-review/page.tsx`, `src/app/admin/layout.tsx` for the admin check and nav).

## 1. Candidates as data

Turn the table in `docs/tasks/zbms-matches.md` into `src/lib/pricing/zbmsCandidates.json`: `[{ materialId, materialName, ourUnit, candidates: [{ productId, name, priceUsd, statedUnit, factor, reason }], noGoodMatch: boolean, note }]`, same order (cost order). Use `research/zbms-2026-11/catalog.json` for permalinks (`url` per candidate). Add a unit test that every `materialId` exists in the catalogue (`src/lib/materials.ts`) and `ourUnit` matches its unit.

## 2. The screen: `/admin/price-matches`

Add it to the admin nav next to Scraper review, label "Price matches".
- One row per material from the JSON, in cost order, showing: material name and our unit; its status (**Confirmed**, **No good match**, or **To check**) as a `Badge`; for confirmed rows, the chosen product, factor and who confirmed it and when.
- Opening a row (shadcn `Collapsible`, or a `Dialog`/`Drawer` on a phone, following batch 10) shows the candidates as a radio list: name (link to the ZBMS page, new tab), listed price, stated unit, the reason/doubt, and the **price in our unit** (`priceUsd × factor`, with `formatUsd`). Plus a final option **"No good match"**.
- Below the choice: the **conversion factor** (number input, `inputMode="decimal"`, > 0, prefilled from the candidate), an optional note, and **Confirm** (primary). Confirm upserts `public.price_source_matches` (`source 'zbms'`, `material_id`, `status 'confirmed'` with `product_ids [id]` and `factor`, or `status 'no_match'` with `product_ids {}`), `unit` = our unit, `confirmed_by` = the admin's id, `confirmed_at` now. A confirmed row can be changed or **Reset** (deletes the row, back to To check).
- Top of the page: "12 of 30 confirmed · 5 no good match · 13 to check", and a filter: All / To check / Confirmed / No good match.
- Uses the browser Supabase client; RLS (admins only) does the security. Show the existing error pattern if a write fails. Same look as the other admin pages; shadcn `Badge`, `Collapsible`, `NativeSelect`/radio, `Input`; 44px targets on a phone.
- **If the table does not exist yet** (migration not applied: error `42P01` or `PGRST205`), show one calm message: "Price matches need a database update. Ask your developer to apply migration 068." and nothing else; do not crash.

## 3. The collector reads confirmed matches

`scripts/pricing/collect-zbms.mjs` reads `status = 'confirmed'` rows from `price_source_matches` (service role) and uses their `product_ids`, `factor`, `unit`, instead of `ZBMS_PRODUCTS`. Keep `src/lib/pricing/zbmsProducts.ts` only if something else still imports it; otherwise remove it and its test, and adjust the tests to the new source. If the table is missing, the collector exits with a clear message and non-zero status (the alert email then reports it). `DRY_RUN=1` still writes nothing.

## Rules

- Do not commit, push, run database commands, or edit `.env*` or `supabase/**`. No network access.
- Do not touch the home page, vision files, or `src/app/api/**` (the page talks to Supabase directly under RLS).
- No new npm packages. Installed shadcn components are in `src/components/shadcn/`; use `sc-` colour names only.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass. Finish with a file-by-file summary and anything you could not do.
