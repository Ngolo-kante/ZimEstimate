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
import { DEFAULT_ROOF_COVERING, DEFAULT_ROOF_SHAPE, ROOF_COVERINGS, ROOF_SHAPES, type RoofCovering, type RoofShape } from './roofingOptions';
import { LABOR_SUBSTAGES, laborPercentageFor, laborSubstageFor, type LaborRates } from './laborSubstages';
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
  roofShape?: RoofShape;
  /** The user's own labour percentages by stage; defaults to 35% each. */
  laborRates?: LaborRates;
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
  // Walls stand on the slab, full height; the foundation walls are below it.
  const openings = wallOpenings(
    config.totalWindows || rooms.reduce((sum, r) => sum + (r.windows || 0), 0) || Math.ceil(totalFloorArea / 15),
    config.totalDoors,
    rooms.length,
  );
  const externalWallArea = Math.max(0, perimeter * wallHeight - openings.external);
  const internalWallArea = Math.max(0, internalWallLength * wallHeight - openings.internal);

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
    const info = getBrickInfoById(materialId);

    for (const unit of wallUnitsFor(info, externalWallArea * ratio, internalWallArea * ratio, masonryWasteMultiplier)) {
      items.push(createBOQItem(
        unit.info.materialId,
        unit.info.name,
        'superstructure',
        unit.count,
        'each',
        `Walls (${(ratio * 100).toFixed(0)}% of plan) — ${unit.note}, less windows and doors`
      ));
      mortarVolumeTotal += (unit.count / 1000) * MORTAR_M3_PER_1000_BRICKS;
      mortarFor.push(`${unit.count.toLocaleString('en-US')} ${unit.info.name.toLowerCase()}`);
    }
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
  const mortarCementBagsPerM3 = getMortarCementBagsPerM3(cementType);

  // ============================================
  // SUBSTRUCTURE
  // ============================================
  if (hasScope('substructure')) {
    items.push(...substructureItems({ floorArea, perimeter, internalWallLength, brickType, cementType, locationType }));
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

      items.push(...ringBeamItems(totalWallLen, wallHeight, cementType, locationType));

    } else {
      // Walls stand on the slab, full height; the foundation walls are below it.
      const openings = wallOpenings(config.totalWindows || Math.ceil(floorArea / 15), config.totalDoors, roomCount);
      const units = wallUnitsFor(brickInfo, perimeter * wallHeight - openings.external, internalWallLength * wallHeight - openings.internal, masonryWasteMultiplier);
      // One line per brick: the same brick for inside and outside walls is bought together.
      for (const unit of units) {
        items.push(createBOQItem(unit.info.materialId, `${unit.info.name} (Walls)`, 'superstructure', unit.count, 'each', `${unit.note}, less windows and doors`));
      }

      const totalB = units.reduce((sum, unit) => sum + unit.count, 0);
      const mort = (totalB / 1000) * MORTAR_M3_PER_1000_BRICKS;
      items.push(createBOQItem(cementInfo.materialId, `${cementInfo.name} (Wall Mortar)`, 'superstructure', Math.ceil(mort * mortarCementBagsPerM3 * masonryWasteMultiplier), 'per 50kg bag', 'Mortar for laying the wall bricks'));
      items.push(createBOQItem('sand-bricks', 'Brick Sand (Wall Mortar)', 'superstructure', mort * SAND_M3_PER_M3_MORTAR * masonryWasteMultiplier, 'per cube', 'Mortar for laying the wall bricks'));

      const totalLen = perimeter + internalWallLength;
      items.push(...ringBeamItems(totalLen, wallHeight, cementType, locationType));
    }
  }

  // ============================================
  // ROOFING (Simple Area based)
  // ============================================
  if (hasScope('roofing')) {
    items.push(...calculateRoofing(floorArea, locationType, config.roofCovering, config.roofShape));
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

  if (hasScope('services')) {
    items.push(...calculateServices({ floorArea, roomCount }));
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
    items.push(...calculateLabor(items, config.laborRates));
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

const ROOF_PITCH_FACTOR = 1.06;
// Sheeted roofs here are pitched about 20° (1/cos 20° ≈ 1.06), tiled ones
// about 30° (1.15), a lean-to about 10° (1.02).
const TILE_PITCH_FACTOR = 1.15;
const LEAN_TO_PITCH_FACTOR = 1.02;
const HIP_CUTTING_WASTE = 1.05;
const ROOF_OVERHANG_M = 0.6;
const TRUSS_SPACING_M = 1.2;
/** Web members of a fink truss, as a share of its span. */
const TRUSS_WEB_FACTOR = 0.8;
const PURLIN_SPACING_M = 1.0;
const TILE_BATTEN_GAUGE_M = 0.32;
const BRANDERING_SPACING_M = 0.4;
const TIMBER_LENGTH_M = 6;
const ROOF_NAILS_KG_PER_SQM = 0.1;

// ============================================
// WALLING AND FOUNDATIONS — ZIMBABWE PRACTICE
// ============================================
// Audited 2026-10-18 against Harare cost models and the owner's building
// guide. The estimate had been pricing every wall half a brick thick (115 mm),
// foundations under the outside walls only, a metre less outside wall than
// the house has, and no concrete floor slab at all: a 120 m² house came to
// about 10,000 bricks and $2,500 to slab level, against 16,000–20,000 bricks
// and roughly $60–90/m² in published 2026 models.
//
// As houses are built here: every wall stands on a concrete strip footing
// (600 mm wide outside, 450 mm under the lighter inside walls) and one-brick
// (230 mm) foundation brickwork up to floor level; the floor is a 100 mm
// concrete slab on hardcore; above it, outside walls are one brick (230 mm)
// and inside walls half a brick (115 mm). A block wall is one block thick.

/** Footing to floor level: trench depth plus the rise to slab level. */
const FOUNDATION_WALL_HEIGHT_M = 1.0;
const INTERNAL_FOOTING_WIDTH_MM = 450;
/** A standard 813 x 2032 mm door leaf in its frame. */
const DOOR_OPENING_M2 = 1.89;
const WINDOW_OPENING_M2 = 1.44;
const EXTERIOR_DOOR_COUNT = 2;

const isBlockUnit = (materialId: string) => materialId.startsWith('block');

/** Units per m² of a one-brick (230 mm) wall. A block is already a full-thickness wall. */
function oneBrickUnitsPerSqm(info: { materialId: string; bricksPerSqm: number }): number {
  return isBlockUnit(info.materialId) ? info.bricksPerSqm : info.bricksPerSqm * 2;
}

type WallUnits = { info: { name: string; materialId: string; bricksPerSqm: number }; count: number; note: string };

/**
 * Bricks for walls of the given areas: outside walls one brick thick, inside
 * walls half a brick. A face-brick outside wall is a face skin backed by a
 * common-brick skin, so it buys some of each.
 */
function wallUnitsFor(
  info: { name: string; materialId: string; bricksPerSqm: number },
  externalArea: number,
  internalArea: number,
  wasteMultiplier: number,
): WallUnits[] {
  const ext = Math.max(0, externalArea);
  const int = Math.max(0, internalArea);
  if (info.materialId === BRICK_INFO.face_brick.materialId) {
    const common = BRICK_INFO.common;
    return [
      { info, count: Math.ceil(ext * info.bricksPerSqm * wasteMultiplier), note: `Outside face skin: ${ext.toFixed(1)}m²` },
      { info: common, count: Math.ceil((ext * common.bricksPerSqm + int * common.bricksPerSqm) * wasteMultiplier), note: `Inner skin of the outside walls ${ext.toFixed(1)}m² + inside walls ${int.toFixed(1)}m²` },
    ].filter((u) => u.count > 0);
  }
  const extCount = Math.ceil(ext * oneBrickUnitsPerSqm(info) * wasteMultiplier);
  const intCount = Math.ceil(int * info.bricksPerSqm * wasteMultiplier);
  const thick = isBlockUnit(info.materialId) ? '' : ' (230mm)';
  const thin = isBlockUnit(info.materialId) ? '' : ' (115mm)';
  return [{
    info,
    count: extCount + intCount,
    note: `Outside walls${thick} ${ext.toFixed(1)}m²: ${extCount.toLocaleString('en-US')} + inside walls${thin} ${int.toFixed(1)}m²: ${intCount.toLocaleString('en-US')}`,
  }];
}

/** Window and door openings, taken out of the wall areas they sit in. */
function wallOpenings(totalWindows: number, totalDoors: number | undefined, roomCount: number): { external: number; internal: number } {
  const interiorDoors = totalDoors && totalDoors > 0 ? Math.max(0, totalDoors - EXTERIOR_DOOR_COUNT) : Math.max(1, roomCount);
  return {
    external: Math.max(0, totalWindows) * WINDOW_OPENING_M2 + EXTERIOR_DOOR_COUNT * DOOR_OPENING_M2,
    internal: interiorDoors * DOOR_OPENING_M2,
  };
}

/** A brick course with its mortar joint. */
const COURSE_HEIGHT_M = 0.085;
/** Brickforce in every fourth course. */
const BRICKFORCE_EVERY_COURSES = 4;
const BRICKFORCE_ROLL_M = 20;

/**
 * The reinforced concrete ring beam on top of every wall — 230 mm wide, four
 * Y12 bars with Y10 stirrups — and brickforce in every fourth course. The
 * beam had its steel but no concrete; brickforce was one 20 m roll for every
 * 15 m of wall, a single layer where a 2.7 m wall has about eight.
 */
function ringBeamItems(allWalls: number, wallHeight: number, cementType: CementType, locationType: LocationType): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cement = CEMENT_INFO[cementType];
  const depthMm = BOQ_ASSUMPTIONS.ringBeam.depthMm[getBuildQuality(cementType)];
  const beamM3 = allWalls * (BOQ_ASSUMPTIONS.ringBeam.widthMm / 1000) * (depthMm / 1000) * (1 + BOQ_ASSUMPTIONS.concrete.waste[locationType]);
  const beamNote = `Ring beam ${allWalls.toFixed(1)}m @ ${BOQ_ASSUMPTIONS.ringBeam.widthMm}x${depthMm}mm (${beamM3.toFixed(1)}m³)`;
  items.push(createBOQItem(cement.materialId, `${cement.name} (Ring Beam)`, 'superstructure', Math.ceil(beamM3 * getConcreteCementBagsPerM3(cementType)), 'per 50kg bag', beamNote));
  items.push(createBOQItem('sand-river', 'River Sand (Ring Beam)', 'superstructure', beamM3 * 0.5, 'per cube', beamNote));
  items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm (Ring Beam)', 'superstructure', beamM3 * 0.8, 'per cube', beamNote));
  items.push(createBOQItem('rebar-12', 'Rebar Y12', 'superstructure', Math.ceil(allWalls * REBAR_Y12_PER_LM_RINGBEAM / 6), 'per length', `Ring beam: ${allWalls.toFixed(1)}m @ 4 bars`));
  items.push(createBOQItem('rebar-10', 'Rebar Y10', 'superstructure', Math.ceil(allWalls * STIRRUPS_PER_LM / 6), 'per length', 'Ring beam stirrups @ 250mm spacing'));
  const layers = Math.max(1, Math.floor(wallHeight / COURSE_HEIGHT_M / BRICKFORCE_EVERY_COURSES));
  items.push(createBOQItem('brickforce', 'Brickforce', 'superstructure', Math.ceil(allWalls * layers / BRICKFORCE_ROLL_M), 'per roll', `Every ${BRICKFORCE_EVERY_COURSES}th course: ${layers} layers x ${allWalls.toFixed(1)}m of wall`));
  return items;
}

/**
 * Everything to slab level: hardcore, damp proofing, termite treatment, strip
 * footings under every wall, one-brick foundation walls, and the floor slab.
 */
function substructureItems(input: {
  floorArea: number;
  perimeter: number;
  internalWallLength: number;
  brickType: BrickType;
  cementType: CementType;
  locationType: LocationType;
}): GeneratedBOQItem[] {
  const { floorArea, perimeter, internalWallLength, brickType, cementType, locationType } = input;
  const items: GeneratedBOQItem[] = [];
  const cement = CEMENT_INFO[cementType];
  const allWalls = perimeter + internalWallLength;
  const masonryWaste = getMasonryWasteMultiplier(locationType);
  const concreteBags = getConcreteCementBagsPerM3(cementType);

  items.push(createBOQItem('hardcore', 'Hardcore (Filling)', 'substructure', floorArea * HARDCORE_M3_PER_SQM, 'per cube', `${floorArea}m² floor @ 150mm thick`));
  items.push(createBOQItem('dpc', 'DPC Roll', 'substructure', Math.max(1, Math.ceil(allWalls / DPC_ROLL_LENGTH_M)), 'per roll', `Under every wall: ${allWalls.toFixed(1)}m`));
  items.push(createBOQItem('dpm', 'DPM 500 Gauge', 'substructure', Math.ceil(floorArea * DPM_SHEETS_PER_SQM / 50), 'per roll', `${floorArea}m² under the slab, with overlaps`));
  items.push(createBOQItem('termite-poison', 'Termite Poison', 'substructure', floorArea * TERMITE_POISON_L_PER_SQM, 'per litre', 'Soil treatment for foundation and slab'));

  // Strip footings: 600 mm under outside walls, 450 mm under inside walls.
  const footingDepthM = BOQ_ASSUMPTIONS.stripFooting.depthMm / 1000;
  const extWidthMm = BOQ_ASSUMPTIONS.stripFooting.widthMm[locationType];
  const footingM3 = (perimeter * (extWidthMm / 1000) + internalWallLength * (INTERNAL_FOOTING_WIDTH_MM / 1000)) * footingDepthM
    * getFoundationConcreteWasteMultiplier(locationType);
  const footingNote = `Strip footings ${BOQ_ASSUMPTIONS.stripFooting.depthMm}mm deep: ${perimeter.toFixed(1)}m outside @ ${extWidthMm}mm + ${internalWallLength.toFixed(1)}m inside @ ${INTERNAL_FOOTING_WIDTH_MM}mm (${footingM3.toFixed(1)}m³)`;
  items.push(createBOQItem(cement.materialId, `${cement.name} (Foundation Concrete)`, 'substructure', Math.ceil(footingM3 * concreteBags), 'per 50kg bag', footingNote));
  items.push(createBOQItem('sand-river', 'River Sand (Foundation Concrete)', 'substructure', footingM3 * 0.5, 'per cube', 'Strip footing concrete'));
  items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm (Foundation Concrete)', 'substructure', footingM3 * 0.8, 'per cube', 'Strip footing concrete'));

  // One-brick foundation walls under every wall, footing to floor level.
  // Common bricks: face brick is for what shows.
  const foundationBrick = brickType === 'face_brick' ? BRICK_INFO.common : BRICK_INFO[brickType];
  const foundationArea = allWalls * FOUNDATION_WALL_HEIGHT_M;
  const subBricks = Math.ceil(foundationArea * oneBrickUnitsPerSqm(foundationBrick) * masonryWaste);
  items.push(createBOQItem(foundationBrick.materialId, `${foundationBrick.name} (Foundation Walls)`, 'substructure', subBricks, 'each',
    `Foundation walls${isBlockUnit(foundationBrick.materialId) ? '' : ' (230mm)'} under every wall, footing to floor level: ${allWalls.toFixed(1)}m x ${FOUNDATION_WALL_HEIGHT_M}m`));
  const { cement: subCement, sand: subSand } = calculateMortar(subBricks, cementType, locationType);
  items.push(createBOQItem(cement.materialId, `${cement.name} (Foundation Mortar)`, 'substructure', subCement, 'per 50kg bag', `Mortar for laying ${subBricks.toLocaleString('en-US')} foundation bricks`));
  items.push(createBOQItem('sand-bricks', 'Brick Sand (Foundation Mortar)', 'substructure', subSand, 'per cube', 'Mortar for laying the foundation bricks'));

  // The floor slab: concrete over the hardcore and membrane, on mesh.
  // 100 mm whichever cement: the 85 mm "economy" slab was being chosen for
  // every build on 32.5 cement, which is most of them.
  const slabMm = BOQ_ASSUMPTIONS.slab.thicknessMm.standard;
  const slabM3 = floorArea * (slabMm / 1000) * (1 + BOQ_ASSUMPTIONS.concrete.waste[locationType]);
  const slabNote = `Floor slab ${floorArea}m² @ ${slabMm}mm (${slabM3.toFixed(1)}m³)`;
  items.push(createBOQItem(cement.materialId, `${cement.name} (Floor Slab)`, 'substructure', Math.ceil(slabM3 * concreteBags), 'per 50kg bag', slabNote));
  items.push(createBOQItem('sand-river', 'River Sand (Floor Slab)', 'substructure', slabM3 * 0.5, 'per cube', slabNote));
  items.push(createBOQItem('stone-19mm', 'Crushed Stone 19mm (Floor Slab)', 'substructure', slabM3 * 0.8, 'per cube', slabNote));
  items.push(createBOQItem('mesh-ref193', 'Welded Mesh Ref 193', 'substructure', Math.ceil(floorArea * MESH_SHEETS_PER_SQM), 'per sheet', `Floor slab reinforcement: ${floorArea}m²`));

  return items;
}

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
  internalWallLength: number,
  config: VisionConfig,
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): GeneratedBOQItem[] {
  const cfg = normalizeConfig(config);
  return substructureItems({
    floorArea: totalArea,
    perimeter: perimeterLength,
    internalWallLength,
    brickType: cfg.brickType,
    cementType: cfg.cementType,
    locationType,
  });
}

