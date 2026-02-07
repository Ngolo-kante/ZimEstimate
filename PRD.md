# ZimEstimate - Product Requirements Document

> **Last Updated:** February 2026
> **Status:** Active Development

---

## Overview

ZimEstimate is a construction cost estimation and project management tool for the Zimbabwean market. It helps homebuilders create Bills of Quantities (BOQ), track material purchases, plan budgets, and manage construction projects.

---

## Core Features

### 1. Bill of Quantities (BOQ) Builder
- **Manual Builder** (`/boq/new?method=manual`) - Add materials manually
- **AI Vision Takeoff** (`/ai/vision-takeoff`) - Upload floor plans, AI extracts measurements

### 2. Project Management (`/projects/[id]`)
- **BOQ Tab** - View/edit bill of quantities
- **Tracking Tab** - Mark items as purchased, track actual vs budgeted costs
- **Documents Tab** - Upload plans, permits, receipts, photos
- **Planning Tab** - Milestones, tasks, timelines, savings calculator
- **Usage Tab** - Dedicated page to log material usage by day/week; builder cadence reminders
- **Procurement Tab** - Request supplier quotations and track procurement status

### 3. Dashboard (`/dashboard`)
- Project overview cards
- Quick stats and progress indicators

### 4. Marketplace (`/marketplace`)
- Browse suppliers and materials
- Price comparisons

---

## Architecture Decisions

### Currency & Pricing
| Decision | Implementation |
|----------|----------------|
| Dual currency storage | `price_usd` + `price_zwg` columns on all price fields |
| User toggle | Display preference stored in profile |
| Exchange rates | `exchange_rates` table with daily rates |
| Price updates | `weekly_prices` stores scraped averages keyed by material code; BOQ prompts to update averages for unpurchased items |
| Price disclaimer | BOQ banner notes prices are estimates/averages; verify with suppliers |

### Project Ownership & Sharing
| Decision | Implementation |
|----------|----------------|
| Single owner model | `owner_id` on projects table |
| View-only sharing | `project_shares` table with `access_level: 'view' | 'edit'` |
| Invite by email | Share modal sends invites, links to user when they sign up |

### Progress Tracking
| Decision | Implementation |
|----------|----------------|
| Auto-calculate progress | Compare `actual_quantity` vs `quantity` on BOQ items |
| Manual override | `is_purchased` boolean flag |
| Usage tracking | `material_usage` table for on-site consumption |
| Usage reminders | One active usage reminder per project + builder, cadence set by builder |
| Owner notifications | Owner receives app notifications when usage logs are updated |

### Reminder System
| Decision | Implementation |
|----------|----------------|
| Recurring savings reminder | One active reminder per project with on/off toggle |
| Stop condition | Reminders stop at the target purchase date |
| Recipient | Reminders sent to builder only |
| Channel selection | Email/SMS/WhatsApp/Telegram with phone requirement for mobile channels |

### Offline Support
| Decision | Implementation |
|----------|----------------|
| Read-only offline | Service worker caches viewed data |
| Edits require connection | Sync when back online |

---

## Database Schema

### Core Tables
```
profiles          - User accounts and preferences
projects          - Construction projects
boq_items         - Bill of quantities line items
materials         - Master materials catalog
suppliers         - Supplier directory
exchange_rates    - Currency conversion rates
```

### Enhancement Tables (Migration 004)
```
project_documents  - Uploaded files (plans, permits, receipts)
project_milestones - Project phases with target dates
milestone_tasks    - Checklist items within milestones
material_usage     - Track materials consumed on-site
```

### Additional Tables (Migration 011)
```
project_recurring_reminders - Recurring reminder settings per project/user
project_notifications       - Owner notifications for usage/procurement updates
procurement_requests        - RFQs and supplier request tracking
```

