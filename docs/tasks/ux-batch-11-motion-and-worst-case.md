# Batch 11: motion across the rest of the app, worst-case data on the untested screens

Source: `docs/UX_AUDIT_2026-11-15.md` ("Where motion would help", M9's `transition: all` count, M7). Batch 6 cleaned motion in the project screens only.
Background reading (optional, plain Markdown files): `/Users/audreytsoka/.claude/skills/improve-animations/SKILL.md`, `/Users/audreytsoka/.claude/skills/break-ui/SKILL.md` and its `CATALOG.md`. No skill is required for this brief.

## Changes

1. **Motion outside the project screens.** In `src/app/**` and `src/components/**` except the project screens batch 6 covered, and except the home page and vision files:
   - Replace every `transition: all` with the properties that actually change; use `var(--ease-out)` for enter/press and `ease` for colour.
   - Remove motion on things people use many times a minute or trigger from the keyboard; keep it for occasional things (modals, sheets, toasts, a first-time success).
   - Entrances from `scale(0.95+)` and opacity, never `scale(0)`; under 300ms except modals and sheets; exits faster than entrances; every animation has a `prefers-reduced-motion: reduce` fallback that keeps fades and drops movement.
   - Only `transform` and `opacity` animate (height for collapsibles is the one exception). List any keyframe animation you removed and why.
2. **Worst-case data on untested screens (M7).** Read Compliance (`ComplianceTrackerTab.tsx`), Budget (`BudgetPlanner.tsx`), Documents (`DocumentsTab.tsx`, `DocumentCard.tsx`) and Settings (`ProjectSettings.tsx`) against these realistic values and fix what would clip, overflow, squash or misformat, with the batch 2 rules (`min-width: 0` on text columns, `overflow-wrap: anywhere` on long strings, `flex-shrink: 0` on icons and badges, amounts never wrap or truncate, `formatUsd`/`formatQuantity` for numbers, correct plurals):
   - project name "Aleksandra Wiśniewska-Kowalczyk's double-storey family residence with cottage, gatehouse and borehole"; owner email `bartholomew.fitzgerald@northwind-industries-holdings.example.com`;
   - budget limit $1,250,000 with an estimate $357,487.24 over; a target of $0; a savings plan of 1 week and of 260 weeks;
   - 17 compliance tasks with one titled "City of Harare building plan approval resubmission (third time, revised structural drawings)" and 0 complete; 1 certificate;
   - 0 documents, 1 document, and 240 documents in one category.
   Add unit tests for any helper you add.

## Rules (same for batches 4–6)

- Read `AGENTS.md` first (this Next.js version differs from what you know). Read the audit finding rows named above in `docs/UX_AUDIT_2026-11-15.md`.
- Do not commit, push, edit `.env*`, add npm packages, or run database commands.
- Do not touch `src/lib/vision/**`, `src/components/vision-takeoff/**`, `src/hooks/useVisionTakeoff.ts`, `src/app/api/**`, `supabase/**`, or the home page (`src/app/home/**`, `src/components/home/**`, `src/app/page.tsx`).
- Keep batch 2's formatters (`src/lib/format.ts`), batch 3's Buying view, and every accessible name `tests/projects-authenticated-layout.spec.ts` uses, unless a change below replaces it (then update the test, roles and names only).
- Phone first: design below 768px first; 768px and up must keep working.
- shadcn is set up (`src/components/shadcn/`, colours in `src/styles/shadcn.css`). Use only `sc-` colour names with it (`bg-sc-muted`), never `bg-muted` / `bg-accent` / `text-secondary`, which mean other things in this app. Installed: alert, alert-dialog, badge, button, collapsible, dialog, drawer (Vaul), dropdown-menu, empty, field, input, label, native-select, separator, skeleton, sonner, table, tabs, tooltip. Do not add more or any npm package; if one is missing, stop and say so. Keep using the app's own `src/components/ui/Button.tsx` for buttons outside shadcn overlays.
- styled-jsx: a scoped `<style jsx>` rule does not reach child components or `next/link`. Check each rule applies.
- Controls at least 44px tall on a phone. Text at least 12px. Text colour pairs 4.5:1 or better.
- Motion (Emil Kowalski): only `transform` and `opacity` (collapsible height is the one exception); entrances 150–300ms `cubic-bezier(0.23, 1, 0.32, 1)`, exits faster; under `prefers-reduced-motion: reduce` keep fades, drop movement; hover only inside `@media (hover: hover) and (pointer: fine)`; never animate keyboard actions or things used tens of times a minute.

## Done when

- `npm run lint && npm run typecheck && npm run build && npm run test:unit` all pass.
- Finish with a short file-by-file summary and anything you could not do. Claude will check it in a browser at 390px and 1440px with the normal and worst-case projects.
