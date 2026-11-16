# My projects: the owner's starred "Calm & Minimal" design (Stitch, 16 Nov 2026)

The owner starred one Stitch design for the My projects page, "My Projects — Calm & Minimal". Rebuild the page's look to match it, in the app's own components, keeping everything the page does today (data, menus, links, the + button, loading skeleton, empty state, archived section, shared section, filters from 6 projects). Files: `src/app/projects/page.tsx`, `src/components/projects/list/**`, `src/styles/projects-list.css`.

## What to take from the design (phone first, 390 px)
1. **Header row:** "My projects" (bold, tight tracking) left; **New project** as a rounded-full pill button with a + icon right, 44px tall.
2. **Numbers line** under it: "3 builds · 2 active · **$1.3M** estimated · 3 of 3 free projects" with light dot separators, the estimate in bold navy, plan usage amber only at the limit (as today). **See insights** below it in blue with a small chevron.
3. **Continue panel** (white card, 16px radius, 1px slate-300 border, very soft shadow):
   - Top row: "Continue your build" small blue label (sentence case, not uppercase) and the ⋮ menu (44px target) at the right.
   - Project name (bold) and short location beneath.
   - Stage pill: neutral grey pill with a small dot; dot blue when in progress, green when complete (status colours from batch 6; no amber).
   - Thin divider, then "**$3,851** spent of **$16,794**" left and the percentage "23%" in blue on the right, then an 8px rounded progress bar.
   - "Next to buy" (sentence case, small bold) with rows separated by thin dividers: name left, bold price right, small chevron that turns blue on hover/press.
   - Full-width **Open project** button, 48px, rounded-xl, with an arrow icon on the right.
4. **Section headers with counts:** "Builds" and a small grey pill with the count (3); same for "Quick estimates" and "Archived".
5. **Build cards** (white, 16px radius, 1px border, faint shadow, border darkens slightly on hover):
   - Title (bold, wraps) and the stage badge under it; ⋮ top-right (44px target).
   - Thin divider, then two quiet rows with small icons: location (pin) and "Updated 6 Nov" (calendar).
   - **Estimate strip** at the bottom: a light slate-50 rounded box with "Estimate" left and the amount right in bold tabular figures, or "No estimate yet" in muted italic. Every card ends the same way.
6. **Quick estimate cards:** same structure, type badge (Solar, Borehole) **neutral grey** for every type (the owner's rule: no per-type colours), updated row, estimate strip.
7. Desktop (≥ 768 px): same components in the existing grid; the Continue panel keeps its two-column layout (details and Open on the left, Next to buy on the right).

## What NOT to copy from the Stitch code
- Its viewport tag blocks zooming (`user-scalable=no, maximum-scale=1.0`): never.
- Its font (Plus Jakarta Sans): keep the app's Geist.
- Text under 12px (its 10–11px labels) and buttons under 44px (its 32px ⋮): keep our minimums.
- Uppercase labels ("ESTIMATE", "NEXT TO BUY"): sentence case.
- Amber stage dots and green/blue per-type badges: status colours only for status.
- Its own top bar, bottom tab bar and footer: keep the app's existing ones.
- Tailwind CDN or inline config: use the project's existing styling approach.

## Rules
- No commits, pushes, packages, network, `.env*`, `supabase/**`, vision files, `src/app/api/**`.
- Update `tests/projects-authenticated-layout.spec.ts` only where a name or role you changed is asserted.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass. Finish with a file-by-file summary.
