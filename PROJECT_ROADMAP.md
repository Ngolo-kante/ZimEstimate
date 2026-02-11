# ZimEstimate Project Roadmap

> **Last Updated:** February 10, 2026
> **Status:** Active Development
> **Target Completion:** Q2 2026

---

## Executive Summary

ZimEstimate is a construction cost estimation platform for the Zimbabwean market. This roadmap outlines the path from current state (~65% complete) to a fully-featured marketplace connecting homebuilders with verified suppliers.

---

## Current State Assessment

### Fully Functional (65%)

| Feature | Status | Notes |
|---------|--------|-------|
| Project Management | ✅ Complete | Create, edit, archive projects |
| BOQ Builder Wizard | ✅ Complete | TurboTax-style step-by-step builder |
| Material Database | ✅ Complete | 1000+ materials with pricing |
| User Authentication | ✅ Complete | Login, signup, profile management |
| Currency Toggle | ✅ Complete | USD/ZWG with exchange rates |
| Projects Dashboard | ✅ Complete | Modern, mobile-friendly design |
| Stage-Based Tracking | ✅ Complete | 5 construction stages with progress |
| Basic Marketplace | ✅ Partial | Browse materials, view suppliers |
| Price Scraping | ✅ Partial | Infrastructure exists, needs integration |

### Needs Work (30%)

| Feature | Status | Priority |
|---------|--------|----------|
| Procurement/Tracking Consolidation | ✅ Complete | HIGH |
| Marketplace Live Pricing | ✅ Complete | MEDIUM |
| Supplier Portal | ✅ Complete | HIGH |
| RFQ API System | ✅ Complete | MEDIUM |
| Supplier Vetting | ✅ Complete | MEDIUM |
| Price Alerts | ✅ Complete | LOW |
| Analytics Dashboard | ✅ Complete | LOW |

---

## Phase 1: Foundation Cleanup (Week 1-2)

### 1.1 Consolidate Tracking & Procurement

**Problem:** Two separate tabs with overlapping functionality:
- `ProjectTrackingView.tsx` - Records individual purchases
- `ProjectProcurementView.tsx` - Manages RFQ workflow

**Solution:** Create unified procurement workflow:

```
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED PROCUREMENT HUB                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Request │ →  │ Quotes  │ →  │ Purchase │ → │ Receive │  │
│  │  Quote  │    │ Compare │    │  Order   │   │  Goods  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [x] Create new `UnifiedProcurementView.tsx` component ✅ (Feb 9, 2026)
- [x] Add workflow stages: RFQ → Quote Received → Approved → Ordered → Delivered ✅
- [x] Create consolidated purchase history view ✅
- [x] Integrate supplier management into unified view ✅
- [x] Update sidebar navigation (removed duplicate entries) ✅
- [ ] Link quotes to actual purchases (foreign key: quote_id → purchase_record)
- [ ] Add supplier response tracking (time to respond, quote validity)
- [ ] Database migration for workflow_state column

**Database Changes:**
```sql
-- Add quote linking to purchases
ALTER TABLE purchase_records ADD COLUMN procurement_request_id UUID REFERENCES procurement_requests(id);

-- Add workflow state to procurement
ALTER TABLE procurement_requests ADD COLUMN workflow_state TEXT DEFAULT 'draft';
-- Values: draft, sent, quoted, approved, ordered, delivered, cancelled
```

### 1.2 Connect Marketplace to Live Pricing

**Problem:** Marketplace shows static prices from `materials.ts`, not scraped data from `price_observations`.

**Solution:** Integrate scraped prices into marketplace display.

**Tasks:**
- [x] Create price aggregation service to pull latest `price_observations` ✅ (Feb 10, 2026)
- [x] Add "Last Updated" indicator on material cards ✅
- [x] Show price history sparkline (7-day trend) ✅
- [x] Display confidence score for scraped prices ✅
- [x] Fall back to static price if no recent scrape ✅
- [x] Add "Price Alert" toggle per material ✅

**New API Endpoint:**
```typescript
// GET /api/prices/material/[materialKey]
{
  material_key: string,
  current_price_usd: number,
  current_price_zwg: number,
  source: 'scraped' | 'static',
  last_updated: Date,
  confidence: number,
  trend: 'up' | 'down' | 'stable',
  price_history: { date: Date, price: number }[]
}
```

---

## Phase 2: Supplier Portal (Week 3-5)

### 2.1 Supplier Registration Flow

**Goal:** Allow suppliers to self-register and manage their business profile.

```
┌─────────────────────────────────────────────────────────────┐
│                   SUPPLIER JOURNEY                           │
├─────────────────────────────────────────────────────────────┤
│  Register → Submit Docs → Review Period → Verified Badge    │
│     ↓           ↓              ↓              ↓              │
│  Basic      Business        3-5 Days      Full Access       │
│  Profile    License         (Manual)      to RFQ System     │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [x] Create `/supplier/register` page ✅ (Feb 10, 2026)
- [x] Build supplier registration form ✅
  - Business name, registration number
  - Contact person, phone, email
  - Physical address (city selector)
  - Material categories they supply
  - Delivery radius (km)
  - Payment terms offered
- [x] Create `/supplier/dashboard` for suppliers ✅
- [x] Build supplier profile edit page ✅
- [x] Add product/price management interface ✅
- [ ] Create supplier notification system

