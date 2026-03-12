# BOQ Wizard Refactor Roadmap

## Overview

Refactor the manual builder wizard from a step-based wizard to a **live estimator** with a scrollable form on the left and a sticky estimate panel on the right. This addresses cognitive overload, step fragmentation, and several implementation bugs.

**Branch Name:** `feat/boq-live-estimator-refactor`

**Base Branch:** `unified`

---

## Phase 1: Critical Bug Fixes (P0)

### 1.1 Fix Scope State Mismatch

**Problem:** The codebase uses `entire` internally but some UI logic expects `full`. This causes scope cards to appear unselected.

**Files to check/modify:**
- `src/store/boqWizardStore.ts`
- `src/app/boq/new/components/steps/ScopeAndLaborStep.tsx`
- `src/hooks/useProjectAutoSave.ts`

**Action:**
- Audit all uses of `projectScope`
- Standardize on `'entire' | 'stage'` as the only valid values
- Ensure the store, UI, and save logic all use the same values
- Remove any references to `'full'` if they exist

### 1.2 Remove Step 2.5 Decimal Hack

**Problem:** The old wizard used `currentStep = 2.5` for detailed room mode, which breaks step mapping.

**Files to check:**
- `src/app/boq/new/page.tsx` (already refactored, verify no remnants)
- Any step-related utilities

**Action:**
- Confirm the new architecture has no numeric step tracking
- If any step tracking is needed (analytics, URL state), use string IDs:
  ```ts
  type SectionId = 'project' | 'geometry' | 'scope' | 'site_setup' | 'review';
  ```

---

## Phase 2: Architecture Changes (P1)

### 2.1 Implement LiveEstimatorLayout Component

**File:** `src/app/boq/new/components/LiveEstimatorLayout.tsx`

**Requirements:**
- Split-screen layout: 60% left (form), 40% right (estimate panel)
- Left side scrollable, right side sticky
- On mobile (<1024px): stack vertically with estimate as a collapsible bottom sheet
- Accept `leftControls` and `rightEstimate` as render props

**Skeleton:**
```tsx
interface LiveEstimatorLayoutProps {
  leftControls: React.ReactNode;
  rightEstimate: React.ReactNode;
}

export default function LiveEstimatorLayout({ leftControls, rightEstimate }: LiveEstimatorLayoutProps) {
  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
      <div className="lg:grid lg:grid-cols-[1fr,420px] lg:gap-8">
        {/* Left: Scrollable Form */}
        <div className="py-8">
          {leftControls}
        </div>

        {/* Right: Sticky Estimate */}
        <div className="hidden lg:block">
          <div className="sticky top-24 py-8">
            {rightEstimate}
          </div>
        </div>
      </div>

      {/* Mobile: Bottom Sheet */}
      <MobileEstimateBar className="lg:hidden" />
    </div>
  );
}
```

### 2.2 Create Section Components

Replace step components with section components. Each section is a collapsible card in the scrollable form.

**Files to create:**
- `src/app/boq/new/components/sections/ProjectLocationSection.tsx`
- `src/app/boq/new/components/sections/BuildingDesignSection.tsx`
- `src/app/boq/new/components/sections/MaterialsSection.tsx`
- `src/app/boq/new/components/sections/ScopeSection.tsx`
- `src/app/boq/new/components/sections/LaborSection.tsx`
- `src/app/boq/new/components/sections/SiteSetupSection.tsx`
- `src/app/boq/new/components/sections/SiteConditionsSection.tsx`

**Each section should:**
- Be a self-contained card with a header and content
- Read/write state from the Zustand store (`useBoqWizardStore`)
- Trigger live estimate recalculation on any field change
- Show inline validation errors (not blocking)
- Have optional "collapsed" state for progressive disclosure

**Section Template:**
```tsx
'use client';

import { useBoqWizardStore } from '@/store/boqWizardStore';

export default function ProjectLocationSection() {
  const { projectDetails, updateProjectDetails } = useBoqWizardStore();

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">Project & Location</h2>
        <p className="text-sm text-slate-500 mt-1">Name your project and set the location for pricing.</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Form fields here */}
      </div>
    </section>
  );
}
```

### 2.3 Implement BuildingDesignSection with Mode Choice

**Critical:** The floor area field should only be required if "Quick Entry" mode is selected. If "Draw Rooms" mode is selected, area is derived from the room builder.

**File:** `src/app/boq/new/components/sections/BuildingDesignSection.tsx`

**Requirements:**
- First choice: "Quick Entry" vs "Draw Floor Plan" (radio/toggle)
- If Quick Entry:
  - Show floor area input (required)
  - Show building type selector
  - Show wall height input
  - Show openings (windows/doors) as collapsible "Optional"
- If Draw Floor Plan:
  - Show "Launch Floor Plan Editor" button
  - Display calculated area from rooms (read-only)
  - Store rooms in Zustand

**Store additions needed:**
```ts
// In boqWizardStore.ts
geometryMode: 'quick' | 'detailed';
setGeometryMode: (mode: 'quick' | 'detailed') => void;
detailedRooms: RoomInstance[];
setDetailedRooms: (rooms: RoomInstance[]) => void;
```

