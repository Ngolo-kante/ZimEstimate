# Batch 6: status colours, motion items 1–5, phone baseline

Source: `docs/UX_AUDIT_2026-11-15.md`, findings M4, M8, M9 and the "Where motion would help" table (items 1–5). Plan: `docs/tasks/ux-plan.md`.

## Changes

1. **Four status colours (M4).** Define four status roles once in `src/app/globals.css` (they mostly exist: `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*`) with fixed meanings: done = green, in progress = blue, needs attention = amber, problem = red. Apply them in the project workspace (`src/components/projects/**`, `src/styles/project-*.css`, `procurement-view.css`, `stage-boq-section.css`): amber only for "needs attention" (pending approval, left to buy), red only for problems (over budget, over-purchased), green only for done, blue for in progress. Links and bought quantities stop sharing the status blue: bought quantities use the text colour with tabular figures. The current-stage outline on Overview uses the app accent, not orange. Badge pairs 4.5:1 or better.
2. **One "purchased" count (M8).** Overview, BOQ and Buying count purchased lines the same way, from quantities (a line counts as purchased when bought ≥ BOQ quantity), not from the `is_purchased` flag alone. Put the rule in one helper in `src/lib/projects/` with a unit test, and use it in all three places.
3. **Phone baseline (M9).** The rules below are complete on their own; for background you may read `/Users/audreytsoka/.claude/skills/mobile-native/SKILL.md` (a plain Markdown file, not something to load). No skill is required for this brief:
   - `src/app/layout.tsx` viewport export: `viewportFit: 'cover'`, `interactiveWidget: 'resizes-content'`, and `themeColor` matching the header background (light only; the app has no dark mode).
   - Replace `100vh` with `100dvh` for app shells and full-height panels, `100svh` for public heroes, in `src/**` (not vision or home files). Keep a `100vh` line above as a fallback only where a comment says older browsers matter.
   - Fixed bottom bars (phone dock, sticky summary bars, the Sonner toaster offset) pad with `env(safe-area-inset-bottom, 0px)`.
   - Replace `transition: all …` with the specific properties that change, in `src/styles/**`, `src/components/projects/**`, `src/components/ui/**`, `src/components/layout/**`. Use the two curves `cubic-bezier(0.23, 1, 0.32, 1)` (enter/press) and `ease` (colour), defined once as `--ease-out` and used everywhere you touch.
4. **Motion items 1–5** from the audit table (item 1 is done; check it and skip): 2 the phone card menu sheet in `src/styles/projects-list.css` slides with `translateY(100%)` → `0`, 300ms `cubic-bezier(0.32, 0.72, 0, 1)`, out in 200ms, as a transition so it can be interrupted; 3 the card dropdown scales from `scale(0.97)` + `opacity: 0`, `transform-origin: top right`, 150ms; 4 BOQ stage sections and Buying groups open and close with height + opacity 200ms (if batch 3/4 rows already do, skip); 5 the projects-list "saved" notice enters with `@starting-style`. All with reduced-motion fallbacks.

## Rules (same for batches 4–6)

- Read `AGENTS.md` first (this Next.js version differs from what you know). Read the audit finding rows named above in `docs/UX_AUDIT_2026-11-15.md`.
- Do not commit, push, edit `.env*`, add npm packages, or run database commands.
- Do not touch `src/lib/vision/**`, `src/components/vision-takeoff/**`, `src/hooks/useVisionTakeoff.ts`, `src/app/api/**`, `supabase/**`, or the home page (`src/app/home/**`, `src/components/home/**`, `src/app/page.tsx`).
- Keep batch 2's formatters (`src/lib/format.ts`), batch 3's Buying view, and every accessible name `tests/projects-authenticated-layout.spec.ts` uses, unless a change below replaces it (then update the test, roles and names only).
- Phone first: design below 768px first; 768px and up must keep working.
- shadcn is set up (`src/components/shadcn/`, colours in `src/styles/shadcn.css`). Use only `sc-` colour names with it (`bg-sc-muted`), never `bg-muted` / `bg-accent` / `text-secondary`, which mean other things in this app. To add a component: `npx shadcn@latest add <name> -y` then `node scripts/shadcn-scope.mjs`; if that needs the network and fails, build with what is there and say so.
- styled-jsx: a scoped `<style jsx>` rule does not reach child components or `next/link`. Check each rule applies.
- Controls at least 44px tall on a phone. Text at least 12px. Text colour pairs 4.5:1 or better.
- Motion (Emil Kowalski): only `transform` and `opacity` (collapsible height is the one exception); entrances 150–300ms `cubic-bezier(0.23, 1, 0.32, 1)`, exits faster; under `prefers-reduced-motion: reduce` keep fades, drop movement; hover only inside `@media (hover: hover) and (pointer: fine)`; never animate keyboard actions or things used tens of times a minute.

## Done when

- `npm run lint && npm run typecheck && npm run build && npm run test:unit` all pass.
- Finish with a short file-by-file summary and anything you could not do. Claude will check it in a browser at 390px and 1440px with the normal and worst-case projects.
