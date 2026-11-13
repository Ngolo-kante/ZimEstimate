import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCATION_PROCEDURE_RULES } from '@/lib/buildFlowRules';
import type { ProjectStageWithTasks, StageTask } from '@/lib/database.types';
import {
    isStageCategory,
    nextReminderRunAt,
    parseProjectLocationType,
    STAGE_CATEGORIES,
    STAGE_LABELS,
    STAGE_SHORT_LABELS,
    stageComplianceWarnings,
} from './workspaceStages';

const stage = (boq_category: ProjectStageWithTasks['boq_category'], tasks: Partial<StageTask>[] = []): ProjectStageWithTasks => ({
    id: `stage-${boq_category}`,
    project_id: 'p1',
    boq_category,
    name: STAGE_LABELS[boq_category],
    description: null,
    start_date: null,
    end_date: null,
    status: 'planning',
    sort_order: STAGE_CATEGORIES.indexOf(boq_category) + 1,
    is_applicable: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    tasks: tasks.map((t, i) => ({
        id: `task-${boq_category}-${i}`, stage_id: `stage-${boq_category}`, title: 't', description: null, assigned_to: null,
        verification_note: null, is_completed: false, completed_at: null, sort_order: i, is_default: false,
        created_at: '2026-09-01T00:00:00.000Z', ...t,
    })),
});

describe('stage names', () => {
    it('lists the six stages in building order, each with a long and short name', () => {
        expect(STAGE_CATEGORIES).toEqual(['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior']);
        for (const category of STAGE_CATEGORIES) {
            expect(STAGE_LABELS[category]).toBeTruthy();
            expect(STAGE_SHORT_LABELS[category]).toBeTruthy();
        }
    });

    it('recognises stage names from a link, and nothing else', () => {
        expect(isStageCategory('roofing')).toBe(true);
        expect(isStageCategory('labor')).toBe(false);
        expect(isStageCategory(null)).toBe(false);
    });
});

describe('location type from the project location', () => {
    it('reads the prefix before the dash', () => {
        expect(parseProjectLocationType('Urban — Borrowdale, Harare')).toBe('urban');
        expect(parseProjectLocationType('Peri-Urban — Ruwa')).toBe('peri-urban');
        expect(parseProjectLocationType('Rural — Murehwa')).toBe('rural');
    });

    it('needs the exact label and the long dash', () => {
        expect(parseProjectLocationType('Borrowdale, Harare')).toBeNull();
        expect(parseProjectLocationType('urban — Borrowdale')).toBeNull();
        expect(parseProjectLocationType('Urban - Borrowdale')).toBeNull();
        expect(parseProjectLocationType(null)).toBeNull();
        expect(parseProjectLocationType('')).toBeNull();
    });

    it('accepts a label on its own', () => {
        expect(parseProjectLocationType('Urban')).toBe('urban');
    });
});

describe('approvals still open for a stage', () => {
    it('has none without a current stage', () => {
        expect(stageComplianceWarnings(undefined, [], 'urban')).toEqual([]);
    });

    it('lists the stage certificates not yet done, named with their stage', () => {
        const stages = [stage('substructure')];
        expect(stageComplianceWarnings(stages[0], stages, null)).toEqual([
            'Approved Site Plan (Site Preparation & Foundation)',
            'Slab/Foundation Certificate (Site Preparation & Foundation)',
        ]);
    });

    it('drops a certificate once it is done', () => {
        const stages = [stage('substructure', [{ verification_note: 'compliance_certificate:approved_site_plan|status:done' }])];
        expect(stageComplianceWarnings(stages[0], stages, null)).toEqual([
            'Slab/Foundation Certificate (Site Preparation & Foundation)',
        ]);
    });

    it('adds the procedures the location requires, for the foundation stage only', () => {
        const required = LOCATION_PROCEDURE_RULES.filter((rule) => rule.statusByLocation.urban === 'required');
        expect(required.length).toBeGreaterThan(0);
        const foundation = stage('substructure');
        const warnings = stageComplianceWarnings(foundation, [foundation], 'urban');
        for (const rule of required) expect(warnings).toContain(`${rule.label} (required for Urban)`);

        const walls = stage('superstructure');
        expect(stageComplianceWarnings(walls, [foundation, walls], 'urban').some((w) => w.includes('required for'))).toBe(false);
    });

    it('drops a procedure once its checklist task is ticked', () => {
        const rule = LOCATION_PROCEDURE_RULES.find((r) => r.statusByLocation.urban === 'required')!;
        const foundation = stage('substructure', [{ verification_note: `boq_checklist:${rule.id}`, is_completed: true }]);
        expect(stageComplianceWarnings(foundation, [foundation], 'urban')).not.toContain(`${rule.label} (required for Urban)`);
    });

    it('still lists a procedure whose task exists but is not ticked', () => {
        const rule = LOCATION_PROCEDURE_RULES.find((r) => r.statusByLocation.urban === 'required')!;
        const foundation = stage('substructure', [{ verification_note: `boq_checklist:${rule.id}`, is_completed: false }]);
        expect(stageComplianceWarnings(foundation, [foundation], 'urban')).toContain(`${rule.label} (required for Urban)`);
    });
});

describe('next reminder', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 10, 15, 30)); });
    afterEach(() => { vi.useRealTimers(); });

    it('is the next day, week, or 30 days on, at 09:00 local time', () => {
        const base = new Date(2026, 10, 10, 15, 30);
        expect(nextReminderRunAt('daily', base)).toEqual(new Date(2026, 10, 11, 9, 0, 0, 0));
        expect(nextReminderRunAt('weekly', base)).toEqual(new Date(2026, 10, 17, 9, 0, 0, 0));
        expect(nextReminderRunAt('monthly', base)).toEqual(new Date(2026, 11, 10, 9, 0, 0, 0));
    });

    it('counts from now by default and leaves the base date alone', () => {
        const base = new Date(2026, 10, 10, 15, 30);
        nextReminderRunAt('daily', base);
        expect(base).toEqual(new Date(2026, 10, 10, 15, 30));
        expect(nextReminderRunAt('daily')).toEqual(new Date(2026, 10, 11, 9, 0, 0, 0));
    });
});
