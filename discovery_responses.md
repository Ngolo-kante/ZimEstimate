# ZimEstimate: Discovery Questions & Responses

> **Status:** ✅ All 5 Questions Answered

---

## Summary of Architecture Decisions

| Question | Decision | Implication |
|----------|----------|-------------|
| **Currency** | Dual storage (USD + ZWG) with toggle | `price_usd` + `price_zwg` columns, exchange rate table |
| **Supplier Data** | Web scraping from local sites | Scheduled scraping jobs, normalization pipeline |
| **Project Sharing** | Single owner + view-only invites | `project_shares` junction table, invite system |
| **Progress Tracking** | Auto-calc + manual override | Budgeted vs. actual calculation with override flag |
| **Offline Support** | Offline viewing (Option B) | Service worker for caching, read-only offline mode |

---

## Detailed Responses

### 1. Currency & Pricing Logic ✅
Store prices in **both USD and ZWG** with user-togglable currency display.

### 2. Supplier Data Model ✅
**Web scraping** from existing Zimbabwean e-commerce sites with fallback to admin entry.

### 3. Project Ownership & Sharing ✅
**Single owner** with ability to invite others for view-only access. Collaboration as separate feature.

### 4. Milestone Completion Logic ✅
**Auto-calculate** from budgeted vs. actual material usage + **manual override** capability.

### 5. Offline / Low-Connectivity Support ✅
**Option B** – Cached estimates can be viewed offline, but edits require connection.

---

*Discovery complete. Ready to proceed with Task List and Implementation Plan.*
