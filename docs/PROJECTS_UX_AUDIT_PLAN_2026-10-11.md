# Projects UX audit and improvement plan

Status: authenticated browser walkthrough completed on the available full build and saved septic estimate. The remaining checks require controlled test data, failure simulation, or real devices.

Audit started 11 October and continued 12 October 2026 (America/New_York). Local application: http://localhost:3001.

## What has actually been checked

- Reviewed the project list, Insights, full-project shell and eight workspace views, and the saved quick-estimate composition.
- Opened the real sign-in page and measured its responsive layout at 320×720, 390×844, 768×1024, 1024×768, and 1440×900.
- Confirmed a sign-in resize issue: after the Google button renders at desktop width, narrowing the viewport leaves the document 392px wide at both 390px and 320px. A fresh load at 320px fits correctly (320px document, 208px Google button). This is a resize/orientation regression, not a failure on every mobile visit.
- Signed into the user's existing account and walked My Work, Insights, all eight full-project views, all five BOQ stages, all five Compliance stages, the Procurement Items/Quotes/Purchases sections, the Usage Log/Materials/Ledger sections, and the saved septic estimate.
- Used responsive browser viewports at 390×844 (phone), 834×1112 (tablet portrait), and 1440×900 (desktop) across the workspace. Tested sign-in at the additional widths above. This was browser emulation, not a real-device test.
- Opened a BOQ add form, an RFQ draft, a compliance reminder draft, a purchase form, the quick-estimate budget editor, and its share sheet. Checked required-field errors for a purchase. Canceled the drafts and did not send requests, upload files, change compliance, or save account data.
- No application code or account data changed. This document records observed behavior and a plan, not an implementation or a claim that every workflow passes.

The older `PROJECT_EXPERIENCE_OVERHAUL.md` is historical context. Its old pending items must not be treated as current findings: for example, a procurement Quotes interface now exists.

## Results from the signed-in walkthrough

The account contained one 99-item full build and one saved septic estimate. The observed full build had no purchases, usage records, RFQs, or documents, so populated history and preview flows could not be checked without creating fixtures.

| Priority | Observed behavior | User impact and recommended change |
| --- | --- | --- |
| P1 | On Budget, selecting **Custom**, entering $15,000, then opening **Set delivery reminders** takes the user to Settings. Returning to Budget restores **Remaining $32,914.79**, losing the custom amount. | A savings plan appears usable but is not durable. Save or clearly label drafts, preserve state across sections, and carry the chosen target into reminder setup. |
| P1 | A one-day target shows **Daily $32,914.79**, **Weekly $230,403.53 (Recommended)**, and **Monthly $987,443.70**. The same pattern appears for a custom $15,000 target. | The recommended amount exceeds the total funding need. Show the remaining period's actual contribution and suppress inapplicable weekly/monthly recommendations when the deadline is shorter than that period. |
| P1 | At 390px, Usage causes document width **426px** against **390px** viewport and **327px** project content area. At 320px, the document is still **426px** wide while the content area is only **257px**. The **Usage Ledger** tab reaches x=427px. | The third Usage destination is cut off on a phone. Make the subnavigation fit, wrap, or scroll in a clearly signaled region without expanding the whole document. |
| P1 | Overview showed **Checklist Tasks 0/0, Certificates 0/3**, while Compliance showed **Admin tasks 0/16, Certificates 0/6**, for the same build. | The summary appears to contradict the detailed page. Reconcile the data definitions or relabel the subset being summarized; link the summary to the exact detail. |
| P1 | Switching to Compliance keeps the URL at `/projects/<id>`; refreshing returns to Overview. | Users lose their place and cannot share a link to a section. Put view and stage in stable, usable URLs and restore them on refresh and Back. |
| P1 | The mobile **More tools** element claims `aria-modal="true"`, but focus stays on the More button behind it when opened. The background remains in the accessibility tree. | Keyboard and screen-reader users can move outside the apparent modal. Use a native dialog or an accessible sheet with focus entry, containment, and restoration. |
| P1 | On the saved septic estimate at phone width, **Edit inputs**, **Share**, and **PDF** become icon-only buttons with no accessible name. The same buttons have names on desktop. | People using assistive technology cannot identify the actions on mobile. Keep text labels or add stable accessible names. |
| P2 | At 834px tablet portrait, the full sidebar leaves roughly **504px** of project content. Budget renders four metrics in one row, causing `$32,914.79` to break mid-number; the target date's icon/text is cramped. The planned and remaining figures also wrap to two lines at 320px. | Use the tablet and narrow-phone space deliberately: compact the sidebar or stack metrics sooner based on content width. Keep monetary figures intact with tabular digits. |
| P2 | The Usage material selector lists 99 BOQ lines but repeats indistinguishable names such as **DPC Roll** and **Standard Cement 32.5N**. | Users may record consumption against the wrong line. Include stage, item context, unit, and available quantity in option labels, with search for long lists. |
| P2 | The saved septic BOQ exposes the quantity **7.199999999999999** in an editable field. | Round display values to a sensible precision while retaining calculation accuracy. `QuickBOQTable.tsx:328` binds the raw quantity. |
| P2 | The quick-estimate BOQ table is about **570px** wide inside a **293px** phone container, requiring horizontal scrolling. | Use a compact phone row/card with description, quantity, unit price, and line total together, or a clearly guided horizontal comparison surface. |
| P2 | Document filtering to **Receipts** still says **No documents yet**. The account has no files, so the message is technically true but gives no route back to all files. | Distinguish an empty project from a filter with zero matches and offer Clear filter. |
| P2 | The full-build card and Insights expose raw soil code **`not_sure`**. | Convert stored codes into plain user-facing labels such as “Soil type unknown.” |

