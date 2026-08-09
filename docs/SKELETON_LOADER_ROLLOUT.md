# Skeleton Loader Rollout

Audit of loading states across ZimEstimate, written alongside the `/home`
skeleton so the rest of the application has a plan rather than a precedent to
copy blindly.

**Scope:** this document recommends. Only `/home` is implemented. Nothing else
in this list has been changed.

---

## The finding that shapes every recommendation

`loading.tsx` is a Suspense fallback for a **route segment rendering on the
server**. It is shown while the server streams the segment, and it is replaced
the moment that segment resolves.

`/home` is a Server Component. That is why a route-level skeleton is the right
mechanism there, and why it works.

Almost every other data-heavy route in this app is the opposite shape:

| Route | Rendering | Where the wait actually is |
| --- | --- | --- |
| `/home` | **server** | server render |
| `/projects` | client | `useEffect` fetch after mount |
| `/projects/[id]` | client | `useEffect` fetch after mount |
| `/marketplace` | client | `useEffect` fetch after mount |
| `/contractors` | client | `useEffect` fetch after mount |
| `/market-insights` | client | `useEffect` fetch after mount |
| `/supplier/dashboard` | client | `useEffect` fetch after mount |
| `/quick-projects` | client | `useEffect` fetch after mount |
| `/analytics` | client | `useEffect` fetch after mount |

For a `'use client'` page that fetches in `useEffect`, the component tree
resolves almost immediately — there is nothing for the server to wait on. A
`loading.tsx` on those routes would appear for a few milliseconds and then be
replaced by the page's own empty state while the real wait, the browser's fetch
to Supabase, has not even started.

**So "add `loading.tsx` everywhere" is the wrong instruction.** Each route below
names the mechanism that matches how that route actually loads. Where a route
would need to become a Server Component first, that is stated as a prerequisite
rather than hidden inside the estimate.

A shared `LoadingState` component already exists
(`src/components/ui/LoadingState.tsx`) with `table`, `cards`, and `page`
variants. Most recommendations below reuse it rather than adding new skeleton
markup.

---

## Group 1 — High priority

Authenticated, data-heavy money workflows where waiting is currently disruptive.

### `/projects` — the work list

- **What causes the wait:** `loadProjects` fetches projects and quick estimates
  after mount, then derives portfolio totals. This is the first screen after
  sign-in and the most frequently revisited page in the app.
- **Skeleton structure:** page header with title and the portfolio total as a
  neutral block, then 6 project cards in the live grid geometry — thumbnail
  block, two title lines, a status pill outline, and a footer row.
- **Mechanism:** **inline pending state** using `LoadingState variant="cards"`.
  A `loading.tsx` would not cover the fetch. Converting the route to a Server
  Component is the larger, better fix and is out of scope here.
- **Mobile:** cards go single-column below 640px; the skeleton must follow the
  same breakpoint or the layout will shift on resolve. Do not render 6 cards on
  mobile — 3 is enough to fill the viewport and costs less paint.
- **Test:** extend `tests/projects-authenticated-layout.spec.ts` to assert the
  skeleton is present before the network settles and that no horizontal scroll
  appears at 320px while it is showing.

### `/projects/[id]` — the project workspace

- **What causes the wait:** four parallel primary requests (project, stages,
  purchases, documents), followed by active-tab requests for BOQ, usage,
  prices, and related records. The breadth of dependent data still makes this
  the heaviest authenticated screen.
- **Skeleton structure:** header with project name and KPI row (four neutral
  tiles), then the tab bar rendered **for real** with the active tab's body
  skeletonised. The tab bar does not depend on fetched data, so showing it
  immediately gives the user something to orient by and to click.
- **Mechanism:** **component-level pending state per tab**, not a whole-page
  skeleton. The tabs resolve at different times; blanking the entire workspace
  for the slowest one is worse than what exists today.
- **Mobile:** the KPI row is horizontally scrollable; the skeleton must use the
  same overflow container or it will introduce page-level horizontal scroll.
