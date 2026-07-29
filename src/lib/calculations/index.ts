import {
  DetailedRoom,
  DetectedRoom,
  DetectedWall,
  VisionConfig,
  GeneratedBOQItem,
  BRICK_INFO,
  CEMENT_INFO,
  BrickType,
  CementType,
  ProjectScope,
} from '@/lib/vision/types';
import { getBestPrice } from '@/lib/materials';
import {
  BOQ_ASSUMPTIONS,
  DEFAULT_LOCATION_TYPE,
  LocationType,
  normalizeLocationType,
} from '@/lib/calculations/assumptions';

// Helper to get first value from array or single value
function getFirstValue<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

// Normalize config to single values for calculations
function normalizeConfig(config: VisionConfig): {
  scope: ProjectScope;
  brickType: BrickType;
  cementType: CementType;
  includeLabor: boolean;
  wallHeight: number;
  foundationDepth: number;
} {
  return {
    scope: getFirstValue(config.scope),
    brickType: getFirstValue(config.brickType),
    cementType: getFirstValue(config.cementType),
    includeLabor: config.includeLabor,
    wallHeight: config.wallHeight,
    foundationDepth: config.foundationDepth,
  };
}

// Helper to lookup brick info by material ID
function getBrickInfoById(id: string) {
  return Object.values(BRICK_INFO).find(b => b.materialId === id) || BRICK_INFO['common'];
}

/**
 * Configuration for manual builder (simplified input)
 */
export interface ManualBuilderConfig {
  floorArea: number;        // m²
  roomCount: number;        // total rooms for internal wall estimation
  wallHeight: number;       // meters (default 2.7)
  brickTypes: BrickType[];
  cementTypes: CementType[];
  scope: ProjectScope | ProjectScope[];
  includeLabor: boolean;
  locationType?: LocationType;
  rooms?: DetailedRoom[];   // NEW: Detailed room data
}

/**
 * Estimate building perimeter and internal walls from floor area
 */
function estimateDimensions(floorArea: number, roomCount: number): {
  perimeter: number;
  internalWallLength: number;
} {
  // Assume 1.4:1 aspect ratio for typical house
  const length = Math.sqrt(floorArea * 1.4);
  const width = floorArea / length;
  const perimeter = 2 * (length + width);

  // Internal walls: approximately 4m per room division
  const internalWallLength = Math.max(0, (roomCount - 1) * 4);

  return { perimeter, internalWallLength };
}

/**
 * Superstructure calculation with detailed rooms
 * Splits wall materials based on room area proportions
 */
function calculateSuperstructureFromRooms(
  config: ManualBuilderConfig,
  perimeter: number,
  internalWallLength: number,
  locationType: LocationType
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const { rooms, wallHeight } = config;
  const cementType = (config.cementTypes && config.cementTypes.length > 0) ? config.cementTypes[0] : 'cement_325';
  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);
  const mortarCementBagsPerM3 = getMortarCementBagsPerM3(cementType);

  if (!rooms || rooms.length === 0) return items;

  const totalFloorArea = config.floorArea || rooms.reduce((sum, r) => sum + (r.length * r.width), 0);
  const totalWallLength = perimeter + internalWallLength;

  // Group rooms by material
  const materialGroups: Record<string, number> = {};
  rooms.forEach(room => {
    const area = room.length * room.width;
    const mat = room.materialId || 'brick-common';
    materialGroups[mat] = (materialGroups[mat] || 0) + area;
  });

  // Calculate items for each material
  Object.entries(materialGroups).forEach(([materialId, groupArea]) => {
    const ratio = groupArea / totalFloorArea;
    const groupWallLength = totalWallLength * ratio; // Approximation

    // Superstructure height (deduct 1m substructure)
    const superHeight = Math.max(1, wallHeight - 1.0);
    const wallArea = groupWallLength * superHeight;

    // Get info
    const info = getBrickInfoById(materialId);

    // Calculate bricks
    const bricks = Math.ceil(wallArea * info.bricksPerSqm * masonryWasteMultiplier);

    items.push(createBOQItem(
      info.materialId,
      info.name,
      'superstructure',
      bricks,
      'each',
      `Walls (${(ratio * 100).toFixed(0)}% of plan): ${wallArea.toFixed(1)}m²`
    ));

    // Calculate Mortar
    const mortarVolume = (bricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
    const cementInfo = CEMENT_INFO[cementType];
    const cementBags = Math.ceil(mortarVolume * mortarCementBagsPerM3 * masonryWasteMultiplier);
    const sandCubes = Math.ceil(mortarVolume * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier * 10) / 10;

    items.push(createBOQItem(
      cementInfo.materialId,
      cementInfo.name,
      'superstructure',
      cementBags,
      'per 50kg bag',
      `Mortar for ${info.name}`
    ));

    items.push(createBOQItem(
      'sand-bricks',
      'Brick Sand',
      'superstructure',
      sandCubes,
      'per cube',
      `Mortar for ${info.name}`
    ));
  });

  return items;
}