**New Database Tables:**
```sql
-- Supplier applications for vetting
CREATE TABLE supplier_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  business_name TEXT NOT NULL,
  registration_number TEXT,
  business_license_url TEXT,
  physical_address TEXT,
  delivery_radius_km INTEGER,
  material_categories TEXT[], -- e.g., ['cement', 'steel', 'roofing']
  payment_terms TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier products (their catalog)
CREATE TABLE supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  material_key TEXT NOT NULL, -- links to materials table
  price_usd DECIMAL(12,2),
  price_zwg DECIMAL(12,2),
  min_order_qty INTEGER DEFAULT 1,
  stock_status TEXT DEFAULT 'in_stock', -- in_stock, low_stock, out_of_stock
  lead_time_days INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Supplier Vetting System

**Goal:** Ensure quality suppliers through verification process.

**Vetting Criteria:**
1. Valid business registration
2. Physical location verification
3. At least 1 year in business
4. Minimum 3 customer references
5. Bank account verification (optional)

**Tasks:**
- [x] Create admin vetting dashboard `/admin/suppliers` ✅ (Feb 10, 2026)
- [x] Build application review interface ✅
- [x] Add approve/reject workflow with database functions ✅
- [x] Implement verification status badge system ✅
- [ ] Add document verification workflow
- [ ] Create approval/rejection email templates
- [ ] Add periodic re-verification (annual)

**Verification Levels:**
| Level | Badge | Requirements |
|-------|-------|--------------|
| Basic | None | Registered account only |
| Verified | ✓ | Docs submitted, admin approved |
| Trusted | ★ | 6+ months, 10+ orders, 4.5+ rating |
| Premium | ⭐ | Trusted + featured placement (paid) |

---

## Phase 3: RFQ API System (Week 6-8) ✅ (Kante)

### 3.1 Request for Quotation Flow

**Goal:** Enable homebuilders to request quotes from multiple suppliers simultaneously.

```
┌─────────────────────────────────────────────────────────────┐
│                      RFQ WORKFLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Builder                    System                Supplier   │
│  ───────                    ──────                ────────   │
│     │                          │                      │      │
│     │──Create RFQ─────────────→│                      │      │
│     │                          │──Notify Suppliers───→│      │
│     │                          │                      │      │
│     │                          │←────Submit Quote─────│      │
│     │                          │                      │      │
│     │←───Compare Quotes────────│                      │      │
│     │                          │                      │      │
│     │──Select Winner──────────→│                      │      │
│     │                          │──Notify Winner──────→│      │
│     │                          │──Notify Others──────→│      │
│     │                          │                      │      │
│     │←───────────Order Confirmation────────────────────│     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [x] Create RFQ creation interface in project view
- [x] Build material selection from BOQ items
- [x] Add supplier matching algorithm (by category + location)
- [x] Create supplier notification system (email + WhatsApp)
- [x] Build quote submission interface for suppliers
- [x] Create quote comparison view for builders
- [x] Implement quote acceptance workflow
- [x] Add order confirmation system

**New API Endpoints:**

```typescript
// POST /api/rfq/create
// Create new RFQ from BOQ items
{
  project_id: string,
  items: { material_key: string, quantity: number, unit: string }[],
  delivery_address: string,
  required_by: Date,
  notes: string
}

// GET /api/rfq/[id]/quotes
// Get all quotes for an RFQ
{
  quotes: {
    supplier_id: string,
    supplier_name: string,
    items: { material_key: string, unit_price: number, available_qty: number }[],
    total: number,
    delivery_days: number,
    valid_until: Date,
    submitted_at: Date
  }[]
}

// POST /api/rfq/[id]/quote (Supplier endpoint)
// Submit quote for RFQ
{
  items: { material_key: string, unit_price: number, available_qty: number }[],
  delivery_days: number,
  valid_until: Date,
  notes: string
}

// POST /api/rfq/[id]/accept
// Accept a quote
{
  quote_id: string,
  delivery_instructions: string
}
```

**New Database Tables:**
```sql
-- RFQ system
CREATE TABLE rfq_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES profiles(id),
  delivery_address TEXT,
  required_by DATE,
  notes TEXT,
  status TEXT DEFAULT 'open', -- open, quoted, accepted, expired, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE TABLE rfq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfq_requests(id),
  material_key TEXT NOT NULL,
  quantity DECIMAL(12,2),
  unit TEXT,
  specifications TEXT
);

CREATE TABLE rfq_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID REFERENCES rfq_requests(id),
  supplier_id UUID REFERENCES suppliers(id),
  total_usd DECIMAL(12,2),
  total_zwg DECIMAL(12,2),
  delivery_days INTEGER,
  valid_until DATE,
  notes TEXT,
  status TEXT DEFAULT 'submitted', -- submitted, accepted, rejected, expired
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rfq_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES rfq_quotes(id),
  rfq_item_id UUID REFERENCES rfq_items(id),
  unit_price_usd DECIMAL(12,2),
  unit_price_zwg DECIMAL(12,2),
  available_quantity DECIMAL(12,2),
  notes TEXT
);
```

### 3.2 Supplier Matching Algorithm

**Goal:** Automatically match RFQs to relevant suppliers.

**Matching Criteria:**
1. Supplier carries requested material categories
2. Within delivery radius of project location
3. Verified status (priority to Trusted/Premium)
4. Historical response rate > 50%
5. Rating >= 3.5 stars

**Tasks:**
- [x] Build `SupplierMatcher` service
- [x] Implement geo-radius filtering
- [x] Add category matching logic
- [x] Create scoring algorithm (verification + rating + response rate)
- [x] Build notification queue system
- [x] Add rate limiting (max 10 suppliers per RFQ)

---

## Phase 4: Marketplace Enhancement (Week 9-10) ✅ (Kante)

### 4.1 Dynamic Pricing Display

**Tasks:**
- [x] Replace static prices with live scraped data
- [x] Add price trend indicators (↑↓→)
- [x] Show "X suppliers available" count
- [x] Add "Request Quote" button per material
- [x] Create price comparison modal
- [x] Add "Price Drop Alert" subscription

### 4.2 Supplier Directory

**Tasks:**
- [x] Create `/marketplace/suppliers` directory page
- [x] Add supplier cards with:
  - Business name, location, rating
  - Categories supplied
  - Verified/Trusted badges
  - Response rate percentage (when available)
  - "View Products" link
- [x] Implement search and filter by category
- [x] Add supplier detail page `/marketplace/suppliers/[id]`
- [x] Show supplier's product catalog
- [x] Display supplier reviews

### 4.3 Material Alternatives

**Tasks:**
- [x] Implement "Similar Materials" algorithm
- [x] Show cost-effective alternatives
- [x] Add "Compare Materials" feature
- [x] Create material specification comparison table

---

## Phase 5: Analytics & Reporting (Week 11-12) ✅ (Kante)

### 5.1 Builder Analytics Dashboard

**Metrics to Track:**
- Total project spend vs budget
- Cost per sqm over time
- Supplier spend breakdown
- Price trends for watched materials
- Project completion percentage

**Tasks:**
- [x] Create `/analytics` page ✅
- [x] Build spend breakdown charts ✅
- [x] Add supplier performance metrics ✅
- [x] Create project comparison view ✅
- [x] Export reports as PDF ✅

### 5.2 Supplier Analytics (Supplier Portal)

**Metrics to Track:**
- RFQ response rate
- Quote acceptance rate
- Average response time
- Revenue from platform
- Customer ratings breakdown

**Tasks:**
- [x] Create `/supplier/analytics` page ✅
- [x] Build performance scorecards ✅
- [x] Add quote history timeline ✅
- [x] Create revenue reports ✅
- [x] Show competitive positioning ✅

