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
import { DEFAULT_ROOF_COVERING, ROOF_COVERINGS, type RoofCovering } from './roofingOptions';
import { LABOR_SUBSTAGES, laborPercentageFor, laborSubstageFor } from './laborSubstages';
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
  finishLevel?: FinishLevel; // Drives tiling coverage, paint coats, wet-area tiling
  standAreaSqm?: number;     // Plot size — drives boundary wall length in exterior works
  rooms?: DetailedRoom[];   // NEW: Detailed room data
  totalWindows?: number;     // Plan total, when individual rooms lack opening counts
  totalDoors?: number;       // Uploaded plan total, including entrance doors
  roofCovering?: RoofCovering;
}

/**
 * Estimate building perimeter and internal walls from floor area
 */
export function estimateDimensions(floorArea: number, roomCount: number): {
  perimeter: number;
  internalWallLength: number;
} {
  if (!Number.isFinite(floorArea) || floorArea <= 0) {
    return { perimeter: 0, internalWallLength: 0 };
  }
  // Assume 1.4:1 aspect ratio for typical house
  const length = Math.sqrt(floorArea * 1.4);
  const width = floorArea / length;
  const perimeter = 2 * (length + width);

  // Internal walls: approximately 4m per room division
  const internalWallLength = Math.max(0, (roomCount - 1) * 4);

  return { perimeter, internalWallLength };
}