/**
 * Generate BOQ from basic inputs (Manual Builder)
 */
export function generateBOQFromBasics(config: ManualBuilderConfig): GeneratedBOQItem[] {
  itemIdCounter = 0;
  const items: GeneratedBOQItem[] = [];

  const { floorArea, roomCount, wallHeight, brickTypes, cementTypes, includeLabor, rooms } = config;
  const brickType = (brickTypes && brickTypes.length > 0) ? brickTypes[0] : 'common';
  const cementType = (cementTypes && cementTypes.length > 0) ? cementTypes[0] : 'cement_325';
  const { perimeter, internalWallLength } = estimateDimensions(floorArea, roomCount);

  // Normalize scope to array
  const scopes: ProjectScope[] = Array.isArray(config.scope) ? config.scope : [config.scope];
  const hasScope = (s: ProjectScope) => scopes.includes(s) || scopes.includes('full_house');

  const locationType = normalizeLocationType(config.locationType);
  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);
  const brickInfo = BRICK_INFO[brickType];
  const cementInfo = CEMENT_INFO[cementType];
  const concreteCementBagsPerM3 = getConcreteCementBagsPerM3(cementType);
  const mortarCementBagsPerM3 = getMortarCementBagsPerM3(cementType);

  // ============================================
  // SUBSTRUCTURE
  // ============================================
  if (hasScope('substructure')) {
    const hardcoreM3 = floorArea * HARDCORE_M3_PER_SQM;
    items.push(createBOQItem('hardcore', 'Hardcore (Filling)', 'substructure', hardcoreM3, 'per cube', `${floorArea}m² floor`));

    const dpcRolls = Math.max(1, Math.ceil(perimeter / DPC_ROLL_LENGTH_M));
    items.push(createBOQItem('dpc', 'DPC Roll', 'substructure', dpcRolls, 'per roll', `DPC for ${perimeter.toFixed(1)}m perimeter`));

    items.push(createBOQItem('dpm', 'DPM 500 Gauge', 'substructure', Math.ceil(floorArea * DPM_SHEETS_PER_SQM / 50), 'per roll', 'Floor membrane'));

    const termitePoisonLitres = floorArea * TERMITE_POISON_L_PER_SQM;
    items.push(createBOQItem('termite-poison', 'Termite Poison', 'substructure', termitePoisonLitres, 'per litre', 'Soil treatment for foundation and slab'));

    const conc = calculateFoundationConcreteVolume(perimeter, locationType);
    const footingWidthMm = BOQ_ASSUMPTIONS.stripFooting.widthMm[locationType];
    const footingDepthMm = BOQ_ASSUMPTIONS.stripFooting.depthMm;
    items.push(createBOQItem(cementInfo.materialId, cementInfo.name, 'substructure', Math.ceil(conc * concreteCementBagsPerM3), 'per 50kg bag', `Foundation concrete (${footingWidthMm}mm x ${footingDepthMm}mm strip footing)`));
    items.push(createBOQItem('sand-river', 'River Sand', 'substructure', conc * 0.5, 'per cube', 'Foundation concrete'));
    items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm', 'substructure', conc * 0.8, 'per cube', 'Foundation concrete'));

    const subWallArea = perimeter * 1.0;
    const subBricks = Math.ceil(subWallArea * brickInfo.bricksPerSqm * masonryWasteMultiplier);
    items.push(createBOQItem(brickInfo.materialId, brickInfo.name, 'substructure', subBricks, 'each', 'Substructure walls'));

    const subMortar = (subBricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
    items.push(createBOQItem(cementInfo.materialId, cementInfo.name, 'substructure', Math.ceil(subMortar * mortarCementBagsPerM3 * masonryWasteMultiplier), 'per 50kg bag', 'Substructure mortar'));
    items.push(createBOQItem('sand-bricks', 'Brick Sand', 'substructure', subMortar * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier, 'per cube', 'Substructure mortar'));

    items.push(createBOQItem('mesh-ref193', 'Welded Mesh Ref 193', 'substructure', Math.ceil(floorArea * MESH_SHEETS_PER_SQM), 'per sheet', 'Slab reinforcement'));
  }

  // ============================================
  // SUPERSTRUCTURE
  // ============================================
  if (hasScope('superstructure')) {
    // Use Detailed logic if rooms exist, else Fallback
    if (rooms && rooms.length > 0) {
      items.push(...calculateSuperstructureFromRooms(config, perimeter, internalWallLength, locationType));

      // Add Global Items (Lintel, Reinforcement)
      const totalWallLen = perimeter + internalWallLength;

      // BrickforceateBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalWallLen / 15), 'per roll', 'Wall reinforcement'));
      items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalWallLen / 15), 'per roll', 'Wall reinforcement'));
      items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', Math.ceil(totalWallLen * REBAR_Y12_PER_LM_RINGBEAM / 6), 'per length', 'Ring beam'));
      items.push(createBOQItem('rebar-10', 'Rebar Y10', 'superstructure', Math.ceil(totalWallLen * STIRRUPS_PER_LM / 6), 'per length', 'Stirrups'));

    } else {
      const superH = wallHeight - 1.0;
      const extBricks = Math.ceil(perimeter * superH * brickInfo.bricksPerSqm * masonryWasteMultiplier);
      items.push(createBOQItem(brickInfo.materialId, brickInfo.name, 'superstructure', extBricks, 'each', 'External walls'));

      const intBricks = Math.ceil(internalWallLength * wallHeight * brickInfo.bricksPerSqm * masonryWasteMultiplier);
      items.push(createBOQItem(brickInfo.materialId, brickInfo.name, 'superstructure', intBricks, 'each', 'Internal walls'));

      const totalB = extBricks + intBricks;
      const mort = (totalB / 1000) * MORTAR_M3_PER_1000_BRICKS;
      items.push(createBOQItem(cementInfo.materialId, cementInfo.name, 'superstructure', Math.ceil(mort * mortarCementBagsPerM3 * masonryWasteMultiplier), 'per 50kg bag', 'Superstructure mortar'));
      items.push(createBOQItem('sand-bricks', 'Brick Sand', 'superstructure', mort * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier, 'per cube', 'Superstructure mortar'));

      const totalLen = perimeter + internalWallLength;
      items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalLen / 15), 'per roll', ''));
      items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', Math.ceil(totalLen * 4 / 6), 'per length', ''));
      items.push(createBOQItem('rebar-10', 'Rebar Y10', 'superstructure', Math.ceil(totalLen * STIRRUPS_PER_LM / 6), 'per length', ''));
    }
  }

  // ============================================
  // ROOFING (Simple Area based)
  // ============================================
  if (hasScope('roofing')) {
    items.push(...calculateRoofing(floorArea, locationType));
  }

  // ============================================
  // FINISHING (Add Windows Sills)
  // ============================================
  if (hasScope('finishing')) {
    const totalWindows = rooms ? rooms.reduce((sum, r) => sum + r.windows, 0) : Math.ceil(floorArea / 15);
    const sillLength = totalWindows * 1.5;

    items.push(createBOQItem(
      'window-sill-brick',
      'Window Sill (Brick)',
      'finishing',
      sillLength,
      'per meter',
      `${totalWindows} windows`
    ));

    items.push(...calculateFinishes({
      floorArea,
      roomCount,
      wallHeight,
      perimeter,
      internalWallLength,
      totalWindows,
      cementType: getFirstValue(cementTypes) as CementType,
    }));
  }

  if (includeLabor) {
    items.push(...calculateLabor(floorArea, config.scope, items));
  }

  return items;
}

