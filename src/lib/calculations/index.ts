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
  brickType: BrickType;
  cementType: CementType;
  scope: ProjectScope | ProjectScope[];
  includeLabor: boolean;
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
  internalWallLength: number
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const { rooms, wallHeight, cementType } = config;

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
    const bricks = Math.ceil(wallArea * info.bricksPerSqm * WASTAGE_FACTOR);

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
    const cementBags = Math.ceil(mortarVolume * cementInfo.bagsPerM3Mortar * WASTAGE_FACTOR);
    const sandCubes = Math.ceil(mortarVolume * SAND_M3_PER_M3_MORTAR * 10) / 10;

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

  const { floorArea, roomCount, wallHeight, brickType, cementType, includeLabor, rooms } = config;
  const { perimeter, internalWallLength } = estimateDimensions(floorArea, roomCount);

  // Normalize scope to array
  const scopes: ProjectScope[] = Array.isArray(config.scope) ? config.scope : [config.scope];
  const hasScope = (s: ProjectScope) => scopes.includes(s) || scopes.includes('full_house');

  const brickInfo = BRICK_INFO[brickType];
  const cementInfo = CEMENT_INFO[cementType];

  // ============================================
  // SUBSTRUCTURE
  // ============================================
  if (hasScope('substructure')) {
    const hardcoreM3 = floorArea * HARDCORE_M3_PER_SQM;
    items.push(createBOQItem('hardcore', 'Hardcore (Filling)', 'substructure', Math.ceil(hardcoreM3), 'per cube', `${floorArea}m² floor`));

    items.push(createBOQItem('dpm-500', 'DPM 500 Gauge', 'substructure', Math.ceil(floorArea * DPM_SHEETS_PER_SQM / 50), 'per roll', 'Floor membrane'));

    const conc = perimeter * CONCRETE_M3_PER_LM_FOUNDATION;
    items.push(createBOQItem(cementInfo.materialId, cementInfo.name, 'substructure', Math.ceil(conc * 7), 'per 50kg bag', 'Foundation concrete'));
    items.push(createBOQItem('sand-river', 'River Sand', 'substructure', Math.ceil(conc * 0.5), 'per cube', 'Foundation concrete'));
    items.push(createBOQItem('aggregate-19mm', 'Crushed Stone 19mm', 'substructure', Math.ceil(conc * 0.8), 'per cube', 'Foundation concrete'));

    const subWallArea = perimeter * 1.0;
    const subBricks = Math.ceil(subWallArea * brickInfo.bricksPerSqm * WASTAGE_FACTOR);
    items.push(createBOQItem(brickInfo.materialId, brickInfo.name, 'substructure', subBricks, 'each', 'Substructure walls'));

    const subMortar = (subBricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
    items.push(createBOQItem(cementInfo.materialId, cementInfo.name, 'substructure', Math.ceil(subMortar * cementInfo.bagsPerM3Mortar), 'per 50kg bag', 'Substructure mortar'));
    items.push(createBOQItem('sand-bricks', 'Brick Sand', 'substructure', Math.ceil(subMortar * SAND_M3_PER_M3_MORTAR), 'per cube', 'Substructure mortar'));

    items.push(createBOQItem('mesh-ref193', 'Welded Mesh Ref 193', 'substructure', Math.ceil(floorArea * MESH_SHEETS_PER_SQM), 'per sheet', 'Slab reinforcement'));
  }

  // ============================================
  // SUPERSTRUCTURE
  // ============================================
  if (hasScope('superstructure')) {
    // Use Detailed logic if rooms exist, else Fallback
    if (rooms && rooms.length > 0) {
      items.push(...calculateSuperstructureFromRooms(config, perimeter, internalWallLength));

      // Add Global Items (Lintel, Reinforcement)
      const totalWallLen = perimeter + internalWallLength;

      // BrickforceateBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalWallLen / 15), 'per roll', 'Wall reinforcement'));
      items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalWallLen / 15), 'per roll', 'Wall reinforcement'));
      items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', Math.ceil(totalWallLen * REBAR_Y12_PER_LM_RINGBEAM / 6), 'per length', 'Ring beam'));
      items.push(createBOQItem('rebar-10', 'Rebar Y10', 'superstructure', Math.ceil(totalWallLen * STIRRUPS_PER_LM / 6), 'per length', 'Stirrups'));

    } else {
      const superH = wallHeight - 1.0;
      const extBricks = Math.ceil(perimeter * superH * brickInfo.bricksPerSqm * WASTAGE_FACTOR);
      items.push(createBOQItem(brickInfo.materialId, brickInfo.name, 'superstructure', extBricks, 'each', 'External walls'));

      const intBricks = Math.ceil(internalWallLength * wallHeight * brickInfo.bricksPerSqm * WASTAGE_FACTOR);
      items.push(createBOQItem(brickInfo.materialId, brickInfo.name, 'superstructure', intBricks, 'each', 'Internal walls'));

      const totalB = extBricks + intBricks;
      const mort = (totalB / 1000) * MORTAR_M3_PER_1000_BRICKS;
      items.push(createBOQItem(cementInfo.materialId, cementInfo.name, 'superstructure', Math.ceil(mort * cementInfo.bagsPerM3Mortar), 'per 50kg bag', 'Superstructure mortar'));
      items.push(createBOQItem('sand-bricks', 'Brick Sand', 'superstructure', Math.ceil(mort * SAND_M3_PER_M3_MORTAR), 'per cube', 'Superstructure mortar'));

      const totalLen = perimeter + internalWallLength;
      items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalLen / 15), 'per roll', ''));
      items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', Math.ceil(totalLen * 4 / 6), 'per length', ''));
    }
  }

  // ============================================
  // ROOFING (Simple Area based)
  // ============================================
  if (hasScope('roofing')) {
    items.push(...calculateRoofing(floorArea));
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
  }

  if (includeLabor) {
    items.push(...calculateLabor(floorArea, config.scope));
  }

  return items;
}

