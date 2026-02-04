# ZimEstimate Stage-First Architecture Refactor

> **Status**: Ready for Implementation
> **Created**: February 2026
> **Priority**: High

## Overview
Refactor project view from tab-based navigation to Stage-First architecture where construction stages (Substructure, Roofing, etc.) are the primary tabs, each with metadata, admin tasks, filtered BOQ, and usage tracking.

## Key Decisions
- **Usage Tab**: Merged INTO each stage tab (not separate)
- **Existing Projects**: Auto-create stages via migration (consistent UX)

---

## Database Migration (`006_stage_first_architecture.sql`)

### New Table: `project_stages`
```sql
CREATE TABLE project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    boq_category TEXT NOT NULL,  -- 'substructure', 'superstructure', 'roofing', 'finishing', 'exterior'
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planning',  -- 'planning', 'pending_approval', 'in_progress', 'on_hold', 'completed'
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, boq_category)
);

CREATE INDEX idx_project_stages_project_id ON project_stages(project_id);
CREATE INDEX idx_project_stages_status ON project_stages(status);
```

### New Table: `stage_tasks`
```sql
CREATE TABLE stage_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    verification_note TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stage_tasks_stage_id ON stage_tasks(stage_id);
```

### Auto-Create Stages Trigger
- When project created → auto-generate 5 stages (substructure, superstructure, roofing, finishing, exterior)
- `is_applicable` based on project scope
- Seed default admin tasks per stage (e.g., "Ensure inspector approves plan" for Substructure)

### Default Stage Tasks (Seeded Automatically)
| Stage | Default Tasks |
|-------|---------------|
| Substructure | "Ensure inspector approves plan", "Obtain building permit", "Verify soil test results" |
| Superstructure | "Foundation inspection sign-off", "Structural engineer approval" |
| Roofing | "Wall plate level inspection", "Truss delivery verification" |
| Finishing | "Electrical rough-in inspection", "Plumbing rough-in inspection" |
| Exterior | "Boundary verification", "Security system specifications" |

---

## Component Architecture

### New Components to Create
| Component | Location | Purpose |
|-----------|----------|---------|
| `StageTab.tsx` | `src/components/projects/` | Self-contained stage view (metadata + tasks + BOQ + usage) |
| `StageMetadataHeader.tsx` | `src/components/projects/` | Stage dates + status dropdown |
| `StageTaskList.tsx` | `src/components/projects/` | Admin/compliance checklist |
| `StageTaskItem.tsx` | `src/components/projects/` | Task with checkbox, assigned_to, verification |
| `StageBOQSection.tsx` | `src/components/projects/` | BOQ table filtered by stage category |
| `StageProgressBar.tsx` | `src/components/projects/` | Horizontal progress bar below summary cards |
| `StageUsageSection.tsx` | `src/components/projects/` | Usage tracking within each stage |
| `StageSavingsToggle.tsx` | `src/components/ui/` | Savings goal toggle in Total Budget card |

### Files to Delete
| File | Reason |
|------|--------|
| `src/components/projects/PlanningTab.tsx` | Replaced by stage architecture |
| `src/components/projects/MilestoneCard.tsx` | Replaced by StageTaskList |
| `src/components/projects/SavingsCalculator.tsx` | Replaced by StageSavingsToggle |
| `src/components/projects/UsageTab.tsx` | Merged into StageTab |
| `src/components/projects/UsageTracker.tsx` | Merged into StageUsageSection |

---

## Page Structure Changes

### Summary Cards (Top)
```
[Total Budget + Savings Toggle] [Progress] [Amount Spent]
```

### Stage Progress Bar (Below Cards)
```
[Substructure ●] → [Superstructure ○] → [Roofing ○] → [Finishing ○] → [Exterior ○]
     ↑ clickable, shows status colors (green=complete, blue=in-progress, gray=pending)
```

### Tab Navigation
```
[Substructure] [Superstructure] [Roofing] [Finishing] [Exterior] | [Tracking] [Documents]
```
- Default landing: Substructure (or first applicable stage)
- Stages with `is_applicable=false` are hidden

### Stage Tab Content Layout
```
┌─────────────────────────────────────────┐
│ STAGE HEADER                            │
│ Status: [In Progress ▼]                 │
│ Start: [Feb 3, 2026]  End: [Feb 20]     │
├─────────────────────────────────────────┤
│ ADMIN & COMPLIANCE TASKS                │
│ [✓] Ensure inspector approves plan      │
│     Assigned: John | Verified: ✓        │
│ [ ] Obtain building permit              │
│ [+ Add Task]                            │
├─────────────────────────────────────────┤
│ BILL OF QUANTITIES - SUBSTRUCTURE       │
│ (Filtered materials for this stage)     │
│ Material | Qty | Unit | Price | Total   │
├─────────────────────────────────────────┤
│ USAGE TRACKING                          │
│ Cement: 50/100 bags used (50%)          │
│ Sand: 2/5 tonnes used (40%)             │
│ [+ Record Usage]                        │
└─────────────────────────────────────────┘
```