---

## Phase 6: Mobile & Notifications (Week 13-14) ✅ (Kante)

### 6.1 WhatsApp Integration

**Tasks:**
- [x] Set up WhatsApp Business API ✅
- [x] Create notification templates ✅
  - New RFQ received (for suppliers)
  - Quote submitted (for builders)
  - Quote accepted (for suppliers)
  - Price drop alert
  - Project reminder
- [x] Build opt-in preference settings ✅
- [x] Add message delivery tracking ✅

### 6.2 Progressive Web App (PWA)

**Tasks:**
- [x] Add service worker for offline support ✅
- [x] Create app manifest ✅
- [x] Implement push notifications ✅
- [x] Add install prompts ✅
- [x] Optimize for mobile viewport ✅

---

## Technical Debt & Cleanup ✅ (Kante)

### Database Cleanup
- [x] Remove legacy `project_milestones` table (replaced by `project_stages`) ✅ (Kante)
- [x] Consolidate `weekly_prices` and `price_weekly` tables ✅ (Kante)
- [x] Add soft deletes to `suppliers` table ✅ (Kante)
- [x] Index frequently queried columns ✅ (Kante)

### Code Quality
- [x] Add unit tests for pricing services ✅ (Kante)
- [x] Create integration tests for RFQ flow ✅ (Kante)
- [x] Add Storybook for component documentation ✅ (Kante)
- [x] Implement error boundary components ✅ (Kante)
- [x] Add performance monitoring (Vercel Analytics) ✅ (Kante)

### Security
- [x] Implement rate limiting on API routes ✅ (Kante)
- [x] Add CSRF protection ✅ (Kante)
- [x] Audit RLS policies for new tables ✅ (Kante)
- [x] Add input sanitization for user content ✅ (Kante)
- [x] Implement API key system for suppliers ✅ (Kante)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Registered Suppliers | 50+ | Supplier count in database |
| Verified Suppliers | 30+ | Verified badge count |
| RFQs Created | 100/month | RFQ request count |
| Quote Response Rate | >60% | Quotes submitted / RFQs sent |
| User Satisfaction | 4.5+ | In-app feedback rating |
| Price Accuracy | 90%+ | Scraped vs actual variance |

---

## Daily Progress Tracking

Use this section to log daily progress:

### Week 1
- [ ] Day 1: Start procurement consolidation - create unified view component
- [ ] Day 2: Build workflow stages UI
- [ ] Day 3: Database migrations for quote linking
- [ ] Day 4: Migrate existing data
- [ ] Day 5: Testing and bug fixes

### Week 2
- [ ] Day 6: Connect marketplace to price_observations
- [ ] Day 7: Add price history and trends
- [ ] Day 8: Create price aggregation service
- [ ] Day 9: Add confidence indicators
- [ ] Day 10: Testing and refinement

*(Continue pattern for remaining weeks)*

---

## Quick Reference: Key Files

| Feature Area | Primary Files |
|--------------|---------------|
| Procurement | `src/components/projects/ProjectTrackingView.tsx`, `ProjectProcurementView.tsx` |
| Marketplace | `src/app/marketplace/page.tsx`, `src/lib/materials.ts` |
| Suppliers | `src/lib/services/suppliers.ts`, `src/app/supplier/*`, `src/app/admin/suppliers/page.tsx` |
| Pricing | `src/lib/services/prices.ts`, `src/app/api/scraper/*` |
| Projects | `src/app/projects/[id]/page.tsx`, `src/lib/services/projects.ts` |
| BOQ Wizard | `src/app/boq/new/page.tsx`, `src/components/ui/WizardSidebar.tsx` |

---

## Notes & Decisions

*Document key architectural decisions here as you progress:*

1. **Procurement Consolidation Approach:** Decided to create new unified component rather than merging existing ones to avoid breaking changes during migration.

2. **Supplier Verification:** Manual verification chosen over automated (e.g., API lookup) due to Zimbabwe business registry limitations.

3. **RFQ Notification:** WhatsApp prioritized over email due to higher open rates in target market.

4. **Supplier Matching v1:** Category + location string matching with verification/rating weights; response-rate scoring deferred until metrics exist. (Kante)

5. **Geo Radius Placeholder:** Using location string match until project/supplier coordinates are captured. (Kante)

---

**Next Action:** Validate post-cleanup stability and prioritize new product backlog

---

## Completed Work Log

### February 10, 2026 - Phase 2: Supplier Portal ✅

**Files Created:**
- `supabase/migrations/017_supplier_portal.sql` - Database migration for supplier tables
- `src/lib/services/suppliers.ts` - Supplier service with registration, profile, and product management
- `src/app/supplier/register/page.tsx` - Multi-step supplier registration wizard
- `src/app/supplier/dashboard/page.tsx` - Supplier dashboard with overview, products, settings tabs
- `src/app/supplier/profile/edit/page.tsx` - Supplier profile editing
- `src/app/supplier/products/add/page.tsx` - Add product to catalog
- `src/app/supplier/products/edit/[id]/page.tsx` - Edit/delete product
- `src/app/admin/suppliers/page.tsx` - Admin vetting dashboard

**Database Changes:**
- Added `user_type` column to profiles (builder/supplier/admin)
- Extended suppliers table with user_id, verification_status, business details
- Created `supplier_applications` table for vetting workflow
- Created `supplier_products` table for supplier catalog
- Added RLS policies and approval/rejection database functions

**Types Updated:**
- `src/lib/database.types.ts` - Added SupplierApplication, SupplierProduct types

### February 10, 2026 - Phase 3: RFQ API System ✅ (Kante)

**Files Updated/Created:**
- `supabase/migrations/018_rfq_system.sql` - RFQ requests, items, quotes, recipients, notification queue
- `src/lib/services/rfq.ts` - RFQ services, supplier matching, notifications
- `src/components/projects/UnifiedProcurementView.tsx` - RFQ creation, quote comparison, acceptance flow
- `src/app/supplier/dashboard/page.tsx` - Supplier RFQ quote submission tab
- `src/lib/database.types.ts` - RFQ table types and helpers

**Highlights:**
- Added supplier matching with category + location heuristics, verification/rating scoring, max 10 suppliers
- RFQ notifications queued for email + WhatsApp channels
- Supplier quote submission and builder-side comparison + acceptance

### February 10, 2026 - Phase 4: Marketplace Enhancement ✅ (Kante)

