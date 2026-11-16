# Owner's comments, 16 Nov 2026 (round 4): home hero buttons and a chat bubble

Brand: navy `--color-primary`, accent blue `--color-accent` (`#1d4ed8` for small blue text on white). shadcn components live in `src/components/shadcn/` and use `sc-` colour names only. Minimums: 12px text, 44px tap targets. Respect `prefers-reduced-motion`. Gate hover styles behind `@media (hover: hover) and (pointer: fine)`. Use sentence case.

## 1. Home hero buttons on a phone (`src/app/home/home.module.css`, `src/app/home/page.tsx`)

The owner said: "add some icon here these two buttons and if you need space you add them on top of each other with start your BOQ on top and cover entire width for emphasis".

Below the phone breakpoint, in the rule block near line 900:
- Stack `.heroActions` as one column, with **Start your BOQ** first and **Upload your plan** under it. Both buttons are full width and at least 52px tall.
- Show the icons again. Remove the `display: none` rule on `.heroActions … > svg`. Each button gets its leading icon (Calculator, UploadSimple) and its trailing arrow, as on desktop.
- Desktop stays unchanged.

## 2. "Describe your project" becomes a floating chat bubble

The owner said: "This feature needs to be part of a chat icon floating bubble above or below the floating + icon … remove this here. This floating bubble appear on the home screen and this page. We remove the feature just making into a chat."

### The chat bubble

- Add a client component `src/components/estimate/DescribeChatBubble.tsx`: a round 56px button with a chat icon (Phosphor `ChatCircleText`).
  - Accessible name: "Describe your project".
  - Background: `bg-sc-background`, a 1px `sc-border` border and a blue icon. It must look secondary to the filled blue **+**.
- Show it only on `/home` (and `/`) and `/estimate`.
- **Phone (below 768px):** fixed bottom-right, stacked **directly above** the existing + button (`MobileStartButton` in `src/components/projects/StartOptions.tsx`, which sits at `bottom: calc(90px + env(safe-area-inset-bottom))`). Put the bubble at `bottom: calc(158px + env(safe-area-inset-bottom))`, right 16px, so there is a 12px gap.
- **Desktop (768px and up):** the + is hidden there, so place the bubble alone at bottom-right (24px from the right edge and 24px from the bottom).
- Mount it in `MainLayout` next to `MobileStartButton` (`src/components/layout/MainLayout.tsx` line ~214), using the same pathname check approach. On desktop it must render even where `hideBottomNav` hides the phone dock.
  - Check how `hideBottomNav` is used before relying on it.
  - The simplest approach is to mount the bubble outside that condition and gate it only by pathname.

### What tapping the bubble opens

- **Phone:** a shadcn `Drawer` from the bottom.
- **Desktop:** a `Sheet` from the right, or a `Dialog` (use whichever is already installed in `src/components/shadcn/`).
- Title: "Describe your project". Description: "Tell us what you want to build and we'll take you to the right estimate."
- The panel contains the existing conversation flow: `DescribeProject` with `conversation`, which renders `DescribeConversation`.
  - Reuse it as is. Its parsing, follow-up chips and **Build my estimate** hand-off must work exactly as today.
  - Make it fill the panel's width. Keep the input at 16px so iOS doesn't zoom.
  - The panel scrolls inside itself (`overscroll-behavior: contain`), with safe-area bottom padding.
- Opening the panel focuses the text field. A Close button and Esc close it.

### Remove the inline boxes

- `src/app/estimate/page.tsx`: remove `<DescribeProject conversation />` from the hero. Keep the heading, the intro text and the "No account needed" note. Tidy any spacing left behind.
- `src/app/home/page.tsx`: remove the `describeRow` block ("Not sure? Describe your project in a sentence"). Remove its CSS (`describeRow`) if nothing else uses it.
- Remove the `DescribeProject` imports that are no longer used.

### Keep these behaviours

- Anything that opens `/estimate` from elsewhere keeps working. Examples: the "Describe it instead" choice in `StartOptions`, and links from New project.
- If `/estimate` is opened with a query or hash that pre-fills or focuses the describe box, keep that working by opening the bubble's panel automatically. Search for such links first; if there are none, do nothing extra.
- Neither floating button may cover the other. The bubble must not cover the phone dock.

## Rules

- No commits, pushes, packages or network access.
- Do not touch vision files, `src/app/api/**`, `supabase/**` or `.env*`.
- Update `tests/public-pages-smoke.spec.ts` or `tests/projects-authenticated-layout.spec.ts` only where an asserted name or element you changed is checked.
- `npm run lint && npm run typecheck && npm run build && npm run test:unit` must pass.
- Finish with a file-by-file summary.