- **Test:** assert the tab bar is interactive while the body is still pending.

### `/boq/new` — the estimator

- **What causes the wait:** material catalogue and price resolution on entry;
  the wizard is otherwise local state.
- **Skeleton structure:** the wizard step shell and progress indicator, with
  only the item table skeletonised.
- **Mechanism:** **inline pending state** scoped to the item table. The wizard
  chrome must never be skeletonised — a user mid-estimate seeing their step
  indicator disappear will assume work was lost. This matters more here than
  anywhere else in the app because this screen holds unsaved work.
- **Mobile:** the action row is fixed to the bottom on small screens; keep it
  rendered and disabled rather than skeletonised, so the viewport does not jump.
- **Test:** unit-test that entering the wizard with a pending catalogue never
  unmounts the progress component.

### `/supplier/dashboard` — supplier home

- **What causes the wait:** ten separate data calls (profile, products, RFQ
  inbox, API keys, documents). The most fetch-heavy route in the codebase.
- **Skeleton structure:** stat tiles and the tab bar, with the active tab's list
  skeletonised.
- **Mechanism:** **per-section pending states.** A single page-level spinner
  here hides the fact that most of the page is ready.
- **Mobile:** stat tiles wrap to two columns; match that in the skeleton.
- **Test:** assert the RFQ Quotes tab is reachable before products finish
  loading.

---

## Group 2 — Medium priority

Discovery, marketplace, contractor, and account pages. Waiting here costs
browsing momentum rather than money.

### `/marketplace` and `/marketplace/suppliers`

- **What causes the wait:** supplier list plus live price observations.
- **Skeleton structure:** filter bar rendered for real, results grid
  skeletonised at 6 cards.
- **Mechanism:** **inline pending state**, `LoadingState variant="cards"`. The
  filter bar must stay live so a user can refine before results land.
- **Mobile:** category nav is horizontally scrollable — reuse the real
  container.
- **Test:** public smoke test asserting no layout shift when results resolve.

### `/contractors`

- **What causes the wait:** `listListedContractors` plus filter state read from
  the URL after mount.
- **Skeleton structure:** 6 contractor cards matching `ContractorCard`
  geometry.
- **Mechanism:** **inline pending state.** Note the existing deliberate
  `filtersReady` gate — the page intentionally waits for mount before reading
  filters so server and client agree. The skeleton should cover that gate too,
  otherwise it flashes an unfiltered list first.
- **Mobile:** single column below 640px.
- **Test:** extend `tests/public-pages-smoke.spec.ts`.

### `/market-insights`

- **What causes the wait:** price history aggregation across three queries.
- **Skeleton structure:** chart-shaped neutral blocks at the final chart
  height.
- **Mechanism:** **inline pending state.** Reserving the chart height matters
  more than the shimmer here: charts resolve late and shift the page hardest.
- **Mobile:** charts are the most overflow-prone element in the app; the
  skeleton must be width-constrained, not fixed-width.
- **Test:** assert reserved height matches rendered height within a tolerance.

### `/supplier/leads`, `/supplier/documents`, `/supplier/notifications`, `/analytics`, `/settings`

- **What causes the wait:** a single list fetch each.
- **Mechanism:** **inline pending state** with the existing `LoadingState`.
  These are small enough that anything more is over-engineering.
- **Test:** covered by existing route smoke tests.

---

## Group 3 — Low priority

Mostly static or near-instant. **No skeleton recommended.** Adding one would
introduce a flash of loading UI on pages that render immediately, which is worse
than no loading state at all.

| Route | Why no skeleton |
| --- | --- |
| `/privacy`, `/terms` | Static content, no fetch |
| `/support` | Static form; submission has its own pending state |
| `/offline` | Rendered when there is no network |
| `/style-guide` | Internal reference |
| `/auth/*` | Forms, not data; sign-in already has a button pending state |
| `/quick-projects` | Static list of project types |
| `/templates`, `/export` | Local data |
| `/dashboard` | A 24-line redirect to `/projects/dashboard`. It should not gain a skeleton — it should gain nothing. Its bare "Redirecting…" is correct for what it is. |

