# Batch 1: accessibility floor and phone feel

Source: `docs/UX_AUDIT_2026-11-15.md`, findings C1, C2, C4, H1, H2, H3, H11, H12, M10.
Read `AGENTS.md` first (this Next.js version differs from what you know).

**Goal:** make text readable, controls tappable and buttons responsive on a phone, without changing layout or the look of the brand. This is shared CSS and small attribute changes, not a redesign.

## Rules

- Do not commit, push, add npm packages, edit `.env*`, or run database commands.
- Do not restructure layouts, rename classes, or change copy. Later batches do that.
- Do not touch `src/lib/vision/**`, `src/app/api/**`, `supabase/**`.
- styled-jsx gotcha: a scoped `<style jsx>` rule does not reach child components or `next/link`. Check each rule actually applies.

## Changes

1. **Zoom (C1).** `src/app/layout.tsx`: remove `maximumScale: 1` and `userScalable: false` from the `viewport` export. Change nothing else there.
2. **Input zoom (H2).** In `src/app/globals.css` add, once:
   ```css
   @media (pointer: coarse) {
     input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea { font-size: 16px !important; }
   }
   html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }
   button, a, summary, [role="button"], [role="tab"] { touch-action: manipulation; }
   ```
3. **Press feedback (H3).** `src/components/ui/Button.tsx`: replace `transition: all 0.2s ease` with `transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1), background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease;` and add `.btn:active:not(:disabled) { transform: scale(0.97); }`. Under `prefers-reduced-motion: reduce` keep the colour change and drop the scale.
4. **Sticky hover (H3).** Wrap every `:hover` rule in `@media (hover: hover) and (pointer: fine) { … }` in: `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/layout/**`, `src/styles/projects-list.css`, `src/styles/project-workspace.css`, `src/styles/stage-boq-section.css`, `src/styles/project-usage.css`, `src/styles/procurement-view.css`. Move only; do not change the declarations.
5. **Faint text (C2).** Text colours only, never borders, icons-as-decoration or backgrounds:
   - `#94a3b8` used as a text colour → `#64748b`. If `--color-text-muted` in `src/styles/design-tokens.css` is lighter than `#64748b`, set it to `#64748b`.
   - `#748196` (phone dock and small labels) → `#5b6b82`.
   - `#64748b` text on tinted surfaces (`#f4f6fb`, `#f5f7fb`, `#eff6ff`, `#e2e8f0`, `#eef2f7`), including the site footer links → `#475569`.
   - Amber text `#f59e0b` (for example `.qty-value.remaining`) → `#b45309`.
   - Green text `#16a34a` at 14px or smaller (for example `.qty-value.complete`, `text-[var(--color-success)]` labels) → `#15803d`; on green-tinted badges use `#166534`.
   - `#3b82f6` text on `#f8fafc` (`.kpi-action`) → `#1d4ed8`.
   Scope: `src/styles/**`, `src/components/projects/**`, `src/components/ui/**`, `src/components/layout/**`, `src/app/projects/**`.
6. **Focus ring (C4).** `src/styles/project-workspace.css`, the `.project-dashboard-shell …:focus-visible` rule: `outline: 2px solid var(--color-accent); outline-offset: 2px; box-shadow: none;`.
7. **Small text (H12).** Nothing under 12px in the scope above: phone dock labels (`.nav-text`), `.tab-count`, `.qty-label`, `.stat-label`, `.stage-number`, `.view-eyebrow`, `small` inside the stage switcher, and Tailwind `text-[10px]` / `text-[11px]` in `src/components/projects/**` → 12px.
8. **Tap targets (H1).** Below 768px only:
   - Site footer links: `display: inline-flex; align-items: center; min-height: 44px;`.
   - Header account and menu buttons (`.user-btn`, `.mobile-toggle`): 44×44.
   - `.compliance-warning-dismiss`, BOQ `.expand-trigger`, BOQ row `.action-btn`, project card `.menu-btn`, Overview `.stat-action`: 44×44 hit area (the icon can stay its size).
   - Buttons, inputs and selects in the workspace and projects list: `min-height: 44px`.
9. **Slow fade-in (H11).** Remove the `reveal` class and `data-delay` attributes from every element in `src/components/projects/**` and `src/app/projects/**`. Remove `useReveal(...)` calls there if nothing else needs them. Leave the home page and other public pages alone.
10. **Names for icon buttons (M10).**
    - Project card menu button: `aria-label={`Actions for ${name}`}`, `aria-haspopup="menu"`, `aria-expanded`.
    - Overview stat arrows (`.stat-action` in `ProjectKPIDashboard.tsx`): an `aria-label` saying where it goes.
    - BOQ `.expand-trigger`: `aria-label` "Collapse" / "Expand" plus the stage name, and `aria-expanded`.
    - BOQ row actions keep `title` and gain matching `aria-label`.

## Done when

- `npm run lint && npm run typecheck && npm run build && npm run test:unit` all pass.
- `tests/projects-authenticated-layout.spec.ts` still matches (update it only where an accessible name you added changes a selector).
- Write a short summary of what you changed, file by file, and anything you could not do.

Claude will then check in a browser at 390px and 1440px: no input under 16px on touch, no text colour pair under 4.5:1 in the scope, no control under 44px on the phone screens listed, pressed buttons scale, and no sideways scrolling.
