# Batch 2: numbers and words

Source: `docs/UX_AUDIT_2026-11-15.md`, findings H8, M1, M2, M7, M11, C3.
Read `AGENTS.md` first (this Next.js version differs from what you know).

**Goal:** every number is written one way, every place has one name, and realistic worst-case data (long names, huge amounts, missing prices) no longer clips or overflows. This is formatting, wording and a few CSS rules on text columns, not a redesign.

## Rules

- Do not commit, push, add npm packages, edit `.env*`, or run database commands.
- Do not restructure layouts or change colours, spacing or motion. Later batches do that.
- Do not touch `src/lib/vision/**`, `src/components/vision-takeoff/**`, `src/hooks/useVisionTakeoff.ts`, `src/app/api/**`, `supabase/**`, or the home page (`src/app/home/**`, `src/components/home/**`, `src/app/page.tsx`).
- Do not change stored values, database fields, enum values or URL slugs (`labor` as a category key stays `labor`). Change only what a person reads.
- styled-jsx gotcha: a scoped `<style jsx>` rule does not reach child components or `next/link`. Check each rule actually applies.
- Never truncate an amount, a quantity or a date. Give them the room (`white-space: nowrap`) and let the label beside them wrap instead.

## Changes

1. **One number format (H8).**
   - Add `src/lib/format.ts` with, at minimum:
     - `formatQuantity(n, unit?)`: `Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })`, so 22000 → "22,000", 22000.0 → "22,000", 12.5 → "12.5", 0.333333 → "0.33". Appends the unit with a space when given. `null`, `undefined` or `NaN` → "—".
     - `formatUsd(n, opts?)`: `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`, always two decimals ("$0.09", "$13,999.00", "$16,794.00"); an option for whole dollars for headline totals if a screen already shows whole dollars. Negative → "-$1,234.00". `null`/`NaN` → "—".
     - Cache the `Intl.NumberFormat` instances at module level.
   - Make `formatPrice` in `src/components/ui/CurrencyToggle.tsx` use the same formatter for USD so the whole app agrees. Keep its ZWG output as it is unless it is clearly broken.
   - Replace `toFixed` and hand-built `$` strings that a person sees in: `src/components/projects/**`, `src/app/projects/**`, `src/components/ui/RunningTotalBar.tsx`, and the quick estimate screens (`src/app/projects/quick/**`, `src/components/quick-projects/**` if it exists). The worst files: `usage/UsageLogTab.tsx`, `ProjectTrackingView.tsx`, `procurement/ProcurementItemCard.tsx`, `usage/UsageMaterialsTab.tsx`, `boq/BoqItemRow.tsx`, `ProjectKPIDashboard.tsx`, `procurement/PurchaseDialog.tsx`. Leave `toFixed` that feeds an `<input value>`, a calculation, or a percentage label alone, unless it shows more than one decimal of a percentage.
   - The quick estimate writes "$ 5,202.60" with a space; it should match "$5,202.60".
   - `white-space: nowrap` and `font-variant-numeric: tabular-nums` on amount and quantity elements in those screens (one shared class or the existing amount classes; check styled-jsx reaches them). The header stat that broke as "$857,487.2 / 4" must not break inside a number.
   - Unit tests in `src/lib/format.test.ts` (Vitest picks up `src/**/*.test.ts`) for both functions, including 0, 0.0875, 22000, 1250000, negative, `NaN`, `null`.

2. **"Labour" throughout (M1).** Every string a person reads says "Labour", in sentence case: `StageTab.tsx:307` "Labour & services", `list/ProjectsGrid.tsx:208` "With labour", `StageBOQSection.tsx:170, 211, 212`, `boq/PlanReviewCheckpoint.tsx:86`, `src/app/export/page.tsx:228`, and the quick estimate's `src/lib/quick-projects/engine/boqEngine.ts:124` description "Labour (25% of materials)". Search `src/` for any others (`grep -rn "Labor" src`). Do not rename identifiers, types, keys, or the vision-takeoff files. Update tests that assert the old text.

