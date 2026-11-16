# Batch 9: one toast, one set of form controls and tabs

Source: `docs/UX_AUDIT_2026-11-15.md` finding M3 (controls look different in every view) and H7's toast. Model: batch 3's Buying view (`src/components/projects/procurement/**`).
Background reading (optional, plain Markdown files): `/Users/audreytsoka/.claude/skills/emil-design-eng/SKILL.md`, `/Users/audreytsoka/.claude/skills/ask-sonner/SKILL.md`. No skill is required for this brief.

## Changes

1. **One toast system.** The app has its own toast (`src/components/ui/Toast.tsx`, `useToast` in about 32 files) and Sonner (`src/components/shadcn/sonner.tsx`, used for the BOQ undo). Keep the `useToast` API exactly (`showToast`, `success`, `error`, `warning`, `info`) but implement it with Sonner's `toast`, so none of the 32 callers change. Mount one `<Toaster />` for the whole app (where `ToastProvider` is mounted today) and remove the one in `src/app/projects/[id]/page.tsx`; on pages with the phone dock the toasts must sit above it (keep the safe-area-aware offset from batch 6). Errors stay until dismissed or 6s; success 4s.
2. **Form controls (M3).** In the project screens not yet converted, lay out forms with `FieldGroup` / `Field` / `FieldLabel` and use `Input` and `NativeSelect` (`h-11` on a phone): the Usage log form (`src/components/projects/usage/UsageLogTab.tsx`), the Documents category filter and upload form (`DocumentsTab.tsx`, `DocumentUploader.tsx`), the Budget view inputs (`src/components/ui/BudgetPlanner.tsx`), `ProjectSettings.tsx`, the BOQ add-item form (`boq/BoqAddItemForm.tsx`), the BOQ status filter and search, and the new-project wizard (`src/app/projects/new/page.tsx`). Keep every field, label text, validation and saved value; `inputMode="decimal"` on amounts and quantities.
3. **Tabs.** Usage (Log / Materials / Ledger, `ProjectUsageView.tsx`) and any other segmented switch in the project screens (Simple / Detailed in BOQ, Daily / Weekly in Usage) use shadcn `Tabs` (or `ToggleGroup`-style `Tabs` for a two-way switch), with counts as `Badge`. Keep `aria-label="Usage tracking"` on the Usage tab list.

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