// ============================================
// SUPERSTRUCTURE CALCULATIONS
// ============================================

function calculateSuperstructure(
  externalWallLength: number,
  internalWallLength: number,
  config: VisionConfig,
  openings: { external: number; internal: number },
  locationType: LocationType = DEFAULT_LOCATION_TYPE
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const cfg = normalizeConfig(config);
  const masonryWasteMultiplier = getMasonryWasteMultiplier(locationType);

  // Walls stand on the slab, full height; the foundation walls are below it.
  const units = wallUnitsFor(
    BRICK_INFO[cfg.brickType],
    externalWallLength * cfg.wallHeight - openings.external,
    internalWallLength * cfg.wallHeight - openings.internal,
    masonryWasteMultiplier,
  );
  for (const unit of units) {
    items.push(createBOQItem(unit.info.materialId, `${unit.info.name} (Walls)`, 'superstructure', unit.count, 'each', `${unit.note}, less windows and doors`));
  }

  const totalSuperBricks = units.reduce((sum, unit) => sum + unit.count, 0);

  const { cement, sand } = calculateMortar(totalSuperBricks, cfg.cementType, locationType);
  items.push(createBOQItem(cfg.cementType === 'cement_425' ? 'cement-425' : 'cement-325', `${CEMENT_INFO[cfg.cementType].name} (Wall Mortar)`, 'superstructure', cement, 'per 50kg bag', 'Mortar for laying the wall bricks'));
  items.push(createBOQItem('sand-bricks', 'Bricklaying Sand (Wall Mortar)', 'superstructure', sand, 'per cube', 'Mortar for laying the wall bricks'));

  items.push(...ringBeamItems(externalWallLength + internalWallLength, cfg.wallHeight, cfg.cementType, locationType));

  return items;
}

