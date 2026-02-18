export type BoqHealthCategory =
  | 'substructure'
  | 'superstructure'
  | 'roofing'
  | 'finishing'
  | 'exterior';

export type BoqHealthStatus = 'high_risk' | 'work_in_progress' | 'ready_for_procurement';

export interface BoqHealthCategoryInput {
  category: BoqHealthCategory;
  itemIdsWithQty: string[];
}

export interface BoqCategoryHealth {
  category: BoqHealthCategory;
  weight: number;
  completionPct: number;
  matchedCritical: number;
  totalCritical: number;
  missingCriticalItemIds: string[];
  missingCriticalGroups: string[][];
}

export interface BoqHealthResult {
  weightedScorePct: number;
  status: BoqHealthStatus;
  statusLabel: string;
  statusMessage: string;
  categories: BoqCategoryHealth[];
  missingCriticalItemIds: string[];
}

export const BOQ_HEALTH_WEIGHTS: Record<BoqHealthCategory, number> = {
  substructure: 35,
  superstructure: 25,
  roofing: 15,
  finishing: 15,
  exterior: 10,
};

export const BOQ_HEALTH_CRITICAL_REQUIREMENTS: Record<BoqHealthCategory, string[][]> = {
  substructure: [
    ['cement-325', 'cement-425'],
    ['hardcore'],
    ['sand-river'],
    ['stone-19mm'],
    ['mesh-ref193'],
    ['dpc'],
    ['dpm'],
    ['termite-poison'],
    ['brick-common', 'farm-brick', 'block-6inch', 'block-8inch'],
  ],
  superstructure: [
    ['brick-common', 'farm-brick', 'block-6inch', 'block-8inch'],
    ['cement-325', 'cement-425'],
    ['sand-bricks'],
    ['rebar-12'],
    ['rebar-10'],
    ['brickforce'],
  ],
  roofing: [
    ['ibr-05-3m', 'ibr-04-3m'],
    ['timber-50x76'],
    ['timber-38x38'],
    ['screws-roof'],
    ['fascia-pvc', 'gutter-pvc'],
  ],
  finishing: [
    ['paint-pva', 'paint-acrylic'],
    ['tiles-floor-ceramic', 'tiles-wall-ceramic'],
    ['tile-adhesive'],
    ['conduit-20', 'cable-25', 'db-8way'],
    ['pipe-110-pvc', 'pipe-40-pvc', 'geyser-150'],
  ],
  exterior: [
    ['durawall-panel', 'block-6inch', 'block-8inch'],
    ['cement-325', 'cement-425'],
    ['sand-river'],
  ],
};

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getStatus(score: number): {
  status: BoqHealthStatus;
  statusLabel: string;
  statusMessage: string;
} {
  if (score < 40) {
    return {
      status: 'high_risk',
      statusLabel: 'High Risk',
      statusMessage: 'Fundamental structural materials are missing. Do not use for budgeting yet.',
    };
  }
  if (score <= 90) {
    return {
      status: 'work_in_progress',
      statusLabel: 'Work in Progress',
      statusMessage: 'Core structure is defined, but MEP and finishing items may still be missing.',
    };
  }
  return {
    status: 'ready_for_procurement',
    statusLabel: 'Ready for Procurement',
    statusMessage: 'Core budget looks solid. Validate final quantities before procurement.',
  };
}

export function calculateBoqHealth(inputs: BoqHealthCategoryInput[]): BoqHealthResult {
  const categories = inputs.map((input) => {
    const criticalGroups = BOQ_HEALTH_CRITICAL_REQUIREMENTS[input.category] || [];
    const present = new Set(input.itemIdsWithQty);
    const matchedCritical = criticalGroups.filter((group) => group.some((id) => present.has(id))).length;
    const missingCriticalGroups = criticalGroups.filter((group) => !group.some((id) => present.has(id)));
    const missingCriticalItemIds = missingCriticalGroups.map((group) => group[0]);
    const completionPct = criticalGroups.length > 0 ? (matchedCritical / criticalGroups.length) * 100 : 0;

    return {
      category: input.category,
      weight: BOQ_HEALTH_WEIGHTS[input.category],
      completionPct: roundTo(completionPct, 1),
      matchedCritical,
      totalCritical: criticalGroups.length,
      missingCriticalItemIds,
      missingCriticalGroups,
    } satisfies BoqCategoryHealth;
  });

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const weightedScorePct = totalWeight > 0
    ? roundTo(
        categories.reduce((sum, c) => sum + (c.completionPct * c.weight), 0) / totalWeight,
        1
      )
    : 0;

  const status = getStatus(weightedScorePct);
  const missingCriticalItemIds = Array.from(
    new Set(categories.flatMap((c) => c.missingCriticalItemIds))
  );

  return {
    weightedScorePct,
    status: status.status,
    statusLabel: status.statusLabel,
    statusMessage: status.statusMessage,
    categories,
    missingCriticalItemIds,
  };
}