// ============================================
// CONSTANTS
// ============================================

const MORTAR_M3_PER_1000_BRICKS = 0.5;
const SAND_M3_PER_M3_MORTAR = 1.2;
const WASTAGE_FACTOR = 1.05;

const HARDCORE_M3_PER_SQM = 0.15;
const DPM_SHEETS_PER_SQM = 1.1;
const CONCRETE_M3_PER_LM_FOUNDATION = 0.18;

const REBAR_Y12_PER_LM_RINGBEAM = 4;
const STIRRUPS_PER_LM = 4;
const MESH_SHEETS_PER_SQM = 0.07;

const IBR_SHEETS_PER_SQM = 0.49;
const ROOF_SCREWS_PER_SHEET = 8;
const ROOF_PITCH_FACTOR = 1.15;

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

function createBOQItem(
  materialId: string,
  materialName: string,
  category: string,
  quantity: number,
  unit: string,
  calculationNote: string
): GeneratedBOQItem {
  const prices = getMaterialPrice(materialId);
  return {
    id: generateItemId(),
    materialId,
    materialName,
    category,
    quantity: Math.ceil(quantity),
    unit,
    unitPriceUsd: prices.usd,
    unitPriceZwg: prices.zwg,
    totalUsd: Math.ceil(quantity) * prices.usd,
    totalZwg: Math.ceil(quantity) * prices.zwg,
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
  brickType: BrickType
): { bricks: number; note: string } {
  const wallArea = wallLength * wallHeight;
  const bricksPerSqm = BRICK_INFO[brickType].bricksPerSqm;
  const bricks = Math.ceil(wallArea * bricksPerSqm * WASTAGE_FACTOR);

  return {
    bricks,
    note: `${wallArea.toFixed(1)}m² wall @ ${bricksPerSqm}/m²`,
  };
}

export function calculateMortar(
  totalBricks: number,
  cementType: CementType
): { cement: number; sand: number } {
  const mortarVolume = (totalBricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
  const cementBags = Math.ceil(
    mortarVolume * CEMENT_INFO[cementType].bagsPerM3Mortar * WASTAGE_FACTOR
  );
  const sandCubes = Math.ceil(mortarVolume * SAND_M3_PER_M3_MORTAR * 10) / 10;

  return { cement: cementBags, sand: sandCubes };
}

// ============================================
// SUBSTRUCTURE CALCULATIONS
// ============================================

function calculateSubstructure(
  totalArea: number,
  perimeterLength: number,
  config: VisionConfig
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cfg = normalizeConfig(config);

  const hardcoreM3 = totalArea * HARDCORE_M3_PER_SQM;
  items.push(createBOQItem('aggregate-hardcore', 'Hardcore', 'substructure', hardcoreM3, 'per cube', `${totalArea}m² floor @ 150mm thick`));

  const dpmSheets = Math.ceil(totalArea * DPM_SHEETS_PER_SQM / 50);
  items.push(createBOQItem('dpm-500', 'DPM 500 Gauge', 'substructure', dpmSheets, 'per roll', `${totalArea}m² coverage with overlaps`));

  const concreteM3 = perimeterLength * CONCRETE_M3_PER_LM_FOUNDATION;
  const concreteCement = Math.ceil(concreteM3 * 7);
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', CEMENT_INFO[cfg.cementType].name, 'substructure', concreteCement, 'per 50kg bag', `Foundation: ${perimeterLength.toFixed(1)}m perimeter`));

  const foundationSand = Math.ceil(concreteM3 * 0.5 * 10) / 10;
  items.push(createBOQItem('sand-river', 'River Sand', 'substructure', foundationSand, 'per cube', 'Foundation concrete mix'));

  const foundationStone = Math.ceil(concreteM3 * 0.8 * 10) / 10;
  items.push(createBOQItem('aggregate-19mm', 'Crushed Stone 19mm', 'substructure', foundationStone, 'per cube', 'Foundation concrete mix'));

  const { bricks: subBricks, note: brickNote } = calculateWallBricks(perimeterLength, 1.0, cfg.brickType);
  items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, BRICK_INFO[cfg.brickType].name, 'substructure', subBricks, 'each', `Substructure walls: ${brickNote}`));

  const { cement: subCement, sand: subSand } = calculateMortar(subBricks, cfg.cementType);
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
  config: VisionConfig
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cfg = normalizeConfig(config);

  const externalWallLength = walls.filter((w) => w.type === 'external').reduce((sum, w) => sum + w.length, 0) / 4;
  const internalWallLength = walls.filter((w) => w.type === 'internal').reduce((sum, w) => sum + w.length, 0) / 4;

  const superWallHeight = cfg.wallHeight - 1.0;
  const { bricks: extBricks } = calculateWallBricks(externalWallLength, superWallHeight, cfg.brickType);
  items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, BRICK_INFO[cfg.brickType].name, 'superstructure', extBricks, 'each', `External walls: ${externalWallLength.toFixed(1)}m x ${superWallHeight}m`));

  if (internalWallLength > 0) {
    const { bricks: intBricks } = calculateWallBricks(internalWallLength, cfg.wallHeight, cfg.brickType);
    items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, BRICK_INFO[cfg.brickType].name, 'superstructure', intBricks, 'each', `Internal walls: ${internalWallLength.toFixed(1)}m x ${cfg.wallHeight}m`));
  }

  const totalSuperBricks = extBricks + (internalWallLength > 0 ? calculateWallBricks(internalWallLength, cfg.wallHeight, cfg.brickType).bricks : 0);

  const { cement, sand } = calculateMortar(totalSuperBricks, cfg.cementType);
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

