import { generateBOQFromBasics } from '@/lib/calculations';
import type { RoofCovering, RoofShape } from '@/lib/calculations/roofingOptions';
import { LABOR_SUBSTAGES, formatLaborRate, isLaborCategory, laborRateFor, stageOfLaborCategory, type LaborRates, type LaborSubstageId } from '@/lib/calculations/laborSubstages';
import type { LocationType } from '@/lib/calculations/assumptions';
import type { BrickType, CementType } from '@/lib/vision/types';

const STAGE_ORDER = [
  { id: 'substructure', label: 'Site Preparation & Foundation' },
  { id: 'superstructure', label: 'Structural Walls & Frame' },
  { id: 'roofing', label: 'Roofing' },
  // Plumbing & Electrical is its own stage in the full BOQ; on this quick
  // check it is part of the interior, shown as a line inside it (owner's
  // choice, 2026-10-18), so the list stays short.
  { id: 'finishing', label: 'Interior & Finishing' },
  { id: 'exterior', label: 'External Work' },
] as const;

export type StageId = (typeof STAGE_ORDER)[number]['id'];

/**
 * Where each stage stands. People in Zimbabwe often build over years, so a
 * budget may start after the walls are up ('built'), or leave the boundary
 * wall for later ('skip'). Neither is counted; a built stage reads as done.
 */
export type StageStatus = 'build' | 'built' | 'skip';
export const STAGE_IDS: StageId[] = STAGE_ORDER.map((stage) => stage.id);

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
  brickTypes?: BrickType[];
  cementTypes?: CementType[];
  locationType?: LocationType;
  roofCovering?: RoofCovering;
  roofShape?: RoofShape;
  /** Adds each stage's labour, priced by trade (laborSubstages.ts), to its cost. */
  includeLabor?: boolean;
  /** The user's own labour rates by trade; missing ones use the defaults. */
  laborRates?: LaborRates;
  /** Stages left out of the budget. Missing means 'build'. */
  stageStatus?: Partial<Record<StageId, StageStatus>>;
};

export type StageReachRow = {
  id: StageId;
  label: string;
  /** What the stage is made of, where it has distinct parts (the interior's plumbing and electrical). */
  parts?: Array<{ label: string; usd: number }>;
  stageCostUsd: number;
  cumulativeCostUsd: number;
  affordable: boolean;
  coveragePercent: number;
  status: StageStatus;
};