The following paths worked in this account: My Work search and clear-filter recovery; estimate-type filtering; opening a full project; all five BOQ stages with expected item counts (17, 13, 11, 48, 10); opening stage schedule; Procurement Quotes and Purchases empty states; an RFQ item-selection draft and supplier-preview control; Usage tabs; all five Compliance stage disclosures; document category filter; Settings sections; Insights totals and project link; quick-estimate budget editor and share sheet. The purchase form rejected missing supplier and quantity before submission. These checks prove navigation and initial interactions, not successful saved transactions.

## Color consistency and visual usability

The product has a coherent base palette in `src/styles/design-tokens.css` and `src/app/globals.css`: navy for structure, electric blue for actions, green for success, amber for attention, red for danger, and light neutral surfaces. Budget and Compliance largely use these semantic variables. The audit's initial design direction was too broad, so this section makes the visual work concrete.

| Priority | Evidence | Improvement |
| --- | --- | --- |
| P1 | Small inactive labels are faint: the mobile project dock uses `#748196` on white (calculated contrast about **3.95:1**), and desktop sidebar text uses `#7689a5` on white (about **3.56:1**). Their current sizes are around 11px or smaller. | Use a darker secondary-text role for actionable labels and keep muted tones for truly disabled or decorative content. Do not reduce font size to compensate for five destinations; improve spacing and labels instead. |
| P1 | The sidebar project switcher and navigation remove the default outline, replacing it with a 25%-opacity blue glow. Its composited edge is about **1.27:1** against white. See `SidebarSpine.tsx:252` and `:430`. | Use the solid focus-ring token or another clearly visible outline on both white and tinted backgrounds. Test keyboard focus across the switcher, every section, cards, forms, and dialogs. |
| P2 | The small Draft badge uses `#64748B` on a translucent gray surface; its estimated contrast is about **3.87:1** on white underneath. The amber Geotech Pending chip uses a stronger dark foreground and is easier to read. | Define one badge recipe per meaning with tested foreground/background pairs. Preserve labels and icons so status never depends on hue alone. |
| P2 | The project sidebar contains **25 distinct literal six-digit colors** in 26 uses, while the mobile dock has 12. Usage repeats hard-coded `#3b82f6` and `#2563eb` even though the brand accent is `#2e6cf6`. Budget uses the existing color variables instead. | Replace repeated literals with semantic roles in shared navigation, status, and form primitives. Keep intentional decorative variation, but make the same action and state look the same across pages and devices. |
| P2 | Overview's orange stage emphasis, Procurement's amber pending icon, Compliance's red Required text, and Budget's green On track badge each communicate different things, but the screens do not share a clear status legend. | Define status meaning first: blue = action/selection; neutral = draft or planned; amber = needs attention; red = blocking or over budget; green = completed/on track. Pending should be amber only when it calls for action. Apply text labels consistently alongside color. |

