# UX improvement plan (from docs/UX_AUDIT_2026-11-15.md)

## Decisions (owner, 15 November 2026)

- **Phone first.** When phone and desktop pull apart, design the phone layout first; desktop must keep working.
- **shadcn for tables and form controls only**, one view at a time, starting with Buying on a phone. Keep the app's own colours and type.
- **First batch: accessibility and phone feel.**
- **Shipping:** Codex builds, Claude checks in the browser and runs the release checks, then commits. Ask the owner before pushing.

## Batches

Finding IDs refer to the audit. Each batch is one brief in this folder, one commit, and must pass `npm run lint && npm run typecheck && npm run build && npm run test:unit` plus a browser check at 390px and 1440px.

| # | Batch | Findings | Skills to load | Status |
| --- | --- | --- | --- | --- |
| 1 | Accessibility floor and phone feel | C1, C2, C4, H1, H2, H3, H11, H12, M10 | `mobile-native`, `emil-design-eng`, `remove-animations` | Done 15 Nov (built by Codex, checked by Claude). Still open: tab-count and a few badge colours on public pages, `viewport-fit` and `100vh` (batch 6). |
| 2 | Numbers and words | H8, M1, M2, M7, M11, C3 | `break-ui` | Done 15 Nov (built by Codex, checked by Claude). Unit prices under $1 keep up to four decimals so bulk lines are not misstated. Still open: "Usage Tracking" and section headings in capitals are not yet sentence case; quick-estimate item names clamp to two lines with only a hover title, which a phone cannot show. |
| 3 | shadcn set-up, then Buying on a phone | H5 (Buying), M3, H7 | `shadcn`, `emil-design-eng`, `ask-sonner` | Done 15 Nov (built by Codex, checked by Claude). Buying on a phone 6,452px → 2,817px; undo tested (Undo sends nothing, timeout sends one delete). shadcn state variants added to `src/styles/shadcn.css`. |
| 4 | Usage and BOQ as compact rows; BOQ table first on desktop | H5 (Usage, BOQ), H4, M5, M6 | `shadcn`, `gestures`, `/prototype` | Done 15 Nov. Usage on a phone 7,100px → 3,557px, BOQ 3,684px → 2,751px; desktop BOQ table first, six stages in one row. |
| 5 | Overview, projects list and Budget Estimator order | H6, H9, H10 | `apple-hig-review`, `/prototype` | Done 15 Nov. Overview leads with progress and next steps; projects list cards first; Budget Estimator shows the result under the budget field. |
| 6 | Status colours, motion items 1–5, phone baseline | M4, M8, M9, motion table | `animate`, `choreograph`, `/review-animations` | Done 15 Nov. Four status roles, one quantity-based purchased count, viewport-fit/dvh/safe areas, motion items 2–5. |
| 7 | Leftovers from batches 1–3 | M2 (sentence case), quick-estimate names on a phone, C2/H12 on public pages, H6 (Overview still ~3,000px) | `break-ui`, `apple-hig-review` | Done 15 Nov. Sentence case, quick-estimate names tap to expand, Overview 2,533px (target 2,200 not met). Still open: faint/small text on /projects/quick (3 colour pairs, 7 sizes) and /boq/new (3, 5). |
| 8 | The six October items never re-checked | Budget target lost, date not rolled back, Insights failure looks empty, empty document filter text, Google button overflow, `7.199999999999999` | `diagnosing-bugs` | Done 15 Nov. Re-checked all six: Insights error state and two quantity-rounding gaps fixed; the other four were already fixed. |
| 9 | One toast, one set of form controls and tabs | M3 (rest of the project screens), H7 toast | `emil-design-eng`, `ask-sonner` | Brief written 15 Nov; Codex run queued, unreviewed. |
| 10 | Phone sheets you can swipe, one menu, one dialog | Motion items 2–3, M10 | `gestures`, `emil-design-eng` | Brief written 15 Nov; Codex run queued after 9, unreviewed. Adds `vaul` (installed by Claude). |
| 11 | Motion across the rest of the app, worst-case data on untested screens | Motion, M9 `transition: all`, M7 | `improve-animations`, `break-ui` | Brief written 15 Nov; Codex run queued after 10, unreviewed. |
After batch 11: re-run the full audit (`docs/UX_AUDIT_2026-11-15.md` method) and compare.
