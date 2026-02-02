// BOQ Calculation Engine
// Converts floor plan dimensions to material quantities

import {
  DetectedRoom,
  DetectedWall,
  VisionConfig,
  GeneratedBOQItem,
  BRICK_INFO,
  CEMENT_INFO,
  BrickType,
  CementType,
} from '@/lib/vision/types';
import { getBestPrice } from '@/lib/materials';

// ============================================
// CONSTANTS
// ============================================

// Mortar requirements
const MORTAR_M3_PER_1000_BRICKS = 0.5;
const SAND_M3_PER_M3_MORTAR = 1.2;
const WASTAGE_FACTOR = 1.05; // 5% wastage

// Foundation/Substructure
const HARDCORE_M3_PER_SQM = 0.15; // 150mm thick
const DPM_SHEETS_PER_SQM = 1.1; // with overlaps
const CONCRETE_M3_PER_LM_FOUNDATION = 0.18; // 600mm x 300mm strip

// Steel requirements
const REBAR_Y12_PER_LM_RINGBEAM = 4; // 4 bars
const STIRRUPS_PER_LM = 4; // at 250mm spacing
const MESH_SHEETS_PER_SQM = 0.07; // 2.4m x 6m sheets

// Roofing
const IBR_SHEETS_PER_SQM = 0.49; // 0.762m effective width, 3m length
const ROOF_SCREWS_PER_SHEET = 8;
const ROOF_PITCH_FACTOR = 1.15; // 15 degree pitch adds ~15% area