// ============================================
// ROOFING CALCULATIONS
// ============================================

function calculateRoofing(
  totalArea: number,
  locationType: LocationType = DEFAULT_LOCATION_TYPE,
  roofCovering: RoofCovering = DEFAULT_ROOF_COVERING,
  roofShape: RoofShape = DEFAULT_ROOF_SHAPE,
): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const shape = ROOF_SHAPES[roofShape] ? roofShape : DEFAULT_ROOF_SHAPE;
  const tileRoof = roofCovering === 'concrete_tile';

  // Plan shape as estimateDimensions assumes it, 1.4:1, with the eaves
  // overhanging 600 mm all round. The roof covers the overhang too: the area
  // had been the floor area times the pitch, about 20% short.
  const length = Math.sqrt(totalArea * 1.4);
  const width = totalArea / length;
  const planLength = length + ROOF_OVERHANG_M * 2;
  const planWidth = width + ROOF_OVERHANG_M * 2;
  // Sheeted roofs are pitched about 20°, tiled ones about 30°, a lean-to less.
  const pitch = shape === 'lean_to' ? LEAN_TO_PITCH_FACTOR : tileRoof ? TILE_PITCH_FACTOR : ROOF_PITCH_FACTOR;
  const roofArea = planLength * planWidth * pitch;
  // A hipped roof's sheets are cut at every hip.
  const cuttingWaste = shape === 'hipped' ? HIP_CUTTING_WASTE : 1;
  const roofAreaWithWaste = roofArea * getRoofingWasteMultiplier(locationType) * cuttingWaste;
  const covering = ROOF_COVERINGS[roofCovering] ?? ROOF_COVERINGS[DEFAULT_ROOF_COVERING];
  const coveringQuantity = Math.ceil(roofAreaWithWaste / covering.coverage);
  items.push(createBOQItem(covering.materialId, covering.materialName, 'roofing', coveringQuantity, covering.unit,
    `${ROOF_SHAPES[shape].label} roof: ${roofArea.toFixed(1)}m² including 600mm eaves, + ${shape === 'hipped' ? 'hip cutting and ' : ''}location waste; ${covering.coverage.toFixed(2)}m² effective cover per ${covering.unit.replace('per ', '')}. Confirm laps and pitch with supplier.${tileRoof ? ' Fixings and ridge pieces require a separate quote.' : ''}`));

  if (covering.fixingRate > 0) {
    const screwBoxes = Math.ceil((coveringQuantity * covering.fixingRate) / 100);
    items.push(createBOQItem('screws-roof', 'Roof Screws 65mm', 'roofing', screwBoxes, 'per 100', `${coveringQuantity} ${covering.unit.replace('per ', '')} @ ${covering.fixingRate} screws each`));
  }

  // The structure, as a Zimbabwe roof is built: timber trusses at 1.2 m on a
  // wall plate, tied down with hoop iron, then purlins at about 1 m for metal
  // sheeting or battens at the tile gauge. A lean-to has single rafters.
  const lengthsOf = (metres: number) => Math.ceil((metres * 1.05) / TIMBER_LENGTH_M);
  const wallPlateM = 2 * (length + width);
  const frames = Math.ceil(length / TRUSS_SPACING_M) + 1;
  let frameM: number;
  let frameNote: string;
  if (shape === 'lean_to') {
    const rafter = planWidth * pitch;
    frameM = frames * rafter;
    frameNote = `${frames} rafters @ ${TRUSS_SPACING_M}m, ${rafter.toFixed(1)}m each`;
  } else {
    const rafter = (planWidth / 2) * pitch;
    // Each truss: two rafters, the tie beam across the span, and its webs.
    frameM = frames * (rafter * 2 + planWidth + width * TRUSS_WEB_FACTOR);
    frameNote = `${frames} trusses @ ${TRUSS_SPACING_M}m`;
    if (shape === 'hipped') {
      // Four hip rafters, and the jack rafters running up to them, which
      // take about as much timber again as the hips.
      const hip = Math.hypot(rafter, planWidth / 2);
      frameM += 4 * hip * 2;
      frameNote += ` + 4 hips with jack rafters (${hip.toFixed(1)}m each)`;
    }
  }
  items.push(createBOQItem('timber-50x76', 'Timber 50x76mm (Roof Frame & Wall Plate)', 'roofing', lengthsOf(frameM + wallPlateM), 'per 6m length',
    `${frameNote} (${Math.round(frameM)}m) + wall plate ${Math.round(wallPlateM)}m${tileRoof ? '. Concrete tiles are heavy: have the roof design checked by an engineer' : ''}`));

  // Purlins or battens run across the whole slope area, whatever the shape.
  const slopeArea = planLength * planWidth * pitch;
  if (tileRoof) {
    items.push(createBOQItem('timber-38x38', 'Timber 38x38mm (Tile Battens)', 'roofing', lengthsOf(slopeArea / TILE_BATTEN_GAUGE_M), 'per 6m length', `Battens @ ${TILE_BATTEN_GAUGE_M * 1000}mm gauge; confirm with the tile specification`));
  } else {
    items.push(createBOQItem('timber-50x76', 'Timber 50x76mm (Purlins)', 'roofing', lengthsOf(slopeArea / PURLIN_SPACING_M), 'per 6m length', `Purlins @ ${PURLIN_SPACING_M}m over ${slopeArea.toFixed(0)}m² of roof`));
  }

  // Ceiling brandering, which every roof needs whatever covers it.
  items.push(createBOQItem('timber-38x38', 'Timber 38x38mm (Ceiling Brandering)', 'roofing', lengthsOf(totalArea / BRANDERING_SPACING_M), 'per 6m length', `Brandering @ ${BRANDERING_SPACING_M * 1000}mm under ${totalArea}m² of ceiling`));
  items.push(createBOQItem('hoop-iron', 'Hoop Iron Straps', 'roofing', frames * 2, 'each', `Each ${shape === 'lean_to' ? 'rafter' : 'truss'} tied down at both walls`));
  items.push(createBOQItem('nails-100', 'Wire Nails 100mm', 'roofing', Math.ceil(roofArea * ROOF_NAILS_KG_PER_SQM), 'per kg', 'Frame, purlin and brandering joints'));

  // Ridge and hips are capped; a lean-to has a flashing at its top edge instead.
  const ridgeM = shape === 'hipped' ? Math.max(0, length - width) : shape === 'gable' ? planLength : 0;
  const hipsM = shape === 'hipped' ? 4 * Math.hypot((planWidth / 2) * pitch, planWidth / 2) : 0;
  if (!tileRoof && ridgeM + hipsM > 0) {
    items.push(createBOQItem('ridge-ibr', shape === 'hipped' ? 'Ridge & Hip Capping 2.4m' : 'Ridge Capping 2.4m', 'roofing', Math.ceil((ridgeM + hipsM) / 2.2), 'each',
      shape === 'hipped' ? `Ridge ${ridgeM.toFixed(1)}m + 4 hips ${hipsM.toFixed(1)}m, lapped` : `Ridge ${ridgeM.toFixed(1)}m, lapped`));
  }

  // Fascia round the eaves (and up the gable or lean-to ends); gutters on every eave.
  const eavesM = shape === 'hipped' ? 2 * (planLength + planWidth) : shape === 'gable' ? 2 * planLength : planLength;
  const vergeM = shape === 'gable' ? 4 * (planWidth / 2) * pitch : shape === 'lean_to' ? 2 * planWidth * pitch + planLength : 0;
  items.push(createBOQItem('fascia-pvc', 'Fascia Board 228mm', 'roofing', Math.ceil((eavesM + vergeM) / 6), 'per 6m length', shape === 'hipped' ? 'Right round the eaves' : 'Eaves and the sloping ends'));
  items.push(createBOQItem('gutter-pvc', 'PVC Gutter', 'roofing', Math.ceil(eavesM / 6), 'per 6m length',
    `${shape === 'hipped' ? 'All four eaves' : shape === 'gable' ? 'Both long eaves' : 'The low eave'}: ${eavesM.toFixed(1)}m. Downpipes and brackets: add from your supplier's quote`));

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
const GLAZED_SHARE = 0.85;
const SOCKETS_PER_ROOM = 3;
const KITCHEN_EXTRA_SOCKETS = 4;
const EXTRA_LIGHT_POINTS = 3;
const CABLE_M_PER_SOCKET = 8;
const CABLE_M_PER_LIGHT = 8;
const CONDUIT_LENGTHS_PER_POINT = 2;
const CIRCUIT_BREAKERS = 6;
const FLOOR_M2_PER_BATHROOM = 60;
const COPPER_M_PER_POINT = 12;
const FITTINGS_PER_POINT = 6;
const WASTE_M_PER_FITTING = 3;
const SOIL_M_PER_WC = 6;
const SOIL_RUN_TO_SEWER_M = 18;
const KITCHEN_UNITS_M: Record<FinishLevel, number> = { economy: 0, standard: 5.5, premium: 7.5 };
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
  // Steel frames are sold unglazed; most Zimbabwe houses also bar every window.
  items.push(createBOQItem('glass-4mm', 'Clear Glass 4mm', 'finishing', roundTo(totalWindows * WINDOW_AREA_M2 * GLAZED_SHARE, 1), 'per m²', `Glazing for ${totalWindows} windows`));
  items.push(createBOQItem('burglar-bars', 'Burglar Bars', 'finishing', totalWindows, 'per window', 'One set per window'));

  // ── Kitchen units ────────────────────────────────────────────────────────
  // Propzone's standard Harare spec: about 3 m of base and 2.5 m of wall
  // units with worktop and sink. An economy kitchen starts with a sink unit.
  const kitchenM = KITCHEN_UNITS_M[finishLevel];
  if (kitchenM > 0) {
    items.push(createBOQItem('kitchen-units', 'Kitchen Units', 'finishing', kitchenM, 'per metre', `${kitchenM}m of base and wall units, worktop and sink. Replace with your joiner's quote`));
  } else {
    items.push(createBOQItem('sink-kitchen', 'Kitchen Sink', 'finishing', 1, 'each', 'Sink only; units added later'));
  }

  return items;
}