export function estimateVisionWallDimensions(rooms: DetectedRoom[], walls: DetectedWall[]): {
  perimeter: number;
  internalWallLength: number;
  noExternalWallsDetected: boolean;
} {
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);
  const estimated = estimateDimensions(totalArea, rooms.length);
  // The scanner creates four wall segments per room, so each list is divided
  // by four before it can inform the area-based floor. Labels-only reads mark
  // every room as internal; the external envelope must never become zero.
  const scannedExternal = walls.filter((wall) => wall.type === 'external').reduce((sum, wall) => sum + wall.length, 0) / 4;
  const scannedInternal = walls.filter((wall) => wall.type === 'internal').reduce((sum, wall) => sum + wall.length, 0) / 4;
  return {
    perimeter: Math.max(estimated.perimeter, scannedExternal),
    internalWallLength: Math.max(estimated.internalWallLength, scannedInternal),
    noExternalWallsDetected: scannedExternal === 0,
  };
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
  const totalWallArea = perimeter * Math.max(1, wallHeight - 1) + internalWallLength * wallHeight;

  // Group rooms by material
  const materialGroups: Record<string, number> = {};
  rooms.forEach(room => {
    const area = room.length * room.width;
    const mat = room.materialId || 'brick-common';
    materialGroups[mat] = (materialGroups[mat] || 0) + area;
  });

  // Mortar is the same mix whichever brick it lays, so it is one cement and
  // one sand line for all the walls, not one per brick type (which printed
  // as identical-looking cement lines).
  let mortarVolumeTotal = 0;
  const mortarFor: string[] = [];

  // Calculate items for each material
  Object.entries(materialGroups).forEach(([materialId, groupArea]) => {
    const ratio = groupArea / totalFloorArea;
    // Only the external wall has a metre already counted in foundation walls;
    // partitions run from floor level to ceiling height.
    const wallArea = totalWallArea * ratio;

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

    mortarVolumeTotal += (bricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
    mortarFor.push(`${bricks.toLocaleString('en-US')} ${info.name.toLowerCase()}`);
  });

  if (mortarVolumeTotal > 0) {
    const cementInfo = CEMENT_INFO[cementType];
    const cementBags = Math.ceil(mortarVolumeTotal * mortarCementBagsPerM3 * masonryWasteMultiplier);
    const sandCubes = Math.ceil(mortarVolumeTotal * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier * 10) / 10;
    const note = `Mortar for laying the wall bricks (${mortarFor.join(' + ')})`;
    items.push(createBOQItem(cementInfo.materialId, `${cementInfo.name} (Wall Mortar)`, 'superstructure', cementBags, 'per 50kg bag', note));
    items.push(createBOQItem('sand-bricks', 'Brick Sand (Wall Mortar)', 'superstructure', sandCubes, 'per cube', note));
  }

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
    // Cement appears twice in this stage — concrete and mortar are different
    // jobs with different mixes — so each line is named for its job, as the
    // finishing stage already does ("Cement (Plaster)", "Cement (Floor Screed)").
    items.push(createBOQItem(cementInfo.materialId, `${cementInfo.name} (Foundation Concrete)`, 'substructure', Math.ceil(conc * concreteCementBagsPerM3), 'per 50kg bag', `Concrete for the strip footing (${footingWidthMm}mm x ${footingDepthMm}mm)`));
    items.push(createBOQItem('sand-river', 'River Sand', 'substructure', conc * 0.5, 'per cube', 'Foundation concrete'));
    items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm', 'substructure', conc * 0.8, 'per cube', 'Foundation concrete'));

    const subWallArea = perimeter * 1.0;
    const subBricks = Math.ceil(subWallArea * brickInfo.bricksPerSqm * masonryWasteMultiplier);
    items.push(createBOQItem(brickInfo.materialId, `${brickInfo.name} (Foundation Walls)`, 'substructure', subBricks, 'each', 'Foundation walls, from the footing up to floor level'));

    const subMortar = (subBricks / 1000) * MORTAR_M3_PER_1000_BRICKS;
    items.push(createBOQItem(cementInfo.materialId, `${cementInfo.name} (Foundation Mortar)`, 'substructure', Math.ceil(subMortar * mortarCementBagsPerM3 * masonryWasteMultiplier), 'per 50kg bag', 'Mortar for laying the foundation bricks'));
    items.push(createBOQItem('sand-bricks', 'Brick Sand (Foundation Mortar)', 'substructure', subMortar * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier, 'per cube', 'Mortar for laying the foundation bricks'));

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
      const intBricks = Math.ceil(internalWallLength * wallHeight * brickInfo.bricksPerSqm * masonryWasteMultiplier);
      // One line: the same brick, bought together. The split stays in the note.
      items.push(createBOQItem(
        brickInfo.materialId, `${brickInfo.name} (Walls)`, 'superstructure', extBricks + intBricks, 'each',
        `External walls ${extBricks.toLocaleString('en-US')} + internal walls ${intBricks.toLocaleString('en-US')}`,
      ));

      const totalB = extBricks + intBricks;
      const mort = (totalB / 1000) * MORTAR_M3_PER_1000_BRICKS;
      items.push(createBOQItem(cementInfo.materialId, `${cementInfo.name} (Wall Mortar)`, 'superstructure', Math.ceil(mort * mortarCementBagsPerM3 * masonryWasteMultiplier), 'per 50kg bag', 'Mortar for laying the wall bricks'));
      items.push(createBOQItem('sand-bricks', 'Brick Sand (Wall Mortar)', 'superstructure', mort * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier, 'per cube', 'Mortar for laying the wall bricks'));

      const totalLen = perimeter + internalWallLength;
      items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(totalLen / 15), 'per roll', 'Wall reinforcement laid in the brickwork'));
      items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', Math.ceil(totalLen * 4 / 6), 'per length', 'Ring beam'));
      items.push(createBOQItem('rebar-10', 'Rebar Y10', 'superstructure', Math.ceil(totalLen * STIRRUPS_PER_LM / 6), 'per length', 'Ring beam stirrups'));
    }
  }

  // ============================================
  // ROOFING (Simple Area based)
  // ============================================
  if (hasScope('roofing')) {
    items.push(...calculateRoofing(floorArea, locationType, config.roofCovering));
  }

  // ============================================
  // FINISHING (Add Windows Sills)
  // ============================================
  if (hasScope('finishing')) {
    const totalWindows = config.totalWindows || (rooms ? rooms.reduce((sum, r) => sum + r.windows, 0) : Math.ceil(floorArea / 15));
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
      totalDoors: config.totalDoors,
      cementType: getFirstValue(cementTypes) as CementType,
      finishLevel: normalizeFinishLevel(config.finishLevel),
    }));
  }

  if (hasScope('exterior')) {
    items.push(...calculateExteriorWorks({
      floorArea,
      perimeter,
      standAreaSqm: config.standAreaSqm,
      cementType,
    }));
  }

  if (includeLabor) {
    items.push(...calculateLabor(items));
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

const ROOF_PITCH_FACTOR = 1.15;

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
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', `${CEMENT_INFO[cfg.cementType].name} (Foundation Concrete)`, 'substructure', concreteCement, 'per 50kg bag', `Concrete for the strip footing: ${perimeterLength.toFixed(1)}m perimeter (${footingWidthMm}mm x ${footingDepthMm}mm)`));

  const foundationSand = Math.ceil(concreteM3 * 0.5 * 10) / 10;
  items.push(createBOQItem('sand-river', 'River Sand', 'substructure', foundationSand, 'per cube', 'Foundation concrete mix'));

  const foundationStone = Math.ceil(concreteM3 * 0.8 * 10) / 10;
  items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm', 'substructure', foundationStone, 'per cube', 'Foundation concrete mix'));

  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);
  const { bricks: subBricks, note: brickNote } = calculateWallBricks(perimeterLength, 1.0, cfg.brickType, masonryWasteMultiplier);
  items.push(createBOQItem(BRICK_INFO[cfg.brickType].materialId, `${BRICK_INFO[cfg.brickType].name} (Foundation Walls)`, 'substructure', subBricks, 'each', `Foundation walls up to floor level: ${brickNote}`));

  const { cement: subCement, sand: subSand } = calculateMortar(subBricks, cfg.cementType, locationType);
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', `${CEMENT_INFO[cfg.cementType].name} (Foundation Mortar)`, 'substructure', subCement, 'per 50kg bag', `Mortar for laying ${subBricks.toLocaleString('en-US')} foundation bricks`));
  items.push(createBOQItem('sand-bricks', 'Bricklaying Sand (Foundation Mortar)', 'substructure', subSand, 'per cube', 'Mortar for laying the foundation bricks'));

  const meshSheets = Math.ceil(totalArea * MESH_SHEETS_PER_SQM);
  items.push(createBOQItem('mesh-ref193', 'Welded Mesh Ref 193', 'substructure', meshSheets, 'per sheet', `Floor slab: ${totalArea}m²`));

  return items;
}

