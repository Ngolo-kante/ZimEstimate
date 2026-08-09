# Handover — ZimEstimate

> Historical snapshot from 2026-07-31. Contractor registration and later
> security work have since shipped. Start with `docs/ARCHITECTURE.md` for the
> current implemented system.

Written 31 July 2026, at the end of a long session. Branch `unified`, which is
also the Vercel **production** branch — anything merged here deploys.

Read section 1 before writing code. It is the part that would have saved me the
most time.

---

## 1. How this work goes

### Verify empirically. Reading the code is not enough.

Nearly every real bug this session was invisible from the source and obvious
from the running app. Three examples, all of which I initially got wrong:

- **RFQ** looked fine in `rfq.ts`. Every RFQ table was returning HTTP 500.
- **Project navigation** looked fine. The button that opened it was underneath
  the bottom nav bar; tapping it sent you to Home.
- **Quick-project defaults** looked fine. Untouched toggles failed validation.

Read the code to form a hypothesis. Then prove it against the running system.

### Scripted clicks lie

`element.click()` reaches an element **regardless of what is painted on top of
it**. I audited the project tabs that way, declared them working, and shipped a
page where every tab was unreachable on a phone. The user found it.

Use `document.elementsFromPoint(x, y)` to check what a tap actually hits, or
drive real coordinate taps via the `computer` tool. If you are asserting that
something is clickable, hit-test it.

### Tests passing does not mean it works

This bit twice. Most recently: my first fix for quick-project defaults passed
15 unit tests while completely breaking wizard navigation — Continue silently
refused to advance past step 1. I only caught it by driving the real wizard and
comparing against `git stash`-ed original code.

**When a fix touches interactive behaviour, exercise that behaviour.** And when
something misbehaves, stash your change and re-test to establish whether you
caused it. That single technique resolved two ambiguous failures here.

### Totals can hide compensating errors

The BOQ was ordering 2.4× too much roofing *and* under-pricing cement by half.
The two nearly cancelled, so the headline total looked plausible and survived an
earlier accuracy pass. Check line quantities against physical reality, not just
whether the total feels right.

### Don't trust the migration history

`supabase_migrations.schema_migrations` said 024 was applied. The table it
creates did not exist. `db push` will never re-run a migration the history
claims is done — you need a new one. Verify schema with
`supabase inspect db table-sizes --linked`, not the migration list.

### The gate before every commit

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Then commit, push, and confirm the deploy actually carries the change — Vercel
"Ready" is not proof the live domain serves it. Fetch the page or the shipped JS
chunk and grep for something you added.

### Tone of the work

The user is direct and technically engaged. They want the real problem found and
fixed, not reassurance. When something is wrong — including something they
built, or something I previously shipped — say so plainly with the evidence.
They have consistently responded well to that and badly to hedging.

Ask before consequential judgment calls (changing every estimate in the product,
restructuring a working flow). Act without asking on clear defects.

---

## 2. Codebase traps that recur

**styled-jsx + `next/link`.** A `<style jsx>` rule targeting a `<Link>` compiles
and matches *nothing* — the scope class never lands on the rendered `<a>`. Hit
five times this session. The whole mobile bottom nav was shipping unstyled
because of it. Symptom: `display` computes to `block` where you wrote `flex`.
Fix: wrap the selector in `:global()`.

**Stale service worker.** The PWA service worker serves old chunks per origin.
On Turbopack dev this shows as *"module factory is not available"* and the page
renders server HTML but never hydrates, so `useEffect` never runs. Unregister
service workers **and** delete caches on that exact origin, then reload. Clearing
one port does not clear another.

**Port 3007 is `next start`**, a production build that never picks up edits. Use
`preview_start {name: "zimestimate"}` (port 3001). Stop it before running
Playwright — it wants the same port.

**Hidden preview tab.** If `document.visibilityState` is `"hidden"` and the
viewport is 0×0, React never hydrates and every DOM read is meaningless. Check
before concluding anything.

Both of the above are in the persistent memory directory.

---

## 3. State: what is done and live

All of the following is committed on `unified` and verified in production.