3. **One name per place (M2).**
   - The sidebar (`src/components/projects/SidebarSpine.tsx:46-52`), phone dock, and view titles (`src/components/projects/views/ViewHeader.tsx`) use the same name for each view. Use the short form everywhere: "Budget", "Compliance", "Buying". Update references in copy that say "Budget Planner" or "Compliance Tracker" to a person (`OverviewView.tsx:343` "Open compliance", `ProjectSettings.tsx:592`). Code comments can stay.
   - `procurement/ProcurementSummary.tsx:106` "Start RFQ" → "Request quotes". Any other "RFQ" a builder sees in the project screens → "quote request(s)". Leave the supplier portal (`src/app/supplier/**`) alone.
   - Buttons and tabs in `src/components/projects/**` and `src/app/projects/**` in sentence case: "Edit project", "Add item", "Over purchased" → "Over-purchased". Keep proper nouns and the brand name.

4. **Wrap, don't clip (M7).** Use the `break-ui` rules: `min-width: 0` on text columns in flex and grid rows (`minmax(0, 1fr)` in grids), `overflow-wrap: anywhere` on long unbroken strings, `flex-shrink: 0` on icons, badges and trailing actions.
   - Budget warning in `src/components/ui/BudgetPlanner.tsx:160` ("Estimate is $357,487.24 over your limit") wraps instead of being cut off.
   - Material names in BOQ, Buying and Usage rows wrap to two lines (`-webkit-line-clamp: 2`) with the full name in a `title`, so "Sino-Zimbabwe Sinoma High Strength Cement 42.5N" and the 32.5N line are told apart.
   - Delivery notes and other free text in Buying and Usage wrap fully (no single-line ellipsis without a way to read it).
   - "Over-purchased" badge: `white-space: nowrap; flex-shrink: 0`; it must not be clipped at 1440px.
   - An unpriced line (price 0 or missing) shows "No price yet" in muted text instead of "$0.00", in BOQ rows, Buying and Usage. Totals still add it as 0.

5. **Headings (M11).** One `h1` per page:
   - `src/app/projects/new/page.tsx`: the rendered page has two `h1`, but the file has only one (`:224`, the step title), so the other comes from a shared component it renders. Find it; keep the one that names the page as the `h1` and make the other an `h2` (or a `p`) without changing how it looks, and without changing other pages that use that component.
   - The BOQ wizard (`src/app/boq/new/**`) has none: make its main title an `h1` without changing how it looks.

6. **Long file names (C3).** `src/components/projects/DocumentCard.tsx:79-80`:
   - `min-width: 0` on the column holding the name, `overflow-wrap: anywhere` on `.file-name`.
   - Middle-truncate long names in JavaScript so the extension stays visible, e.g. `Approved_Structural_Engineering…stamped_2026-09-05.pdf`; keep the full name in `title` and the `aria-label`. Put the truncation helper in `src/lib/format.ts` (`truncateMiddle(name, max)`) with a unit test.
   - At 390px the Documents view must not be wider than the screen with the file name `Approved_Structural_Engineering_Drawings_Revision_12_FINAL_final_signed_and_stamped_2026-09-05.pdf`.

## Done when

- `npm run lint && npm run typecheck && npm run build && npm run test:unit` all pass.
- `tests/projects-authenticated-layout.spec.ts` still matches (update it only where text you changed is asserted, for example a renamed view title).
- `grep -rn "Labor" src --include='*.tsx' --include='*.ts'` shows only identifiers, comments, or the vision files.
- Write a short summary of what you changed, file by file, and anything you could not do.

Claude will then check in a browser at 390px and 1440px with a worst-case project (long names, a 1,250,000 quantity, a $357,487.24 overrun, an unpriced line, the long file name): numbers written one way, nothing clipped, no sideways scrolling, one `h1` per page.