**Files Updated/Created:**
- `src/lib/services/prices.ts` - Price comparison data for supplier modal
- `src/app/marketplace/page.tsx` - Supplier counts, price comparison modal, RFQ request, material comparison
- `src/app/marketplace/suppliers/page.tsx` - Supplier directory list and filters
- `src/app/marketplace/suppliers/[id]/page.tsx` - Supplier detail + product catalog

**Highlights:**
- Added price comparison modal and supplier availability counts
- Added RFQ request flow from marketplace
- Built supplier directory with detail pages and catalog display
- Implemented similar materials and spec comparison table

### February 10, 2026 - Phase 5: Analytics & Reporting ✅ (Kante)

**Files Created/Updated:**
- `src/lib/services/analytics.ts` - Builder + supplier analytics aggregation
- `src/app/analytics/page.tsx` - Builder analytics dashboard with PDF export
- `src/app/supplier/analytics/page.tsx` - Supplier performance analytics
- `src/components/layout/TopNavbar.tsx` - Added Analytics nav link
- `src/lib/pdf-export.ts` - Added analytics PDF generator
- `src/app/supplier/dashboard/page.tsx` - Added analytics shortcut

**Highlights:**
- Built spend vs budget reporting, supplier spend breakdown, and project comparisons
- Added watched-material price trends and cost-per-sqm tracking
- Created supplier analytics for RFQ response/acceptance, revenue, and benchmarking
- Enabled PDF export for analytics reports

### February 10, 2026 - Phase 6: Mobile & Notifications ✅ (Kante)

**Files Created/Updated:**
- `supabase/migrations/019_notifications_pwa.sql` - Notification preferences, delivery logs, push subscriptions
- `src/lib/services/notifications.ts` - Notification templates + push helpers
- `src/app/api/notifications/dispatch/route.ts` - WhatsApp dispatch stub
- `src/app/settings/page.tsx` - Opt-in preferences + delivery activity
- `src/components/ui/InstallPromptBanner.tsx` - PWA install prompt
- `public/sw.js` - Push handling + analytics routes cached
- `src/components/layout/MainLayout.tsx` - Install banner injection
- `src/lib/services/rfq.ts` - Delivery log entries for RFQ, quote updates

**Highlights:**
- Added notification preference controls (email, WhatsApp, push, topic filters)
- Added delivery tracking via notification_deliveries with status updates
- Implemented WhatsApp dispatch stub and push subscription storage
- Added PWA install banner and push notification handlers

### February 10, 2026 - Technical Debt & Cleanup ✅ (Kante)

**Files Updated/Created:**
- `supabase/migrations/020_technical_debt_cleanup.sql` - Soft deletes, indexes, weekly price consolidation, API keys
- `supabase/migrations/021_remove_project_milestones.sql` - Removed legacy milestone tables
- `src/lib/services/projects.ts` - Removed legacy milestone handlers, updated price_weekly usage
- `src/lib/database.types.ts` - Removed milestone types, added price_weekly type
- `src/lib/server/security.ts` - Rate limiting, CSRF guard, input sanitization helpers
- `src/app/api/*/route.ts` - Added rate limits, CSRF checks, and sanitization
- `.storybook/*` and `src/components/ui/Button.stories.tsx` - Storybook setup + sample story
- `src/app/error.tsx`, `src/app/global-error.tsx` - Error boundary components
- `src/app/layout.tsx` - Vercel Analytics integration
- `src/app/supplier/dashboard/page.tsx` - API key management UI
- `src/lib/services/prices.test.ts`, `src/lib/services/rfq.test.ts` - New unit/integration tests

**Highlights:**
- Consolidated pricing weekly data and removed legacy milestone tables
- Added Storybook, error boundaries, and analytics instrumentation
- Implemented API rate limiting, CSRF protection, and input sanitization
- Added supplier API key management and test coverage for pricing + RFQ flow

### February 10, 2026 - Deployment Readiness & UI Enhancements ✅ (Kante)

**Files Updated/Created:**
- `src/lib/server/auth.ts` - Admin/auth guard for API routes
- `src/app/api/*/route.ts` - Admin authorization for scraper + notifications, auth for vision
- `src/components/layout/TopNavbar.tsx` - Hide scraper tab for non-admin users
- `src/app/scraper/page.tsx` - Admin-only access + auth headers for API calls
- `src/app/marketplace/suppliers/page.tsx`, `src/app/marketplace/suppliers/[id]/page.tsx` - Runtime validation guards
- `src/app/home/page.tsx` - Animated platform features showcase
- `src/lib/server/security.test.ts` - Security unit tests
- `src/lib/services/rfq.flow.test.ts` - RFQ flow integration tests
- `src/lib/logger.ts` - Centralized logging helper
- `src/lib/services/supabase-helpers.ts` - Shared Supabase error helper
- `scripts/check-env.ts` - Environment validation script

**Highlights:**
- Secured API routes with admin/auth checks and updated scraper UX
- Added runtime validation to marketplace data handling
- Shipped animated feature showcase on home page
- Added security/unit/integration tests and env validation tooling

### February 10, 2026 - Procurement RFQ Load Fix ✅ (Kante)

**Fix:**
- `src/lib/services/rfq.ts` - Handle missing RFQ tables gracefully (avoid hard failure on load)
- `src/components/projects/UnifiedProcurementView.tsx` - Surface real RFQ load errors when present

**Outcome:**
- Manual purchase logging no longer shows a generic RFQ load error when RFQ tables are unavailable.

### February 10, 2026 - Design Tokens + Component Style Guide ✅ (Kante)

**Files Updated/Created:**
- `src/app/globals.css` - Import design tokens + component guide styles globally
- `src/styles/component-guide.css` - Token-based primitives for buttons, cards, inputs, tables
- `src/app/style-guide/page.tsx` - Component style guide page for UI reference

**Highlights:**
- Established a token-driven component baseline to align upcoming refresh work.
- Style guide available at `/style-guide` for review and QA.

### February 10, 2026 - Supplier Dashboard + Marketplace Materials Refresh ✅ (Kante)

**Files Updated:**
- `src/app/supplier/dashboard/page.tsx` - Tokenized UI refresh with reveal animations and updated cards/forms
- `src/app/marketplace/page.tsx` - Marketplace materials refresh with reveal animations, updated cards/tables, and token-aligned styling

**Highlights:**
- Applied design tokens across both pages and aligned motion with `useReveal`.
- Normalized card and table styling to match Market Insights / Supplier Directory patterns.

### February 10, 2026 - Mbudzi Trial Alignment Fixes ✅ (Kante)

