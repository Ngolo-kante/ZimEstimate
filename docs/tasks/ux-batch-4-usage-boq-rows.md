# Batch 4: Usage and BOQ as compact rows; BOQ table first on desktop

Source: `docs/UX_AUDIT_2026-11-15.md`, findings H5 (Usage, BOQ), H4, M5, M6. Plan: `docs/tasks/ux-plan.md`.
Model to follow: batch 3's Buying rows (`src/components/projects/procurement/ProcurementItemCard.tsx`, `src/styles/procurement-view.css`): the same compact row, `Collapsible`, `Badge`, and press feedback, so the three views feel like one app.

## Changes

1. **Usage on a phone (H5).** `src/components/projects/usage/**`, `StageUsageSection.tsx`, `src/styles/project-usage.css`: the "Burn-down by material" cards (about 300px each) become compact rows: name (two lines at most), one key fact ("0.75 each left", "No price yet"), a small usage % and a thin progress bar; tapping opens Available / Used / Remaining. The recent usage log and the ledger become compact rows too. The log form stays as it is. Target: the Usage view on a phone at most half today's height for the sample project.
2. **BOQ on a phone (H5).** `src/components/projects/boq/**`, `StageBOQSection.tsx`, `src/styles/stage-boq-section.css`: each line becomes a compact row (name, "Qty × price", line total, status `Badge`); tapping opens the detail fields and the row actions. Row actions (log purchase, record usage, delete) get visible text labels inside the opened row, not icon-only buttons. Delete keeps batch 3's undo toast.
3. **BOQ table first on desktop (H4).** At 1024px and up, the BOQ table for the selected stage starts within the first screen: move the "Where the budget goes" chart below the table (or into a collapsed section) and keep the stage strip directly above the table. Use the shadcn `Table` for the desktop BOQ table if it fits without losing features; otherwise keep the current table and say why.
4. **Six stages (M5).** `src/styles/project-workspace.css` (~line 199): the stage strip uses `repeat(6, minmax(0, 1fr))` on desktop (or `auto-fit` with a sensible minimum) so the sixth stage is not alone on a second row.
5. **No page jump (M6).** `src/components/projects/views/BoqView.tsx`: replace `scrollIntoView({ block: 'nearest' })` on the stage button with scrolling the stage strip sideways only (`strip.scrollTo({ left: …, behavior })`, `behavior: 'auto'` under reduced motion). Opening the BOQ on a phone must not scroll the page.

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
