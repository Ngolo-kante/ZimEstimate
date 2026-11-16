# Fixes from the owner's second round of screen comments (16 Nov 2026)

Make exactly these changes. Same brand (navy `--color-primary`, accent blue `--color-accent`, status colours only for status), `src/components/ui/Button.tsx` variants, shadcn components in `src/components/shadcn/` with `sc-` colour names only. Phone first, 44px tap targets, `prefers-reduced-motion` respected. The owner's own UI rule from these comments: **colour must mean something** (status or the one main action); no decorative per-card or per-type colours.

## A. Colour clean-ups
1. **Documents** (`src/components/projects/DocumentsTab.tsx`, `DocumentCard.tsx`, `DocumentUploader.tsx`): "so many different colors". Use one accent plus neutrals: file-type icons in a neutral tint, category chips neutral (`Badge` secondary), the "Saved" tag neutral; colour only for a real state (an upload error). Remove button stays a quiet destructive text style.
2. **Quick projects list** (`src/app/quick-projects/**`): "why different colors?" Every project-type card gets the same neutral surface and border; the type is told apart by its icon and name; icons in one muted tint. No per-type colour backgrounds or rank colours.
3. **Describe your project cards** (`/estimate`, `src/app/estimate/**`, `src/components/estimate/**`): "same color issues on these cards" — same treatment as 2.

## B. One main action per screen
4. **Quick estimate** (`src/app/projects/quick/[id]/page.tsx`, `src/components/quick-projects/**`): "do we need to place emphasis on these buttons?" Exactly one filled primary button per view: **Save BOQ** stays primary; "Find a contractor" and the PDF/Share/Invite/Edit actions become secondary (outline) or icon buttons, same size. No other filled buttons.

## C. Start options everywhere
5. **New project** (`src/app/projects/new/page.tsx`): "add more options… solar, borehole etc". The first step offers, as equal choices: House (the current flow), **Describe it instead** (opens `/estimate`), **Solar**, **Borehole**, **Fencing / paving** (each links to its existing quick estimate start; find the real routes from `/projects/quick` and the Budget Estimator tabs; do not invent routes).
6. **Floating + button on phones** ("a floating + button for mobile view… like other mobile apps"): on phones only, on `/projects`, `/projects/quick` and `/estimate`, a round 56px **+** button bottom-right, above the phone dock and safe area. Tapping opens a `Drawer` titled "Start something new" with the same choices as 5. Accessible name "Start something new". Hidden on desktop.
7. **Describe your project as a chat** (`/estimate`; owner agreed): present the describe flow as a simple conversation, reusing the existing parsing (no new AI calls, no new packages): an assistant message asking what they want to build; the person's description as their message bubble; the assistant's "Here's what I understood" summary (the fields the page already extracts); one follow-up question per missing key field (bedrooms, size, location, budget) answered by tapping a chip or typing; then a primary **Build my estimate** that hands off exactly as the page does today. Keep its current URL and what it saves.

## D. Smaller screen fixes
8. **Settings on a phone** (`src/app/settings/page.tsx`): "make sections collapse accordion". Below 768px, show each tab's cards as a `Collapsible` accordion (heading row visible, one open at a time, the first open by default). Desktop unchanged. Keep the tabs and their address (`#notifications` etc.).
9. **Marketplace on a phone** (`src/app/marketplace/**`): "remove this section, covering the section even it is unused". On phones the material detail panel ("Select a material to view details") and the "Work with ZimEstimate" box float over the list even when nothing is selected. On phones: show the detail panel only when a material is selected, as a `Drawer` from the bottom; move "Work with ZimEstimate" into the normal page flow after the list. Desktop unchanged.
10. **Sign up / Sign in** (`src/app/auth/signup/page.tsx`, `src/app/auth/login/page.tsx`): "add color, looks dull". On desktop (≥ 900px) a two-column layout: the form on one side, a navy brand panel on the other with the product's promise in one line, three short benefits, and the logo; white text on navy. On phones keep the form first, with a slim navy header band. Same for both pages.
11. **"Register as a contractor" link** (Sign up, and Sign in if present): link colour `#1d4ed8` with an underline on hover, 44px tap area.

## Rules
- Do not touch the home page (`src/app/home/**`, `src/components/home/**`, `src/app/page.tsx`), vision files, `src/app/api/**`, `supabase/**`, `.env*`. No commits, pushes, packages, or network.
- Update `tests/projects-authenticated-layout.spec.ts` only where a name or role you changed is asserted.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass. Finish with a file-by-file summary and anything you could not do.