// Labor estimates (days per sqm of floor area)
const LABOR_DAYS_PER_SQM = {
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
  // Fallback prices
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

  // Hardcore
  const hardcoreM3 = totalArea * HARDCORE_M3_PER_SQM;
  items.push(
    createBOQItem(
      'aggregate-hardcore',
      'Hardcore',
      'substructure',
      hardcoreM3,
      'per cube',
      `${totalArea}m² floor @ 150mm thick`
    )
  );

  // DPM (Damp Proof Membrane)
  const dpmSheets = Math.ceil(totalArea * DPM_SHEETS_PER_SQM / 50); // 50sqm rolls
  items.push(
    createBOQItem(
      'dpm-500',
      'DPM 500 Gauge',
      'substructure',
      dpmSheets,
      'per roll',
      `${totalArea}m² coverage with overlaps`
    )
  );

  // Foundation concrete (strip foundation)
  const concreteM3 = perimeterLength * CONCRETE_M3_PER_LM_FOUNDATION;
  const concreteCement = Math.ceil(concreteM3 * 7); // 7 bags per m³
  items.push(
    createBOQItem(
      config.cementType === 'cement_425' ? 'cement-425' : 'cement-325',
      CEMENT_INFO[config.cementType].name,
      'substructure',
      concreteCement,
      'per 50kg bag',
      `Foundation: ${perimeterLength.toFixed(1)}m perimeter`
    )
  );

  // Foundation sand
  const foundationSand = Math.ceil(concreteM3 * 0.5 * 10) / 10;
  items.push(
    createBOQItem(
      'sand-river',
      'River Sand',
      'substructure',
      foundationSand,
      'per cube',
      'Foundation concrete mix'
    )
  );

  // Foundation stone
  const foundationStone = Math.ceil(concreteM3 * 0.8 * 10) / 10;
  items.push(
    createBOQItem(
      'aggregate-19mm',
      'Crushed Stone 19mm',
      'substructure',
      foundationStone,
      'per cube',
      'Foundation concrete mix'
    )
  );

  // Substructure walls (to window level ~1m)
  const subWallArea = perimeterLength * 1.0;
  const { bricks: subBricks, note: brickNote } = calculateWallBricks(
    perimeterLength,
    1.0,
    config.brickType
  );
  items.push(
    createBOQItem(
      BRICK_INFO[config.brickType].materialId,
      BRICK_INFO[config.brickType].name,
      'substructure',
      subBricks,
      BRICK_INFO[config.brickType].bricksPerSqm > 20 ? 'per 1000' : 'each',
      `Substructure walls: ${brickNote}`
    )
  );

  // Mortar for substructure
  const { cement: subCement, sand: subSand } = calculateMortar(subBricks, config.cementType);
  items.push(
    createBOQItem(
      config.cementType === 'cement_425' ? 'cement-425' : 'cement-325',
      CEMENT_INFO[config.cementType].name,
      'substructure',
      subCement,
      'per 50kg bag',
      `Mortar for ${subBricks} bricks`
    )
  );
  items.push(
    createBOQItem(
      'sand-bricks',
      'Bricklaying Sand',
      'substructure',
      subSand,
      'per cube',
      'Mortar sand'
    )
  );

  // Mesh for slab
  const meshSheets = Math.ceil(totalArea * MESH_SHEETS_PER_SQM);
  items.push(
    createBOQItem(
      'mesh-ref193',
      'Welded Mesh Ref 193',
      'substructure',
      meshSheets,
      'per sheet',
      `Floor slab: ${totalArea}m²`
    )
  );

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

  // Calculate external and internal wall lengths
  const externalWallLength = walls
    .filter((w) => w.type === 'external')
    .reduce((sum, w) => sum + w.length, 0) / 4; // Divide by 4 as each room has 4 walls counted
  const internalWallLength = walls
    .filter((w) => w.type === 'internal')
    .reduce((sum, w) => sum + w.length, 0) / 4;

  // External walls (window to roof level = wallHeight - 1m substructure)
  const superWallHeight = config.wallHeight - 1.0;
  const { bricks: extBricks } = calculateWallBricks(
    externalWallLength,
    superWallHeight,
    config.brickType
  );
  items.push(
    createBOQItem(
      BRICK_INFO[config.brickType].materialId,
      BRICK_INFO[config.brickType].name,
      'superstructure',
      extBricks,
      BRICK_INFO[config.brickType].bricksPerSqm > 20 ? 'per 1000' : 'each',
      `External walls: ${externalWallLength.toFixed(1)}m x ${superWallHeight}m`
    )
  );

  // Internal walls (full height for partitions)
  if (internalWallLength > 0) {
    const { bricks: intBricks } = calculateWallBricks(
      internalWallLength,
      config.wallHeight,
      config.brickType
    );
    items.push(
      createBOQItem(
        BRICK_INFO[config.brickType].materialId,
        BRICK_INFO[config.brickType].name,
        'superstructure',
        intBricks,
        BRICK_INFO[config.brickType].bricksPerSqm > 20 ? 'per 1000' : 'each',
        `Internal walls: ${internalWallLength.toFixed(1)}m x ${config.wallHeight}m`
      )
    );
  }

  // Total bricks for mortar calculation
  const totalSuperBricks = extBricks + (internalWallLength > 0 ?
    calculateWallBricks(internalWallLength, config.wallHeight, config.brickType).bricks : 0);

  // Mortar
  const { cement, sand } = calculateMortar(totalSuperBricks, config.cementType);
  items.push(
    createBOQItem(
      config.cementType === 'cement_425' ? 'cement-425' : 'cement-325',
      CEMENT_INFO[config.cementType].name,
      'superstructure',
      cement,
      'per 50kg bag',
      `Mortar for superstructure walls`
    )
  );
  items.push(
    createBOQItem(
      'sand-bricks',
      'Bricklaying Sand',
      'superstructure',
      sand,
      'per cube',
      'Mortar sand'
    )
  );

  // Ring beam steel
  const totalWallLength = externalWallLength + internalWallLength;
  const rebarY12 = Math.ceil((totalWallLength * REBAR_Y12_PER_LM_RINGBEAM) / 6); // 6m lengths
  items.push(
    createBOQItem(
      'rebar-12',
      'Rebar Y12',
      'superstructure',
      rebarY12,
      'per 6m length',
      `Ring beam: ${totalWallLength.toFixed(1)}m @ 4 bars`
    )
  );

  // Stirrups
  const stirrupsY10 = Math.ceil((totalWallLength * STIRRUPS_PER_LM) / 6);
  items.push(
    createBOQItem(
      'rebar-10',
      'Rebar Y10',
      'superstructure',
      stirrupsY10,
      'per 6m length',
      `Ring beam stirrups @ 250mm spacing`
    )
  );

  // Brickforce
  const brickforceRolls = Math.ceil(totalWallLength / 15); // 15m rolls
  items.push(
    createBOQItem(
      'brickforce',
      'Brickforce',
      'superstructure',
      brickforceRolls,
      'per roll',
      `Wall reinforcement every 3rd course`
    )
  );

  return items;
}