---

## Service Functions

### New File: `src/lib/services/stages.ts`

```typescript
// Stages
getProjectStages(projectId): Promise<{ stages: ProjectStage[], error: Error | null }>
updateStage(stageId, updates): Promise<{ stage: ProjectStage, error: Error | null }>
getActiveStage(projectId): Promise<{ stage: ProjectStage | null, error: Error | null }>

// Stage Tasks
createStageTask(stageId, data): Promise<{ task: StageTask, error: Error | null }>
updateStageTask(taskId, updates): Promise<{ task: StageTask, error: Error | null }>
toggleStageTask(taskId, completed): Promise<{ task: StageTask, error: Error | null }>
deleteStageTask(taskId): Promise<{ error: Error | null }>

// Stage Budget & Usage
getStageBudgetStats(projectId, boqCategory): Promise<{ totalBudget, amountSpent, itemCount }>
getStageUsage(projectId, boqCategory): Promise<{ usageByItem: Record<string, number> }>
calculateStageSavingsPlan(projectId, stageId): Promise<{ plan: StageSavingsPlan }>
```

### Additions to `src/lib/services/projects.ts`
```typescript
getBOQItemsByCategory(projectId, category): Promise<{ items: BOQItem[], error: Error | null }>
```

---

## Type Definitions

### Add to `src/lib/database.types.ts`

```typescript
export type StageStatus = 'planning' | 'pending_approval' | 'in_progress' | 'on_hold' | 'completed';

export interface ProjectStage {
    id: string;
    project_id: string;
    boq_category: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    status: StageStatus;
    sort_order: number;
    is_applicable: boolean;
    created_at: string;
    updated_at: string;
}

export interface StageTask {
    id: string;
    stage_id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    verification_note: string | null;
    is_completed: boolean;
    completed_at: string | null;
    sort_order: number;
    is_default: boolean;
    created_at: string;
}
```

---

## Implementation Order

| Phase | Task | Files |
|-------|------|-------|
| 1 | Database migration | `supabase/migrations/006_stage_first_architecture.sql` |
| 2 | Type definitions | `src/lib/database.types.ts` |
| 3 | Service functions | `src/lib/services/stages.ts`, `src/lib/services/projects.ts` |
| 4 | Stage components | `StageTab.tsx`, `StageMetadataHeader.tsx`, `StageTaskList.tsx`, `StageTaskItem.tsx` |
| 5 | BOQ & Usage components | `StageBOQSection.tsx`, `StageUsageSection.tsx` |
| 6 | Progress bar & savings | `StageProgressBar.tsx`, `StageSavingsToggle.tsx` |
| 7 | Page refactor | `src/app/projects/[id]/page.tsx` |
| 8 | Cleanup | Delete deprecated components |
| 9 | Testing | End-to-end verification |

---

## Files Summary

### To Create
- `supabase/migrations/006_stage_first_architecture.sql`
- `src/lib/services/stages.ts`
- `src/components/projects/StageTab.tsx`
- `src/components/projects/StageMetadataHeader.tsx`
- `src/components/projects/StageTaskList.tsx`
- `src/components/projects/StageTaskItem.tsx`
- `src/components/projects/StageBOQSection.tsx`
- `src/components/projects/StageProgressBar.tsx`
- `src/components/projects/StageUsageSection.tsx`
- `src/components/ui/StageSavingsToggle.tsx`

### To Modify
- `src/app/projects/[id]/page.tsx` - Major refactor
- `src/lib/database.types.ts` - Add new types
- `src/lib/services/projects.ts` - Add getBOQItemsByCategory

### To Delete
- `src/components/projects/PlanningTab.tsx`
- `src/components/projects/MilestoneCard.tsx`
- `src/components/projects/SavingsCalculator.tsx`
- `src/components/projects/UsageTab.tsx`
- `src/components/projects/UsageTracker.tsx`

---

## Data Migration (Existing Projects)

The migration will automatically:
1. Create 5 stages for ALL existing projects
2. Set `is_applicable` based on project scope
3. Seed default admin tasks for each stage
4. Stages start with status = 'planning'
5. Existing BOQ items auto-filter by their `category` field (no changes needed)

---

## Verification Checklist

- [ ] Create new project → verify 5 stages auto-created
- [ ] Open Substructure tab → verify default admin task exists
- [ ] Add BOQ items with different categories → verify filtering works
- [ ] Update stage dates/status → verify persistence
- [ ] Toggle savings in budget card → verify calculation for active stage
- [ ] Click progress bar stages → verify tab navigation
- [ ] Open EXISTING project → verify stages were created by migration
- [ ] Record usage in stage → verify tracking works
- [ ] Mark stage complete → verify progress bar updates

---

## Reference Files

For implementation patterns, refer to:
- `src/components/projects/PlanningTab.tsx` - Existing milestone/task UI patterns
- `src/components/projects/UsageTab.tsx` - Usage tracking patterns
- `src/lib/services/projects.ts` - Service function structure
- `supabase/migrations/004_project_enhancements.sql` - Migration & RLS patterns