function calculateRoofing(totalArea: number): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];

  const roofArea = totalArea * ROOF_PITCH_FACTOR;

  const ibrSheets = Math.ceil(roofArea * IBR_SHEETS_PER_SQM * WASTAGE_FACTOR);
  items.push(createBOQItem('ibr-05-3m', 'IBR Sheets 0.5mm x 3m', 'roofing', ibrSheets, 'per sheet', `Roof area: ${roofArea.toFixed(1)}m²`));

  const screwBoxes = Math.ceil((ibrSheets * ROOF_SCREWS_PER_SHEET) / 100);
  items.push(createBOQItem('screws-roof', 'Roof Screws 65mm', 'roofing', screwBoxes, 'per 100', `${ibrSheets} sheets @ ${ROOF_SCREWS_PER_SHEET} screws each`));

  const rafterCount = Math.ceil(roofArea / 6);
  items.push(createBOQItem('timber-50x76', 'Timber 50x76mm', 'roofing', rafterCount, 'per 6m length', 'Roof rafters @ 600mm spacing'));

  const branderingCount = Math.ceil(roofArea / 4);
  items.push(createBOQItem('timber-38x38', 'Timber 38x38mm', 'roofing', branderingCount, 'per 6m length', 'Brandering @ 400mm spacing'));

  const fasciaLength = Math.ceil(Math.sqrt(roofArea) * 4 / 6);
  items.push(createBOQItem('fascia-board', 'Fascia Board 228mm', 'roofing', fasciaLength, 'per 6m length', 'Perimeter fascia'));

  return items;
}

// ============================================
// LABOR CALCULATIONS
// ============================================

function calculateLabor(
  totalArea: number,
  scope: VisionConfig['scope']
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const normalizedScope = getFirstValue(scope);

  const laborDays = Math.ceil(totalArea * LABOR_DAYS_PER_SQM[normalizedScope]);
  const builderDays = laborDays;
  const assistantDays = Math.ceil(laborDays * 1.5);
  const foremanDays = Math.ceil(laborDays / 10);

  items.push(createBOQItem('labor-builder', 'Builder (Daily Rate)', 'labor', builderDays, 'per day', `${totalArea}m² @ ${LABOR_DAYS_PER_SQM[normalizedScope]} days/m²`));

  items.push(createBOQItem('labor-assistant', 'General Hand (Daily Rate)', 'labor', assistantDays, 'per day', '1.5 assistants per builder'));

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

  if (hasScope('substructure')) {
    allItems.push(...calculateSubstructure(totalArea, perimeterLength, config));
  }

  if (hasScope('superstructure')) {
    allItems.push(...calculateSuperstructure(rooms, walls, config));
  }

  if (hasScope('roofing')) {
    allItems.push(...calculateRoofing(totalArea));
  }

  if (includeLabor) {
    allItems.push(...calculateLabor(totalArea, config.scope));
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