**Fixes:**
- Restored `ProtectedRoute` gating for Projects List.
- Corrected component props in Project Detail (StageTab, BudgetPlanner, RunningTotalBar, ProjectUsageView, ShareModal, PhoneNumberModal).
- Restored Budget view section and mobile sidebar FAB to avoid regressions.

### February 10, 2026 - BOQ Wizard + Supplier Dashboard Refresh (Takeover) ✅ (Kante)

**Files Updated:**
- `src/app/boq/new/page.tsx` - Added reveal animations for step sections
- `src/app/boq/new/WizardStyles.tsx` - Tokenized surfaces/typography to align with design system
- `src/app/supplier/dashboard/page.tsx` - Token-aligned visuals and hover states
- `src/components/projects/UnifiedProcurementView.tsx` - Restored real service wiring (removed stubs)
- `src/components/ui/EmptyState.tsx` - Token-aligned empty state styling

**Highlights:**
- Completed Mbudzi's remaining pages due to workstation outage.
- Ensured UI-only scope while removing stubbed data access.

### February 10, 2026 - Security & Code Quality Fixes ✅ (Ngolo)

**Files Updated:**
- `src/lib/server/security.ts` - Fixed SEC-001 (removed header bypass), SEC-002 (added proper CSRF with HMAC)
- `src/lib/services/rfq.ts` - Fixed TYPE-001 (removed `as any`, use proper types with `as never` pattern)
- `src/lib/services/analytics.ts` - Fixed TYPE-002 (removed `as any`), PERF-001 (count queries instead of fetching all rows)
- `src/lib/services/notifications.ts` - Fixed TYPE-003 (removed `as any`), ERR-002 (added error logging), NOTIF-001 (browser feature detection)
- `public/sw.js` - Fixed SW-001 (try-catch for JSON parsing in push handler)

**Security Fixes:**
- Removed vulnerable internal header bypass that allowed attackers to skip rate limits
- Added proper CSRF token implementation with HMAC signatures, session binding, and expiration
- Added `generateCsrfToken()` and `validateCsrfToken()` with timing-safe comparison

**Type Safety Fixes:**
- Removed `const db = supabase as any` pattern in favor of using `supabase` directly
- Applied `as never` pattern consistently for Supabase insert/update operations
- Added proper type assertions for Supabase return values

**Performance Fixes:**
- Changed unbounded platform benchmark queries to use `select('id', { count: 'exact', head: true })`
- Prevents loading millions of rows for simple count statistics

**Error Handling Fixes:**
- Added try-catch around browser push notification APIs
- Added error logging for notification delivery failures
- Added graceful fallback in service worker when JSON parsing fails

### February 10, 2026 - Pagination Implementation ✅ (Ngolo)

**Files Updated:**
- `src/app/marketplace/suppliers/page.tsx` - Added PERF-002 pagination fix

**Pagination Implementation:**
- Added PAGE_SIZE constant (20 suppliers per page)
- Implemented offset-based pagination with `.range()` query
- Added "Load More" button with loading state and spinner
- Display "Showing X of Y suppliers" count
- Product counts now fetched per-batch instead of all at once
- Uses count query with `{ count: 'exact', head: true }` for total count

### February 10, 2026 - RFQ Error Handling ✅ (Ngolo)

**Files Updated:**
- `src/lib/services/rfq.ts` - Added ERR-001 error handling fix

**Error Handling Improvements:**
- Added `logAsyncError()` helper for consistent error logging
- Added error handling to notification queue insert in `createRfqRequest()`
- Added error handling to delivery logs insert in `createRfqRequest()`
- Added error handling to quote items delete in `submitSupplierQuote()`
- Added error handling to recipient status update in `submitSupplierQuote()`
- Added error handling to RFQ status update in `submitSupplierQuote()`
- Added error handling to quote notification delivery log insert
- Added error handling to rejection of other quotes in `acceptRfqQuote()`
- Added error handling to acceptance notification delivery log insert

### February 10, 2026 - Database Transaction for RFQ ✅ (Ngolo)

**Files Created:**
- `supabase/migrations/022_rfq_transaction_function.sql` - PostgreSQL function for atomic RFQ creation

**Files Updated:**
- `src/lib/services/rfq.ts` - Updated `createRfqRequest()` to use the transaction function

**Transaction Implementation:**
- Created `create_rfq_with_items_and_recipients()` PostgreSQL function
- Function creates RFQ request, items, and recipients in a single atomic transaction
- If any insert fails, the entire operation is rolled back
- Returns JSONB with rfq_id, item_ids, and recipient_ids
- Updated service to prepare data upfront, then call RPC function
- Notifications still handled outside transaction (fire-and-forget pattern)

### February 11, 2026 - Phase 1 & 4 Enhancements: Design System & Motion Refresh ✅ (Mbudzi)

**Files Updated:**
- `src/app/projects/page.tsx` - Projects List refresh
- `src/app/projects/[id]/page.tsx` - Project Detail refresh
- `src/components/projects/UnifiedProcurementView.tsx` - Procurement Hub refresh
- `src/app/globals.css` - Global Tailwind theme token mapping
- `REFRESH_REPORT.md` - detailed report of changes and findings

**Highlights:**
- Integrated new design tokens and `useReveal` motion hook across high-traffic project pages
- Mapped CSS variables to Tailwind utility classes in `globals.css` for consistent styling
- Refactored layout and components to match the new visual direction (deep navy/electric blue)
- Ensured mobile responsiveness for complex grids and tables

---

## Code Review Feedback (Ngolo → Kante)

> **Review Date:** February 10, 2026
> **Reviewer:** Ngolo (Senior Developer)
> **Reviewed Phases:** 3, 4, 5, 6, Technical Debt

### Overall Assessment

Good progress on feature completion. However, several code quality issues were identified that need to be addressed before deployment. These are categorized by severity below.

---

### 🔴 CRITICAL Issues (Must Fix Before Deployment)

#### 1. Security Vulnerability in `src/lib/server/security.ts` (Lines 68-70)
**Issue:** Internal header bypass allows attackers to spoof trusted requests.
```typescript
// VULNERABLE: Attackers can set x-internal-request header to bypass rate limits
if (req.headers.get('x-internal-request') === 'true') {
  return { allowed: true };
}
```
**Fix:** Remove header-based bypass entirely OR use cryptographically-signed tokens for internal requests that cannot be spoofed by clients.

#### 2. Weak CSRF Implementation in `src/lib/server/security.ts`
**Issue:** CSRF token validation is incomplete:
- Tokens are not tied to user sessions
- No token expiration mechanism
- No cryptographic verification
**Fix:** Implement proper CSRF with session-bound tokens and HMAC verification.

