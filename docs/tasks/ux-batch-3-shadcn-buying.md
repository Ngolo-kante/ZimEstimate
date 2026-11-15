# Batch 3: Buying on a phone, with shadcn

Source: `docs/UX_AUDIT_2026-11-15.md`, findings H5 (Buying), M3, H7. Plan: `docs/tasks/ux-plan.md`.
Read `AGENTS.md` first (this Next.js version differs from what you know).

**Goal:** on a phone, the Buying view is a short list you can scan, not 15 tall cards each with a full-width blue button. Its controls (search, filters, tabs, status badges, the purchase form) come from one shared set. Deleting a BOQ line can be undone.

## Already done (by Claude, do not redo)

- shadcn is set up: `components.json`, components in `src/components/shadcn/` (badge, input, native-select, tabs, table, collapsible, sonner, field, label, separator). Packages `radix-ui`, `class-variance-authority` and `sonner` are installed.
- Colours: shadcn components use `sc-` colour names (`bg-sc-muted`, `text-sc-primary`…) mapped to the app's palette in `src/styles/shadcn.css`. **Never** use shadcn's plain names (`bg-muted`, `bg-accent`, `text-secondary`…) in new code: in this app `muted` and `secondary` are grey text colours and `accent` is the brand blue. Use `sc-` names, or the app's own CSS variables in styled-jsx/CSS files.
- If you add another shadcn component, run `npx shadcn@latest add <name> -y` and then `node scripts/shadcn-scope.mjs`. Do not run `shadcn init` and do not edit `components.json`. Do not add packages beyond what `add` installs; tell me if one is needed.

## Rules

- Do not commit, push, edit `.env*`, or run database commands.
- Do not touch `src/lib/vision/**`, `src/components/vision-takeoff/**`, `src/hooks/useVisionTakeoff.ts`, `src/app/api/**`, `supabase/**`, the home page (`src/app/home/**`, `src/components/home/**`, `src/app/page.tsx`), or the app's own `src/components/ui/Button.tsx` (keep using it for buttons).
- Scope: the Buying view (`src/components/projects/procurement/**`, `src/components/projects/views/` file for procurement, `src/styles/procurement-view.css`), plus the BOQ delete in `src/components/projects/boq/BoqItemRow.tsx` and `src/app/projects/[id]/hooks/useProjectData.ts`.
- Keep every number formatter from batch 2 (`src/lib/format.ts`) and every accessible name the e2e test uses unless a change below replaces it.
- Phone first: design below 768px first. At 768px and up the view must keep working and look at least as good as now.
- shadcn rules (from the `shadcn` skill): `gap-*` not `space-y-*`; `size-*` for equal sides; `cn()` for conditional classes; form layout with `FieldGroup` + `Field` + `FieldLabel`; icons inside components get no size classes; status chips are `Badge`.
- Every tappable thing is at least 44px tall on a phone. Inputs and selects: `h-11` below 768px (the shadcn default is 32px).
- Motion (Emil Kowalski's rules): only `transform` and `opacity` plus the collapsible height; opening a row 180ms `cubic-bezier(0.23, 1, 0.32, 1)`, closing 150ms; nothing moves under `prefers-reduced-motion: reduce` (the content just appears). Rows show press feedback with a background change on `:active`, not a scale. No hover effects outside `@media (hover: hover) and (pointer: fine)`.

## Changes

1. **Compact rows on a phone (H5).** `ProcurementItemCard.tsx` below 768px becomes one row about 64–76px tall:
   - Left: material name (two lines at most, full name in `title`), and under it one key fact in muted text: "18,750 per 50kg bag left", or "All bought" when nothing is left, or "No price yet" when unpriced.
   - Right: the status as a `Badge` (Pending, In progress, Purchased, Over-purchased) and a caret.
   - Tapping anywhere on the row opens it (`Collapsible`, `aria-expanded`, one accessible button for the whole row). Open, it shows what the card shows today: BOQ / Bought / Left, the progress bar, Spent, the purchase history and receipts, and a **"Log purchase"** button.
   - "Log purchase" is the primary (blue) button only when something is left to buy. On a fully bought or over-purchased line it is the secondary style. Closed rows have no button at all, so the closed list has no blue buttons.
   - Desktop (768px and up): keep today's row layout, but apply the same rule to the "Log" button (secondary when nothing is left).
2. **Shared controls (M3).**
   - `ProcurementToolbar.tsx`: the search box is the shadcn `Input`; the status and group selects are `NativeSelect` (a styled native select, so phones keep the system picker). On a phone they stack: search full width, then the two selects side by side. Labels: give each select an accessible name ("Filter by status", "Group by").
   - `ProcurementTabs.tsx`: Items / Quotes / Purchases use shadcn `Tabs` (`TabsList`, `TabsTrigger` with the count as a `Badge`). Keep the same three sections and counts. Keep `aria-label="Procurement sections"` on the list. This changes the buttons to tabs: update `tests/projects-authenticated-layout.spec.ts` where it clicks them (role `tab` instead of `button`).
   - Status chips everywhere in Buying use `Badge` with the existing status colours (pending amber text `#92400e` on `#fffbeb`, in progress blue `#1d4ed8` on `#eff6ff`, purchased green `#166534` on `#f0fdf4`, over-purchased red `#b91c1c` on `#fef2f2`); every pair must be 4.5:1 or better.
   - `PurchaseDialog.tsx`: keep the dialog itself, lay out its fields with `FieldGroup` / `Field` / `FieldLabel` / `Input` / `NativeSelect`, `inputMode="decimal"` on quantity and price, `h-11` on a phone.
3. **Purchases tab.** `ProcurementPurchasesTab.tsx`: on a phone, each purchase is a compact row (material, "1,250,000.5 × $0.0875", total on the right, supplier and note below in muted text, wrapping). On desktop use the shadcn `Table` with the same columns as today. Keep the date grouping and day totals.
4. **Undo a deleted BOQ line (H7).** In `useProjectData.ts` `handleDeleteItem`:
   - Remove the line from `items` at once, then show a Sonner toast: "Line removed" with an **Undo** action, about 6 seconds.
   - Only call `deleteBOQItem` when the toast closes without Undo (`onAutoClose` / `onDismiss`). Undo puts the line back where it was, with no database call.
   - If the page is left before the toast closes (unmount or `pagehide`), commit the pending delete then.
   - If the delete fails, put the line back and show the existing error message.
   - Mount `<Toaster />` from `src/components/shadcn/sonner.tsx` once in the project workspace page, `position="bottom-center"`, raised above the phone dock (`mobileOffset={{ bottom: 88 }}` or the dock's real height).
   - Add a unit test for the pending-delete logic (put the logic in a small pure helper or hook in `src/lib/projects/` so it can be tested without React if that is simpler).

## Done when

- `npm run lint && npm run typecheck && npm run build && npm run test:unit` all pass.
- `tests/projects-authenticated-layout.spec.ts` updated only where a role changed.
- No `bg-muted`, `bg-accent`, `bg-secondary`, `text-secondary-foreground`, `text-muted-foreground`, `bg-primary` (unprefixed shadcn names) anywhere you wrote code: `grep -rnE "\b(bg|text|border|ring)-(muted|accent|secondary|primary|destructive|popover|card)(-foreground)?\b" src/components/projects/procurement` returns only the app's own existing uses, if any.
- Write a short summary of what you changed, file by file, and anything you could not do.

Claude will then check in a browser at 390px and 1440px with the normal and the worst-case project: Buying on a phone no longer than about a third of today's height, no blue button in the closed list, 44px controls, nothing clipped, no sideways scrolling, rows open and close, and the BOQ delete undo works.