// ============================================
// SUPERSTRUCTURE CALCULATIONS
// ============================================

function calculateSuperstructure(
  externalWallLength: number,
  internalWallLength: number,
  config: VisionConfig,
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cfg = normalizeConfig(config);
  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);

  const superWallHeight = cfg.wallHeight - 1.0;
  const { bricks: extBricks } = calculateWallBricks(externalWallLength, superWallHeight, cfg.brickType, masonryWasteMultiplier);
  const intBricks = internalWallLength > 0
    ? calculateWallBricks(internalWallLength, cfg.wallHeight, cfg.brickType, masonryWasteMultiplier).bricks
    : 0;
  // One line: the same brick for inside and outside walls, bought together.
  items.push(createBOQItem(
    BRICK_INFO[cfg.brickType].materialId, `${BRICK_INFO[cfg.brickType].name} (Walls)`, 'superstructure', extBricks + intBricks, 'each',
    intBricks > 0
      ? `External walls ${extBricks.toLocaleString('en-US')} (${externalWallLength.toFixed(1)}m x ${superWallHeight}m) + internal walls ${intBricks.toLocaleString('en-US')} (${internalWallLength.toFixed(1)}m x ${cfg.wallHeight}m)`
      : `External walls: ${externalWallLength.toFixed(1)}m x ${superWallHeight}m`,
  ));

  const totalSuperBricks = extBricks + intBricks;

  const { cement, sand } = calculateMortar(totalSuperBricks, cfg.cementType, locationType);
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', `${CEMENT_INFO[cfg.cementType].name} (Wall Mortar)`, 'superstructure', cement, 'per 50kg bag', 'Mortar for laying the wall bricks'));
  items.push(createBOQItem('sand-bricks', 'Bricklaying Sand (Wall Mortar)', 'superstructure', sand, 'per cube', 'Mortar for laying the wall bricks'));

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
  locationType: LocationType = DEFAULT_LOCATION_TYPE,
  roofCovering: RoofCovering = DEFAULT_ROOF_COVERING
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];

  const roofArea = totalArea * ROOF_PITCH_FACTOR;
  const roofAreaWithWaste = roofArea * getRoofingWasteMultiplier(locationType);
  const covering = ROOF_COVERINGS[roofCovering] ?? ROOF_COVERINGS[DEFAULT_ROOF_COVERING];
  const coveringQuantity = Math.ceil(roofAreaWithWaste / covering.coverage);
  items.push(createBOQItem(covering.materialId, covering.materialName, 'roofing', coveringQuantity, covering.unit, `Roof area: ${roofArea.toFixed(1)}m² + location waste; ${covering.coverage.toFixed(2)}m² effective cover per ${covering.unit.replace('per ', '')}. Confirm laps and pitch with supplier.${roofCovering === 'concrete_tile' ? ' Fixings and ridge pieces require a separate quote.' : ''}`));

  if (covering.fixingRate > 0) {
    const screwBoxes = Math.ceil((coveringQuantity * covering.fixingRate) / 100);
    items.push(createBOQItem('screws-roof', 'Roof Screws 65mm', 'roofing', screwBoxes, 'per 100', `${coveringQuantity} ${covering.unit.replace('per ', '')} @ ${covering.fixingRate} screws each`));
  }

  const rafterCount = Math.ceil(roofArea / 6);
  const tileRoof = roofCovering === 'concrete_tile';
  items.push(createBOQItem('timber-50x76', 'Timber 50x76mm', 'roofing', rafterCount, 'per 6m length', tileRoof ? 'Preliminary rafter allowance only; concrete tile weight requires a designed roof structure' : 'Roof rafters @ 600mm spacing'));

  const branderingCount = Math.ceil(roofArea / (tileRoof ? 3.2 : 4));
  items.push(createBOQItem('timber-38x38', 'Timber 38x38mm', 'roofing', branderingCount, 'per 6m length', tileRoof ? 'Tile battens @ approximately 320mm gauge; confirm tile specification' : 'Brandering @ 400mm spacing'));

  const fasciaLength = Math.ceil(Math.sqrt(roofArea) * 4 / 6);
  items.push(createBOQItem('fascia-pvc', 'Fascia Board 228mm', 'roofing', fasciaLength, 'per 6m length', 'Perimeter fascia'));

  return items;
}

