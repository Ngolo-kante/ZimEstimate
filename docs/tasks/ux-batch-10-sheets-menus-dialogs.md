# Batch 10: phone sheets you can swipe, one menu and one dialog

Source: `docs/UX_AUDIT_2026-11-15.md` motion items 2–3 and M10. Background reading (optional, plain Markdown files): `/Users/audreytsoka/.claude/skills/gestures/SKILL.md`, `/Users/audreytsoka/.claude/skills/emil-design-eng/SKILL.md`. No skill is required for this brief.

## Changes

1. **Phone sheets → `Drawer` (Vaul).** The projects-list card menu sheet (`src/components/projects/list/MobileCardSheet.tsx`, `src/styles/projects-list.css`, `src/app/projects/hooks/useCardActions.ts`) and the workspace "More" sheet on the phone dock (find it from the dock's "More" button) become shadcn `Drawer`s: they follow the finger 1:1, close on a quick downward flick or past about a quarter of their height, can be caught mid-motion, and show a grab handle. Each needs a `DrawerTitle` (visually hidden is fine). Keep every action, its label and its order. Remove the CSS sheet animations batch 6 added for these if the Drawer replaces them.
2. **Menus → `DropdownMenu`.** The project card "…" menu on desktop (`ProjectsGrid.tsx`) and any other hand-built dropdown in the project screens use `DropdownMenu` (items in `DropdownMenuGroup`, destructive items with the destructive variant, opening from the trigger: scale from 0.97 and fade, 150ms, `transform-origin` at the trigger). Keep the trigger's accessible name "Actions for <project name>".
3. **Dialogs → `Dialog` / `AlertDialog`.** `procurement/PurchaseDialog.tsx`, `src/components/ui/ConfirmDialog.tsx` (as an `AlertDialog`; keep its props so callers do not change), `PhoneNumberModal.tsx` and `ProjectPickerModal.tsx`: focus moves in on open and back to the trigger on close, Escape closes, a title for screen readers. On a phone, the purchase form opens as a `Drawer` from the bottom instead of a centred dialog. Modals stay centred and scale from 0.96 with a fade, 200ms; exits faster.
4. **Tooltips on desktop icon buttons.** Icon-only buttons in desktop BOQ rows (log purchase, record usage, delete) get a `Tooltip` with the same text as their `aria-label`; the first tooltip waits about 400ms, then neighbouring ones open instantly. No tooltips on touch.

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
