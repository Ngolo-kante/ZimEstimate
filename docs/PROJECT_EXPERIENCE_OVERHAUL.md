# Project Experience Overhaul

Audit of the create-a-project journey, the RFQ failures, and the mobile
experience — with what has been fixed and what remains, in priority order.

Audited 31 July 2026 by walking the real flow on a 375×812 viewport, signed in
as a builder, against the production Supabase project.

---

## 1. What was actually broken

### 1.1 RFQ was dead end to end — FIXED

Every RFQ table returned **HTTP 500** for any normal user:

```
42P17: infinite recursion detected in policy for relation "rfq_requests"
```

Two row-level-security policies referenced each other:

| Policy | References |
| --- | --- |
| `rfq_requests` SELECT | `EXISTS (SELECT … FROM rfq_recipients …)` |
| `rfq_recipients` SELECT | `EXISTS (SELECT … FROM rfq_requests …)` |

Reading either re-entered the other forever. Every child table — `rfq_items`,
`rfq_quotes`, `rfq_quote_items`, `rfq_notification_queue` — reaches
`rfq_requests` through its own policy, so all of them inherited the failure.
Migration `003_fix_rls_recursion.sql` had already solved this class of bug for
projects; migration `018` reintroduced it for RFQ.

That is why **all 12 projects in production had zero RFQs** — nobody had ever
successfully created one.

Fixed in `035_fix_rfq_rls_recursion.sql`, applied to production, by moving the
membership checks into `SECURITY DEFINER` helpers that do not re-trigger RLS.

Two further RFQ bugs were sitting underneath, invisible until the 500 cleared:

- **`PGRST201` on the query the UI actually runs.** Two foreign keys exist
  between `rfq_requests` and `rfq_quotes` (`rfq_quotes.rfq_id` and
  `rfq_requests.accepted_quote_id`), so PostgREST refused to guess which to
  embed and rejected the whole request. Both `getProjectRfqs` and
  `getSupplierRfqInbox` now name the key explicitly.
- **Suppliers were never notified.** `notification_deliveries` correctly
  restricts inserts to `auth.uid() = user_id`, so the builder's write of a
  supplier-addressed row was rejected 403 and swallowed by a non-fatal logger.
  Now routed through `log_rfq_supplier_notifications`, a definer function that
  verifies RFQ edit rights and writes only for suppliers actually invited.

Verified against production: RFQ creation with recipients, the UI query,
notification queue insert, supplier delivery log, and a forgery guard proving a
builder cannot address an uninvited user (writes 0 rows).

### 1.2 Mobile tables were unreadable — FIXED

Measured on a 375px viewport:

| Table | Rendered width | Container | Ratio |
| --- | --- | --- | --- |
| Bill of Quantities | 1072px | 289px | 3.7× |
| Usage Tracking | 701px | 260px | 2.7× |

Both sat in `overflow-x: auto`, so the page did not visibly break — but a phone
showed roughly a quarter of each row, and a figure could never be on screen at
the same time as the item it belonged to. The existing mobile CSS only shrank
padding and font size, which does not address a 3.7× overflow.

Below 768px each row is now a card. Every cell carries a `data-label` so the
column heading travels with its value instead of living in a header row that has
scrolled away; `thead` is accessibly hidden rather than removed, so screen
readers keep the association. Toggling columns off in the toolbar shortens the
cards exactly as it narrows the table on desktop.

Result: BOQ 1072px → 289px, Usage 701px → 260px, no horizontal scrolling, every
cell inside the viewport.

### 1.3 The creation wizard threw away its own answers — FIXED

`/projects/new` asks four steps of questions — type, priority, name, location —
writes them to `sessionStorage` under `zimestimate_new_project`, then hands off
to `/boq/new`.

**Nothing ever read that key back.** Grep found exactly one reference in the
codebase: the write. Choosing "Manual Builder" — the option labelled
*Recommended* — discarded all four steps and opened on "Untitled Estimate",
asking for the same details again.

