# Fixes from the owner's screen review comments (16 Nov 2026)

The owner commented on screenshots of the live app. Make exactly these changes, nothing else. Same look as today (navy/blue, `src/components/ui/Button.tsx` variants); phone first; 44px tap targets; nothing animates except as stated.

## Screen 1 — My projects (`src/app/projects/page.tsx`, `src/components/projects/list/**`, `src/styles/projects-list.css`)

1. **Numbers line to the top.** "this should be at the top… they seem to be hidden": on a phone the numbers line ("3 builds · 2 active · $1.3M estimated · 3 of 3 free projects") and the **See insights** link sit under the tall Continue panel. Move `PortfolioStrip` directly under the "My projects" title row, **above** the Continue panel, on every width. Keep it hidden for a person with no projects. Keep it one compact line (wrapping is fine on a phone), "See insights" inline at its end.
2. **⋮ menu on the Continue panel.** "missing the three dot menu like other cards": give `ContinuePanel.tsx` the same ⋮ button as the project cards, in its top-right corner, opening the **same** actions with the same components and handlers the Builds cards use (`ProjectsGrid.tsx`: `DropdownMenu` on desktop, the phone `Drawer`/`MobileCardSheet` on a phone). Reuse that code; do not copy the action list. Keep the accessible name "Actions for <project name>". The project title must not run under the button (leave the same 52px clearance the cards use).

## Screen 2 — Project overview (`src/components/projects/views/OverviewView.tsx` and its styles)

3. **Header actions on one line (phone).** "can these buttons be in one line": Share, Invite and Edit project currently wrap to two rows on a 390px phone. Put them on one row of three equal-width buttons (icon + short label; `flex: 1 1 0; min-width: 0`), all the **same** secondary/outline style, 44px tall. If a label cannot fit at 320px, keep the icon and hide the text visually but keep it as the accessible name. Desktop unchanged apart from the same consistent style.
4. **One button style in Next steps.** "why is this button highlighted blue whilst the other buttons are not": the first pending item's **Purchase** button is primary (blue) and the rest are secondary. Make every Purchase button in Next steps the same secondary style, on phone and desktop.
5. **A clear "Details" section.** "what is this detail section and why hidden or not collapsed": the bare "▶ Details" disclosure at the bottom hides Compliance and Site photos and doesn't say so. Replace it with a full-width collapsible row (the shadcn `Collapsible`, closed by default) that reads **"Compliance and site photos"**, with a short summary on the right when closed (e.g. "1 of 6 certificates · 0 photos", using the counts the sections already compute), a chevron that rotates when open, a 44px minimum height, and `aria-expanded`. Opening shows the same Compliance snapshot and Site photos as today. Height + opacity 200ms `cubic-bezier(0.23, 1, 0.32, 1)` when it opens, nothing under `prefers-reduced-motion`.

## Rules

- Do not commit, push, run database commands, edit `.env*` or `supabase/**`; no new npm packages; no network.
- Do not touch the home page, vision files or `src/app/api/**`.
- Update `tests/projects-authenticated-layout.spec.ts` only where a role or name you changed is asserted.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass. Finish with a file-by-file summary.
