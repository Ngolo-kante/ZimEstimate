// ─── Construction stages in the project workspace ─────────────────────────────
// Stage names, the approvals still open for a stage, and the location rules,
// moved out of the project page unchanged so they can be tested on their own.

import { LOCATION_PROCEDURE_RULES } from '@/lib/buildFlowRules';
import type { LocationTypeRule } from '@/lib/buildFlowRules';
import { CHECKLIST_TASK_PREFIX, getComplianceRequirementStatus, getStageRequirements } from '@/lib/compliance';
import type { BOQCategory, ProjectStageWithTasks } from '@/lib/database.types';

/** Stage categories in building order. */
export const STAGE_CATEGORIES: BOQCategory[] = ['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior'];

export const STAGE_LABELS: Record<BOQCategory, string> = {
    substructure: 'Site Preparation & Foundation',
    superstructure: 'Structural Walls & Frame',
    roofing: 'Roofing',
    finishing: 'Interior & Finishing',
    services: 'Plumbing & Electrical',
    exterior: 'External Work',
};

export const STAGE_SHORT_LABELS: Record<BOQCategory, string> = {
    substructure: 'Foundation',
    superstructure: 'Structure',
    roofing: 'Roof',
    finishing: 'Finishes',
    services: 'Plumbing & Electrical',
    exterior: 'External',
};

export const isStageCategory = (value: unknown): value is BOQCategory =>
    STAGE_CATEGORIES.includes(value as BOQCategory);

export const LOCATION_TYPE_LABELS: Record<LocationTypeRule, string> = {
    urban: 'Urban',
    'peri-urban': 'Peri-Urban',
    rural: 'Rural',
};

/** "Urban — Borrowdale, Harare" → 'urban'. A location without that prefix gives null. */
export const parseProjectLocationType = (location?: string | null): LocationTypeRule | null => {
    if (!location) return null;
    const [prefix] = location.split(' — ');
    const entry = Object.entries(LOCATION_TYPE_LABELS).find(([, label]) => label === prefix.trim());
    return entry ? (entry[0] as LocationTypeRule) : null;
};

/**
 * Approvals still open before the given stage can start: its required
 * certificates that are not done, and, for the foundation stage, the
 * procedures the project's location type requires that are not ticked off.
 */
export function stageComplianceWarnings(
    currentStage: ProjectStageWithTasks | undefined,
    stages: ProjectStageWithTasks[],
    locationType: LocationTypeRule | null,
): string[] {
    if (!currentStage) return [] as string[];
    const warnings: string[] = [];
    const substructureStage = stages.find((stage) => stage.boq_category === 'substructure');

    const requirements = getStageRequirements(currentStage.boq_category).filter((requirement) => requirement.required);
    requirements.forEach((requirement) => {
        const requirementStage = stages.find((stage) => stage.boq_category === requirement.stage);
        const status = getComplianceRequirementStatus(requirementStage?.tasks || [], requirement.id);
        if (status !== 'done') {
            warnings.push(`${requirement.label} (${STAGE_LABELS[requirement.stage]})`);
        }
    });

    if (currentStage.boq_category === 'substructure' && locationType) {
        const requiredRules = LOCATION_PROCEDURE_RULES.filter(
            (rule) => rule.statusByLocation[locationType] === 'required'
        );
        requiredRules.forEach((rule) => {
            const marker = `${CHECKLIST_TASK_PREFIX}${rule.id}`;
            const checklistTask = (substructureStage?.tasks || []).find(
                (task) => (task.verification_note || '').startsWith(marker)
            );
            if (!checklistTask?.is_completed) {
                warnings.push(`${rule.label} (required for ${LOCATION_TYPE_LABELS[locationType]})`);
            }
        });
    }

    return warnings;
}

export type ReminderFrequency = 'daily' | 'weekly' | 'monthly';

/** The next reminder after baseDate, at 09:00 local time. A month is 30 days. */
export function nextReminderRunAt(frequency: ReminderFrequency, baseDate = new Date()): Date {
    const next = new Date(baseDate);
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    if (frequency === 'monthly') next.setDate(next.getDate() + 30);
    next.setHours(9, 0, 0, 0);
    return next;
}