Use one predictable hierarchy on every project page: project and page title; the most important next action; a small group of trusted metrics; then the detailed records. On a phone, Overview should lead with the next action and compact progress, while stage cards, photos, and secondary statistics can be disclosed below. Budget should show budget limit, BOQ estimate, spend, and contribution plan as distinct concepts. Compliance should lead with the next approval and direct access to its evidence. These changes reduce scanning and make color support the meaning already carried by words and layout.

For visual acceptance, compare the same statuses and controls side by side on My Work, Overview, Budget, BOQ, Procurement, Usage, Compliance, and Insights at phone/tablet/desktop widths. Check normal, selected, hover, focus, disabled, loading, success, warning, and error states. Measure text and control contrast against the actual rendered surface, including translucent backgrounds; do not judge from palette swatches alone.

## Findings from the current code

These are code findings that complement the browser results. The observed issues above should guide implementation priority.

| Priority | Finding and user impact | Evidence | Proposed correction |
| --- | --- | --- | --- |
| P1 | Budget custom amount and selected mode disappear on leaving Budget. Opening Settings for reminders unmounts the planner, losing the custom target. Confirmed in the browser. | `src/components/ui/BudgetPlanner.tsx:42` stores mode and amount locally; `src/app/projects/[id]/page.tsx:1754` conditionally mounts the component. | Persist the saved plan, preserve drafts between sections, and pass the chosen target into reminder setup. Show Saving, Saved, and Retry states. |
| P1 | Different screens can describe different amounts as the project budget. Overview can use the explicit budget target; Budget always uses the BOQ estimate. A custom target therefore may not govern the “On track” badge. | `src/app/projects/[id]/page.tsx:1410` versus `:1757`. | Separate “Budget limit,” “BOQ estimate,” “Actual spend,” and “Amount still to fund.” Use one shared calculation across Overview, Budget, and Insights. Rename spending percentage so it is not confused with construction completion. |
| P1 | Project sections have no URL state. Reload returning to Overview was confirmed in the browser. | `src/app/projects/[id]/page.tsx:207`; section navigation calls `setActiveView`. | Give views and selected stages stable URLs, with history, refresh restoration, predictable focus, and scroll handling. |
| P1 | Users with only quick estimates cannot access search or filters, although quick-estimate filtering exists. Sorting is applied to full builds, not quick estimates. | `src/app/projects/page.tsx:744` gates controls on `projects.length > 0`; `filteredQuick` at `:201` has no sorting. | Render controls for all saved work; use a common sort across both types or make the scope explicit. Keep “Full build” and estimate-type labels visible. |
| P1 | An Insights request failure can look like an empty account. | `src/app/projects/dashboard/page.tsx:60` ignores the returned error; `:114` treats null analytics as first-use empty state. | Separate loading, failure, empty account, and populated states. Retain usable content on refresh failure and offer Retry. |
| P1 | The mobile More sheet declares a modal dialog but does not implement focus entry, focus trapping, background inertness, or focus restoration. The focus-entry defect was confirmed in the browser. | `src/components/projects/ProjectViewTabs.tsx:28` and the conditional `section role="dialog"`. | Use the existing native-dialog approach used by Documents and Procurement, or a shared accessible sheet primitive. Test keyboard and screen-reader operation. |
| P2 | Tablet layout switches abruptly above 768px: a 252px sidebar appears and the measured project content width is about 504px at an 834px viewport. Budget figures wrap mid-number. | `SidebarSpine.tsx:523`; project page `:2300`; `BudgetPlanner.tsx:862`. | Add a deliberate tablet layout with a compact, expandable rail; base dense content layouts on available container width. Verify 768, 769, 834, 900, and 1024px. |
| P2 | Navigation names differ by device: Configurations/Settings and Procurement/Buy. Project-switcher entries are clickable divs, and desktop navigation lacks a current-page attribute. | `SidebarSpine.tsx:49`, `:142`, `:177`; `ProjectViewTabs.tsx:9`. | Use consistent labels, native links/buttons for switcher entries, an accessible navigation name, and `aria-current`. Provide a plainly named route back to all projects. |
| P2 | Document-load failure can settle into “No documents yet”; an empty category filter also uses this message even when other documents exist. | `src/components/projects/DocumentsTab.tsx:49` and `:164`. | Distinguish unavailable, no files, and no filter matches; show Retry or Clear filter as appropriate. |
| P2 | Budget date immediately changes the local calculation, but failed persistence does not restore the previous value or attach an error to the field. | `BudgetPlanner.tsx:107`; project page `:804` and `:910`. | Return save status to the planner, retain a retryable draft, and make unsaved state explicit. |
| P2 | Some high-frequency controls are undersized for comfortable touch: compliance status controls use 36px height, rising to 40px only below 440px. Budget fields use 15px text. | `src/styles/compliance-tracker.css:416`, `:752`; `BudgetPlanner.tsx:629`. | Adopt a 44px touch-target design goal and 16px mobile form text. Validate actual sizes and focus/zoom behavior on touch devices. |
| P2 | Sign-in Google button overflows after narrowing the browser. | Browser-observed dimensions above; `GoogleSignInButton.tsx:111` takes a one-time container width. | Recalculate safely on container resize without rebuilding the Google control on every keystroke. Verify both fresh loads and orientation changes. |