| Area | What changed |
|---|---|
| **RFQ** | Fixed `42P17` infinite RLS recursion that made every RFQ table return 500. Migration `035`. Also fixed a `PGRST201` ambiguous embed and supplier notifications being silently 403'd. |
| **quick_boqs** | Table did not exist despite migration 024 being recorded as applied. Migration `036` creates it. |
| **Mobile nav** | Replaced a floating button that overlapped the bottom bar (taps went to Home) with a sticky view-tab strip. |
| **Bottom nav** | Was entirely unstyled — every rule dead via the styled-jsx trap. Rebuilt; added Budget Estimator; 5 equal items. |
| **Mobile tables** | BOQ table was 1072px inside 289px; usage table 701px inside 260px. Both become cards below 768px. |
| **Auth** | Added forgot-password and reset-password. Handles all three Supabase link formats. |
| **Budget Estimator** | Already worked signed-out; now carries inputs through sign-in instead of resetting. |
| **Market Insights** | Was fabricating trends from `index % 3` and a hardcoded array, and displaying "12 Sources" against an empty table. Now honest. |
| **BOQ accuracy** | Roof sheet coverage 0.85m² → 2.06m² (was ordering 2.4× too much). Cement $7.50 → $11.29/$13.35. IBR split by gauge. |
| **Quick projects** | Questions with a `defaultValue` no longer fail validation untouched. Labour section rebuilt (it had no stylesheet at all). |

**Test accounts.** `builder@zimestimate.test` password is `ZimTest2026!reset`
(changed while verifying the reset flow). Project
`b10a81ab-191f-4438-a51d-0832ce6d8594` is audit data I created — see
`PROJECT_EXPERIENCE_OVERHAUL.md` §3 for the full cleanup list.

---

## 4. What needs doing, in priority order

### 4.1 RFQ has no builder-facing UI — biggest gap

The backend now works end to end, but the Procurement Hub still shows
*"RFQ management coming soon"*. A builder **cannot raise an RFQ from their BOQ**.
The only screen that calls `createRfqRequest` is the Marketplace, one material at
a time. Full spec in `PROJECT_EXPERIENCE_OVERHAUL.md` §2.1.

Note the marketplace has **2 suppliers and 0 supplier products**, which caps the
value of this until there is supply.

### 4.2 `getBestPrice` ignores live data

It returns the static CSV **before** ever consulting `price_observations`.
Observations already hold cement at $10.24–$16 while the file said $7.50 —
fresher data exists and cannot reach the estimator. Fixing it means making price
resolution async through the BOQ path.

### 4.3 The `/community` page overclaims

`e87e295` committed a pre-existing marketing page (not mine) that says twice:
*"Real-time cement, brick & roofing prices for Harare, Bulawayo & Mutare."*
This is not true — `price_sources` and `price_weekly` are empty, prices come
from a static catalogue, and there is no Mutare data at all. It is now a live
production route. Either soften the wording or hold the page.

### 4.4 Remaining unit ambiguities in pricing

`roofing_galv_0_3`, `roofing_ibr_0_3` and the QTile keys still carry `m2` units
with the same ambiguity I fixed for IBR. `farm-brick` at $0.13 each sits above
the ~$0.05 that farm bricks quote at $50/1000. Needs the user's domain call.

### 4.5 Carried over

Move share/print/download into the review header; `ErrorState` missing on 5
admin screens; CSP header; export flow audit. Blocked on the user: Paynow
merchant account, Meta verification for WhatsApp, scraper sources.

---

## 5. Where we stopped

The user asked: **"do we have something for contractor registration hidden or
ever coded?"** I had started answering and did not finish. The answer:

**There is no contractor registration.** No route, no migration, no signup, no
`user_type = 'contractor'`. What exists is a *derived mode*:

```ts
// src/app/quick-projects/[type]/page.tsx:49
const isContractor = profile?.user_type === 'builder';
```

It reuses the existing `builder` user type and unlocks exactly one thing: the
`ContractorMarkup` component, which adds a markup percentage on quick-project
BOQs. Roughly 40 references across 12 files, concentrated in
`QuickBOQTable.tsx` (10) and the quick-project wizards.

The only other trace is a `contractors` tab in the new `FacebookBrandHub`
marketing page, which is presentation only.

So if the user wants contractor registration, it is a **greenfield build**:
user type, signup flow, profile fields, verification, and whatever separates a
contractor from the existing supplier and builder roles. Worth asking what a
contractor should be able to do that a builder cannot before designing it —
right now the only difference in the product is a markup field.
