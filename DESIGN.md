---
name: ZimEstimate
description: Construction cost estimates and BOQs for building in Zimbabwe.
colors:
  midnight-navy: "#0b192e"
  steel-navy: "#1c3050"
  navy-line: "#3b5272"
  navy-ink: "#f1f5fc"
  navy-muted: "#c1cfe2"
  brass-gold: "#f4c669"
  icon-gold: "#e9c46a"
  gold-ink: "#805509"
  selected-surface: "#fff3cd"
  selected-ink: "#62420a"
  action-blue: "#265cdb"
  action-blue-deep: "#1848b9"
  link-blue: "#1d4ed8"
  info-wash: "#eff6ff"
  focus-blue: "#2e6cf6"
  site-board: "#eaf0f7"
  worksheet: "#fafcff"
  paper-white: "#ffffff"
  icon-tile: "#f1f5f9"
  rule: "#cbd6e4"
  rule-light: "#d7e0eb"
  ink: "#0f172a"
  ink-secondary: "#64748b"
  placeholder: "#65748a"
  success-ink: "#15803d"
  warning-ink: "#92400e"
  danger-ink: "#b91c1c"
typography:
  display:
    fontFamily: "Sora, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2.816rem"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Sora, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Sora, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  eyebrow:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.info-wash}"
    textColor: "{colors.action-blue-deep}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-on-navy-secondary:
    backgroundColor: "{colors.steel-navy}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.lg}"
    padding: "14px 20px"
  input:
    backgroundColor: "{colors.worksheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.worksheet}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip-selected:
    backgroundColor: "{colors.selected-surface}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.full}"
  nav-bar:
    backgroundColor: "{colors.midnight-navy}"
    textColor: "{colors.navy-ink}"
    height: "64px"
---

# Design System: ZimEstimate

## Overview

**Creative North Star: "The Site Office"**

ZimEstimate looks like a well-run site office: a midnight-navy board on the wall, brass labels on it, and clean white worksheets on the desk where the numbers live. The navy frame (top bar, home hero, closing band, footer, phone bottom bar) carries the brand. Inside it, the work happens on pale, flat worksheets with thin rules, one blue for every action, and colour that only appears when something has a real status.

App screens are calm and exact. Cards sit flat on a pale blue-grey board, separated by 1px rules rather than shadows, and the figures, units and status do the talking. Marketing surfaces (the home page) can be bolder in composition, but they stay in the same two worlds: navy with gold, and the pale worksheet. The phone is the main screen, so every decision is checked at about 375px first.

Settled by the owner (16 Nov 2026): the product is light-themed only, with no dark mode, and it uses no line-art illustrations. The home page is flat, quiet navy with no glow or grid lines.

**Key Characteristics:**
- A midnight-navy frame around pale, flat worksheets.
- Brass gold appears only on navy (eyebrows, labels, icon fills); on light surfaces gold becomes a deep ink.
- One action blue per page for buttons, links, arrows and selection.
- Green, amber and red only for real status.
- Sora for headings, Instrument Sans for reading, IBM Plex Mono for eyebrows and figures that need to line up.
- Phone-first, with a fixed navy bottom bar on mobile.

## Colors

A navy-and-brass frame with a single working blue on cool, pale paper.

### Primary
- **Midnight Navy** (frame): the top bar, mobile bottom bar, home hero and closing band, footer, account badge, and the outline of duotone icons. It is the brand's ground, not an accent on light screens.
- **Steel Navy** and **Navy Line**: raised panels and borders inside the navy frame, such as the start cards and the secondary hero button.
- **Navy Ink** and **Navy Muted**: text on navy, for headings and for supporting copy.

### Secondary
- **Brass Gold**: the accent on navy only, used for eyebrow labels, small highlights and the home page's gold details. **Icon Gold** is the softer fill of the duotone icons (at 0.75 opacity) on Icon Tile squares.
- **Gold Ink**: gold rewritten for light surfaces, for labels and featured markers where Brass Gold would fail contrast.
- **Selected Surface** / **Selected Ink**: the warm wash and text of a chosen option (for example, a selected package or tier).

### Tertiary
- **Action Blue**: the one interactive colour for primary buttons, selection rings and focus. **Action Blue Deep** is its hover and the text of secondary buttons. **Link Blue** is used for text links and arrows on light surfaces. **Info Wash** fills secondary buttons and info notes. **Focus Blue** draws the 3px focus outline.

### Neutral
- **Site Board**: the page background behind app screens and light sections.
- **Worksheet**: cards, inputs and panels. **Paper White** is used where a surface sits on Worksheet or needs to read as the top sheet.
- **Icon Tile**: the pale square behind duotone icons.
- **Rule** and **Rule Light**: 1px borders on inputs and cards, and dividers.
- **Ink**: body text and figures. **Ink Secondary**: supporting text and ghost buttons. **Placeholder**: example text in empty fields, kept lighter than labels.
- **Success Ink**, **Warning Ink**, **Danger Ink**: status text on matching pale washes, which only appear for real status (saved, over budget, failed).

### Named Rules
**The One Blue Rule.** A page has one interactive colour, Action Blue (with its deep and link variants). Never colour buttons or categories per type.

**The Gold Lives on Navy Rule.** Brass Gold is only used on Midnight or Steel Navy. On light surfaces, use Gold Ink or Selected Surface instead.

**The Status Is Earned Rule.** Green, amber and red mean saved/OK, needs attention and failed. They never decorate.

**The One Status Scheme Rule.** Since 21 Nov 2026, every status pill in the app uses the same mapping: in progress is the pale info-blue wash (Info Wash fill, Link Blue text), complete/purchased is green, draft, pending and not started are grey (mist fill, Ink Secondary text), over-purchased or failed is red, and amber only for something that needs action. The info-blue wash is a status tint, not an action, so it does not break the One Blue Rule. Waiting to buy is grey, never amber.