/**
 * Plumbing & Electrical: separate trades, quoted and paid separately from the
 * builder, so their own stage (owner's decision, 2026-10-18).
 */
function calculateServices(input: { floorArea: number; roomCount: number }): GeneratedBOQItem[] {
  const { floorArea, roomCount } = input;
  const items: GeneratedBOQItem[] = [];

  // ── Electrical: counted per room, as an electrician lays it out ──────────
  // About three double sockets a room and four more in the kitchen, a light
  // and its switch in each room plus the passage and two outside — 25–30
  // points and 10–12 lights on a 3-bedroom house, as the Propzone 2026 Harare
  // model has. The estimate had been two rolls of cable and a board.
  const sockets = roomCount * SOCKETS_PER_ROOM + KITCHEN_EXTRA_SOCKETS;
  const lights = roomCount + EXTRA_LIGHT_POINTS;
  const points = sockets + lights;
  items.push(createBOQItem('socket-double', 'Double Socket 13A', 'services', sockets, 'each', `${SOCKETS_PER_ROOM} a room + ${KITCHEN_EXTRA_SOCKETS} in the kitchen`));
  items.push(createBOQItem('switch-1g', 'Light Switch', 'services', lights, 'each', 'One per light'));
  items.push(createBOQItem('light-led-4ft', 'Light Fitting (LED)', 'services', lights, 'each', `${roomCount} rooms + passage and outside lights`));
  items.push(createBOQItem('cable-25', 'Cable 2.5mm T&E (Sockets)', 'services', Math.max(1, Math.ceil((sockets * CABLE_M_PER_SOCKET) / CABLE_ROLL_LENGTH_M)), 'per 100m roll', `${sockets} sockets @ ${CABLE_M_PER_SOCKET}m`));
  // Lighting is run in single-core wire: live, neutral and earth.
  items.push(createBOQItem('cable-15', 'House Wire 1.5mm (Lights)', 'services', Math.max(3, Math.ceil((lights * CABLE_M_PER_LIGHT * 3) / CABLE_ROLL_LENGTH_M)), 'per 100m roll', `${lights} lights @ ${CABLE_M_PER_LIGHT}m, three cores`));
  items.push(createBOQItem('conduit-20', 'PVC Conduit 20mm', 'services', Math.ceil(points * CONDUIT_LENGTHS_PER_POINT), 'per 4m length', `${points} points`));
  items.push(createBOQItem('db-8way', 'Distribution Board 8-Way', 'services', 1, 'each', 'Consumer unit'));
  items.push(createBOQItem('mcb-sp', 'Circuit Breakers', 'services', CIRCUIT_BREAKERS, 'each', 'Lights, sockets, geyser and stove circuits. Not yet priced: the 6mm geyser and stove cable and an earth leakage unit — add them from your electrician\'s quote'));

  // ── Plumbing and sanitaryware, per bathroom ──────────────────────────────
  // A bathroom for about every 60 m²: two on a 3-bedroom house (main and
  // en-suite). The main one has a bath, the others a shower. The estimate had
  // pipes and a geyser and nothing to connect them to.
  const bathrooms = Math.max(1, Math.round(floorArea / FLOOR_M2_PER_BATHROOM));
  const showers = bathrooms - 1;
  items.push(createBOQItem('wc-suite-cc', 'WC Suite (Close-Coupled)', 'services', bathrooms, 'each', `${bathrooms} bathroom${bathrooms === 1 ? '' : 's'}`));
  items.push(createBOQItem('basin-pedestal', 'Wash Basin & Pedestal', 'services', bathrooms, 'each', 'One per bathroom'));
  items.push(createBOQItem('mixer-basin', 'Basin Mixer', 'services', bathrooms, 'each', 'One per basin'));
  items.push(createBOQItem('bath-skirted', 'Bath', 'services', 1, 'each', 'Main bathroom'));
  items.push(createBOQItem('mixer-bath', 'Bath Mixer with Hand Shower', 'services', 1, 'each', 'Main bathroom'));
  if (showers > 0) items.push(createBOQItem('shower-mixer', 'Shower Mixer Set', 'services', showers, 'each', 'Other bathrooms: tiled shower'));
  items.push(createBOQItem('mixer-sink', 'Sink Mixer', 'services', 1, 'each', 'Kitchen'));
  items.push(createBOQItem('tap-garden', 'Garden Taps', 'services', 2, 'each', 'Front and back'));
  items.push(createBOQItem('stopcock-15', 'Stopcock 15mm', 'services', 1, 'each', 'Main water shut-off'));

  // Hot and cold to each fitting, wastes to each wet fitting, soil from each
  // WC, and a run to the sewer or septic tank.
  const waterPoints = bathrooms * 3 + 1 /* sink */ + 1 /* washing machine */ + 2 /* garden taps */ + 1 /* geyser */;
  const copperM = waterPoints * COPPER_M_PER_POINT;
  items.push(createBOQItem('pipe-15-copper', 'Copper Pipe 15mm', 'services', Math.ceil(copperM / COPPER_PIPE_LENGTH_M), 'per 5.5m length', `${waterPoints} water points @ ${COPPER_M_PER_POINT}m, hot and cold`));
  items.push(createBOQItem('copper-fitting-15', 'Copper Fittings 15mm', 'services', waterPoints * FITTINGS_PER_POINT, 'each', `Elbows and tees: ${FITTINGS_PER_POINT} a point`));
  const wetFittings = bathrooms * 2 + 2; // basins, baths/showers, sink, washing machine
  items.push(createBOQItem('pipe-40-pvc', 'PVC Waste Pipe 40mm', 'services', Math.max(1, Math.ceil((wetFittings * WASTE_M_PER_FITTING) / WASTE_PIPE_LENGTH_M)), 'per 6m length', `${wetFittings} wet fittings @ ${WASTE_M_PER_FITTING}m`));
  items.push(createBOQItem('pipe-110-pvc', 'PVC Soil Pipe 110mm', 'services', Math.ceil((bathrooms * SOIL_M_PER_WC + SOIL_RUN_TO_SEWER_M) / SOIL_PIPE_LENGTH_M), 'per 6m length', `${bathrooms} WC${bathrooms === 1 ? '' : 's'} + ${SOIL_RUN_TO_SEWER_M}m to the sewer or septic tank`));
  items.push(createBOQItem('gully-110', 'Gully Trap 110mm', 'services', bathrooms + 1, 'each', 'Bathrooms and kitchen'));
  items.push(createBOQItem('geyser-150', 'Geyser 150L', 'services', 1, 'each', 'Hot water'));

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

function calculateLabor(materialItems: GeneratedBOQItem[], rates?: LaborRates): GeneratedBOQItem[] {
  return LABOR_SUBSTAGES.flatMap((substage) => {
    const materials = materialItems.filter((item) => laborSubstageFor(item) === substage.id);
    if (materials.length === 0) return [];
    const materialUsd = materials.reduce((sum, item) => sum + item.totalUsd, 0);
    const materialZwg = materials.reduce((sum, item) => sum + item.totalZwg, 0);
    const percentage = laborPercentageFor(substage.id, rates);
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
    allItems.push(...calculateSubstructure(totalArea, perimeterLength, internalWallLength, config, locationType));
  }

  if (hasScope('superstructure')) {
    const windows = detectedWindows && detectedWindows > 0 ? detectedWindows : Math.ceil(totalArea / 15);
    allItems.push(...calculateSuperstructure(perimeterLength, internalWallLength, config, wallOpenings(windows, detectedDoors, rooms.length), locationType));
  }

  if (hasScope('roofing')) {
    allItems.push(...calculateRoofing(totalArea, locationType, config.roofCovering, config.roofShape));
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

  if (hasScope('services')) {
    allItems.push(...calculateServices({ floorArea: totalArea, roomCount: rooms.length }));
  }

  if (hasScope('exterior')) {
    allItems.push(...calculateExteriorWorks({
      floorArea: totalArea,
      perimeter: perimeterLength,
      cementType: getFirstValue(config.cementType),
    }));
  }

  if (includeLabor) {
    allItems.push(...calculateLabor(allItems, config.laborRates));
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