## Design direction

Keep the existing navy, blue, and light neutral identity. Make Projects feel like a practical construction workspace: clear amounts, plain labels, visible next actions, and compact but readable records. Prioritize a consistent hierarchy over new decoration.

Every section should share a project header, current section title, one primary action, and the same loading/error/save patterns. Keep detailed metrics below the immediate task where possible. Explain abbreviations such as BOQ at first use. Use text and icons as well as color for status.

### Responsive behavior

| Device | Workspace navigation | Content and forms |
| --- | --- | --- |
| Mobile, 320–767px | Keep Overview, BOQ, Budget, Buy, More; include a clear project identity and back route. More must identify its current destination. | One main column; item cards with quantity, unit, amount, and action together; primary form actions visible above the keyboard/dock; 12–16px outer gutters; expand secondary details on demand. |
| Tablet, 768–1023px | Compact labelled rail or collapsible navigation, with all tools discoverable. Test portrait and landscape independently. | One or two columns according to container space; avoid shrinking desktop tables until unreadable. Use a drawer for detail only when list and drawer each remain usable. |
| Desktop, 1024px and above | Full sidebar when space permits; compact option retained. Stable URLs for every destination. | Tables for comparison, restrained summary rows, side-by-side Budget inputs/results only with enough usable width. |

The exact navigation breakpoint should be confirmed from rendered content; the important requirement is usable content width, including at 769px.

## Page-by-page plan and remaining checks

| Surface | Improvement objective | Required interaction checks |
| --- | --- | --- |
| My Projects / My Work | Put finding and resuming work first. Unified search/sort, clear full-build versus estimate type, updated date, stage, and one next action per card. | Empty account; only estimates; only full builds; mixed account; long names; search/no matches; each filter/sort; card menu; return from project; pagination/large lists if applicable. |
| Insights | Summarize money and exceptions with a clear calculation basis and direct links to affected projects. | Empty versus failed load; totals reconcile with source projects; archived-work policy; currency switching; narrow charts; project links. |
| Overview | Answer “How are we doing?” and “What should I do next?” with one action queue and a small set of coherent metrics. | Stage navigation; procurement/compliance links; budget versus estimate; zero and populated projects; long names; back and project switcher. |
| Budget Planner | Separate the budget limit from savings planning. Keep target, deadline, and weekly contribution together. Preserve the plan across navigation. | Remaining/custom target; zero/negative/large input; missing/today/past/future date; over-budget state; currency labeling; change section and return; reload; date-save failure; reminder handoff without sending messages. |
| BOQ, every enabled stage | Keep stage, quantity, unit price, and line total readable. Make editing and “record purchase” easy to discover. | Switch all five stages; disabled stage; stage schedule/tasks; add/edit form validation; quantity/price recalculation; long materials; hidden columns; search; empty stage; export; approval-warning link; no accidental stage change on scroll. |
| Procurement: Items, Quotes, History | Make the journey from needed material to quote to purchase explicit. Keep item status, remaining quantity, and next action together. | Search/status/group filters; expand purchase records; record-purchase form validation; partial purchase; totals refresh; receipts; export; empty/error states; quote-request draft and cancellation. Do not send supplier requests during an ordinary UI audit. |
| Usage: Log, Materials, Ledger | Optimize for quick site entry with purchased, used, and remaining quantities adjacent to units. | Enabled/disabled feature; select material; zero/negative/over-stock quantity; date and notes; daily/weekly ledger; empty history; form preservation after failure; stock update after a controlled test save. |
| Compliance: every enabled stage | Put the next blocking approval first. Show status, what to do, and the associated evidence without burying the action. Keep description details available on demand. | Expand/collapse every stage; next-action jump; status controls; task validation; reminder draft/cancellation; no applicable stages; long labels; keyboard operation. Review workflow usability only; this audit does not validate legal requirements. |
| Documents | Lead with a compact Upload action and useful file browsing; support mobile photos and legible previews. | Category/no-match states; PDF and image preview; close/escape/focus return; long filename; download; invalid type/size; upload retry with a disposable fixture once authorized by test scope. |
| Settings / Configurations | Use one name: Settings. Group General, Stages, and Notifications, with obvious save behavior and clear consequences. | Field labels/validation; stage controls; dirty state; cancellation; keyboard access; save failure; changes visible in the workspace. Avoid altering real reminder delivery or sharing access as incidental testing. |
| Saved quick estimate | Preserve the simpler estimate experience while aligning Budget, Compliance, and material terminology with full projects. Do not impose irrelevant construction stages. | Budget plan/funds saved; compliance statuses; BOQ and labour controls; edit-input handoff; PDF; share-sheet opening/cancellation; quote-request draft without sending. |
| Project access / shared site view | Make available actions match the person's role, with clear project context and recovery. | Owner and invited role using separately authorized accounts; inaccessible/deleted project; expired session; browser refresh. Do not infer owner-only testing covers invitees. |