### 2.4 Implement LiveEstimatePanel

**File:** `src/app/boq/new/components/LiveEstimatePanel.tsx`

**Requirements:**
- Show total estimate (USD and ZWG)
- Currency toggle
- Cost breakdown by category (collapsible)
- Estimate health score with progress bar
- Missing items warnings
- "View Full BOQ" button (navigates to `/boq/new/review` or expands inline)
- Export and Share buttons

**Data sources:**
- `milestonesState` from store for totals
- `calculateBoqHealth()` from `@/lib/boqHealth`
- `useCurrency()` hook for formatting

### 2.5 Implement MobileEstimateBar

**File:** `src/app/boq/new/components/MobileEstimateBar.tsx`

**Requirements:**
- Fixed bottom bar on mobile (below 1024px)
- Shows: Total estimate, Health %, "View Details" button
- Tapping expands to a bottom sheet with full breakdown
- Must not conflict with MainLayout's mobile nav

**Action on MainLayout:**
- Add `hideBottomNav` prop to `MainLayout` component
- When true, suppress the mobile navigation bar
- Use this prop on the BOQ page: `<MainLayout fullWidth hideBottomNav>`

### 2.6 Fix Mobile Navigation Conflict

**File:** `src/components/layout/MainLayout.tsx`

**Add prop:**
```tsx
interface MainLayoutProps {
  // existing props...
  hideBottomNav?: boolean;
}
```

**In render:**
```tsx
{!hideBottomNav && <MobileNavBar />}
```

---

## Phase 3: Final Review Screen (P1)

### 3.1 Create Tabbed Review Interface

**File:** `src/app/boq/new/components/ReviewTabs.tsx` (or integrate into page)

**Requirements:**
- Three tabs: "BOQ & Pricing" | "Site Compliance" | "Documents"
- Tab 1 (Primary): Full BOQ table with editable quantities, milestone accordions, totals
- Tab 2: Pre-construction checklist, certificate tracker
- Tab 3: Geotech upload, other documents

**This separates concerns** that were previously all on one overloaded screen.

### 3.2 BOQ Table Component

**File:** `src/app/boq/new/components/BOQTable.tsx`

**Requirements:**
- Accordion per milestone (Substructure, Superstructure, etc.)
- Each row: Material name, quantity (editable), unit, unit price, line total
- Add material button per milestone
- AI generate button per milestone
- Show calculated vs overridden quantities indicator

### 3.3 Compliance Tab Components

**Files:**
- `src/app/boq/new/components/PreConstructionChecklist.tsx`
- `src/app/boq/new/components/CertificateTracker.tsx`

**Move existing logic** from the old page.tsx into these focused components.

---

## Phase 4: Store Enhancements (P2)

### 4.1 Consolidate State in Zustand Store

**File:** `src/store/boqWizardStore.ts`

**Ensure all wizard state is in the store:**
```ts
interface BoqWizardState {
  // Project Details
  projectDetails: {
    name: string;
    locationType: 'urban' | 'peri-urban' | 'rural' | '';
    locationCity: string;
    specificLocation: string;
    soilType: SoilType | '';
    siteSlope: SiteSlopeType | '';
    floorPlanSize: string;
    buildingType: 'single_storey' | 'double_storey' | '';
    wallHeight: string;
    brickType: BrickType;
    cementType: CementType;
  };
  updateProjectDetails: (partial: Partial<ProjectDetails>) => void;

  // Geometry Mode
  geometryMode: 'quick' | 'detailed';
  setGeometryMode: (mode: 'quick' | 'detailed') => void;
  detailedRooms: RoomInstance[];
  setDetailedRooms: (rooms: RoomInstance[]) => void;
  totalWindows: number;
  setTotalWindows: (n: number) => void;
  totalDoors: number;
  setTotalDoors: (n: number) => void;

  // Scope
  projectScope: 'entire' | 'stage';  // CANONICAL VALUES
  setProjectScope: (scope: 'entire' | 'stage') => void;
  selectedStages: string[];
  setSelectedStages: (stages: string[]) => void;

  // Labor
  laborType: 'materials_only' | 'materials_labor' | null;
  setLaborType: (type: 'materials_only' | 'materials_labor' | null) => void;

  // BOQ Data
  milestonesState: MilestoneData[];
  setMilestonesState: (state: MilestoneData[]) => void;
  updateMilestoneItem: (milestoneId: string, itemId: string, updates: Partial<BOQItem>) => void;
  addMilestoneItem: (milestoneId: string, item: BOQItem) => void;
  removeMilestoneItem: (milestoneId: string, itemId: string) => void;

  // Site Setup
  temporaryWorksSelections: TemporaryWorkSelection[];
  setTemporaryWorksSelections: (selections: TemporaryWorkSelection[]) => void;
  toggleTemporaryWork: (id: string, enabled: boolean) => void;
  includeSepticTank: boolean;
  setIncludeSepticTank: (include: boolean) => void;
  septicDimensions: SepticDimensions;
  updateSepticDimensions: (partial: Partial<SepticDimensions>) => void;

  // Documents
  geotechDocument: GeotechDocumentSummary | null;
  setGeotechDocument: (doc: GeotechDocumentSummary | null) => void;

  // Compliance
  preConstructionChecks: Record<string, boolean>;
  togglePreConstructionCheck: (ruleId: string) => void;
  certificateTracker: Record<string, CertificateStatus>;
  setCertificateStatus: (certId: string, status: CertificateStatus) => void;

  // Computed (selectors)
  getTotalEstimateUSD: () => number;
  getTotalEstimateZWG: (exchangeRate: number) => number;
  getBoqHealth: () => BoqHealthResult;

  // Reset
  resetWizard: () => void;
}
```

