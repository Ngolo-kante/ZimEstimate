# System light and dark mode (follow the phone's setting)

Status: approved by the owner 22 Nov 2026 (follow the system setting, no in-app switch, navy sheets in both modes). All four phases shipped 23 Nov 2026. Left light on purpose: floor-plan canvases, chart series colours, the Google sign-in button and PDFs.
This reverses the 16 Nov decision "no dark theme": the owner now wants the app to follow the
phone's (or computer's) light/dark setting, as Android and iOS apps do.

## What the platforms say

**Apple (Human Interface Guidelines, Dark Mode)**
- People choose Dark Mode system-wide and expect every app to respect it. Don't offer an
  app-only appearance setting; people may think the app is broken when it ignores the system.
- Look good in both modes, including "Auto" switching while the app is open.
- Dark palette = dimmer backgrounds, brighter foregrounds; not a straight inversion.
- Depth in dark: a *base* background for the page and a brighter *elevated* background for
  anything on top (sheets, popovers, menus).
- Contrast at least 4.5:1; aim for 7:1 on small custom-coloured text. Test with Increase
  Contrast and Reduce Transparency.
- Soften white: images with white backgrounds glow in dark; icons may need a light outline or
  a separate dark version.

**Android (developer docs, Dark theme; Material dark theme)**
- Dark theme is a system setting (Android 10+). Default to "System default"; an app may offer
  Light / Dark / System as an override, with System as the recommended default.
- Don't hardcode colours or assume a light background; use theme colours for surfaces and text.
- Material dark surfaces start around #121212 (not pure black) and get *lighter* as they rise
  (sheets, dialogs, menus), instead of relying on shadows.
- Use lighter, less saturated tones of brand colours in dark (the 200 tone of a brand colour
  passes 4.5:1 on every dark surface); avoid fully saturated colours on dark backgrounds.
- Avoid pure white text on dark; use a slightly off-white for main text and dimmer tones for
  secondary text.

## Recommendation for ZimEstimate

1. **Follow the system setting** with CSS `prefers-color-scheme`. Light stays exactly as it is
   today. No in-app switch at first (Apple's advice); an optional "Appearance: System / Light /
   Dark" row in Settings can come later if people ask (Android allows it).
2. **One set of theme colours**, defined in `src/styles/design-tokens.css` and
   `src/app/globals.css`, with a dark block. Everything uses the tokens, so pop-ups, cards and
   pages switch together and stay consistent.
3. **Brand in dark mode** (navy family, not grey #121212, so it still looks like ZimEstimate):
   - page (base): `#0b192e` (today's navy frame)
   - cards (raised): `#13243d`
   - sheets, menus, dialogs (elevated): `#1c3050`
   - fields: `#0f1f36` with a `#2a4063` border
   - main text `#f1f5fc` (not pure white), secondary `#c1cfe2`, faint `#94a3b8`
   - lines `#2a4063`
   - action blue: buttons keep `#265cdb` with white text; links and selection use `#7099f7`
   - gold `#f4c669` unchanged; status: green `#4ade80`, amber `#fbbf24`, red `#f87171` on
     tinted fills
   - icon tiles: `--icon-tile-bg #1c3050`, border `#2a4063`, ink `#c1cfe2`, gold fill unchanged
4. **Pop-ups are navy in both modes** (owner, 22 Nov): the "+" sheet, More, the project ⋮
   menu, Share, Invite, Log purchase, filters and the marketplace detail sheet are navy
   sheets with white titles and light cards/rows inside. In dark mode the light cards inside
   them become the dark "raised" surface. Use a `--color-sheet` token (navy in both modes)
   and `--color-sheet-card` (light in light mode, raised navy in dark mode).
5. **Browser and app chrome**: `<meta name="color-scheme" content="light dark">` and two
   `theme-color` metas (light/dark media); check the TWA status bar and splash in both.

## Phases (each a separate Codex run, reviewed by Claude in the browser before commit)

1. **Tokens and shell**: dark token block; `color-scheme`; theme-color; MainLayout, TopNavbar,
   bottom nav, footer, shared `src/components/ui` (Button, Card, Input, Switch, Toast,
   ConfirmDialog), shadcn drawer/dialog/dropdown, `.icon-tile`. Done when: home, projects
   list, settings, quick projects hub render correctly in both modes at 375px and 1280px.
2. **Estimators**: quick budget, home budget check, quick project wizards, budget explorers.
3. **Project workspace**: overview, BOQ, budget, buying, usage, compliance, documents,
   project settings, share/invite/purchase sheets.
4. **Builder and the rest**: /boq/new wizard, market insights, marketplace, contractors,
   support, auth pages, PDF export preview (PDFs stay light).

Scale: about 3,150 hard-coded hex/rgb colours and 1,590 fixed Tailwind colour classes across
184 files. Most should become tokens; a few (logo, charts' fixed series, PDF output) stay fixed.

## Rules for every phase
- Change colours only: no layout, copy or behaviour changes.
- Prefer tokens over `dark:` utility classes; never hardcode a colour that only works in one mode.
- Light mode must look pixel-identical to today (Claude compares before/after screenshots).
- Contrast: 4.5:1 for text in both modes.
- Don't commit; Claude reviews, screenshots both modes, and the owner approves.
- Files forbidden: `supabase/`, `src/lib/calculations/`, pricing data, PDF generation.

## Done when (whole project)
Every page in the route list renders readably in light and dark at 375px and 1280px, with no
white flashes, no white-on-white or dark-on-dark text, sheets following the mode, the status
bar colour matching, and lint, typecheck, unit tests and build passing.
