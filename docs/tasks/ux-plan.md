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
| 3 | shadcn set-up, then Buying on a phone | H5 (Buying), M3, H7 | `shadcn`, `emil-design-eng`, `ask-sonner` | Built 15 Nov, committed locally as [unreviewed]. Buying on a phone 6,452px → 2,817px. Still to check: e2e, screenshots, undo toast in a browser. |
| 4 | Usage and BOQ as compact rows; BOQ table first on desktop | H5 (Usage, BOQ), H4, M5, M6 | `shadcn`, `gestures`, `/prototype` | Brief written; Codex run queued 15 Nov, unreviewed. |
| 5 | Overview, projects list and Budget Estimator order | H6, H9, H10 | `apple-hig-review`, `/prototype` | Brief written; Codex run queued 15 Nov, unreviewed (takes the audit's first option, no side-by-side prototypes). |
| 6 | Status colours, motion items 1–5, phone baseline | M4, M8, M9, motion table | `animate`, `choreograph`, `/review-animations` | Brief written; Codex run queued 15 Nov, unreviewed. |
| 7 | Leftovers from batches 1–3 | M2 (sentence case), quick-estimate names on a phone, C2/H12 on public pages, H6 (Overview still ~3,000px) | `break-ui`, `apple-hig-review` | Brief written 15 Nov; Codex run queued after batch 6, unreviewed. |
| 8 | The six October items never re-checked | Budget target lost, date not rolled back, Insights failure looks empty, empty document filter text, Google button overflow, `7.199999999999999` | `diagnosing-bugs` | Brief written 15 Nov; Codex run queued after batch 7, unreviewed. |
After batch 8: re-run the full audit (`docs/UX_AUDIT_2026-11-15.md` method) and compare.