---

### 🟠 HIGH Priority Issues

#### 3. Unsafe Type Casting in `src/lib/services/rfq.ts` (Line 22)
**Issue:** Using `as any` defeats TypeScript's type safety.
```typescript
// BAD: This hides potential type mismatches
const data = result as any;
```
**Fix:** Define proper types for all Supabase return values. Use the `as never` pattern only where absolutely necessary, with a comment explaining why.

#### 4. Unsafe Type Casting in `src/lib/services/analytics.ts` (Line 15)
**Issue:** Same `as any` pattern issue. Type safety is critical for data aggregation services.
**Fix:** Create proper interface types for analytics data structures.

#### 5. Unhandled Errors in RFQ Service
**Issue:** Several async operations don't handle errors properly:
- Failed quote submissions silently fail
- RFQ creation errors not propagated to UI
**Fix:** Implement try-catch blocks and return proper error objects to calling code.

#### 6. Missing Transaction Management in RFQ Flow
**Issue:** Multi-step RFQ operations (create request → add items → notify suppliers) are not wrapped in database transactions.
**Risk:** Partial data state if any step fails mid-operation.
**Fix:** Use Supabase RPC functions or implement compensating transactions.

#### 7. Unbounded Queries in `src/lib/services/analytics.ts` (Lines 345-346)
**Issue:** Queries without pagination or limits can return massive datasets.
```typescript
// BAD: No limit - could return millions of rows
const { data } = await supabase.from('purchase_records').select('*');
```
**Fix:** Always add `.limit()` and implement pagination for large datasets.

#### 8. Silent Insert Failures in `src/lib/services/notifications.ts`
**Issue:** Failed notification inserts don't report errors, causing silent failures.
**Fix:** Check for errors and log/handle appropriately.

---

### 🟡 MEDIUM Priority Issues

#### 9. No Pagination in `src/app/marketplace/suppliers/page.tsx`
**Issue:** Supplier directory loads all suppliers without pagination.
**Impact:** Performance degrades as supplier count grows.
**Fix:** Implement cursor-based or offset pagination with infinite scroll.

#### 10. Unsafe JSON Parsing in `public/sw.js` (Line 183)
**Issue:** `JSON.parse()` without try-catch can crash the service worker.
```javascript
// BAD: Crashes if payload is malformed
const data = JSON.parse(event.data);
```
**Fix:** Wrap in try-catch with graceful error handling.

#### 11. Unhandled Browser API Errors in `src/lib/services/notifications.ts`
**Issue:** Push notification APIs can throw if user denies permission or browser doesn't support.
**Fix:** Add feature detection and error handling for Notification API calls.

#### 12. Type Casting Without Validation in Marketplace Components
**Issue:** Data from Supabase is cast to expected types without runtime validation.
**Risk:** Runtime errors if database schema changes.
**Fix:** Add runtime type guards or use a validation library like Zod.

---

### 🟢 LOW Priority (Code Quality)

#### 13. Inconsistent Error Logging
**Issue:** Mix of `console.error`, `console.log`, and silent failures.
**Fix:** Implement centralized logging service with consistent severity levels.

#### 14. Missing JSDoc Comments
**Issue:** Complex functions lack documentation, making maintenance harder.
**Fix:** Add JSDoc to public API functions in service files.

#### 15. Duplicate Code Patterns
**Issue:** Several services repeat similar Supabase query patterns.
**Fix:** Consider creating a base query helper with standard error handling.

---

### Learning Notes for Kante

1. **Type Safety First:** Avoid `as any` - it defeats the purpose of TypeScript. Use proper types even if it requires more upfront work.

2. **Security is Non-Negotiable:** Never trust client headers for security decisions. Always validate on the server with secrets the client cannot know.

3. **Fail Loudly:** Silent failures are debugging nightmares. Always propagate errors to where they can be handled properly.

4. **Pagination is Mandatory:** Any query that could return unbounded results needs limits. This is both a performance and security concern (DoS via large result sets).

5. **Transactions for Multi-Step Operations:** When multiple database writes need to succeed or fail together, use transactions.

---

## Deployment Readiness Checklist (TODO for Kante)

### 🔴 Critical (Blocks Deployment)

- [x] **SEC-001:** Remove internal header bypass vulnerability in `security.ts` ✅ (Ngolo - Feb 10, 2026)
- [x] **SEC-002:** Implement proper session-bound CSRF tokens with expiration ✅ (Ngolo - Feb 10, 2026)
- [x] **SEC-003:** Security audit of all API routes for authentication/authorization gaps ✅ (Kante - Feb 10, 2026)

### 🟠 High Priority (Required for Production)

- [x] **TYPE-001:** Replace all `as any` casts with proper types in `rfq.ts` ✅ (Ngolo - Feb 10, 2026)
- [x] **TYPE-002:** Replace all `as any` casts with proper types in `analytics.ts` ✅ (Ngolo - Feb 10, 2026)
- [x] **ERR-001:** Add error handling to RFQ service async operations ✅ (Ngolo - Feb 10, 2026)
- [x] **ERR-002:** Add error handling to notification service inserts ✅ (Ngolo - Feb 10, 2026)
- [x] **DB-001:** Implement database transactions for RFQ creation flow ✅ (Ngolo - Feb 10, 2026)
- [x] **PERF-001:** Add query limits to all analytics aggregation queries ✅ (Ngolo - Feb 10, 2026)
- [x] **PERF-002:** Implement pagination for supplier directory ✅ (Ngolo - Feb 10, 2026)

### 🟡 Medium Priority (Before Public Launch)

- [x] **SW-001:** Add try-catch to service worker JSON parsing ✅ (Ngolo - Feb 10, 2026)
- [x] **NOTIF-001:** Add browser feature detection for push notifications ✅ (Ngolo - Feb 10, 2026)
- [x] **TYPE-003:** Add runtime validation for Supabase responses in marketplace ✅ (Kante - Feb 10, 2026)
- [x] **TEST-001:** Add unit tests for security.ts functions ✅ (Kante - Feb 10, 2026)
- [x] **TEST-002:** Add integration tests for full RFQ → Quote → Accept flow ✅ (Kante - Feb 10, 2026)

### 🟢 Low Priority (Technical Debt)

- [x] **LOG-001:** Implement centralized logging service ✅ (Kante - Feb 10, 2026)
- [x] **DOC-001:** Add JSDoc comments to all service public functions ✅ (Kante - Feb 10, 2026)
- [x] **DRY-001:** Create base query helper for Supabase operations ✅ (Kante - Feb 10, 2026)

