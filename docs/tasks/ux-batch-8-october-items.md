# Batch 8: the six October items never re-checked

Source: `docs/PROJECTS_UX_AUDIT_PLAN_2026-10-11.md` and the "October audit: what is still open" table in `docs/UX_AUDIT_2026-11-15.md`. For each item: first confirm whether it still happens (read the code; write a unit test that shows it where you can), then fix it if it does. Say for each one whether it was still broken.

## Changes

1. **Budget custom target lost on leaving.** In the project Budget view (`src/components/ui/BudgetPlanner.tsx` and the hooks it uses), a custom target typed by the person must survive leaving the view and coming back, and a reload (it should be saved like the other budget fields, or kept as a draft until saved; do not add a database column; if it needs one, stop and say so).
2. **Date not rolled back on failure.** Find the date field from the October audit (a purchase date or usage date edit). When saving fails, the field returns to the last saved value and the existing error message shows.
3. **Insights failure looks empty.** `/projects/insights` (or the Insights view): when its data fails to load, show an error state with a retry (use the app's `ErrorState` component), not the empty state.
4. **Empty document filter says "No documents yet".** In Documents, when a category filter matches nothing but the project has documents, say "No documents in this category" with a way to clear the filter; keep "No documents yet" for a project with none.
5. **Google button overflow.** On `/auth/login` and `/auth/signup` at 320px and 390px, the Google sign-in button fits its container with no sideways overflow.
6. **`7.199999999999999` quantity.** Find where a floating-point quantity is shown or stored unrounded (grep for arithmetic on quantities that is displayed without `formatQuantity`, and inputs that show computed values). Displayed values use `formatQuantity`; values written to inputs are rounded to at most 4 decimals.

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