// ============================================
// CONSTANTS
// ============================================

const MORTAR_M3_PER_1000_BRICKS = 0.5;
const SAND_M3_PER_M3_MORTAR = 1.2;

const HARDCORE_M3_PER_SQM = 0.15;
const DPM_SHEETS_PER_SQM = 1.1;
const DPC_ROLL_LENGTH_M = 30;
const TERMITE_POISON_L_PER_SQM = 0.05;

const REBAR_Y12_PER_LM_RINGBEAM = 4;
const STIRRUPS_PER_LM = 4;
const MESH_SHEETS_PER_SQM = 0.07;

const ROOF_SCREWS_PER_SHEET = 8;
const ROOF_PITCH_FACTOR = 1.15;

// Zimbabwe market practice: a builder/contractor charge of roughly 25-30% of the
// material spend, with materials making up 60-70% of the total build.
const LABOR_SHARE_OF_MATERIALS = 0.28;
const ASSISTANTS_PER_BUILDER = 1;
const FOREMEN_PER_BUILDER = 0.1;

// Kept in sync with the catalogue rates so the crew cost used for sizing matches
// what the BOQ is actually priced at.
const LABOR_DAY_RATES = {
  builder: 25,
  assistant: 10,
  foreman: 40,
  food: 5,
};

// Fallback only — used when no material in the BOQ carries a price.
const LABOR_DAYS_PER_SQM: Record<string, number> = {
  full_house: 1.2,
  substructure: 0.3,
  superstructure: 0.5,
  roofing: 0.2,
  finishing: 0.2,
  exterior: 0.15,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBuildQuality(cementType: CementType): 'standard' | 'economy' {
  return cementType === 'cement_425' ? 'standard' : 'economy';
}

function getConcreteProfile(cementType: CementType): 'structural' | 'economy' {
  return cementType === 'cement_425' ? 'structural' : 'economy';
}

function getMasonryWasteMultiplier(locationType: LocationType): number {
  return 1 + BOQ_ASSUMPTIONS.masonry.waste[locationType];
}

function getRoofingWasteMultiplier(locationType: LocationType): number {
  return 1 + BOQ_ASSUMPTIONS.roofing.waste[locationType];
}

function getFoundationConcreteWasteMultiplier(locationType: LocationType): number {
  const foundationWaste = BOQ_ASSUMPTIONS.foundation.waste[locationType];
  const concreteWaste = BOQ_ASSUMPTIONS.concrete.waste[locationType];
  return (1 + foundationWaste) * (1 + concreteWaste);
}

function getMortarCementBagsPerM3(cementType: CementType): number {
  const buildQuality = getBuildQuality(cementType);
  return BOQ_ASSUMPTIONS.mortar.cementBagsPerM3[buildQuality];
}

function getConcreteCementBagsPerM3(cementType: CementType): number {
  const profile = getConcreteProfile(cementType);
  return BOQ_ASSUMPTIONS.concrete.cementBagsPerM3[profile];
}

function calculateFoundationConcreteVolume(
  perimeterLength: number,
  locationType: LocationType
): number {
  const widthM = BOQ_ASSUMPTIONS.stripFooting.widthMm[locationType] / 1000;
  const depthM = BOQ_ASSUMPTIONS.stripFooting.depthMm / 1000;
  const concreteVolume = perimeterLength * widthM * depthM;
  return concreteVolume * getFoundationConcreteWasteMultiplier(locationType);
}

let itemIdCounter = 0;
function generateItemId(): string {
  return `boq_${Date.now()}_${++itemIdCounter}`;
}

function getMaterialPrice(materialId: string): { usd: number; zwg: number } {
  const price = getBestPrice(materialId);
  if (price) {
    return { usd: price.priceUsd, zwg: price.priceZwg };
  }
  return { usd: 0, zwg: 0 };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeQuantityByUnit(quantity: number, unit: string): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  const normalizedUnit = unit.trim().toLowerCase();
  const isDiscreteUnit = /each|bag|roll|sheet|day|length|per 100/.test(normalizedUnit);
  if (isDiscreteUnit) {
    return Math.ceil(quantity);
  }

  const isContinuousUnit = /cube|m3|m²|m2|meter|metre|litre|kg/.test(normalizedUnit);
  if (isContinuousUnit) {
    return roundTo(quantity, 1);
  }

  return roundTo(quantity, 2);
}

function createBOQItem(
  materialId: string,
  materialName: string,
  category: string,
  quantity: number,
  unit: string,
  calculationNote: string
): GeneratedBOQItem {
  const prices = getMaterialPrice(materialId);
  const normalizedQuantity = normalizeQuantityByUnit(quantity, unit);
  const totalUsd = roundTo(normalizedQuantity * prices.usd, 2);
  const totalZwg = roundTo(normalizedQuantity * prices.zwg, 2);

  return {
    id: generateItemId(),
    materialId,
    materialName,
    category,
    quantity: normalizedQuantity,
    unit,
    unitPriceUsd: prices.usd,
    unitPriceZwg: prices.zwg,
    totalUsd,
    totalZwg,
    calculationNote,
    isEdited: false,
  };
}

// ============================================
// WALL CALCULATIONS
// ============================================

export function calculateWallBricks(
  wallLength: number,
  wallHeight: number,
  brickType: BrickType,
  masonryWasteMultiplier: number = getMasonryWasteMultiplier(DEFAULT_LOCATION_TYPE)
): { bricks: number; note: string } {
  const wallArea = wallLength * wallHeight;
  const bricksPerSqm = BRICK_INFO[brickType].bricksPerSqm;
  const bricks = Math.ceil(wallArea * bricksPerSqm * masonryWasteMultiplier);

  return {
    bricks,
    note: `${wallArea.toFixed(1)}m² wall @ ${bricksPerSqm}/m²`,
  };
}

export function calculateMortar(
  totalBricks: number,
  cementType: CementType,
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): { cement: number; sand: number } {
  const mortarVolume = (totalBricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);
  const cementBags = Math.ceil(
    mortarVolume * getMortarCementBagsPerM3(cementType) * masonryWasteMultiplier
  );
  const sandCubes = Math.ceil(mortarVolume * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier * 10) / 10;

  return { cement: cementBags, sand: sandCubes };
}

// ============================================
// SUBSTRUCTURE CALCULATIONS
// ============================================

function calculateSubstructure(
  totalArea: number,
  perimeterLength: number,
  config: VisionConfig,
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cfg = normalizeConfig(config);

  const hardcoreM3 = totalArea * HARDCORE_M3_PER_SQM;
  items.push(createBOQItem('hardcore', 'Hardcore', 'substructure', hardcoreM3, 'per cube', `${totalArea}m² floor @ 150mm thick`));

  const dpcRolls = Math.max(1, Math.ceil(perimeterLength / DPC_ROLL_LENGTH_M));
  items.push(createBOQItem('dpc', 'DPC Roll', 'substructure', dpcRolls, 'per roll', `DPC for ${perimeterLength.toFixed(1)}m perimeter`));

  const dpmSheets = Math.ceil(totalArea * DPM_SHEETS_PER_SQM / 50);
  items.push(createBOQItem('dpm', 'DPM 500 Gauge', 'substructure', dpmSheets, 'per roll', `${totalArea}m² coverage with overlaps`));

  const termitePoisonLitres = totalArea * TERMITE_POISON_L_PER_SQM;
  items.push(createBOQItem('termite-poison', 'Termite Poison', 'substructure', termitePoisonLitres, 'per litre', 'Soil treatment for foundation and slab'));

  const concreteM3 = calculateFoundationConcreteVolume(perimeterLength, locationType);
  const footingWidthMm = BOQ_ASSUMPTIONS.stripFooting.widthMm[locationType];
  const footingDepthMm = BOQ_ASSUMPTIONS.stripFooting.depthMm;
  const concreteCement = Math.ceil(concreteM3 * getConcreteCementBagsPerM3(cfg.cementType));
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', CEMENT_INFO[cfg.cementType].name, 'substructure', concreteCement, 'per 50kg bag', `Foundation: ${perimeterLength.toFixed(1)}m perimeter (${footingWidthMm}mm x ${footingDepthMm}mm)`));

  const foundationSand = Math.ceil(concreteM3 * 0.5 * 10) / 10;
  items.push(createBOQItem('sand-river', 'River Sand', 'substructure', foundationSand, 'per cube', 'Foundation concrete mix'));

  const foundationStone = Math.ceil(concreteM3 * 0.8 * 10) / 10;
  items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm', 'substructure', foundationStone, 'per cube', 'Foundation concrete mix'));

  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);
  const { bricks: subBricks, note: brickNote } = calculateWallBricks(perimeterLength, 1.0, cfg.brickType, masonryWasteMultiplier);
  items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, BRICK_INFO[cfg.brickType].name, 'substructure', subBricks, 'each', `Substructure walls: ${brickNote}`));

  const { cement: subCement, sand: subSand } = calculateMortar(subBricks, cfg.cementType, locationType);
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', CEMENT_INFO[cfg.cementType].name, 'substructure', subCement, 'per 50kg bag', `Mortar for ${subBricks} bricks`));
  items.push(createBOQItem('sand-bricks', 'Bricklaying Sand', 'substructure', subSand, 'per cube', 'Mortar sand'));

  const meshSheets = Math.ceil(totalArea * MESH_SHEETS_PER_SQM);
  items.push(createBOQItem('mesh-ref193', 'Welded Mesh Ref 193', 'substructure', meshSheets, 'per sheet', `Floor slab: ${totalArea}m²`));

  return items;
}