## Implementation sequence

1. **Fix the observed P1 issues.** Make savings targets durable; correct short-deadline pacing; resolve Usage overflow; reconcile Overview/Compliance counts; give sections stable URLs; fix mobile sheet focus and quick-estimate action names.
2. **Clarify money and navigation.** Use shared budget definitions, correct empty/error states, and unified saved-work search/sort. Decide which amount is the BOQ estimate versus the user's spending limit in every view.
3. **Refine tablet and phone layouts and visual language.** Compact the tablet sidebar, preserve intact figures, improve long material selection and quick-estimate BOQ rows, and standardize labels, touch targets, safe-area spacing, status colors, and focus treatment. Address faint actionable text as part of this pass.
4. **Exercise saved workflows with controlled fixtures.** Create a disposable project or seed isolated test data to verify purchase, usage, compliance status, upload/preview, budget persistence, and quote outcomes, including failure/retry behavior. Use a second role-specific account for shared-project access.
5. **Run regression checks and compare before/after.** Add focused coverage for the observed defects and important persistence behavior. Use seeded, explicit fixtures rather than whatever project happens to be first in an account.

## Acceptance criteria

- Every project view and nested section can be reached and returned from on mobile, tablet, and desktop; refresh and Back preserve an intelligible navigation path.
- No document-level horizontal overflow at 320, 390, 768, 769, 834, 1024, and 1440px. Check both fresh loads and resizing; also check clipped descendants and internal table scrolling, not only document width.
- No essential button, form error, or last record is obscured by the bottom dock, modal footer, or software keyboard.
- Full material names, quantities, units, and financial amounts remain accessible without requiring users to remember off-screen columns.
- Saved targets survive leaving Budget, opening reminder settings, reload, and a new session. Failed saves cannot look successful.
- Identical budget concepts reconcile across Projects, Overview, Budget, and Insights; currency is explicit at amount entry.
- Keyboard focus is visible; dialogs contain focus and return it; controls have meaningful names; switching views announces the destination appropriately. Test with keyboard and a screen reader, not just a DOM audit.
- The same meaning uses the same color role, label, and component treatment across pages and device widths. Small actionable text and focus indicators remain clearly visible on their rendered backgrounds; status remains understandable without color.
- Empty, filtered-empty, loading, failed-load, saving, and failed-save states are distinguishable and actionable.
- Browser console and failed network requests are reviewed against the user interaction that caused them. No unexplained project-flow errors.
- Responsive Chromium emulation is supplemented with touch/keyboard checks on iOS Safari and Android Chrome before claiming real-device coverage.

## Test limitations to address

The existing `tests/projects-authenticated-layout.spec.ts` is useful as a smoke test, but skips without credentials, chooses the first full project, assumes an empty BOQ in Budget, mostly asserts document width, and does not exercise saved-state persistence. It cannot establish that all pages or tablet/desktop workflows work.

The signed-in walkthrough covered the pages available in this account, but it did not exercise durable writes, populated receipts/quotes/documents/usage history, an invited user's permissions, or physical iOS/Android devices. Browser logs included intermittent `Failed to fetch` errors; their originating requests were not isolated during this UX pass, so this report does not attribute them to a particular page.
