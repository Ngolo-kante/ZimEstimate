# Batch 12: Settings, the last two public pages, and the small misses

Source: `docs/UX_REAUDIT_2026-11-16.md` ("What is left": both High items and the Medium list). Each item below names the measured problem; fix that, nothing more.
Background reading (optional, plain Markdown files): `/Users/audreytsoka/.claude/skills/emil-design-eng/SKILL.md`, `/Users/audreytsoka/.claude/skills/mobile-native/SKILL.md`. No skill is required for this brief.

## Changes

1. **Settings (`src/app/settings/page.tsx`, `src/components/settings/ReminderChannels.tsx`).** Give it the treatment the workspace got in batches 1, 2 and 9:
   - Inputs at least 44px tall on a phone (they are 24px); text links like "Change email" get a 44px tap area; the Profile / Preferences / Plan tabs 44px tall. Use the shadcn `Field` / `FieldLabel` / `Input` and `Tabs` already in `src/components/shadcn/`.
   - Contrast: "No delivery activity yet." (#94a3b8 on white, 2.56:1), the "Free" plan badge (4.34:1) and "US Dollar" on #eff6ff (4.37:1) to 4.5:1 or better with the app's text tokens. No text under 12px (the "Verified" badge is 9.9px; "Account workspace" eyebrow 11.2px).
   - Sentence case for every heading, label and button ("Personal information", "Save changes", "Upgrade plan", "Danger zone", "Delete account", "Save preferences", "Update password"...).
   - "RFQs" → "Quote requests" in the notification toggles and hints ("Quote requests, quotes and updates").
   - Currency: USD is the only currency (`src/components/ui/CurrencyToggle.tsx`), so replace the selectable "USD" card and "Update currency" button with one line: "Prices are shown in US dollars." Do not change stored preferences.
   - "Upgrade plan" with its chevron on one line (the chevron currently wraps below it).
   - Keep every saved field, its validation and its API call exactly as it is.
2. **Quick projects list (`src/app/quick-projects/page.tsx`, `quick-projects.module.css`).** Rank numbers ("01" #d8a600 at 2.24:1, "04" #b66519 at 4.32:1) and category labels (#748196, 10.9px, 3.95:1) to 4.5:1 and 12px; "Most requested" (10.2px), "Project types" and "About 7 min" (11.2px) to 12px. Keep the accent colours as backgrounds or borders if they carry meaning, not as small text.
3. **BOQ wizard progress (`src/components/boq/WorkflowProgress.tsx` and the step header in `src/app/boq/new/page.tsx`).** Locked step names and numbers (#9aa5b4 on #f8fafc / #eef2f7, 2.2–2.4:1) to 4.5:1: locked steps can look quieter through weight or an icon, not by failing contrast. "Step 1 of 7" (11.2px, 3.65:1) and the step labels (10.6–11.5px) to 12px and 4.5:1. Step buttons 44px tall on a phone (they are 32px).
4. **Shared tap targets on every workspace phone screen.** The "My projects" breadcrumb link on Overview (70×19) gets a 44px-tall tap area; the site footer links "Terms" and "TikTok" (40–42px wide) get `min-width: 44px` (centre the text). The header logo link may stay 32px tall only if it already has 44px of tappable width and nothing sits within 8px above or below it; otherwise pad it.
5. **Near-miss colour pairs.** "Configure in settings" (`button.reminder-settings-link`, #2e6cf6 on #f8fafc, 4.37:1) → #1d4ed8; the Buying desktop spent figure (`span.stat.spent`, #64748b on #f5f7fb, 4.44:1) → #475569.
6. **Budget amounts font.** `src/components/ui/BudgetPlanner.tsx:539` sets `font-family: var(--font-mono)` on amounts; every other view uses the normal font with tabular figures. Remove the mono font, keep `font-variant-numeric: tabular-nums` and `white-space: nowrap`. Do the same for any other amount set in the mono font in the project screens or projects list (the projects list card estimate uses it too).
7. **Project cards on a phone (`src/components/projects/list/**`, `src/styles/projects-list.css`).** The "⋮" menu button floats between the badge and the date, leaving about 80px empty per card. Put it in the card's top-right corner, level with the project name (the name keeps the full remaining width and wraps). Keep its accessible name "Actions for <project name>" and 44×44 target.
8. **Overview next steps on a phone (`src/components/projects/views/OverviewView.tsx`).** Show the first three pending items, then the existing "View all N pending items" link; desktop unchanged. Target: Overview under 2,200px on a 390px phone for the sample project.
9. **Quick estimate controls (`src/app/projects/quick/[id]/page.tsx` and `src/components/quick-projects/**`).** The "Update" and "Tell us" links (20px tall) and the four action buttons (40px) get 44px tap areas on a phone.
10. **Last `transition: all`.** `src/app/projects/dashboard/page.tsx:627` and `src/app/projects/new/page.tsx:526, 641, 680`: name the properties that change.

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