// ============================================
// ROOFING CALCULATIONS
// ============================================

function calculateRoofing(totalArea: number): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];

  const roofArea = totalArea * ROOF_PITCH_FACTOR;

  // IBR Sheets
  const ibrSheets = Math.ceil(roofArea * IBR_SHEETS_PER_SQM * WASTAGE_FACTOR);
  items.push(
    createBOQItem(
      'ibr-05-3m',
      'IBR Sheets 0.5mm x 3m',
      'roofing',
      ibrSheets,
      'per sheet',
      `Roof area: ${roofArea.toFixed(1)}m²`
    )
  );

  // Roof screws
  const screwBoxes = Math.ceil((ibrSheets * ROOF_SCREWS_PER_SHEET) / 100);
  items.push(
    createBOQItem(
      'screws-roof',
      'Roof Screws 65mm',
      'roofing',
      screwBoxes,
      'per 100',
      `${ibrSheets} sheets @ ${ROOF_SCREWS_PER_SHEET} screws each`
    )
  );

  // Timber - rafters
  const rafterCount = Math.ceil(roofArea / 6); // 1 rafter per 6sqm approx
  items.push(
    createBOQItem(
      'timber-50x76',
      'Timber 50x76mm',
      'roofing',
      rafterCount,
      'per 6m length',
      'Roof rafters @ 600mm spacing'
    )
  );

  // Timber - brandering
  const branderingCount = Math.ceil(roofArea / 4);
  items.push(
    createBOQItem(
      'timber-38x38',
      'Timber 38x38mm',
      'roofing',
      branderingCount,
      'per 6m length',
      'Brandering @ 400mm spacing'
    )
  );

  // Fascia board
  const fasciaLength = Math.ceil(Math.sqrt(roofArea) * 4 / 6);
  items.push(
    createBOQItem(
      'fascia-board',
      'Fascia Board 228mm',
      'roofing',
      fasciaLength,
      'per 6m length',
      'Perimeter fascia'
    )
  );

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

  const laborDays = Math.ceil(totalArea * LABOR_DAYS_PER_SQM[scope]);
  const builderDays = laborDays;
  const assistantDays = Math.ceil(laborDays * 1.5); // 1.5 assistants per builder
  const foremanDays = Math.ceil(laborDays / 10); // 1 foreman per 10 days

  items.push(
    createBOQItem(
      'labor-builder',
      'Builder (Daily Rate)',
      'labor',
      builderDays,
      'per day',
      `${totalArea}m² @ ${LABOR_DAYS_PER_SQM[scope]} days/m²`
    )
  );

  items.push(
    createBOQItem(
      'labor-assistant',
      'General Hand (Daily Rate)',
      'labor',
      assistantDays,
      'per day',
      '1.5 assistants per builder'
    )
  );

  if (foremanDays > 0) {
    items.push(
      createBOQItem(
        'labor-foreman',
        'Foreman (Daily Rate)',
        'labor',
        foremanDays,
        'per day',
        'Site supervision'
      )
    );
  }

  // Food allowance
  const foodDays = builderDays + assistantDays + foremanDays;
  items.push(
    createBOQItem(
      'service-food',
      "Builder's Food Allowance",
      'labor',
      foodDays,
      'per day',
      `${foodDays} person-days`
    )
  );

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
  // Reset counter for consistent IDs
  itemIdCounter = 0;

  const allItems: GeneratedBOQItem[] = [];

  // Calculate derived values
  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const perimeterLength = walls
    .filter((w) => w.type === 'external')
    .reduce((sum, w) => sum + w.length, 0) / 4; // Approximate perimeter

  const { scope, includeLabor } = config;

  // Generate items based on scope
  if (scope === 'full_house' || scope === 'substructure') {
    allItems.push(...calculateSubstructure(totalArea, perimeterLength, config));
  }

  if (scope === 'full_house' || scope === 'superstructure') {
    allItems.push(...calculateSuperstructure(rooms, walls, config));
  }

  if (scope === 'full_house' || scope === 'roofing') {
    allItems.push(...calculateRoofing(totalArea));
  }

  // Labor if requested
  if (includeLabor) {
    allItems.push(...calculateLabor(totalArea, scope));
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
