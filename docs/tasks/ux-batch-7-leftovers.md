# Batch 7: leftovers from batches 1–3

Source: `docs/tasks/ux-plan.md` ("Still open" notes on batches 1–3) and `docs/UX_AUDIT_2026-11-15.md` findings C2, H12 (public pages), M2, H6.

## Changes

1. **Sentence case (M2).** Every heading, label, tab and button a person reads in `src/components/projects/**`, `src/app/projects/**` and the sidebar uses sentence case: "Usage tracking" (sidebar, dock and view title must still match), "Recent usage logs", "Purchase ledger". Keep "Bill of Quantities" capitalised: it is the trade name of the document. Headings set in capitals with `text-transform: uppercase` may stay as small eyebrow labels (12px+) but not for section titles. Update `tests/projects-authenticated-layout.spec.ts` where a name it uses changes.
2. **Quick-estimate item names on a phone.** `src/components/quick-projects/QuickBOQTable.tsx` clamps descriptions to two lines with only a hover `title`, which a phone cannot show. Make the clamped text a button (or the row's existing expand) that shows the full description on tap; keep the clamp for the closed state.
3. **Faint and small text on public pages (C2, H12).** Not the home page. Pages and what the 15 Nov measurement found:
   - `/boq/new` (the BOQ wizard): step numbers and "Project Details" at about 2.2–2.4:1, and 7–8 kinds of text under 12px.
   - `/projects/quick` (quick projects list): "01"-style numbers at 2.2:1, labels at 3.95:1, 7 kinds under 12px.
   - `/cost-to-build-a-house-in-zimbabwe` (cost guide): a field label at 1:1 (probably white on white or a placeholder) and helper text at 3.7:1, 4 kinds under 12px.
   - `/marketplace`: filter chips and counts at 3.75–4.44:1.
   - `/quick-budget`: 6 kinds under 12px.
   Fix to 4.5:1 for text under 18px (3:1 for larger or bold), 12px minimum, by changing colours to the app's tokens (`--color-text-muted` #64748b on white, #475569 on tinted surfaces). Do not restyle anything else.
4. **Overview on a phone is still about 3,000px.** After batch 5, look at `src/components/projects/views/OverviewView.tsx` on a 390px phone and remove remaining repetition or move secondary panels (cost split chart, compliance summary) behind a "Details" disclosure so stage progress, next steps and the one summary come first. Target: under 2,200px for the sample project.

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