### 4.2 Remove Project Auto-Creation on Step 1

**Problem:** Currently creates a DB record too early.

**Action:**
- Remove any `createNewProject` calls from step navigation
- Only create project on explicit "Save Estimate" click
- Update `useProjectAutoSave` hook to handle this pattern

---

## Phase 5: Cleanup (P2)

### 5.1 Delete Dead Code

**Files to audit:**
- `src/app/boq/new/WizardStyles.tsx` - Delete if all styles migrated to Tailwind
- `src/components/ui/WizardSidebar.tsx` - Delete if not used in new architecture
- Old step components if fully replaced

### 5.2 Remove Unused Props

**In `WizardSidebar.tsx` (if kept):**
- `projectSummary` is computed but never rendered - either render it or remove
- `completionPercentage` same issue

### 5.3 Standardize Styling

**Action:**
- Prefer Tailwind utility classes
- Remove inline `style={{}}` objects where possible
- Extract repeated patterns into component classes or Tailwind `@apply`

---

## Phase 6: Testing

### 6.1 Update E2E Tests

**File:** `e2e/boq-wizard.spec.ts` (or similar)

**Scenarios to test:**
- [ ] Fill project details → estimate updates
- [ ] Select quick geometry mode → enter floor area → estimate updates
- [ ] Select detailed geometry mode → launch builder → draw rooms → area calculated
- [ ] Select scope (entire vs stages) → estimate updates
- [ ] Select labor option → labor costs appear/disappear
- [ ] Toggle site setup items → estimate updates
- [ ] Save unauthenticated → prompt appears → redirect to auth
- [ ] Save authenticated → project saved → redirect to dashboard
- [ ] Mobile: bottom bar shows correct total
- [ ] Mobile: expand bottom sheet shows breakdown

### 6.2 Unit Tests for Store

**File:** `src/store/boqWizardStore.test.ts`

**Test:**
- State updates correctly
- Computed selectors (getTotalEstimateUSD, getBoqHealth) return correct values
- Reset clears all state

---

## File Structure After Refactor

```
src/app/boq/new/
├── page.tsx                              # Shell (~100 lines)
├── components/
│   ├── LiveEstimatorLayout.tsx           # Split-screen container
│   ├── LiveEstimatePanel.tsx             # Right panel (desktop)
│   ├── MobileEstimateBar.tsx             # Bottom bar (mobile)
│   ├── ReviewTabs.tsx                    # Tabbed final review
│   ├── BOQTable.tsx                      # Editable BOQ table
│   ├── PreConstructionChecklist.tsx      # Compliance checklist
│   ├── CertificateTracker.tsx            # Certificate status
│   ├── InteractiveRoomBuilder.tsx        # Existing room builder
│   └── sections/
│       ├── ProjectLocationSection.tsx
│       ├── BuildingDesignSection.tsx
│       ├── MaterialsSection.tsx
│       ├── ScopeSection.tsx
│       ├── LaborSection.tsx
│       ├── SiteSetupSection.tsx
│       └── SiteConditionsSection.tsx
├── store/
│   └── boqWizardStore.ts                 # Zustand store (may be in src/store/)
└── [DELETED]
    ├── WizardStyles.tsx                  # Replaced by Tailwind
    └── components/steps/                 # Replaced by sections/
```

---

## Definition of Done

- [ ] No numeric step tracking (no `currentStep = 2.5`)
- [ ] Scope uses only `'entire' | 'stage'` values
- [ ] Live estimator layout working on desktop and mobile
- [ ] All 7 sections render and update estimate in real-time
- [ ] Floor plan builder accessible from BuildingDesignSection
- [ ] Final review uses tabs (BOQ / Compliance / Documents)
- [ ] Mobile bottom bar shows total, no nav conflict
- [ ] Project only created in DB on explicit Save
- [ ] All E2E tests pass
- [ ] Old wizard files deleted

---

## Notes for Implementation

1. **Work incrementally:** Get the layout working first, then migrate sections one by one.
2. **Keep old code accessible:** Don't delete old files until new ones are verified working.
3. **Test mobile early:** The mobile bottom sheet is easy to get wrong.
4. **Use the store:** Every form field should read/write from Zustand, not local useState.
5. **Estimate updates must be instant:** Use `useMemo` or store selectors, not API calls.

---

## References

- Original analysis: Claude critical analysis of wizard UX
- Bug findings: Sonnet analysis of implementation issues
- Design mockups: ASCII diagrams in chat history