// ============================================
// SUPERSTRUCTURE CALCULATIONS
// ============================================

function calculateSuperstructure(
  rooms: DetectedRoom[],
  walls: DetectedWall[],
  config: VisionConfig,
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cfg = normalizeConfig(config);

  const externalWallLength = walls.filter((w) => w.type === 'external').reduce((sum, w) => sum + w.length, 0) / 4;
  const internalWallLength = walls.filter((w) => w.type === 'internal').reduce((sum, w) => sum + w.length, 0) / 4;
  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);

  const superWallHeight = cfg.wallHeight - 1.0;
  const { bricks: extBricks } = calculateWallBricks(externalWallLength, superWallHeight, cfg.brickType, masonryWasteMultiplier);
  items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, BRICK_INFO[cfg.brickType].name, 'superstructure', extBricks, 'each', `External walls: ${externalWallLength.toFixed(1)}m x ${superWallHeight}m`));

  let intBricks = 0;
  if (internalWallLength > 0) {
    intBricks = calculateWallBricks(internalWallLength, cfg.wallHeight, cfg.brickType, masonryWasteMultiplier).bricks;
    items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, BRICK_INFO[cfg.brickType].name, 'superstructure', intBricks, 'each', `Internal walls: ${internalWallLength.toFixed(1)}m x ${cfg.wallHeight}m`));
  }

  const totalSuperBricks = extBricks + intBricks;

  const { cement, sand } = calculateMortar(totalSuperBricks, cfg.cementType, locationType);
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', CEMENT_INFO[cfg.cementType].name, 'superstructure', cement, 'per 50kg bag', `Mortar for superstructure walls`));
  items.push(createBOQItem('sand-bricks', 'Bricklaying Sand', 'superstructure', sand, 'per cube', 'Mortar sand'));

  const totalWallLength = externalWallLength + internalWallLength;
  const rebarY12 = Math.ceil((totalWallLength * REBAR_Y12_PER_LM_RINGBEAM) / 6);
  items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', rebarY12, 'per 6m length', `Ring beam: ${totalWallLength.toFixed(1)}m @ 4 bars`));

  const stirrupsY10 = Math.ceil((totalWallLength * STIRRUPS_PER_LM) / 6);
  items.push(createBOQItem('rebar-10', 'Rebar Y10', 'superstructure', stirrupsY10, 'per 6m length', `Ring beam stirrups @ 250mm spacing`));

  const brickforceRolls = Math.ceil(totalWallLength / 15);
  items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', brickforceRolls, 'per roll', `Wall reinforcement every 3rd course`));

  return items;
}