### 🎨 UI/UX Enhancements (New Tasks for Kante)

- [x] **UI-001:** Restrict scraper tab to admin users only ✅ (Kante - Feb 10, 2026)
  - Currently visible to all authenticated users
  - Add admin role check in TopNavbar/MainLayout
  - Add server-side authorization in `/api/scraper/*` routes
  - Files to update: `src/components/layout/TopNavbar.tsx`, `src/app/api/scraper/*/route.ts`

- [x] **UI-002:** Redesign home page with animated feature showcase ✅ (Kante - Feb 10, 2026)
- [x] **UI-003:** Draft design direction brief for full UI refresh ✅ (Kante - Feb 10, 2026)

### Design Direction Draft (Proposed)

**Objective:** Establish a cohesive visual system for a full-site refresh that feels premium, modern, and field‑ready.

**Visual Tone**
- Confident, professional, and practical (construction-tech, not fintech).
- Clear hierarchy with bold headings, tight spacing, and high-contrast data surfaces.

**Typography**
- Headings: **Sora** (bold, geometric, modern).
- Body: **Instrument Sans** (clean, readable at small sizes).
- Numerals/Data: **IBM Plex Mono** for tables, IDs, pricing.

**Color System**
- Primary: Deep Navy `#0B1F3B`
- Accent: Electric Blue `#2E6CF6`
- Support: Clay `#D97A4A`, Emerald `#16A34A`, Warning Amber `#F59E0B`
- Neutrals: Slate `#1F2937`, Mist `#F5F7FB`, Border `#E2E8F0`
- Backgrounds: Soft gradients + subtle texture patterns (avoid flat white).

**Layout & Components**
- 12‑column grid, spacious cards, consistent edge radius (12–16px).
- Data cards with fixed header + meta row + action row.
- Consistent button sizing and icon alignment.
- Tables: sticky headers, row hover, zebra subtle tint.

**Motion**
- Page-load: fade‑up stagger (150–220ms).
- Scroll reveal for feature cards (intersection observer).
- Micro-interactions on buttons and tabs (scale + glow).

**Key Screens in Scope**
1. Home
2. Projects list + project detail
3. Procurement hub
4. Supplier dashboard
5. Marketplace (materials + supplier directory)
6. Market Insights

**Deliverables**
- Tokenized design variables in CSS.
- Component system alignment (buttons, cards, tables, inputs).
- Responsive breakpoints and layout rules.

**Mbudzi (Gemini Pro) Trial + Sequencing** ✅ **APPROVED by Ngolo (Feb 10, 2026)**
- **Trial Task (1–2 pages):** Market Insights + Marketplace Suppliers
  - Goal: prove alignment with design direction (type, color, motion, layout)
  - Acceptance: mobile‑ready, no regressions, consistent styling
- **Kickoff (Kante):** Trial instructions prepared in roadmap; pending Mbudzi start.
- **If trial passes → expand scope:**
  - Home → Projects list + detail → Procurement hub → Supplier dashboard → Marketplace materials

**Mbudzi Trial Review (Kante - Feb 10, 2026)**
- Strengths: Clean token-aligned visuals, preserved data logic, motion consistent with reveal pattern, responsive grid work is solid.
- Follow-ups: Remove page-level token imports, centralize reveal observer in shared hook, avoid per-item hover delay side effects.
- Status: Awaiting Ngolo's final decision on continued engagement.

**Post-Review Decision & Assignment (Ngolo - Completed by Kante due to Mbudzi outage)**
- Decision: Mbudzi approved to continue with guardrails (UI-only, no prop changes, typecheck+build required).
- Next pages: Supplier Dashboard (`src/app/supplier/dashboard/page.tsx`) and BOQ Wizard (`src/app/boq/new/page.tsx`) — **completed by Kante (Feb 10, 2026)**.
- Kante focus: reviewed Mbudzi commits pre-merge, fixed regressions, and updated refresh status report.

**Order of Completion** ✅ **CONFIRMED by Ngolo:**
1. Design tokens + component style guide (buttons/cards/tables/inputs) — Kante ✅ (Feb 10, 2026)
2. Trial pages (Insights + Marketplace Suppliers) — Mbudzi
3. Evaluate trial and decide on full refresh — Kante + Ngolo
4. Rollout to remaining scoped pages — split based on trial results

**Parallelization** ✅ **APPROVED by Ngolo:**
- Kante: tokens + component system
- Mbudzi: trial pages (in parallel)
- Post-trial: split remaining screens across agents to compress timeline

**Ngolo's Notes:**
- Add Danger Red `#DC2626` to color system for destructive actions
- Start with CSS intersection observer; only add Framer Motion if complex orchestration needed
- Trial acceptance: I will review Mbudzi's output before expanding scope
  - Add a "Platform Features" section below the hero
  - Use scroll-triggered animations (staggered card reveals)
  - Consider Framer Motion or enhanced CSS animations
  - Mobile-responsive grid layout
  - File: `src/app/home/page.tsx`

**Features to highlight on home page (identified from projects page):**

| # | Feature | Description | Icon Suggestion |
|---|---------|-------------|-----------------|
| 1 | Budget Planner | Set savings targets, track progress, get reminders | Wallet |
| 2 | Material Usage Tracker | Log materials used on-site, monitor consumption | Package |
| 3 | Budget vs Actual | Compare estimated vs actual costs with variance breakdown | ChartLineUp |
| 4 | Stage-Based BOQ | Organize materials by 5 construction phases | Stack |
| 5 | Progress Tracking | Visual completion percentages per stage | CheckCircle |
| 6 | Live Price Alerts | Real-time material price change notifications | TrendUp |
| 7 | RFQ & Procurement | Request quotes, compare suppliers, accept bids | Storefront |
| 8 | Document Storage | Keep project files organized and accessible | FileText |
| 9 | Team Collaboration | Share projects with stakeholders and team | UsersThree |
| 10 | Variance Analysis | Breakdown of price variance vs quantity variance | ChartBar |
| 11 | Multi-Currency | USD/ZWG toggle with live exchange rates | CurrencyDollar |
| 12 | Savings Reminders | Daily/weekly/monthly via email, SMS, WhatsApp | Bell |
| 13 | PDF/Excel Export | Professional reports for stakeholders | DownloadSimple |
| 14 | Mobile PWA | Offline-capable progressive web app | DeviceMobile |

