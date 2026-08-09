# Next session plan

> Historical plan from 2026-07-30. Several items and assumptions have changed.
> Start with `docs/ARCHITECTURE.md` for the current implemented system.

Handoff from the session ending 2026-07-30. Production is healthy, everything
committed is deployed, nothing is half-finished.

## Context you need up front

- **Production branch is `unified`.** `git push origin unified` auto-deploys to
  zimestimate.com (~2 min). Verify with `curl -s https://zimestimate.com/api/ready`.
- **Release gate:** `npm run lint && npm run typecheck && npm run build && npm run test:unit`
  (52 tests). All must pass before pushing.
- **Hard-refresh after deploys** (⌘⇧R). Stale chunks otherwise surface the
  "Supabase is not configured" error boundary, which looks like an outage but isn't.
- **Screenshots are unreliable** on this app — framer-motion animations mean
  captures often land mid-transition. Measure geometry and DOM state in JS instead.
- **Supabase CLI:** use the Homebrew `supabase` binary, not `npx supabase` — only
  the former holds the login. Project is linked; `supabase db push` works.

## Work queue, in order

### 1. Request quotes from the BOQ (biggest value)
Decided with the owner: **stage-level and item-level**, both feeding one RFQ path.

- "Request quotes" action on each milestone header in the review step.
- Line-item checkboxes plus "Request quotes for selected (n)".
- **Suppliers must not see our prices** — send quantities and specs only, or the
  estimate anchors their bid.
- Match suppliers on `material_categories`; cap recipients (existing RFQ code
  carries a `maxSuppliers: 10` notion).
- Reuse the reminder dispatcher for delivery; email works today.

Already exists: `018_rfq_system.sql`, `022_rfq_transaction_function.sql`, the
procurement view, supplier leads. This is wiring, not greenfield.

### 2. Move share / print / download to the review header
They currently live inside `LiveEstimatePanel`, which no longer renders on the
review step (fixed in 266a16e). Relocate beside "Save Estimate".

### 3. Five admin screens still need ErrorState
`agreements`, `content`, `logs`, `packages`, `performance`, `scraper-review`.
All have `finally` guards already, so they no longer hang — they just show an
empty table on failure. Pattern is established in `admin/users`, `admin/tickets`
and `admin/suppliers`: add `loadError` state, a `catch`, and branch the render.

### 4. Remaining wizard validation fields
`validateBOQWizardStep` returns per-field errors and the store now carries them
(`validationErrors`). Only the project name field consumes them so far — see
`ProjectLocationSection`. Repeat for city, location type, floor area, building
type: `aria-invalid`, error border, and a message tied by `aria-describedby`.

### 5. Content-Security-Policy header
Last real security gap. Other headers already live in `next.config.ts`. Ship
report-only first — a badly scoped CSP breaks Vercel Analytics and inline styles
(the app uses styled-jsx heavily).

### 6. Export flow audit
`/export` was never audited. Given what auditing the wizard turned up, expect
real findings. Excel export is still a "Coming Soon" stub.

## Blocked on the owner

- **Supplier "Approve" button unverified.** The `approve_supplier_application`
  RPC is proven to work; the button was not confirmed because automating its
  native `confirm()` required stubbing it. Ask whether a manual approval works.
  If not, replacing `confirm()` with the existing `ConfirmDialog` is the fix.
- **Paynow (EcoCash) merchant account** — chosen over Stripe; users lack cards.
  `/supplier/upgrade` is a fake `alert("coming soon")` until this lands.
- **Meta business verification** for WhatsApp. Also needs message templates:
  Meta rejects free-form sends outside a 24-hour window, and the current code
  sends `type: "text"`.
- **Scraper sources.** Only `zimplaza` works; `unionhardware` sits behind a
  Sucuri WAF. More coverage needs supplier data agreements, not code.

## Known accuracy limits in the estimator

- Material prices are largely researched estimates, flagged in code. Only cement,
  bricks and PVA paint came from real listings.
- Premium finish level was removed from templates because it only differed from
  standard by paint coats and wet-area tile height. Re-adding it needs
  premium-grade materials in the catalogue with their own prices.

## Test data currently in production

Left in place at the owner's request. Revert when asked:
- `supplier_applications` row "Mbudzi Building Supplies" (approved) and its
  supplier record.
- `builder@zimestimate.test` promoted to `user_type: supplier`.
- Temporary passwords set on `builder@zimestimate.test` and
  `admin@zimestimate.test` for testing.