// ============================================
// ROOFING CALCULATIONS
// ============================================

function calculateRoofing(
  totalArea: number,
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];

  const roofArea = totalArea * ROOF_PITCH_FACTOR;
  const roofAreaWithWaste = roofArea * getRoofingWasteMultiplier(locationType);
  const sheetCoverage = BOQ_ASSUMPTIONS.roofing.effectiveSheetCoverageM2;

  const ibrSheets = Math.ceil(roofAreaWithWaste / sheetCoverage);
  items.push(createBOQItem('ibr-05-3m', 'IBR Sheets 0.5mm x 3m', 'roofing', ibrSheets, 'per sheet', `Roof area: ${roofArea.toFixed(1)}m² + waste, ${sheetCoverage}m² effective coverage per sheet`));

  const screwBoxes = Math.ceil((ibrSheets * ROOF_SCREWS_PER_SHEET) / 100);
  items.push(createBOQItem('screws-roof', 'Roof Screws 65mm', 'roofing', screwBoxes, 'per 100', `${ibrSheets} sheets @ ${ROOF_SCREWS_PER_SHEET} screws each`));

  const rafterCount = Math.ceil(roofArea / 6);
  items.push(createBOQItem('timber-50x76', 'Timber 50x76mm', 'roofing', rafterCount, 'per 6m length', 'Roof rafters @ 600mm spacing'));

  const branderingCount = Math.ceil(roofArea / 4);
  items.push(createBOQItem('timber-38x38', 'Timber 38x38mm', 'roofing', branderingCount, 'per 6m length', 'Brandering @ 400mm spacing'));

  const fasciaLength = Math.ceil(Math.sqrt(roofArea) * 4 / 6);
  items.push(createBOQItem('fascia-pvc', 'Fascia Board 228mm', 'roofing', fasciaLength, 'per 6m length', 'Perimeter fascia'));

  return items;
}

