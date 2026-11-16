# My projects page, reimagined

Agreed with the owner on 16 November 2026 over five rounds of questions. Each decision below is settled; do not reopen it in code. If something cannot be built as written, stop and say why.

Background reading (optional, plain Markdown files): `/Users/audreytsoka/.claude/skills/emil-design-eng/SKILL.md`, `/Users/audreytsoka/.claude/skills/break-ui/SKILL.md`, `/Users/audreytsoka/.claude/skills/mobile-native/SKILL.md`. No skill is required for this brief.

**Who it is for:** homeowners first, with one or two builds. The page answers "where is my build at, and what is next?" It must still work for a builder with 20 jobs.

**Files:** `src/app/projects/page.tsx`, `src/app/projects/hooks/useProjectList.ts`, `src/components/projects/list/**`, `src/styles/projects-list.css`, `src/components/projects/ProjectsSubNav.tsx`, `src/app/projects/dashboard/**`, the header nav label in `src/components/layout/TopNavbar.tsx`, the quick estimate back link in `src/app/projects/quick/[id]/page.tsx`, and the project workspace page for recording opens.

## 1. Name and navigation

- One name everywhere: **"My projects"**. Header nav, page title, the quick estimate back link and the sub-navigation (today "My Projects", "My projects" and "My work").
- The list always opens first. Insights moves to **`/projects/insights`** (same page that is now `/projects/dashboard`); `/projects/dashboard` redirects there permanently so old links work. Remove the "My work / Insights" switch at the bottom of the list; Insights is reached from the numbers line (section 3).
- Breadcrumbs "My projects / <name>" (a `nav` with `aria-label="Breadcrumb"`, the current page `aria-current="page"`, the link a 44px tap target):
  - inside a project, on every workspace view (Overview already has one; make the others match);
  - on a quick estimate, replacing the "← My work" back link;
  - on Insights: "My projects / Insights".
  None on the list page itself.

## 2. Page order, top to bottom

1. **Title "My projects"** with one **New project** button beside it, on a phone too. No eyebrow ("Project workspace") and no second heading ("All projects and estimates").
2. **Continue panel**, showing the active build the person opened most recently (section 4). Contents:
   - the name and short location;
   - the current stage, e.g. "Walls · in progress", using the same stage logic as Overview's stage cards;
   - spent against the estimate as a thin bar with the figures, e.g. "$3,851 of $16,794";
   - the next 2–3 things to buy or do: the same list as Overview's "Next steps" (`pendingItems` in `src/components/projects/views/OverviewView.tsx`). Move that logic into a shared helper rather than copying it;
   - an **Open** button (primary). Each next-step item links to that line in Buying.
   Show nothing for a person with no active build: the lists move up.
3. **One slim numbers line**: "3 builds · 2 active · $1.3M estimated · 3 of 3 free projects", then a **See insights** link. Plan usage only appears for free-plan accounts; "free projects" turns amber when at the limit. Use `formatUsd` with whole dollars, and "$1.3M"-style compact figures only from $1,000,000 up (add a `compact` option to `src/lib/format.ts` with a unit test).
4. **Search and filter**, only when the person has **6 or more** projects: a search box plus one **Filter** button that opens a `DropdownMenu` (desktop) or `Drawer` (phone) holding type, status, scope and sort. Fewer than 6: nothing between the numbers line and the lists.
5. **Builds**: the person's full builds (draft, active, completed), each a card:
   - name (wraps; never truncated past two lines); a type label only if it isn't a full house;
   - **current stage** as a `Badge` ("Walls · in progress", "Completed", "Draft");
   - **short location**: suburb and city only ("Borrowdale, Harare"), from the location field; the full stand address stays inside the project;
   - **"Updated 6 Nov"** (day and short month; add the year only if it is not this year) instead of an unlabelled "06/11/2026";
   - **estimate**, or **"No estimate yet"** in muted text when it is 0 or missing;
   - the ⋮ menu (`DropdownMenu` on desktop, `Drawer` on a phone; actions unchanged) in the card's **top-right corner** on every width;
   - no soil, slope, geotech, "Full House" or labour/materials tags (they stay inside the project).
   Cards are equal height in each row on desktop (grid, `align-items: stretch`), one column on a phone.