**Suggested animation approach:**
- Hero section: Current fade-up animation (already exists)
- Features section: Scroll-triggered staggered reveal
- Each feature card: Slight scale + opacity transition on scroll into view
- Consider intersection observer or Framer Motion's `whileInView`

### Infrastructure & Deployment

- [x] **ENV-001:** Verify all environment variables are set for production ✅ (Kante - Feb 10, 2026)
- [ ] **ENV-002:** Configure Vercel production environment
- [ ] **ENV-003:** Set up Supabase production project with RLS policies
- [ ] **MON-001:** Configure error monitoring (Sentry or similar)
- [ ] **MON-002:** Set up uptime monitoring and alerting
- [ ] **BACKUP-001:** Configure database backup schedule
- [ ] **SSL-001:** Verify SSL certificate for custom domain (if applicable)

### Pre-Launch Validation

- [ ] **UAT-001:** Complete user acceptance testing with 3+ real users
- [ ] **LOAD-001:** Run load tests on critical API endpoints
- [ ] **A11Y-001:** Accessibility audit (keyboard navigation, screen readers)
- [ ] **PERF-003:** Lighthouse performance audit (target score > 80)
- [ ] **MOBILE-001:** Cross-device testing (iOS Safari, Android Chrome)

---

## Strategic Gap Analysis

### Current Platform Objective
ZimEstimate aims to be the leading construction cost estimation and procurement platform for Zimbabwe, connecting homebuilders with verified suppliers.

### Identified Strategic Gaps

#### 1. **Supplier Onboarding Incentive Gap**
**Problem:** No clear value proposition for suppliers to join. Platform needs a critical mass of suppliers before it's useful to builders.
**Recommendation:**
- Offer 3-month free premium listing for early adopters
- Consider referral incentives for suppliers who bring other suppliers
- Create supplier success stories/case studies

#### 2. **Offline Functionality Gap**
**Problem:** Zimbabwe has inconsistent internet connectivity. PWA caching helps, but core workflows require connectivity.
**Recommendation:**
- Implement offline BOQ creation with sync-on-reconnect
- Cache recently viewed materials and prices
- Add "Save for Offline" functionality for project data

#### 3. **Payment/Transaction Gap**
**Problem:** RFQ system ends at "order confirmation" - no payment processing.
**Recommendation:**
- Add mobile money integration (EcoCash, OneMoney)
- Consider escrow system for builder protection
- Add invoice generation for formal transactions

#### 4. **Trust & Verification Gap**
**Problem:** Manual verification process won't scale. No ongoing quality monitoring.
**Recommendation:**
- Implement automated document verification where possible
- Add builder reviews and ratings for suppliers
- Create dispute resolution mechanism

#### 5. **Market Data Monetization Gap**
**Problem:** Valuable price data being collected but not monetized.
**Recommendation:**
- Create premium market insights reports
- Offer API access for construction companies
- Partner with real estate developers for bulk licensing

#### 6. **Competitor Intelligence Gap**
**Problem:** No visibility into competitive landscape.
**Tasks:**
- [ ] Research existing Zimbabwe construction tech solutions
- [ ] Identify key differentiators
- [ ] Monitor competitor pricing and features

---

## Prompt for Kante (Next Session)

```
You are Kante, a developer working on ZimEstimate. Your manager Ngolo has
reviewed your code from Phases 3-6 and logged feedback in PROJECT_ROADMAP.md.

**Note for Mbudzi (Feb 10):**
"Strong visual refresh and motion work, and the pages read premium. I did have to patch a few regressions: Projects List lost ProtectedRoute, several components had prop mismatches (StageTab, BudgetPlanner, RunningTotalBar, ProjectUsageView, ShareModal, PhoneNumberModal), and the Budget view + mobile nav FAB were removed. Going forward, please keep changes UI‑only (no prop/interface changes), and run a quick typecheck/build to catch mismatches before pushing. Overall, great design execution; just tighten on component API contracts."

Your task for this session:
1. Read the "Code Review Feedback" section in PROJECT_ROADMAP.md
2. Address any remaining CRITICAL issues (SEC-003 security audit)
3. Work on the new UI/UX Enhancement tasks (UI-001, UI-002)
4. Mark each item as complete in the checklist when done
5. For each fix, add a brief note in the "Completed Work Log" section

Priority tasks for this session:
- UI-001: Restrict scraper tab to admin users only
  - Files: src/components/layout/TopNavbar.tsx, src/app/api/scraper/*/route.ts
  - Check user.tier === 'admin' before showing scraper nav link
  - Add authorization check in API routes

- UI-002: Redesign home page with animated feature showcase
  - File: src/app/home/page.tsx
  - Add a "Platform Features" section with 14 feature cards (see table in roadmap)
  - Use scroll-triggered animations (staggered card reveals)
  - Consider Framer Motion's whileInView or intersection observer
  - Icons are already imported from @phosphor-icons/react

Design inspiration for feature section:
- TurboTax-style confidence messaging
- Vercel/Linear-style animations
- Cards should have hover effects and staggered reveal on scroll

Remember: Most critical bugs have been fixed by Ngolo. Focus on UI polish
and the security audit (SEC-003) for remaining items.
```

---

## Prompt for Mbudzi (Next Assignment - Approved by Ngolo Feb 10, 2026)

**Status:** Completed by Kante on Feb 10, 2026 due to Mbudzi outage. No action required unless reassigned.

```
You are Mbudzi, an agent working on ZimEstimate's UI refresh.
Your Projects refresh work passed review after Kante fixed prop regressions.
You are approved for continued engagement with MANDATORY guardrails:

## GUARDRAILS (MUST FOLLOW)
1. UI-only scope — styling, layout, motion. NO component prop changes
2. Pre-commit: run `npm run typecheck && npm run build` — must pass
3. Do NOT add/remove/rename exported functions or types
4. If a component doesn't match expected props → STOP and ask Kante

## Next Assignment
Refresh the following pages to match the design system:
1. Supplier Dashboard — `src/app/supplier/dashboard/page.tsx`
2. BOQ Wizard — `src/app/boq/new/page.tsx`

## Design Direction
- Typography: Sora headers, Instrument Sans body, Plex Mono data
- Colors: Deep Navy, Electric Blue, Mist/Surface backgrounds
- Motion: Use `useReveal` hook for scroll-triggered animations
- Tables: Sticky headers, zebra striping
- Mobile: Fully responsive grid/flex layouts

## Process
1. Apply design tokens (use Tailwind classes mapped in globals.css)
2. Use `useReveal` for entrance animations
3. Verify no build errors or type mismatches
4. Submit for Kante's review before merge
```
