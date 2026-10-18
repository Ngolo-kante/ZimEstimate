import { generateBOQFromBasics, DEFAULT_FINISH_LEVEL } from '@/lib/calculations';
import { LABOR_SUBSTAGES, laborPercentageFor, laborSubstageFor } from '@/lib/calculations/laborSubstages';
import { getBestPrice, materials } from '@/lib/materials';
import { buildProjectFeeItems, isTariffPriced, OWN_FIGURE_NOTE } from '@/lib/projectFees';
import { buildExtraItems, isExtraLine, normalizeHouseExtras } from '@/lib/houseExtras';
import { boundaryLengthForStand } from '@/lib/calculations';
import type { DetailedRoom, GeneratedBOQItem, ProjectScope as VisionProjectScope } from '@/lib/vision/types';
import {
  BOQ_MILESTONE_IDS,
  type BOQItem,
  type BoqMilestoneId,
  type LaborPreference,
  type MilestoneData,
  type ProjectDetailsState,
  type ProjectScope,
  type TemporaryWorkSelection,
} from '@/store/boqWizardStore';
import type { RoomInstance } from '@/app/boq/new/components/room-builder/types';

const MILESTONE_SET = new Set<BoqMilestoneId>(BOQ_MILESTONE_IDS);
const ESTIMATOR_STAGES: Array<Exclude<VisionProjectScope, 'full_house'>> = [
  'substructure',
  'superstructure',
  'roofing',
  'finishing',
  'services',
  'exterior',
];

interface BuildLiveMilestonesParams {
  projectDetails: ProjectDetailsState;
  geometryMode: 'quick' | 'detailed' | 'upload';
  detailedRooms: RoomInstance[];
  totalWindows: number;
  totalDoors: number;
  projectScope: ProjectScope;
  selectedStages: string[];
  laborType: LaborPreference;
  temporaryWorksSelections: TemporaryWorkSelection[];
  includeSepticTank: boolean;
  septicDimensions: {
    length: string;
    width: string;
    height: string;
    unitPriceUsd: string;
  };
  previousMilestones: MilestoneData[];
}