// ============================================
// FINISHES
// ============================================

const PLASTER_THICKNESS_M = 0.015;
const PAINT_LITRES_PER_TIN = 20;
const CEILING_COVERAGE_RATIO = 0.95;
const CORNICE_LENGTH_M = 4;
const WINDOW_AREA_M2 = 1.44;
const EXTERIOR_DOORS = 2;
const WET_ROOM_TILE_HEIGHT_M = 1.5;
const CABLE_ROLL_LENGTH_M = 100;
const CABLE_M_PER_SQM = 1.6;
const CONDUIT_LENGTH_M = 4;
const SOIL_PIPE_LENGTH_M = 6;
const WASTE_PIPE_LENGTH_M = 6;
const COPPER_PIPE_LENGTH_M = 5.5;

/**
 * Plaster, paint, tiling, ceilings, joinery and first-fix services.
 *
 * Finishing is 25-35% of a Zimbabwe build, but the finishing scope previously
 * generated window sills alone (0.6% of the estimate), which is why totals sat
 * below the market $80-150/m² band.
 */
function calculateFinishes(input: {
  floorArea: number;
  roomCount: number;
  wallHeight: number;
  perimeter: number;
  internalWallLength: number;
  totalWindows: number;
  cementType: CementType;
}): GeneratedBOQItem[] {
  const { floorArea, roomCount, wallHeight, perimeter, internalWallLength, totalWindows, cementType } = input;
  const items: GeneratedBOQItem[] = [];
  const quality = getBuildQuality(cementType);
  const finishWaste = 1 + BOQ_ASSUMPTIONS.finishes.waste[quality];

  // Plaster both faces of internal walls and both faces of the external skin.
  const externalWallArea = perimeter * wallHeight;
  const internalWallArea = internalWallLength * wallHeight;
  const plasterArea = (externalWallArea * 2 + internalWallArea * 2) * finishWaste;
  const plasterVolume = plasterArea * PLASTER_THICKNESS_M;
  const plasterCementBags = Math.ceil(plasterVolume * BOQ_ASSUMPTIONS.plaster.cementBagsPerM3[quality]);

  items.push(createBOQItem('cement-325', 'Cement (Plaster)', 'finishing', plasterCementBags, 'per 50kg bag', `${plasterArea.toFixed(0)}m² plaster @ ${BOQ_ASSUMPTIONS.plaster.mixRatio[quality]}`));
  items.push(createBOQItem('sand-pit', 'Pit Sand (Plaster)', 'finishing', roundTo(plasterVolume * SAND_M3_PER_M3_MORTAR, 1), 'per cube', 'Plaster sand'));

  // Paint covers the plastered faces; exterior gets acrylic, interior PVA.
  const coats = BOQ_ASSUMPTIONS.paint.coats[quality];
  const coverage = BOQ_ASSUMPTIONS.paint.coveragePerLitrePerCoat;
  const interiorPaintArea = internalWallArea * 2 + externalWallArea + floorArea;
  const interiorTins = Math.ceil((interiorPaintArea * coats) / coverage / PAINT_LITRES_PER_TIN);
  const exteriorTins = Math.ceil((externalWallArea * coats) / coverage / PAINT_LITRES_PER_TIN);

  items.push(createBOQItem('paint-pva', 'PVA Paint (Interior)', 'finishing', interiorTins, 'per 20L', `${interiorPaintArea.toFixed(0)}m² @ ${coats} coats`));
  items.push(createBOQItem('paint-acrylic', 'Acrylic Paint (Exterior)', 'finishing', exteriorTins, 'per 20L', `${externalWallArea.toFixed(0)}m² @ ${coats} coats`));

  // Floor tiling across the whole floor, plus splashbacks in the two wet rooms.
  const tileWaste = 1 + BOQ_ASSUMPTIONS.tiles.waste[quality];
  const floorTileArea = floorArea * tileWaste;
  const wetRoomWallArea = Math.min(roomCount, 2) * 6 * WET_ROOM_TILE_HEIGHT_M * tileWaste;
  const adhesiveBags = Math.ceil((floorTileArea + wetRoomWallArea) / BOQ_ASSUMPTIONS.tiles.adhesiveCoverageM2PerBag);

  items.push(createBOQItem('tiles-floor-ceramic', 'Floor Tiles', 'finishing', roundTo(floorTileArea, 1), 'per m²', `${floorArea}m² floor + waste`));
  items.push(createBOQItem('tiles-wall-ceramic', 'Wall Tiles (Wet Areas)', 'finishing', roundTo(wetRoomWallArea, 1), 'per m²', 'Bathroom and kitchen splashbacks'));
  items.push(createBOQItem('tile-adhesive', 'Tile Adhesive', 'finishing', adhesiveBags, 'per 20kg bag', 'Floor and wall tiling'));
  items.push(createBOQItem('grout', 'Tile Grout', 'finishing', Math.ceil(adhesiveBags / 4), 'per 5kg bag', 'Tile joints'));

  // Ceilings and cornice.
  const ceilingArea = floorArea * CEILING_COVERAGE_RATIO;
  const corniceLengths = Math.ceil((perimeter + internalWallLength * 2) / CORNICE_LENGTH_M);

  items.push(createBOQItem('ceiling-board', 'Ceiling Board', 'finishing', roundTo(ceilingArea, 1), 'per m²', `${floorArea}m² ceiling`));
  items.push(createBOQItem('cornice', 'Cornice', 'finishing', corniceLengths, 'per 4m length', 'Ceiling perimeter'));

  // Joinery — one door per room plus front and back doors.
  const interiorDoors = Math.max(1, roomCount);
  items.push(createBOQItem('door-interior', 'Interior Door', 'finishing', interiorDoors, 'each', `${roomCount} rooms`));
  items.push(createBOQItem('door-exterior', 'Exterior Door', 'finishing', EXTERIOR_DOORS, 'each', 'Front and back'));
  items.push(createBOQItem('hinges-door', 'Door Hinges', 'finishing', interiorDoors + EXTERIOR_DOORS, 'per pair', 'One pair per door'));
  items.push(createBOQItem('lock-mortice', 'Mortice Lock', 'finishing', interiorDoors + EXTERIOR_DOORS, 'each', 'One per door'));
  items.push(createBOQItem('window-steel', 'Steel Window Frames', 'finishing', roundTo(totalWindows * WINDOW_AREA_M2, 1), 'per m²', `${totalWindows} windows`));

  // First-fix electrical and plumbing.
  const cableRolls = Math.max(1, Math.ceil((floorArea * CABLE_M_PER_SQM) / CABLE_ROLL_LENGTH_M));
  items.push(createBOQItem('cable-25', 'Cable 2.5mm T&E', 'finishing', cableRolls, 'per 100m roll', `${floorArea}m² wiring`));
  items.push(createBOQItem('conduit-20', 'PVC Conduit 20mm', 'finishing', Math.ceil((floorArea * 0.5) / CONDUIT_LENGTH_M), 'per 4m length', 'Wiring conduit'));
  items.push(createBOQItem('db-8way', 'Distribution Board', 'finishing', 1, 'each', 'Consumer unit'));

  items.push(createBOQItem('pipe-110-pvc', 'PVC Soil Pipe 110mm', 'finishing', Math.max(1, Math.ceil((perimeter * 0.4) / SOIL_PIPE_LENGTH_M)), 'per 6m length', 'Soil drainage'));
  items.push(createBOQItem('pipe-40-pvc', 'PVC Waste Pipe 40mm', 'finishing', Math.max(1, Math.ceil((floorArea * 0.15) / WASTE_PIPE_LENGTH_M)), 'per 6m length', 'Waste runs'));
  items.push(createBOQItem('pipe-15-copper', 'Copper Pipe 15mm', 'finishing', Math.max(1, Math.ceil((floorArea * 0.25) / COPPER_PIPE_LENGTH_M)), 'per 5.5m length', 'Water supply'));
  items.push(createBOQItem('geyser-150', 'Geyser 150L', 'finishing', 1, 'each', 'Hot water'));

  return items;
}

