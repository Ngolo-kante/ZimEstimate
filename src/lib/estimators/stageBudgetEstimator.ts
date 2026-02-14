import { generateBOQFromBasics } from '@/lib/calculations';
import type { LocationType } from '@/lib/calculations/assumptions';
import type { BrickType, CementType } from '@/lib/vision/types';

const STAGE_ORDER = [
  { id: 'substructure', label: 'Site Preparation & Foundation' },
  { id: 'superstructure', label: 'Structural Walls & Frame' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'finishing', label: 'Interior & Finishing' },
  { id: 'exterior', label: 'External Work' },
] as const;

type StageId = (typeof STAGE_ORDER)[number]['id'];

const STAGE_WEIGHT_FALLBACK: Record<StageId, number> = {
  substructure: 0.22,
  superstructure: 0.30,
  roofing: 0.20,
  finishing: 0.20,
  exterior: 0.08,
};

export type StageReachInput = {
  budgetUsd: number;
  floorAreaM2: number;
  roomCount?: number;
  wallHeightM?: number;
  brickType?: BrickType;
  cementType?: CementType;
  locationType?: LocationType;
};

export type StageReachRow = {
  id: StageId;
  label: string;
  stageCostUsd: number;
  cumulativeCostUsd: number;
  affordable: boolean;
  coveragePercent: number;
};

export type StageReachResult = {
  estimatedTotalUsd: number;
  budgetUsd: number;
  coveragePercent: number;
  reachableStageId: StageId | null;
  reachableStageLabel: string;
  rows: StageReachRow[];
};

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

export function estimateStageReach(input: StageReachInput): StageReachResult {
  const budgetUsd = clampPositive(input.budgetUsd, 0);
  const floorAreaM2 = clampPositive(input.floorAreaM2, 120);
  const roomCount = clampPositive(input.roomCount ?? Math.round(floorAreaM2 / 28), 4);
  const wallHeightM = clampPositive(input.wallHeightM ?? 2.7, 2.7);
  const brickType = input.brickType ?? 'common';
  const cementType = input.cementType ?? 'cement_325';
  const locationType = input.locationType ?? 'urban';

  const generatedItems = generateBOQFromBasics({
    floorArea: floorAreaM2,
    roomCount,
    wallHeight: wallHeightM,
    brickType,
    cementType,
    scope: 'full_house',
    includeLabor: false,
    locationType,
  });

  const stageCosts: Record<StageId, number> = {
    substructure: 0,
    superstructure: 0,
    roofing: 0,
    finishing: 0,
    exterior: 0,
  };

  generatedItems.forEach((item) => {
    const category = item.category as StageId;
    if (category in stageCosts) {
      stageCosts[category] += item.totalUsd || 0;
    }
  });

  const computedTotal = Object.values(stageCosts).reduce((sum, cost) => sum + cost, 0);
  const missingStages = STAGE_ORDER.filter((stage) => stageCosts[stage.id] <= 0);
  const missingWeight = missingStages.reduce((sum, stage) => sum + STAGE_WEIGHT_FALLBACK[stage.id], 0);

  if (computedTotal > 0 && missingWeight > 0 && missingWeight < 1) {
    const impliedTotal = computedTotal / (1 - missingWeight);
    missingStages.forEach((stage) => {
      stageCosts[stage.id] = impliedTotal * STAGE_WEIGHT_FALLBACK[stage.id];
    });
  }

  if (stageCosts.exterior <= 0) {
    stageCosts.exterior = Math.max(computedTotal * 0.08, floorAreaM2 * 18);
  }

  const estimatedTotalUsd = Object.values(stageCosts).reduce((sum, cost) => sum + cost, 0);
  const normalizedTotal = clampPositive(estimatedTotalUsd, floorAreaM2 * 250);
  const coveragePercent = Math.min(100, normalizedTotal > 0 ? (budgetUsd / normalizedTotal) * 100 : 0);

  let cumulative = 0;
  let reachableStageId: StageId | null = null;

  const rows: StageReachRow[] = STAGE_ORDER.map((stage) => {
    const stageCostUsd = stageCosts[stage.id];
    const start = cumulative;
    cumulative += stageCostUsd;
    const affordable = budgetUsd >= cumulative;
    if (affordable) reachableStageId = stage.id;
    const coveragePercentForStage = stageCostUsd > 0
      ? Math.min(100, Math.max(0, ((budgetUsd - start) / stageCostUsd) * 100))
      : 0;

    return {
      id: stage.id,
      label: stage.label,
      stageCostUsd,
      cumulativeCostUsd: cumulative,
      affordable,
      coveragePercent: coveragePercentForStage,
    };
  });

  const reachableStageLabel = reachableStageId
    ? STAGE_ORDER.find((stage) => stage.id === reachableStageId)?.label ?? 'No stage completed'
    : 'No stage completed';

  return {
    estimatedTotalUsd: normalizedTotal,
    budgetUsd,
    coveragePercent,
    reachableStageId,
    reachableStageLabel,
    rows,
  };
}