function parsePositive(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toDetailedRooms(rooms: RoomInstance[]): DetailedRoom[] {
  return rooms.map((room) => ({
    id: room.id,
    label: room.label,
    length: room.length,
    width: room.width,
    windows: room.windows,
    doors: room.doors,
    materialId: room.materialId || 'brick-common',
  }));
}

function getFloorArea(
  geometryMode: 'quick' | 'detailed' | 'upload',
  quickArea: string,
  detailedRooms: RoomInstance[]
): number {
  if (geometryMode === 'detailed') {
    const roomArea = detailedRooms.reduce((sum, room) => sum + (room.length * room.width), 0);
    if (roomArea > 0) {
      return roundTo(roomArea, 1);
    }
  }

  return roundTo(parsePositive(quickArea), 1);
}

function getRoomCount(projectDetails: ProjectDetailsState, detailedRooms: RoomInstance[], floorArea: number): number {
  if (detailedRooms.length > 0) {
    return detailedRooms.length;
  }

  const roomInputCount = Object.values(projectDetails.roomInputs)
    .map(parsePositive)
    .reduce((sum, value) => sum + value, 0);

  if (roomInputCount > 0) {
    return Math.round(roomInputCount);
  }

  return Math.max(4, Math.round(floorArea / 28));
}

function mapScopeForCalculator(projectScope: ProjectScope, selectedStages: string[]): VisionProjectScope | VisionProjectScope[] {
  if (projectScope === 'entire') {
    return 'full_house';
  }

  const filteredStages = selectedStages.filter((stage): stage is Exclude<VisionProjectScope, 'full_house'> =>
    ESTIMATOR_STAGES.includes(stage as Exclude<VisionProjectScope, 'full_house'>)
  );

  if (filteredStages.length === 0) {
    return [];
  }

  return filteredStages;
}

function normalizeCategory(value: string): BoqMilestoneId {
  if (MILESTONE_SET.has(value as BoqMilestoneId)) {
    return value as BoqMilestoneId;
  }

  return 'substructure';
}

function itemKey(category: BoqMilestoneId, materialId: string, unit: string, description: string, isEnablement: boolean): string {
  return [category, materialId, unit, description, isEnablement ? '1' : '0'].join('|');
}

function makeAutoId(key: string): string {
  const compact = key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `auto-${compact}`;
}

function toStoreItem(item: GeneratedBOQItem): BOQItem {
  const category = normalizeCategory(item.category);

  return {
    id: item.id,
    materialId: item.materialId,
    materialName: item.materialName,
    quantity: item.quantity,
    calculatedQuantity: item.quantity,
    unit: item.unit,
    averagePriceUsd: item.unitPriceUsd,
    averagePriceZwg: item.unitPriceZwg,
    actualPriceUsd: item.unitPriceUsd,
    actualPriceZwg: item.unitPriceZwg,
    description: item.calculationNote,
    category,
    isOverridden: false,
    isEnablementCost: item.calculationNote.includes('[Enablement Cost]'),
  };
}

function buildTemporaryWorkItems(selections: TemporaryWorkSelection[]): BOQItem[] {
  return selections
    .filter((selection) => selection.enabled)
    .map((selection) => {
      const quantity = roundTo(parsePositive(selection.quantity), 2);
      const material = materials.find((entry) => entry.id === selection.id);
      const catalogPrice = getBestPrice(selection.id);
      const unitPriceUsd = parsePositive(selection.unitPriceUsd) || catalogPrice?.priceUsd || 0;
      const unitPriceZwg = catalogPrice?.priceZwg || unitPriceUsd * 30;

      return {
        id: `enablement-${selection.id}`,
        materialId: selection.id,
        materialName: material?.name || selection.label,
        quantity,
        calculatedQuantity: quantity,
        unit: material?.unit || selection.unit,
        averagePriceUsd: unitPriceUsd,
        averagePriceZwg: unitPriceZwg,
        actualPriceUsd: unitPriceUsd,
        actualPriceZwg: unitPriceZwg,
        description: selection.description,
        category: 'substructure',
        isOverridden: false,
        isEnablementCost: true,
      } satisfies BOQItem;
    })
    .filter((item) => (item.quantity || 0) > 0);
}

function buildSepticItem(
  includeSepticTank: boolean,
  septicDimensions: BuildLiveMilestonesParams['septicDimensions']
): BOQItem[] {
  if (!includeSepticTank) {
    return [];
  }

  const length = parsePositive(septicDimensions.length);
  const width = parsePositive(septicDimensions.width);
  const height = parsePositive(septicDimensions.height);
  const unitPriceUsd = parsePositive(septicDimensions.unitPriceUsd);

  const volume = roundTo(length * width * height, 2);
  if (volume <= 0 || unitPriceUsd <= 0) {
    return [];
  }

  return [{
    id: 'enablement-custom-septic-tank',
    materialId: 'custom-septic-tank',
    materialName: 'Custom Septic Tank Construction',
    quantity: volume,
    calculatedQuantity: volume,
    unit: 'm3',
    averagePriceUsd: unitPriceUsd,
    averagePriceZwg: unitPriceUsd * 30,
    actualPriceUsd: unitPriceUsd,
    actualPriceZwg: unitPriceUsd * 30,
    description: `${length}m x ${width}m x ${height}m`,
    category: 'substructure',
    isOverridden: false,
    isEnablementCost: true,
  }];
}

function applyQuickOpenings(items: BOQItem[], geometryMode: 'quick' | 'detailed' | 'upload', windows: number, doors: number): BOQItem[] {
  if (geometryMode !== 'quick') {
    return items;
  }

  const safeWindows = Math.max(0, Math.round(windows));
  const safeDoors = Math.max(0, Math.round(doors));
  if (safeWindows === 0 && safeDoors === 0) {
    return items;
  }

  const updated = [...items];
  const sillIndex = updated.findIndex((item) => item.materialId === 'window-sill-brick' && item.category === 'finishing');
  const sillQuantity = roundTo(safeWindows * 1.5, 1);

  if (sillIndex >= 0) {
    const existing = updated[sillIndex];
    updated[sillIndex] = {
      ...existing,
      quantity: sillQuantity,
      calculatedQuantity: sillQuantity,
      description: `${safeWindows} windows`,
    };
  }

  if (safeDoors > 0) {
    const hingesPrice = getBestPrice('hinges-door');
    const lockPrice = getBestPrice('lock-mortice');

    if (hingesPrice) {
      updated.push({
        id: 'auto-opening-hinges',
        materialId: 'hinges-door',
        materialName: 'Door Hinges (Pair)',
        quantity: safeDoors,
        calculatedQuantity: safeDoors,
        unit: 'per pair',
        averagePriceUsd: hingesPrice.priceUsd,
        averagePriceZwg: hingesPrice.priceZwg,
        actualPriceUsd: hingesPrice.priceUsd,
        actualPriceZwg: hingesPrice.priceZwg,
        description: `${safeDoors} door leaves`,
        category: 'finishing',
        isOverridden: false,
      });
    }

    if (lockPrice) {
      updated.push({
        id: 'auto-opening-locks',
        materialId: 'lock-mortice',
        materialName: 'Mortice Lock',
        quantity: safeDoors,
        calculatedQuantity: safeDoors,
        unit: 'each',
        averagePriceUsd: lockPrice.priceUsd,
        averagePriceZwg: lockPrice.priceZwg,
        actualPriceUsd: lockPrice.priceUsd,
        actualPriceZwg: lockPrice.priceZwg,
        description: `${safeDoors} door leaves`,
        category: 'finishing',
        isOverridden: false,
      });
    }
  }

  return updated;
}

export function buildLiveMilestones(params: BuildLiveMilestonesParams): MilestoneData[] {
  const {
    projectDetails,
    geometryMode,
    detailedRooms,
    totalWindows,
    totalDoors,
    projectScope,
    selectedStages,
    laborType,
    temporaryWorksSelections,
    includeSepticTank,
    septicDimensions,
    previousMilestones,
  } = params;

  const fallbackMilestones = BOQ_MILESTONE_IDS.map((id) => {
    const previous = previousMilestones.find((milestone) => milestone.id === id);
    return {
      id,
      label: previous?.label,
      items: [],
      expanded: previous?.expanded ?? true,
    } satisfies MilestoneData;
  });

  const floorArea = getFloorArea(geometryMode, projectDetails.floorPlanSize, detailedRooms);
  const wallHeight = parsePositive(projectDetails.wallHeight) || 2.7;
  const hasCoreInputs = floorArea > 0 && Boolean(projectDetails.buildingType);

  if (!hasCoreInputs) {
    const hasExistingItems = previousMilestones.some((milestone) => milestone.items.length > 0);
    if (hasExistingItems) {
      return previousMilestones;
    }
    return fallbackMilestones;
  }

  const roomCount = getRoomCount(projectDetails, detailedRooms, floorArea);
  const scope = mapScopeForCalculator(projectScope, selectedStages);
  const generatedItems = generateBOQFromBasics({
    floorArea,
    roomCount,
    wallHeight,
    brickTypes: projectDetails.brickTypes,
    cementTypes: projectDetails.cementTypes,
    scope,
    includeLabor: laborType === 'materials_labor',
    laborRates: projectDetails.laborRates,
    roofCovering: projectDetails.roofCovering,
    roofShape: projectDetails.roofShape,
    locationType: (projectDetails.locationType || 'urban') as 'urban' | 'peri-urban' | 'rural',
    // 'not_sure' and unanswered both price as standard — the estimate has to
    // produce a number either way. The difference is that the answer is now
    // recorded, so the review step can say the assumption was ours.
    finishLevel:
      projectDetails.finishLevel && projectDetails.finishLevel !== 'not_sure'
        ? projectDetails.finishLevel
        : DEFAULT_FINISH_LEVEL,
    standAreaSqm: Number(projectDetails.standSize) || undefined,
    rooms: geometryMode !== 'quick' && detailedRooms.length > 0 ? toDetailedRooms(detailedRooms) : undefined,
    totalWindows: geometryMode === 'upload' ? (totalWindows > 0 ? totalWindows : Math.ceil(floorArea / 15)) : undefined,
    totalDoors: geometryMode === 'upload' && totalDoors > 0 ? totalDoors : undefined,
  }).map(toStoreItem);

  const includesSubstructure =
    projectScope === 'entire' || selectedStages.includes('substructure');

  // Extras belong to a whole house. The solar geyser replaces the electric one.
  const houseExtras = normalizeHouseExtras(projectDetails.houseExtras);
  const extraItems = projectScope === 'entire'
    ? buildExtraItems(houseExtras, {
      windows: generatedItems.filter((item) => item.materialId === 'window-steel').reduce((sum, item) => sum + (item.quantity || 0), 0),
      exteriorDoors: generatedItems.filter((item) => item.materialId === 'door-exterior').reduce((sum, item) => sum + (item.quantity || 0), 0),
      boundaryLengthM: boundaryLengthForStand(Number(projectDetails.standSize) || undefined, floorArea),
      laborIncluded: laborType === 'materials_labor',
      roofCovering: projectDetails.roofCovering,
      city: projectDetails.locationCity,
      locationType: projectDetails.locationType,
    })
    : [];
  const stageItems = projectScope === 'entire' && houseExtras.solar_geyser.enabled
    ? generatedItems.filter((item) => item.materialId !== 'geyser-150')
    : generatedItems;

  const siteItems = includesSubstructure
    ? [
      ...buildTemporaryWorkItems(temporaryWorksSelections),
      ...buildSepticItem(includeSepticTank, septicDimensions),
    ]
    : [];

  const mergedInput = applyQuickOpenings(
    [...stageItems, ...siteItems, ...extraItems, ...buildProjectFeeItems({
      floorArea,
      density: projectDetails.residentialDensity || 'low',
      doubleStorey: projectDetails.buildingType === 'double_storey',
    })],
    geometryMode,
    totalWindows,
    totalDoors
  );

  const previousByMilestone = new Map<BoqMilestoneId, BOQItem[]>();
  previousMilestones.forEach((milestone) => {
    previousByMilestone.set(milestone.id, milestone.items);
  });

  const outputByMilestone = new Map<BoqMilestoneId, BOQItem[]>();
  const usedExistingIds = new Set<string>();

  mergedInput.forEach((item) => {
    const category = normalizeCategory(item.category || 'substructure');
    const existingItems = previousByMilestone.get(category) || [];

    if (category === 'project_fees') {
      // One line per fee, matched by fee rather than by note: the note changes
      // with the floor area. A figure the user typed in is kept; a tariff line
      // follows the current floor area, density and storeys.
      const existing = existingItems.find((candidate) => candidate.materialId === item.materialId);
      if (existing) usedExistingIds.add(existing.id);
      const ownFigure = existing && (
        existing.isOverridden ||
        existing.description === OWN_FIGURE_NOTE ||
        (!isTariffPriced(existing) && existing.actualPriceUsd > 0)
      );
      const fee = ownFigure ? existing : { ...item, id: existing?.id || item.id };
      outputByMilestone.set(category, [...(outputByMilestone.get(category) || []), fee]);
      return;
    }

    const key = itemKey(
      category,
      item.materialId,
      item.unit,
      item.description || '',
      Boolean(item.isEnablementCost)
    );

    const matchedExisting = existingItems.find((existing) =>
      itemKey(
        category,
        existing.materialId,
        existing.unit,
        existing.description || '',
        Boolean(existing.isEnablementCost)
      ) === key
    );

    if (matchedExisting) {
      usedExistingIds.add(matchedExisting.id);
    }

    const quantity = matchedExisting?.isOverridden
      ? matchedExisting.quantity
      : item.quantity;

    const finalizedItem: BOQItem = {
      ...item,
      id: matchedExisting?.id || makeAutoId(key),
      quantity,
      calculatedQuantity: item.quantity ?? 0,
      isOverridden: matchedExisting?.isOverridden || false,
      // Percentage labour is calculated from the current material subtotal.
      // Retaining yesterday's generated amount would ignore a changed rate.
      actualPriceUsd: category === 'labor' ? item.actualPriceUsd : matchedExisting?.actualPriceUsd ?? item.actualPriceUsd,
      actualPriceZwg: category === 'labor' ? item.actualPriceZwg : matchedExisting?.actualPriceZwg ?? item.actualPriceZwg,
    };

    const current = outputByMilestone.get(category) || [];
    outputByMilestone.set(category, [...current, finalizedItem]);
  });

  previousByMilestone.forEach((items, milestoneId) => {
    // Carry manually added rows only. Generated rows that no longer match may
    // belong to a roof covering the user has just replaced, or an old labour
    // percentage; keeping them would double-count both options.
    // Extras are rebuilt from the choices on every pass, so one switched off goes.
    const carryForward = items.filter((item) => !usedExistingIds.has(item.id) && !item.id.startsWith('auto-') && !item.materialId.startsWith('labor-') && !isExtraLine(item.materialId) && !(milestoneId === 'labor' && item.materialId === 'service-food'));
    if (carryForward.length === 0) {
      return;
    }

    const current = outputByMilestone.get(milestoneId) || [];
    outputByMilestone.set(milestoneId, [...current, ...carryForward]);
  });

  if (laborType === 'materials_labor') {
    const materialTotals = new Map<string, { usd: number; zwg: number }>();
    for (const [stage, stageItems] of outputByMilestone) {
      if (stage === 'labor') continue;
      for (const item of stageItems) {
        const id = laborSubstageFor({ category: stage, materialId: item.materialId, materialName: item.materialName, calculationNote: item.description });
        if (!id) continue;
        const current = materialTotals.get(id) || { usd: 0, zwg: 0 };
        materialTotals.set(id, {
          usd: current.usd + (item.quantity || 0) * item.actualPriceUsd,
          zwg: current.zwg + (item.quantity || 0) * item.actualPriceZwg,
        });
      }
    }
    const previousLabor = outputByMilestone.get('labor') || [];
    outputByMilestone.set('labor', LABOR_SUBSTAGES.flatMap((substage) => {
      const total = materialTotals.get(substage.id);
      if (!total) return [];
      const percentage = laborPercentageFor(substage.id, projectDetails.laborRates);
      const priceUsd = roundTo(total.usd * percentage / 100);
      const priceZwg = roundTo(total.zwg * percentage / 100);
      const existing = previousLabor.find((item) => item.materialId === `labor-${substage.id}`);
      return [{
        id: existing?.id || `auto-labor-${substage.id}`,
        materialId: `labor-${substage.id}`,
        materialName: `Labour — ${substage.label}`,
        quantity: 1,
        calculatedQuantity: 1,
        unit: 'allowance',
        averagePriceUsd: priceUsd,
        averagePriceZwg: priceZwg,
        actualPriceUsd: priceUsd,
        actualPriceZwg: priceZwg,
        category: 'labor',
        description: `${percentage}% of ${substage.stage} materials ($${total.usd.toFixed(2)})`,
        isOverridden: false,
      } satisfies BOQItem];
    }));
  }

  return fallbackMilestones.map((milestone) => ({
    ...milestone,
    items: outputByMilestone.get(milestone.id) || [],
  }));
}