The BOQ builder now restores the name and location. Project *type* is
deliberately not mapped: the two wizards use different vocabularies
(`new-house` vs `full_house`) for different concepts — project category versus
BOQ scope — so translating between them would guess at intent rather than carry
it. Reconciling those vocabularies is item 2.2 below.

### 1.4 Project-type tiles were unreachable by keyboard — FIXED

Step 1 of creating a project was built from `<div onClick>` with no `role`, no
`tabindex`, and no pressed state. It could not be reached by Tab, was not
announced as a control, and its selection was conveyed by colour alone. All 11
tiles across steps 1, 2 and 4 are now real `<button>`s with `aria-pressed` and a
visible focus ring.

---

## 2. What still needs doing, in priority order

### 2.1 Build "Raise RFQ from BOQ" — the biggest remaining gap

The Procurement Hub's *RFQs & Quotes* tab currently reads:

> RFQ management coming soon — use the Supplier dashboard for RFQ workflows
> while this feature is being built.

So even with the backend fixed, **a builder still has no way to raise an RFQ
from their own BOQ**. The only UI that calls `createRfqRequest` is the
Marketplace, one material at a time. This is the single highest-value piece of
work left.

Proposed scope:

1. Select BOQ lines — checkbox per row, "select all in stage" per group.
2. Review panel: grouped by material category, with quantity overrides.
3. Supplier matching preview — `matchSuppliersForItems` already exists and
   works; show who will receive it and why (the `reasons` array is already
   populated).
4. Delivery address (default the project location), required-by date, notes.
5. Send, then a quote-comparison view per RFQ.

Everything below the UI already exists and is now verified working.

### 2.2 Reconcile the two project-type vocabularies

`/projects/new` uses `new-house | extension | renovation | commercial`;
`/boq/new` uses `full_house | building_in_stages | house_substructure | solar |
…`. They overlap without matching. Until they share a vocabulary, the handoff
cannot carry type or priority, and the user answers two similar questions.

Decide which is canonical, then map or merge. This also determines whether the
first wizard should exist at all — see 2.3.

### 2.3 Question whether `/projects/new` should exist

It asks four questions, then in three of its four branches immediately hands off
to another wizard that asks its own. Priority (budget / quality / speed) is
collected and, as far as I can find, never used to change any estimate.

Worth considering: fold the two useful fields (name, location) into the BOQ
builder's first step and retire the separate wizard. That removes four screens
from the path to a first estimate.

### 2.4 The marketplace is nearly empty

Production has **2 suppliers and 0 supplier products**. Supplier matching scores
on category, product match, location and rating — with zero products listed, one
of its four signals is always dead, and an RFQ can reach at most two businesses.
This is a supply-side content problem, not a code problem, but it caps the value
of everything in 2.1.

### 2.5 Remaining mobile issues

Smaller than the tables, all measured:

- The date field in the BOQ toolbar overflows to 382px on a 375px viewport.
- Usage sub-tab buttons overflow to 439px; they need horizontal scroll or wrap.
- The bottom navigation's floating action button overlaps the "Home" label.
- Project content renders at 289px inside a 375px viewport — roughly 86px of
  horizontal padding on a phone, which is a lot of lost width.

### 2.6 Carried over from the previous session

- Move share / print / download into the review header.
- `ErrorState` still missing on 5 admin screens.
- CSP header.
- Export flow audit.

---

## 3. Test data to clean up

Created during this audit, in production:

- Project `b10a81ab-191f-4438-a51d-0832ce6d8594` — "UX Audit — Cottage Harare",
  owned by `builder@zimestimate.test`, with 23 BOQ items copied from an existing
  project.
- Two RFQs against it, one notification-queue row, one delivery-log row.
- `builder@zimestimate.test` password was changed to `ZimTest2026!reset` while
  verifying the password-reset flow.

None of it is visible to real users, but it should be removed before launch.