6. **Quick estimates**: their own section, heading "Quick estimates", with simpler cards: name, type badge (Solar, Borehole...), estimate, "Updated 6 Nov", menu. Hidden when there are none.
7. **Shared with you** (`SharedWithYou.tsx`): moved **below** the person's own builds and quick estimates. Unchanged otherwise.
8. **Archived (n)**: archived builds and quick estimates in a `Collapsible` at the bottom, closed by default, showing the count. Completed builds stay in Builds with the "Completed" badge.

## 3. States

- **New person, no projects:** replace "No projects yet" with **"Start your first estimate"** and three choices as large tappable cards, each with a one-line description and how long it takes:
  - "Upload a plan": link to the plan upload flow;
  - "Describe the house": link to `/estimate`;
  - "Quick estimate (solar, borehole)": link to `/projects/quick` or the quick budget.
  Find the real routes from the existing "New project" and home page links; do not invent routes.
- **Loading, including arriving straight after creating a project** (`optimisticProject` in `useProjectList.ts`): a shadcn `Skeleton` shaped like the page (Continue panel, numbers line, two cards), not a spinner. When data arrives, the content replaces the skeleton with a 150ms opacity fade, so nothing jumps; the just-created project appears in its real place.
- **Error:** the existing error with Retry, restyled with the shared button.
- **Only drafts or only quick estimates:** no Continue panel.

## 4. Last opened

- Migration `supabase/migrations/066_project_opens.sql` (already written; **do not edit or run it**; the owner reviews and applies it) adds `public.project_opens (user_id, project_id, opened_at)`, one row per person per project, with RLS so people see and write only their own rows.
- Add its type to `src/lib/database.types.ts`.
- When a project workspace opens (`src/app/projects/[id]/page.tsx` once the project has loaded), upsert `{ user_id, project_id, opened_at: now }` on conflict `(user_id, project_id)`. Fire and forget: never block or fail the page.
- The Continue panel picks the person's own **active** build with the latest `opened_at`; if none has a row, the active build updated most recently. Quick estimates and shared projects never take the panel.
- **Before the migration is applied the page must still work:** if reading or writing `project_opens` fails (table missing, error `42P01` or PostgREST `PGRST205`), fall back silently to "most recently updated active build" and do not log it as an error.
- Unit-test the picking rule as a pure helper in `src/lib/projects/` (opened beats updated; active only; quick and shared excluded; no active build gives none).

## 5. Look and feel

- Same navy and blue style, made tidier. **One button set** on the whole page, all from `src/components/ui/Button.tsx`: primary (filled blue) for New project and Open; secondary (outlined) for everything else; text links for "See insights" and breadcrumbs. Same font size and weight for every button of a role. Remove one-off button styles in `projects-list.css`.
- shadcn `Card`-style surfaces (the app's own `Card` is fine), `Badge`, a progress bar (`role="progressbar"` with a label), `Skeleton`, `Collapsible`, `DropdownMenu`, `Drawer`.
- Motion (Emil Kowalski): this page is opened many times a day, so **no entrance animation**. Only: skeleton to content 150ms opacity; cards and buttons show press feedback (`:active` background change on cards, the Button's own scale); the Archived section opens with height + opacity 200ms `cubic-bezier(0.23, 1, 0.32, 1)`. Everything respects `prefers-reduced-motion`.
- Worst case must hold (batch 2 rules): a 120-character project name, a full stand address, a $1,284,750.55 estimate, 20 builds, 0 builds with 3 quick estimates.

## 6. Tests

- Update `tests/projects-authenticated-layout.spec.ts` where names or roles change ("My projects", Insights address, the removed switch).
- Unit tests: the Continue-panel picking rule, short location, "Updated 6 Nov" formatting, compact money.

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
