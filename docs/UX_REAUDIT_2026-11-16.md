# UX re-audit, 16 November 2026

Follow-up to `docs/UX_AUDIT_2026-11-15.md`, after the eleven batches in `docs/tasks/ux-plan.md` (live in production at `133a80f`).

## Summary

**Rating: Good** (was "Critical issues"). The four critical findings are fixed. All twelve high findings are fixed or mostly fixed, and nine of the eleven medium ones are fixed. On a phone, the project workspace now reads as one app: compact rows, one set of controls and badges, sheets you can swipe away, readable text and tappable controls. What is left is mostly outside the workspace: Settings, two public pages, and a handful of 1–4px tap-target and contrast misses.

## How this was checked

The same method as the 15 November audit, on the code that is live:

- **Screens:** 74 screen states at 390px and 1440px: public pages, the projects list, every workspace view, and a worst-case project (long names, a 1,250,000 quantity, a $357,487.24 overrun, unpriced lines, a 100-character file name), with a local stand-in for the database.
- **Measured on each screen:** contrast from real computed colours, text under 12px, tap targets under 28px and under 44px, inputs that make iOS zoom, unnamed controls, sideways overflow, `h1` count and page errors.
- **Tried by hand in a browser:** swiping a sheet closed with touch events, the purchase form, card menus, tooltips, and undoing a BOQ delete.
- **Code counts:** patterns compared between `fbaecad` (before batch 1) and `133a80f`.

**Limits:**
- No real phone was used. Touch was simulated in Chromium, so swipe feel, the keyboard and safe areas should still be checked on a device.
- The contrast checker misreads gradient backgrounds. Four of the five "failures" on the quick estimate are white text on blue or navy buttons, and are not real.

## Before and after

| Measure (74 screens) | 15 Nov | 16 Nov |
| --- | --- | --- |
| Screens that scroll sideways | 1 | 0 |
| Kinds of text under 12px | 373 | 52 |
| Kinds of text colour pairs under 4.5:1 | 398 | 60 |
| Tap targets under 28px | 278 | 29 |
| Tap targets under 44px (phone) | 390 | 176 |
| Inputs that make iOS zoom | 56 | 0 |
| Controls with no accessible name | 34 | 0 |
| Pages without exactly one `h1` | 4 | 0 |
| Page errors | 0 | 0 |

| Phone page height (sample project) | 15 Nov | 16 Nov |
| --- | --- | --- |
| Buying | 6,354px | 2,817px |
| Usage | 6,923px | 3,438px |
| Overview | 5,222px | 2,533px |
| BOQ | 3,478px | 2,751px |
| Buying, worst case | 3,321px | 1,972px |
| Usage, worst case | 3,825px | 2,292px |

| Code pattern (`src/`, excluding home and vision) | Before | Now |
| --- | --- | --- |
| `transition: all` | 115 | 4 |
| `100vh` | 35 | 0 (38 use `dvh`/`svh`) |
| `prefers-reduced-motion` blocks | 22 | 64 |
| `toFixed` in project screens | 56 | 26 (all percentages or input values) |
| Zoom disabled in the viewport | yes | no |
| `viewport-fit=cover` | no | yes |
| shadcn components | 0 | 19 |

## The 15 November findings

| ID | Finding | Now |
| --- | --- | --- |
| C1 | Zoom disabled | **Fixed** |
| C2 | Faint text | **Mostly fixed**: 398 → 60 kinds; the rest are listed below |
| C3 | Long file name breaks Documents | **Fixed**: middle truncation keeps the extension |
| C4 | Focus ring nearly invisible | **Fixed**: 2px accent outline |
| H1 | Small tap targets | **Mostly fixed**: 278 → 29 under 28px |
| H2 | Inputs zoom the page | **Fixed** |
| H3 | No press feedback, sticky hover | **Fixed** |
| H4 | BOQ table below the fold on desktop | **Fixed**: table first, six stages in one row |
| H5 | Long phone lists | **Fixed**: compact rows in Buying, Usage and BOQ |
| H6 | Overview repeats itself | **Mostly fixed**: estimate once, next steps second, one primary action. 2,533px against a 2,200px target |
| H7 | Delete without undo | **Fixed**: Undo sends nothing; letting it time out sends one delete (tried in a browser) |
| H8 | Numbers written three ways | **Fixed**: one quantity and one money format; prices under $1 keep 4 decimals |
| H9 | Projects list starts 880px down | **Fixed**: first card about 250px down |
| H10 | Budget Estimator results at the bottom | **Fixed**: result box under the budget field |
| H11 | Slow fade-in | **Fixed** on signed-in screens |
| H12 | Text under 11px | **Fixed** in the workspace; open on two public pages and Settings |
| M1 | Labor / Labour | **Fixed** |
| M2 | Different names for one place | **Fixed** in the workspace; open in Settings ("RFQs", Title Case) |
| M3 | Controls differ by view | **Fixed** in the workspace (shadcn Field, Input, NativeSelect, Tabs, Badge); open on public pages and Settings |
| M4 | Colours mean different things | **Fixed**: done, in progress, attention and problem |
| M5 | Six stages in five columns | **Fixed** |
| M6 | BOQ opening jumps the page | **Fixed** in code: the stage strip scrolls sideways only |
| M7 | Worst-case text clipped | **Fixed** |
| M8 | Two purchased counts | **Fixed**: one quantity-based rule |
| M9 | Phone basics | **Fixed** |
| M10 | Unnamed controls | **Fixed**: also the two drawer titles found in review |
| M11 | Headings | **Fixed** |