// ============================================
// LABOR CALCULATIONS
// ============================================

function calculateLabor(
  totalArea: number,
  scope: VisionConfig['scope'],
  materialItems: GeneratedBOQItem[] = []
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const normalizedScope = getFirstValue(scope);

  // Size the crew from the material spend rather than from floor area alone.
  // Zimbabwe market practice is that a contractor's charge lands around 25-30%
  // of the material bill, and materials are 60-70% of a build. Driving days off
  // area (previously 1.2 builder-days/m², each with 1.5 assistants plus a food
  // allowance) produced ~375 person-days for a 120m² house and left labour at
  // 55% of the estimate — roughly double what the market carries.
  const materialCost = materialItems.reduce((sum, item) => {
    if (item.category === 'labor') return sum;
    const unitPrice = getBestPrice(item.materialId)?.priceUsd ?? 0;
    return sum + unitPrice * item.quantity;
  }, 0);

  const targetLaborCost = materialCost * LABOR_SHARE_OF_MATERIALS;

  // Cost of running the standard crew for one builder-day: builder + one general
  // hand + a tenth of a foreman, plus each of their food allowance.
  const crewDayCost =
    LABOR_DAY_RATES.builder +
    LABOR_DAY_RATES.assistant * ASSISTANTS_PER_BUILDER +
    LABOR_DAY_RATES.foreman * FOREMEN_PER_BUILDER +
    LABOR_DAY_RATES.food * (1 + ASSISTANTS_PER_BUILDER + FOREMEN_PER_BUILDER);

  // Fall back to the area-based estimate when nothing is priced yet, so an
  // unpriced catalogue cannot silently zero out the labour section.
  const builderDays =
    targetLaborCost > 0 && crewDayCost > 0
      ? Math.max(1, Math.round(targetLaborCost / crewDayCost))
      : Math.ceil(totalArea * LABOR_DAYS_PER_SQM[normalizedScope]);

  const assistantDays = Math.ceil(builderDays * ASSISTANTS_PER_BUILDER);
  const foremanDays = Math.ceil(builderDays * FOREMEN_PER_BUILDER);

  items.push(createBOQItem('labor-builder', 'Builder (Daily Rate)', 'labor', builderDays, 'per day', `${Math.round(LABOR_SHARE_OF_MATERIALS * 100)}% of material cost`));

  items.push(createBOQItem('labor-assistant', 'General Hand (Daily Rate)', 'labor', assistantDays, 'per day', `${ASSISTANTS_PER_BUILDER} assistant per builder`));

  if (foremanDays > 0) {
    items.push(createBOQItem('labor-foreman', 'Foreman (Daily Rate)', 'labor', foremanDays, 'per day', 'Site supervision'));
  }

  const foodDays = builderDays + assistantDays + foremanDays;
  items.push(createBOQItem('service-food', "Builder's Food Allowance", 'labor', foodDays, 'per day', `${foodDays} person-days`));

  return items;
}