// ============================================
// FINISHES
// ============================================

/**
 * How much of the finishing spec a build carries. Zimbabwe budget builds
 * commonly tile the wet areas only and screed the rest of the floor, adding
 * tiles later, so tiling coverage cannot be assumed at 100% for everyone.
 */
export type FinishLevel = 'economy' | 'standard' | 'premium';

export const DEFAULT_FINISH_LEVEL: FinishLevel = 'standard';

const FINISH_LEVEL_SPEC: Record<FinishLevel, {
  floorTileCoverage: number;
  paintCoats: number;
  wetWallHeightM: number;
  exteriorDoors: number;
}> = {
  economy: { floorTileCoverage: 0.25, paintCoats: 1.5, wetWallHeightM: 1.2, exteriorDoors: 2 },
  standard: { floorTileCoverage: 1, paintCoats: 2, wetWallHeightM: 1.5, exteriorDoors: 2 },
  premium: { floorTileCoverage: 1, paintCoats: 3, wetWallHeightM: 2.1, exteriorDoors: 2 },
};

export function normalizeFinishLevel(value?: string): FinishLevel {
  return value === 'economy' || value === 'standard' || value === 'premium'
    ? value
    : DEFAULT_FINISH_LEVEL;
}

const SCREED_THICKNESS_M = 0.04;
const PLASTER_THICKNESS_M = 0.015;
const PAINT_LITRES_PER_TIN = 20;
const CEILING_COVERAGE_RATIO = 0.95;
const CORNICE_LENGTH_M = 4;
const WINDOW_AREA_M2 = 1.44;
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
  totalDoors?: number;
  cementType: CementType;
  finishLevel: FinishLevel;
}): GeneratedBOQItem[] {
  const { floorArea, roomCount, wallHeight, perimeter, internalWallLength, totalWindows, totalDoors, cementType, finishLevel } = input;
  const items: GeneratedBOQItem[] = [];
  const quality = getBuildQuality(cementType);
  const spec = FINISH_LEVEL_SPEC[finishLevel];
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
  const coats = spec.paintCoats;
  const coverage = BOQ_ASSUMPTIONS.paint.coveragePerLitrePerCoat;
  const interiorPaintArea = internalWallArea * 2 + externalWallArea + floorArea;
  const interiorTins = Math.ceil((interiorPaintArea * coats) / coverage / PAINT_LITRES_PER_TIN);
  const exteriorTins = Math.ceil((externalWallArea * coats) / coverage / PAINT_LITRES_PER_TIN);

  items.push(createBOQItem('paint-pva', 'PVA Paint (Interior)', 'finishing', interiorTins, 'per 20L', `${interiorPaintArea.toFixed(0)}m² @ ${coats} coats`));
  items.push(createBOQItem('paint-acrylic', 'Acrylic Paint (Exterior)', 'finishing', exteriorTins, 'per 20L', `${externalWallArea.toFixed(0)}m² @ ${coats} coats`));

  // Floor tiling across the whole floor, plus splashbacks in the two wet rooms.
  const tileWaste = 1 + BOQ_ASSUMPTIONS.tiles.waste[quality];
  const tiledFloorArea = floorArea * spec.floorTileCoverage;
  const floorTileArea = tiledFloorArea * tileWaste;
  const wetRoomWallArea = Math.min(roomCount, 2) * 6 * spec.wetWallHeightM * tileWaste;
  const adhesiveBags = Math.ceil((floorTileArea + wetRoomWallArea) / BOQ_ASSUMPTIONS.tiles.adhesiveCoverageM2PerBag);

  items.push(createBOQItem('tiles-floor-ceramic', 'Floor Tiles', 'finishing', roundTo(floorTileArea, 1), 'per m²', `${roundTo(tiledFloorArea, 1)}m² tiled (${Math.round(spec.floorTileCoverage * 100)}% of floor) + waste`));

  // Whatever is not tiled still needs a finished surface, so screed the balance
  // rather than leaving an economy build with a free floor.
  const screedArea = floorArea - tiledFloorArea;
  if (screedArea > 0) {
    const screedVolume = screedArea * SCREED_THICKNESS_M;
    items.push(createBOQItem('cement-325', 'Cement (Floor Screed)', 'finishing', Math.ceil(screedVolume * BOQ_ASSUMPTIONS.plaster.cementBagsPerM3[quality]), 'per 50kg bag', `${roundTo(screedArea, 1)}m² untiled floor`));
    items.push(createBOQItem('sand-pit', 'Pit Sand (Screed)', 'finishing', roundTo(screedVolume * SAND_M3_PER_M3_MORTAR, 1), 'per cube', 'Screed sand'));
  }
  items.push(createBOQItem('tiles-wall-ceramic', 'Wall Tiles (Wet Areas)', 'finishing', roundTo(wetRoomWallArea, 1), 'per m²', 'Bathroom and kitchen splashbacks'));
  items.push(createBOQItem('tile-adhesive', 'Tile Adhesive', 'finishing', adhesiveBags, 'per 20kg bag', 'Floor and wall tiling'));
  items.push(createBOQItem('grout', 'Tile Grout', 'finishing', Math.ceil(adhesiveBags / 4), 'per 5kg bag', 'Tile joints'));

  // Ceilings and cornice.
  const ceilingArea = floorArea * CEILING_COVERAGE_RATIO;
  const corniceLengths = Math.ceil((perimeter + internalWallLength * 2) / CORNICE_LENGTH_M);

  items.push(createBOQItem('ceiling-board', 'Ceiling Board', 'finishing', roundTo(ceilingArea, 1), 'per m²', `${floorArea}m² ceiling`));
  items.push(createBOQItem('cornice', 'Cornice', 'finishing', corniceLengths, 'per 4m length', 'Ceiling perimeter'));

  // Joinery — use the reviewed upload count when available; otherwise assume
  // one interior door per room plus front and back doors.
  const interiorDoors = totalDoors && totalDoors > 0 ? Math.max(0, totalDoors - spec.exteriorDoors) : Math.max(1, roomCount);
  items.push(createBOQItem('door-interior', 'Interior Door', 'finishing', interiorDoors, 'each', totalDoors && totalDoors > 0 ? `${totalDoors} doors detected, less ${spec.exteriorDoors} entrance doors` : `${roomCount} rooms`));
  items.push(createBOQItem('door-exterior', 'Exterior Door', 'finishing', spec.exteriorDoors, 'each', 'Front and back'));
  items.push(createBOQItem('hinges-door', 'Door Hinges', 'finishing', interiorDoors + spec.exteriorDoors, 'per pair', 'One pair per door'));
  items.push(createBOQItem('lock-mortice', 'Mortice Lock', 'finishing', interiorDoors + spec.exteriorDoors, 'each', 'One per door'));
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
// EXTERIOR WORKS
// ============================================

// Zimbabwe urban stands run from roughly 300m² in high density to 2000m² plus in
// low density. 600m² is a common medium-density plot and is only a fallback —
// the calculation note states it so the figure can be corrected on review.
const DEFAULT_STAND_AREA_SQM = 600;
const DURAWALL_PANEL_LENGTH_M = 2.4;
const DURAWALL_PANELS_PER_BAY = 3;
const APRON_WIDTH_M = 0.9;
const APRON_THICKNESS_M = 0.075;
const DEFAULT_DRIVEWAY_SQM = 40;
const PAVING_WASTE = 1.08;

/**
 * Boundary wall, gates, driveway and the apron around the house.
 *
 * The exterior stage was selectable in the wizard and rendered as a milestone,
 * but nothing generated items for it, so it always read "0 items — $0". Every
 * estimate that included it therefore omitted the boundary wall, gates and
 * paving, which local sources put at a five-figure sum on a typical build.
 */
/** Boundary wall length for a stand, on the same 1.4:1 footprint assumption as the house. */
export function boundaryLengthForStand(standAreaSqm: number | undefined, floorArea: number): number {
  const standArea = standAreaSqm && standAreaSqm > floorArea ? standAreaSqm : DEFAULT_STAND_AREA_SQM;
  const standLength = Math.sqrt(standArea * 1.4);
  const standWidth = standArea / standLength;
  return 2 * (standLength + standWidth);
}

function calculateExteriorWorks(input: {
  floorArea: number;
  perimeter: number;
  standAreaSqm?: number;
  cementType: CementType;
}): GeneratedBOQItem[] {
  const { floorArea, perimeter, standAreaSqm, cementType } = input;
  const items: GeneratedBOQItem[] = [];

  const standArea = standAreaSqm && standAreaSqm > floorArea ? standAreaSqm : DEFAULT_STAND_AREA_SQM;
  const assumedStand = !standAreaSqm || standAreaSqm <= floorArea;
  const boundaryLength = boundaryLengthForStand(standAreaSqm, floorArea);

  const standNote = assumedStand
    ? `${standArea}m² stand assumed — adjust if your stand differs`
    : `${Math.round(standArea)}m² stand`;

  // Precast durawall: panels slot between posts, three panels high per bay.
  const bays = Math.ceil(boundaryLength / DURAWALL_PANEL_LENGTH_M);
  items.push(createBOQItem('durawall-panel', 'Durawall Panel', 'exterior', bays * DURAWALL_PANELS_PER_BAY, 'each', `${boundaryLength.toFixed(0)}m boundary, ${DURAWALL_PANELS_PER_BAY} panels per bay (${standNote})`));
  items.push(createBOQItem('durawall-post', 'Durawall Post', 'exterior', bays + 1, 'each', `One post per ${DURAWALL_PANEL_LENGTH_M}m bay plus an end post`));

  items.push(createBOQItem('gate-vehicle', 'Vehicle Gate', 'exterior', 1, 'each', 'Driveway entrance'));
  items.push(createBOQItem('gate-pedestrian', 'Pedestrian Gate', 'exterior', 1, 'each', 'Walkway entrance'));

  // Driveway plus a walking apron around the house.
  const apronArea = perimeter * APRON_WIDTH_M;
  const pavingArea = (DEFAULT_DRIVEWAY_SQM + apronArea) * PAVING_WASTE;
  items.push(createBOQItem('paving-brick', 'Paving Brick', 'exterior', roundTo(pavingArea, 1), 'per m²', `${DEFAULT_DRIVEWAY_SQM}m² driveway plus ${apronArea.toFixed(0)}m² apron`));

  // Bedding and haunching concrete for the paving.
  const apronConcrete = pavingArea * APRON_THICKNESS_M;
  const cementInfo = CEMENT_INFO[cementType];
  items.push(createBOQItem(cementInfo.materialId, 'Cement (Paving Bed)', 'exterior', Math.ceil(apronConcrete * getConcreteCementBagsPerM3(cementType)), 'per 50kg bag', 'Paving bedding'));
  items.push(createBOQItem('sand-river', 'River Sand (Paving Bed)', 'exterior', roundTo(apronConcrete * SAND_M3_PER_M3_MORTAR, 1), 'per cube', 'Paving bedding sand'));

  return items;
}

// ============================================
// LABOR CALCULATIONS
// ============================================

function calculateLabor(materialItems: GeneratedBOQItem[]): GeneratedBOQItem[] {
  return LABOR_SUBSTAGES.flatMap((substage) => {
    const materials = materialItems.filter((item) => laborSubstageFor(item) === substage.id);
    if (materials.length === 0) return [];
    const materialUsd = materials.reduce((sum, item) => sum + item.totalUsd, 0);
    const materialZwg = materials.reduce((sum, item) => sum + item.totalZwg, 0);
    const percentage = laborPercentageFor(substage.id);
    const usd = roundTo(materialUsd * percentage / 100, 2);
    const zwg = roundTo(materialZwg * percentage / 100, 2);
    return [{
      id: generateItemId(),
      materialId: `labor-${substage.id}`,
      materialName: `Labour — ${substage.label}`,
      category: 'labor',
      quantity: 1,
      unit: 'allowance',
      unitPriceUsd: usd,
      unitPriceZwg: zwg,
      totalUsd: usd,
      totalZwg: zwg,
      calculationNote: `${percentage}% of ${substage.stage} materials ($${materialUsd.toFixed(2)})`,
      isEdited: false,
    }];
  });
}

// ============================================
// MAIN BOQ GENERATOR
// ============================================

export function generateBOQ(
  rooms: DetectedRoom[],
  walls: DetectedWall[],
  config: VisionConfig,
  detectedWindows?: number,
  detectedDoors?: number
): GeneratedBOQItem[] {
  itemIdCounter = 0;
  const allItems: GeneratedBOQItem[] = [];

  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const { perimeter: perimeterLength, internalWallLength } = estimateVisionWallDimensions(rooms, walls);

  const { includeLabor } = config;
  const scopes: ProjectScope[] = Array.isArray(config.scope) ? config.scope : [config.scope];
  const hasScope = (s: ProjectScope) => scopes.includes(s) || scopes.includes('full_house');
  const locationType = DEFAULT_LOCATION_TYPE;

  if (hasScope('substructure')) {
    allItems.push(...calculateSubstructure(totalArea, perimeterLength, config, locationType));
  }

  if (hasScope('superstructure')) {
    allItems.push(...calculateSuperstructure(perimeterLength, internalWallLength, config, locationType));
  }

  if (hasScope('roofing')) {
    allItems.push(...calculateRoofing(totalArea, locationType, config.roofCovering));
  }

  if (hasScope('finishing')) {
    const windows = detectedWindows && detectedWindows > 0 ? detectedWindows : Math.ceil(totalArea / 15);
    allItems.push(createBOQItem('window-sill-brick', 'Window Sill (Brick)', 'finishing', windows * 1.5, 'per meter', `${windows} windows`));
    allItems.push(...calculateFinishes({
      floorArea: totalArea,
      roomCount: rooms.length,
      wallHeight: config.wallHeight,
      perimeter: perimeterLength,
      internalWallLength,
      totalWindows: windows,
      totalDoors: detectedDoors,
      cementType: getFirstValue(config.cementType),
      finishLevel: DEFAULT_FINISH_LEVEL,
    }));
  }

  if (hasScope('exterior')) {
    allItems.push(...calculateExteriorWorks({
      floorArea: totalArea,
      perimeter: perimeterLength,
      cementType: getFirstValue(config.cementType),
    }));
  }

  if (includeLabor) {
    allItems.push(...calculateLabor(allItems));
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
