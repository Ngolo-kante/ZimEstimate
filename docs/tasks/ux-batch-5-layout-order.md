# Batch 5: Overview, projects list and Budget Estimator order

Source: `docs/UX_AUDIT_2026-11-15.md`, findings H6, H9, H10. Plan: `docs/tasks/ux-plan.md`.
This batch moves sections; it does not restyle them. Where the audit suggests two options, take the first one and say so.

## Changes

1. **Overview (H6).** `src/components/projects/views/OverviewView.tsx` and the components it renders: lead with stage progress and "Next steps"; show the estimate once (keep the one summary that also shows budget and spend, remove the repeats: KPI card, cost split, Project Summary and dark total card must not all show the same total); drop the "Pro Tip" card that advertises a feature already in the navigation; make the most likely next action the one filled (primary) button, and "Edit project" secondary. On a phone, "Next steps" must start within the first two screens (about 1,700px).
2. **Projects list (H9).** `src/app/projects/page.tsx`, `src/components/projects/list/**`, `src/styles/projects-list.css`: on a phone, the first project card starts directly under the title and search (move the five stats below the list or into a collapsed "Summary"; keep one "New project" button). The project name takes the full card width with the status badge below it; icons `flex-shrink: 0`. Target: first card within about 400px of the top on a 390px phone.
3. **Budget Estimator (H10).** The Budget Estimator page (find it from the "Budget Estimator" link in the header nav): on a phone, show the headline result (what the budget buys, or the estimate) directly under the budget field, updating as the person types, or pin a compact summary bar at the bottom above the dock with the headline number and a link that scrolls to the full results. Desktop keeps its side-by-side layout.

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