## What is left

### High

| What | Evidence | Fix |
| --- | --- | --- |
| **Settings was never in scope and shows it.** | `/settings` at 390px: inputs 24px tall, "Change email" 19px. "No delivery activity yet." is #94a3b8 on white (2.56:1). The "Verified" badge is 9.9px. Everything is in Title Case ("Personal Information", "Save Changes", "Danger Zone"). "RFQs, quotes, and updates". Three separate save buttons, and an "Update Currency" button when USD is the only option. | Give Settings the batch 1, 2 and 9 treatment: 44px inputs, sentence case, "quote requests", one save per section. Drop the currency control while USD is the only currency. |
| **Two public pages missed by batch 7.** | `/projects/quick`: ranks "01" #d8a600 on white (2.24:1), category labels 10.9px at 3.95:1. `/boq/new`: locked step names #9aa5b4 (2.2–2.4:1), "Step 1 of 7" 11.2px at 3.65:1. | Text tokens (#475569 or #64748b) and a 12px floor. Locked steps can stay muted at 4.5:1. |

### Medium

| What | Evidence | Fix |
| --- | --- | --- |
| Tap targets shared by every workspace screen on a phone | "My projects" breadcrumb 70×19; footer "Terms" 40×44 and "TikTok" 42×44; header logo 143×32 | Pad the breadcrumb link to 44px tall; give footer links a 44px minimum width |
| Colour pairs just under 4.5:1 | "Configure in settings" #2e6cf6 on #f8fafc (4.37); Buying desktop spent figure #64748b on #f5f7fb (4.44); Settings plan badge (4.34) | #1d4ed8 for link text on tinted surfaces; #475569 for muted text on #f5f7fb |
| Budget amounts in a monospaced font | `BudgetPlanner.tsx:539` `font-family: var(--font-mono)` (from the earlier Budget redesign, `d735233`); every other view uses Geist Sans with tabular figures | Drop the mono font and keep `tabular-nums` |
| Project cards waste space on a phone | The "⋮" menu floats between the badge and the date, leaving about 80px empty per card | Put the menu in the card's top-right corner, level with the name |
| Overview still about 2,500px on a phone | Next steps lists every pending item with its own button | Show three, then "View all 12" (the link exists) |
| Quick estimate controls | "Update" and "Tell us" links are 20px tall; four action buttons are 40px | 44px minimum |
| The stage card outline marks Foundation (complete), not Walls (in progress) | Overview stage strip | Outline the stage in progress, or label what the outline means |

### Low

- `transition: all` is left in 4 places in `src/app/projects/dashboard/page.tsx` and `src/app/projects/new/page.tsx`. Batch 6's scope missed those pages.
- A line that is half bought says "0/4 items" next to "In progress". Consider "1 partly bought".
- The home page still has 7–10 kinds of text under 12px. It was left out of every batch because another session owns it.
- My checker can't reach the BOQ "Detailed" tab on a phone, where batch 4's compact rows replace it. That is expected.

## What works

- **One system across the workspace.** Buying, Usage and BOQ share the compact row, `Collapsible`, `Badge`, status colours and number formats. The sidebar, phone dock and view titles use the same names.
- **Motion with a reason.** Press feedback on every button; sheets follow the finger and close on a flick; dialogs and menus scale from their trigger in 150–200ms; nothing animates on keyboard actions; every animation has a reduced-motion version. Under reduced motion, a drag still follows the finger.
- **Forgiving and honest.** Undo on BOQ delete, "No price yet" instead of $0.00, and full worst-case names without clipping.
- **Accessible floor.** No zoom block, no input zoom, every control named, one `h1` per page, and a visible focus ring.

## Suggested next batch

**Batch 12: Settings and the last public pages.** The two High items, plus the Medium tap-target and contrast fixes, and the mono font in Budget. All are small and need no new packages. Then check on a real phone: swipe feel, the keyboard over the purchase form, and safe areas in the home-screen app.