## Typography

**Display Font:** Sora (with -apple-system fallback)
**Body Font:** Instrument Sans (with -apple-system fallback)
**Label/Mono Font:** IBM Plex Mono

**Character:** Sora is geometric and confident, set heavy and slightly tight for headings. Instrument Sans is plain and readable for forms and explanations. Plex Mono adds a surveyor's precision to eyebrows and small tabular labels.

### Hierarchy
- **Display**: the home hero headline only ("Know the cost before you lay a brick."), on navy.
- **Headline**: section and card headings on marketing surfaces and start cards.
- **Title**: section headings inside app screens and tools ("How far will your money go?").
- **Body**: explanations, form answers and table cells. Tables and numeric inputs use tabular numerals.
- **Label**: form labels and small UI text. Placeholders are regular weight and lighter.
- **Eyebrow**: uppercase Plex Mono with wide tracking, in Brass Gold on navy (such as "Construction estimates · Zimbabwe").

### Named Rules
**The Figures Line Up Rule.** Money, quantities and units use tabular numerals, so columns of figures align.

## Layout

The layout is phone-first. Pages are designed at about 375px, with a 16px side gutter, then widen into centred columns on desktop. On phones, a fixed Midnight Navy bottom bar (60px plus the safe-area inset) holds the main navigation, and content must clear it. On desktop, the top bar (about 64px) carries it instead.

Spacing follows a 4px base (4, 8, 12, 16, 20, 24, 32, 48, 64). Cards use 22–28px inner padding, forms stack with 4–8px between label and field, and touch targets are at least 44px tall. Hover styles apply only on devices with a fine pointer, and inputs use 16px text on touch devices so the phone doesn't zoom.

## Elevation & Depth

The system is flat. Depth comes from tone (navy frame, Site Board page, Worksheet card) and from 1px rules, not from shadows. The card shadow is a faint 2px lift that is almost invisible. Stronger shadows are reserved for the primary hero button on navy and for overlays such as sheets, dialogs and toasts.

### Named Rules
**The Flat Worksheet Rule.** Cards sit flat at rest, separated by Rule Light borders. A hover or selection changes the border to Action Blue; it doesn't add a shadow.

## Shapes

Corners are gently rounded: 8px for buttons and inputs, 12px for cards, start cards and tabs, and 16px for larger panels and sheets. Pills (fully round) are used only for chips and badges. Borders are 1px. Icons are Phosphor duotone, with a navy outline and Icon Gold fill on Icon Tile squares. Duotone icons are used on start and choice cards, never in data tables.

## Components

### Buttons
Confident but compact, with weight 600–700 and no decoration.
- **Shape:** gently rounded (8px), 12px on the home page's navy hero.
- **Primary:** Action Blue fill with white text, padding 12px 24px (8px 16px small, 16px 32px large).
- **Hover / Focus:** hover deepens to Action Blue Deep with a soft blue shadow (fine pointers only). Pressing nudges it down 1px. Focus is a 3px Focus Blue outline, offset 2px. Reduced motion removes the nudge.
- **Secondary:** Info Wash fill, faint blue border, Action Blue Deep text. On hover the border turns Action Blue.
- **Ghost:** transparent, Ink Secondary text. On hover it gets a Rule Light fill.
- **Danger:** Danger Ink fill, only for destructive confirmation.
- **On navy:** the primary stays Action Blue, and the secondary is Steel Navy with a Navy Line border and Navy Ink text.

### Chips
- **Style:** pills for filters, choices and badges.
- **State:** selected chips use Selected Surface with Selected Ink. Status badges use the matching status wash and ink.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Worksheet on the Site Board.
- **Shadow Strategy:** flat; see Elevation & Depth.
- **Border:** 1px Rule Light. Clickable cards turn Action Blue on hover, and selected cards get an inset Action Blue ring.
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** Worksheet fill, 1px Rule border, 8px corners, padding 12px 16px, with 15px text (16px on touch devices).
- **Focus:** the border turns Action Blue with a soft 3px blue halo.
- **Error / Disabled:** errors get a red border and a red halo on focus. Disabled controls drop to 50% opacity.

### Navigation
- **Desktop:** a Midnight Navy top bar (about 64px) with Navy Ink links and an account button in Steel Navy. The account badge shows initials on navy.
- **Mobile:** a fixed Midnight Navy bottom bar respecting the safe area, plus a "+" sheet for starting things.

### Start card (signature)
These are the home page's numbered entry points ("01 Guided build", "02 Floor plan"…), each a 12px card with a Plex Mono number, a Sora heading and a duotone icon. The featured card is Steel Navy on the navy band, and the others are Worksheet with a Rule border.

## Do's and Don'ts

### Do:
- **Do** keep app screens light: Site Board page, Worksheet cards, 1px rules.
- **Do** use Action Blue for every interactive element on a page, and only Action Blue.
- **Do** put Brass Gold on navy only, and switch to Gold Ink on light surfaces.
- **Do** use tabular numerals for money and quantities.
- **Do** design at about 375px first, with 44px touch targets, and clear the mobile bottom bar.
- **Do** use Phosphor duotone icons (navy outline, gold fill, pale tile) on choice and start cards.

### Don't:
- **Don't** add a dark theme. The owner rejected it on 16 Nov 2026.
- **Don't** add line-art illustrations, including on empty states, errors and contractor pages.
- **Don't** add glows, gradients or grid lines to the navy home sections; they stay flat and quiet.
- **Don't** give categories or item types their own colours.
- **Don't** use green, amber or red for decoration.
- **Don't** lift cards with shadows at rest.
- **Don't** put duotone icons in data tables.