// ============================================
// MAIN BOQ GENERATOR
// ============================================

export function generateBOQ(
  rooms: DetectedRoom[],
  walls: DetectedWall[],
  config: VisionConfig
): GeneratedBOQItem[] {
  itemIdCounter = 0;
  const allItems: GeneratedBOQItem[] = [];

  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const perimeterLength = walls.filter((w) => w.type === 'external').reduce((sum, w) => sum + w.length, 0) / 4;

  const { includeLabor } = config;
  const scopes: ProjectScope[] = Array.isArray(config.scope) ? config.scope : [config.scope];
  const hasScope = (s: ProjectScope) => scopes.includes(s) || scopes.includes('full_house');
  const locationType = DEFAULT_LOCATION_TYPE;

  if (hasScope('substructure')) {
    allItems.push(...calculateSubstructure(totalArea, perimeterLength, config, locationType));
  }

  if (hasScope('superstructure')) {
    allItems.push(...calculateSuperstructure(rooms, walls, config, locationType));
  }

  if (hasScope('roofing')) {
    allItems.push(...calculateRoofing(totalArea, locationType));
  }

  if (includeLabor) {
    allItems.push(...calculateLabor(totalArea, config.scope, allItems));
  }

  return allItems;
}

// ============================================
// TOTALS CALCULATION
// ============================================

export function calculateTotals(items: GeneratedBOQItem[]): {
  totalUsd: number;
  totalZwg: number;
  itemCount: number;
  byCategory: Record<string, { usd: number; zwg: number; count: number }>;
} {
  const byCategory: Record<string, { usd: number; zwg: number; count: number }> = {};

  let totalUsd = 0;
  let totalZwg = 0;

  items.forEach((item) => {
    totalUsd += item.totalUsd;
    totalZwg += item.totalZwg;

    if (!byCategory[item.category]) {
      byCategory[item.category] = { usd: 0, zwg: 0, count: 0 };
    }
    byCategory[item.category].usd += item.totalUsd;
    byCategory[item.category].zwg += item.totalZwg;
    byCategory[item.category].count += 1;
  });

  return {
    totalUsd,
    totalZwg,
    itemCount: items.length,
    byCategory,
  };
}