### Key Project Columns
```sql
-- Timeline fields
start_date              DATE    -- Construction start
target_completion_date  DATE    -- Project finish goal
target_purchase_date    DATE    -- Materials purchase deadline

-- Budget fields
budget_target_usd       DECIMAL -- Total budget goal
total_usd              DECIMAL -- Calculated total from BOQ
total_zwg              DECIMAL -- ZWG equivalent

-- Settings
savings_frequency       TEXT    -- 'weekly' | 'monthly' | 'quarterly'
scope                  TEXT    -- 'entire_house' | 'substructure' | etc.
labor_preference       TEXT    -- 'materials_only' | 'with_labor'
```

### BOQ Item Tracking Fields
```sql
quantity           DECIMAL  -- Planned quantity
actual_quantity    DECIMAL  -- What was purchased
unit_price_usd     DECIMAL  -- Estimated price
actual_price_usd   DECIMAL  -- What was paid
is_purchased       BOOLEAN  -- Purchase status
purchased_date     DATE     -- When bought
```

---

## UI/UX Decisions

### Design System (Benti)
| Element | Value |
|---------|-------|
| Primary accent | `#4E9AF7` (blue) |
| Navy background | `#06142F` |
| Cards | `bg-white rounded-xl shadow-sm border` |
| Icons | Phosphor Icons (React) |
| Font weights | `font-medium` for tables (not bold) |

### Component Patterns
| Pattern | Decision |
|---------|----------|
| Action buttons | Dropdown menus for multiple options (Share, Export) |
| Tables | Clean, no decorative icons in dense views |
| Date fields | Show "X days remaining" badges with color coding |
| Success feedback | Confetti animation on purchase completion |
| Auto-refresh | Window focus + 30-second interval on project lists |

### Multi-Select Behavior
| Field | Constraint |
|-------|------------|
| Project Scope | Selecting "Full House" disables other options |
| Wall Materials | Multiple selections allowed |
| Cement Type | Multiple selections allowed |

### Export Options
| Format | Use Case |
|--------|----------|
| PDF | Professional sharing |
| CSV | Excel import |
| TXT | Word import |
| WhatsApp | Quick mobile share |
| Email | Formal sharing |
| SMS | Basic mobile share |

---

## Feature Implementation Status

### Completed ✅
- [x] Manual BOQ Builder with material selection
- [x] AI Vision Takeoff with Gemini integration
- [x] Project list with auto-refresh
- [x] Purchase tracking with confetti celebration
- [x] Documents upload and management
- [x] Planning tab with milestones and tasks
- [x] Savings calculator (weekly/monthly/quarterly)
- [x] Timelines card (start, purchase, completion dates)
- [x] Usage tracking for materials
- [x] Usage reminders (builder cadence) + owner notifications
- [x] Share/Export dropdown menus
- [x] Multi-select for vision takeoff config
- [x] Procurement hub (RFQ creation + status tracking)

### In Progress 🔄
- [ ] Email invite system for sharing
- [ ] WhatsApp reminders integration
- [ ] Offline mode improvements

### Planned 📋
- [ ] Supplier price scraping
- [ ] Price alerts
- [ ] Report generation
- [ ] Mobile app (PWA improvements)
- [ ] Procurement hub enhancements (supplier comparisons, quote analysis)

---

## Version 2 (Planned)

- Progress photo uploads and timeline view (builder uploads, owner visibility)

---

## Implementation Plan (Feb 2026)

- [x] Extend BOQ tables with actual qty, variance columns, and column filters
- [x] Add recurring project reminders + phone number capture modal
- [x] Add dedicated usage page with builder reminders and owner notifications
- [x] Add procurement hub for RFQs and status tracking
- [x] Connect notifications page to `project_notifications`
- [x] Apply migration `011_project_reminders_usage_procurement.sql` in Supabase
- [x] Add price update pipeline (weekly_prices material codes, BOQ banner + notifications)
- [x] Improve scraper admin (run all + category filters)
- [ ] Apply migration `012_price_updates_and_scraper_categories.sql` in Supabase

---

## API & Services

### External APIs
| Service | Purpose | Notes |
|---------|---------|-------|
| Google Gemini | Floor plan analysis | Free tier has rate limits |
| Supabase | Database, Auth, Storage | Primary backend |