---

## Copy changes on `/home`

Audit of supporting copy directly beneath homepage headings, per objective 4.
Retained copy is listed too, so the reasoning is reviewable rather than only the
deletions.

| Location | Original | Revised | Reason |
| --- | --- | --- | --- |
| Pathways section | "Estimating comes first, with people and prices ready when you need them." | *(removed)* | Restates the heading directly above it — "Begin with a number. Move toward a real build." Adds no information that helps the reader choose between the three pathway cards below, which carry their own labels. |
| Closing band | Eyebrow: "Your build starts with clarity" | *(removed)* | Sentiment, not orientation. The other section labels ("Start from what you have", "Choose your next move", "One working record") tell the reader where they are; this one tells them nothing they can act on. |
| Closing band | "Create the estimate first. Save it when you are ready." | "No account needed to start. Sign in when you want to save it." | The first sentence repeated the heading and the button beneath it. The replacement carries the fact that actually removes hesitation at a CTA: there is no sign-up wall. Verified true — `/boq/new` has no auth guard and only prompts sign-in at save. |
| Hero | "Build a practical BOQ, test your budget, and find contractors from one connected workspace." | *(kept)* | States what the user receives, and names the three capabilities. Does not repeat the heading. |
| Start section | "Choose a guided build, bring an existing plan or document, or price a smaller project in minutes." | *(kept)* | This is the sentence that differentiates the four pathways. Exactly the copy the brief says to protect. |
| Workflow section | "Keep decisions, quotes, purchases, and site progress attached to the project that created them." | *(kept)* | Concrete specifics the heading ("The estimate does not end at a PDF.") does not supply. |

The four approved pathway names — Create Your BOQ, Plan to BOQ, Quote to
Project, Quick Project — are unchanged.

---

## Semantic colour roles — what changed

The base success, warning, error, and info colours already existed as single
values. The task added consistent foreground, subtle-background, and border
roles for success, warning, danger, and information so future components do not
invent one-off status tints. The foreground values target WCAG AA contrast on
white; status must still include text or an icon because colour alone cannot
carry meaning.

The interactive focus role also needed correction.

| Token | Before | After | Measured |
| --- | --- | --- | --- |
| `--color-focus-ring` | `rgba(46, 108, 246, 0.5)` | `#2E6CF6` | 2.03:1 → **4.57:1** on a white card. WCAG 2.1 requires 3:1 for a focus indicator, so the old value failed on every focusable card on the page. |
| `--color-focus-ring-inverse` | *(did not exist; `#e4b44a` was hardcoded in `home.module.css`)* | `#E4B44A` | **8.58:1** on the navy hero. The standard blue reaches only 3.61:1 there, and 1.87:1 at the old half alpha. |

The amber was already in the stylesheet and already correct — it was simply
anonymous. Naming it `--color-focus-ring-inverse` describes the surface it
belongs on rather than its hue, which is the rule the brief sets.

Both tokens are consumed only by `/home` today, so this is not a site-wide
migration. Nothing else in the codebase references either value.

Status is never communicated by colour alone on this page: the focus ring is a
3px outline with a 3px offset (shape, not just hue), and the card focus state
also changes background and border.

## Recommended sequence

1. `/projects` and `/projects/[id]` — highest traffic, highest frustration.
2. `/supplier/dashboard` — worst fetch count.
3. `/marketplace` and `/contractors` — shared card skeleton, cheap once the
   first is done.
4. `/market-insights` — do this one after the chart data question is settled;
   skeletons for charts that may not have enough data to render is work in the
   wrong order.

## Open risk

The single biggest improvement is not a skeleton at all: it is moving
`/projects` and `/projects/[id]` to Server Components so their data is fetched
during the server render. That would make `loading.tsx` genuinely effective on
the two screens that need it most, and would remove the fetch-after-mount
waterfall rather than decorating it. Skeletons on client-fetched pages are
mitigation; this is the fix.