export type StageReachResult = {
  estimatedTotalUsd: number;
  /** The materials and labour inside estimatedTotalUsd. */
  materialsUsd: number;
  laborUsd: number;
  budgetUsd: number;
  coveragePercent: number;
  reachableStageId: StageId | null;
  reachableStageLabel: string;
  rows: StageReachRow[];
  /** Labour by trade, for explaining the labour figure: its rate as people read it ("$7.40/m² of floor"), cost and cost per m² of floor. */
  laborByTrade: Array<{ id: LaborSubstageId; label: string; rate: number; rateLabel: string; usd: number; perM2: number }>;
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
  const brickType = (input.brickTypes && input.brickTypes.length > 0) ? input.brickTypes[0] : 'common';
  const cementType = (input.cementTypes && input.cementTypes.length > 0) ? input.cementTypes[0] : 'cement_325';
  const locationType = input.locationType ?? 'urban';

  const generatedItems = generateBOQFromBasics({
    floorArea: floorAreaM2,
    roomCount,
    wallHeight: wallHeightM,
    brickTypes: [brickType],
    cementTypes: [cementType],
    scope: 'full_house',
    includeLabor: Boolean(input.includeLabor),
    laborRates: input.laborRates,
    locationType,
    roofCovering: input.roofCovering,
    roofShape: input.roofShape,
  });

  const stageCosts: Record<StageId, number> = {
    substructure: 0,
    superstructure: 0,
    roofing: 0,
    finishing: 0,
    exterior: 0,
  };

  // Labour lines sit inside their stage (labor_<stage>); Plumbing &
  // Electrical folds into the interior here, as its materials do.
  const stageLabor: Record<StageId, number> = { substructure: 0, superstructure: 0, roofing: 0, finishing: 0, exterior: 0 };
  const servicesCost = { materials: 0, labor: 0 };
  const laborByTradeAll: StageReachResult['laborByTrade'] = [];
  const laborStageOfTrade = new Map<LaborSubstageId, StageId>();
  generatedItems.forEach((item) => {
    if (isLaborCategory(item.category)) {
      const laborStage = stageOfLaborCategory(item.category);
      const isServices = laborStage === 'services';
      const stage = (isServices ? 'finishing' : laborStage) as StageId | null;
      if (!stage || !(stage in stageLabor)) return;
      stageLabor[stage] += item.totalUsd || 0;
      if (isServices) servicesCost.labor += item.totalUsd || 0;
      const trade = LABOR_SUBSTAGES.find((entry) => `labor-${entry.id}` === item.materialId);
      if (trade) {
        const rate = laborRateFor(trade.id, input.laborRates);
        laborByTradeAll.push({ id: trade.id, label: trade.label, rate, rateLabel: formatLaborRate(trade.id, rate), usd: item.totalUsd || 0, perM2: (item.totalUsd || 0) / floorAreaM2 });
        laborStageOfTrade.set(trade.id, stage);
      }
      return;
    }
    const isServices = item.category === 'services';
    const category = (isServices ? 'finishing' : item.category) as StageId;
    if (category in stageCosts) {
      stageCosts[category] += item.totalUsd || 0;
      if (isServices) servicesCost.materials += item.totalUsd || 0;
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

  const statusOf = (id: StageId): StageStatus => input.stageStatus?.[id] ?? 'build';
  const counted = STAGE_ORDER.filter((stage) => statusOf(stage.id) === 'build');

  let materialsUsd = 0;
  let laborUsd = 0;
  for (const stage of STAGE_ORDER) {
    const counts = statusOf(stage.id) === 'build';
    if (counts) materialsUsd += stageCosts[stage.id];
    if (input.includeLabor) {
      // A stage filled in from the fallback weights has no lines to price by
      // trade, so it takes the general 35% rule of thumb.
      const labor = stageLabor[stage.id] > 0 ? stageLabor[stage.id] : stageCosts[stage.id] * 0.35;
      stageCosts[stage.id] += labor;
      if (counts) laborUsd += labor;
    }
  }

  const estimatedTotalUsd = materialsUsd + laborUsd;
  // Nothing left to build: the budget covers it, and there is no total to scale.
  const normalizedTotal = counted.length === 0 ? 0 : clampPositive(estimatedTotalUsd, floorAreaM2 * 250);
  const coveragePercent = counted.length === 0
    ? 100
    : Math.min(100, normalizedTotal > 0 ? (budgetUsd / normalizedTotal) * 100 : 0);

  // The interior's plumbing and electrical, shown as a line inside it.
  const servicesUsd = servicesCost.materials + (input.includeLabor ? servicesCost.labor : 0);
  const partsOf = (id: StageId): { parts?: StageReachRow['parts'] } =>
    id === 'finishing' && servicesUsd > 0
      ? { parts: [{ label: 'Finishes', usd: stageCosts.finishing - servicesUsd }, { label: 'Plumbing & electrical', usd: servicesUsd }] }
      : {};

  const laborByTrade = input.includeLabor
    ? laborByTradeAll.filter((trade) => statusOf(laborStageOfTrade.get(trade.id)!) === 'build' && trade.usd > 0)
    : [];

  let cumulative = 0;
  let reachableStageId: StageId | null = null;

  const rows: StageReachRow[] = STAGE_ORDER.map((stage) => {
    const stageCostUsd = stageCosts[stage.id];
    const status = statusOf(stage.id);
    if (status !== 'build') {
      // Shown with its cost, but the money is not spent on it.
      return {
        id: stage.id,
        label: stage.label,
        ...partsOf(stage.id),
        stageCostUsd,
        cumulativeCostUsd: cumulative,
        affordable: status === 'built',
        coveragePercent: status === 'built' ? 100 : 0,
        status,
      };
    }
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
      ...partsOf(stage.id),
      stageCostUsd,
      cumulativeCostUsd: cumulative,
      affordable,
      coveragePercent: coveragePercentForStage,
      status,
    };
  });

  const reachableStageLabel = reachableStageId
    ? STAGE_ORDER.find((stage) => stage.id === reachableStageId)?.label ?? 'No stage completed'
    : 'No stage completed';

  return {
    estimatedTotalUsd: normalizedTotal,
    materialsUsd,
    laborUsd,
    budgetUsd,
    coveragePercent,
    reachableStageId,
    reachableStageLabel,
    rows,
    laborByTrade,
  };
}

/** Stage choices as link parameters: ?done=substructure,superstructure&later=exterior. */
export function stageStatusToParams(status: Partial<Record<StageId, StageStatus>>): Record<string, string> {
  const pick = (value: StageStatus) => STAGE_IDS.filter((id) => status[id] === value).join(',');
  const params: Record<string, string> = {};
  if (pick('built')) params.done = pick('built');
  if (pick('skip')) params.later = pick('skip');
  return params;
}

export function stageStatusFromParams(params: URLSearchParams): Partial<Record<StageId, StageStatus>> {
  const status: Partial<Record<StageId, StageStatus>> = {};
  const read = (key: string, value: StageStatus) => {
    for (const id of (params.get(key) ?? '').split(',')) {
      if ((STAGE_IDS as string[]).includes(id)) status[id as StageId] = value;
    }
  };
  read('done', 'built');
  read('later', 'skip');
  // At least one stage has to be left to build.
  return STAGE_IDS.every((id) => status[id]) ? {} : status;
}