### Service Functions (`src/lib/services/projects.ts`)
```typescript
// Projects
getProjects()
getProject(id)
createProject(data)
updateProject(id, data)
deleteProject(id)

// BOQ Items
getBOQItems(projectId)
createBOQItem(data)
updateBOQItem(id, data)
deleteBOQItem(id)

// Documents
uploadDocument(projectId, file, category)
getProjectDocuments(projectId)
deleteDocument(id)

// Milestones & Tasks
getMilestones(projectId)
createMilestone(data)
updateMilestone(id, data)
deleteMilestone(id)
createTask(milestoneId, title)
toggleTask(taskId, completed)

// Usage Tracking
recordUsage(boqItemId, quantity, date, notes)
getUsageHistory(projectId)
getTotalUsageByItem(projectId)

// Sharing
shareProject(projectId, email, accessLevel)
getProjectShares(projectId)
removeShare(shareId)
```

---

## File Structure

```
src/
├── app/
│   ├── ai/
│   │   └── vision-takeoff/     # AI floor plan analysis
│   ├── boq/
│   │   └── new/                # Manual BOQ builder
│   ├── projects/
│   │   └── [id]/               # Project detail page
│   ├── dashboard/
│   ├── marketplace/
│   └── auth/
├── components/
│   ├── ui/                     # Reusable components
│   ├── projects/               # Project-specific components
│   │   ├── DocumentsTab.tsx
│   │   ├── PlanningTab.tsx
│   │   ├── UsageTab.tsx
│   │   ├── SavingsCalculator.tsx
│   │   └── ShareModal.tsx
│   └── vision-takeoff/         # Vision takeoff steps
├── lib/
│   ├── services/
│   │   └── projects.ts         # All Supabase operations
│   ├── calculations/
│   │   └── index.ts            # BOQ calculations
│   ├── supabase/
│   │   └── client.ts           # Supabase client
│   └── database.types.ts       # TypeScript types
└── styles/
    └── globals.css             # Global styles + animations
```

---

## Migrations

| File | Description | Status |
|------|-------------|--------|
| `001_initial.sql` | Core tables (profiles, projects, boq_items) | ✅ Applied |
| `002_materials.sql` | Materials and suppliers | ✅ Applied |
| `003_fix_rls_recursion.sql` | RLS policy fixes | ✅ Applied |
| `004_project_enhancements.sql` | Documents, milestones, usage | ✅ Applied |
| `005_add_project_dates.sql` | start_date, target_purchase_date | ⏳ Pending |
| `011_project_reminders_usage_procurement.sql` | Recurring reminders, notifications, procurement | ✅ Applied |
| `012_price_updates_and_scraper_categories.sql` | Weekly price matching + scraper categories | ⏳ Pending |

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GOOGLE_GEMINI_API_KEY=your_gemini_key
```

---

## Testing URLs

| Feature | URL |
|---------|-----|
| Home | http://localhost:3000 |
| Dashboard | http://localhost:3000/dashboard |
| Manual BOQ | http://localhost:3000/boq/new?method=manual |
| Vision Takeoff | http://localhost:3000/ai/vision-takeoff |
| Projects List | http://localhost:3000/projects |
| Project Detail | http://localhost:3000/projects/[id] |

---

## Known Issues & Workarounds

| Issue | Workaround |
|-------|------------|
| Gemini API rate limits | Falls back to demo mode with sample data |
| Missing icon-144x144.png | Non-blocking 404, can be ignored |
| RLS recursion on project_shares | Use SECURITY DEFINER functions |

---

## For New Developers/Agents

1. **Read LESSONS.md** - Contains coding patterns and common mistakes
2. **Check migration status** - Run pending migrations before testing
3. **Use TypeScript strictly** - No `any` types, fix all errors
4. **Follow existing patterns** - Check similar components before creating new ones
5. **Test in browser** - Dev server at http://localhost:3000
6. **Supabase dashboard** - Check data and run SQL at your Supabase project URL
