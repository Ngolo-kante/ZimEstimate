import { describe, expect, it } from 'vitest';
import { councilRequiresFullBrickWalls, estimateVisionWallDimensions, generateBOQ, generateBOQFromBasics, ManualBuilderConfig } from './index';
import { getBestPrice } from '../materials';
import { cleanLaborRates, isLaborCategory, laborRateFor, laborRatesFromNotes } from './laborSubstages';
import type { DetectedRoom, DetectedWall } from '../vision/types';

function getItemQuantity(items: ReturnType<typeof generateBOQFromBasics>, notePrefix: string): number {
  const item = items.find((entry) => entry.calculationNote.startsWith(notePrefix));
  if (!item) throw new Error(`Missing item with note prefix: ${notePrefix}`);
  return item.quantity;
}

describe('generateBOQFromBasics assumptions', () => {
  it('applies location-based footing and roofing assumptions', () => {
    const base: ManualBuilderConfig = {
      floorArea: 120,
      roomCount: 6,
      wallHeight: 2.7,
      brickTypes: ['common'],
      cementTypes: ['cement_425'],
      scope: ['substructure', 'roofing'],
      includeLabor: false,
    };

    const urban = generateBOQFromBasics({ ...base, locationType: 'urban' });
    const rural = generateBOQFromBasics({ ...base, locationType: 'rural' });

    const urbanFoundationCement = getItemQuantity(urban, 'Strip footings');
    const ruralFoundationCement = getItemQuantity(rural, 'Strip footings');
    expect(urbanFoundationCement).toBeGreaterThan(ruralFoundationCement);

    const urbanRoofSheets = getItemQuantity(urban, 'Hipped roof');
    const ruralRoofSheets = getItemQuantity(rural, 'Hipped roof');
    expect(ruralRoofSheets).toBeGreaterThan(urbanRoofSheets);
  });

  it('uses cement profile to adjust mortar bag rates', () => {
    const base: ManualBuilderConfig = {
      floorArea: 120,
      roomCount: 6,
      wallHeight: 2.7,
      brickTypes: ['common'],
      cementTypes: ['cement_325'],
      scope: 'superstructure',
      includeLabor: false,
      locationType: 'urban',
    };

    const economy = generateBOQFromBasics({ ...base, cementTypes: ['cement_325'] });
    const standard = generateBOQFromBasics({ ...base, cementTypes: ['cement_425'] });

    const economyMortarCement = getItemQuantity(economy, 'Mortar for laying the wall bricks');
    const standardMortarCement = getItemQuantity(standard, 'Mortar for laying the wall bricks');
    expect(standardMortarCement).toBeGreaterThan(economyMortarCement);
  });

  it('assigns usable prices to generated stage materials', () => {
    const items = generateBOQFromBasics({
      floorArea: 120,
      roomCount: 6,
      wallHeight: 2.7,
      brickTypes: ['common'],
      cementTypes: ['cement_325'],
      scope: ['substructure', 'superstructure', 'roofing'],
      includeLabor: false,
      locationType: 'urban',
    });

    const pricedMaterialIds = [
      'hardcore',
      'dpc',
      'termite-poison',
      'stone-19mm',
      'mesh-ref193',
      'rebar-10',
      'ibr-05-3m',
      'timber-50x76',
      'timber-38x38',
      'fascia-pvc',
    ];

    pricedMaterialIds.forEach((materialId) => {
      const item = items.find((entry) => entry.materialId === materialId);
      expect(item, `Missing generated item for ${materialId}`).toBeDefined();
      expect(item!.unitPriceUsd, `Expected non-zero price for ${materialId}`).toBeGreaterThan(0);
      expect(item!.totalUsd).toBeCloseTo(item!.quantity * item!.unitPriceUsd, 2);
    });
  });
});

describe('roofing sheet coverage', () => {
  it('changes covering quantity and price with the selected Zimbabwe roof material', () => {
    const base: ManualBuilderConfig = {
      floorArea: 120, roomCount: 5, wallHeight: 2.7,
      brickTypes: ['common'], cementTypes: ['cement_325'],
      scope: 'roofing', includeLabor: false, locationType: 'urban',
    };
    const sheet = generateBOQFromBasics({ ...base, roofCovering: 'ibr_05' });
    const tile = generateBOQFromBasics({ ...base, roofCovering: 'concrete_tile' });
    const qtile = generateBOQFromBasics({ ...base, roofCovering: 'qtile' });
    expect(sheet.some((item) => item.materialId === 'ibr-05-3m')).toBe(true);
    expect(tile.some((item) => item.materialId === 'ibr-05-3m')).toBe(false);
    expect(tile.find((item) => item.materialId === 'roof-tile-concrete')?.quantity).toBeGreaterThan(1000);
    expect(tile.find((item) => item.materialId === 'roof-tile-concrete')?.unitPriceUsd).toBeGreaterThan(0);
    expect(qtile.find((item) => item.materialId === 'qtile-04-lm')?.unit).toBe('per metre');
    expect(qtile.find((item) => item.materialId === 'qtile-04-lm')?.unitPriceUsd).toBeGreaterThan(0);
  });

  // Roof_Sheet_Effective_Coverage was 0.85m2, a figure matching no real sheet,
  // and a 120m2 build ordered 179 sheets — 537 linear metres of sheeting for a
  // roof needing about 222m. These bounds are geometric rather than arbitrary,
  // so they will fail again if the assumption drifts.
  it('orders a sheet count consistent with 686mm IBR cover width', () => {
    const items = generateBOQFromBasics({
      floorArea: 120,
      roomCount: 4,
      wallHeight: 3.0,
      brickTypes: ['common'],
      cementTypes: ['cement_425'],
      scope: 'full_house',
      includeLabor: false,
      locationType: 'urban',
    });

    const sheets = getItemQuantity(items, 'Hipped roof');

    // 120m² on a 1.4:1 plan is 12.96 x 9.26m; with 600mm eaves 14.16 x 10.46
    // = 148.1m², x 1.06 for a 20° pitch = 157m², +10% urban waste and +5%
    // for cutting at the hips = 181.3m². A 3m sheet covers 3 x 0.686 = 2.06m².
    const roofAreaWithWaste = 148.1 * 1.06 * 1.1 * 1.05;
    const expected = roofAreaWithWaste / 2.06;

    expect(sheets).toBeGreaterThan(expected * 0.9);
    expect(sheets).toBeLessThan(expected * 1.1);

    // Guards the specific regression: the linear metres of sheet bought must
    // stay in the same order as the roof actually needs.
    const linearMetres = sheets * 3;
    expect(linearMetres).toBeLessThan((roofAreaWithWaste / 0.686) * 1.15);
  });
});

describe('labour sizing', () => {
  const house = (overrides: Partial<ManualBuilderConfig> = {}) => generateBOQFromBasics({
    floorArea: 120, roomCount: 6, wallHeight: 2.7,
    brickTypes: ['common'], cementTypes: ['cement_325'],
    scope: 'full_house', includeLabor: true, locationType: 'urban', ...overrides,
  });

  it('prices labour the way builders quote it, inside each stage', () => {
    const items = house();
    const line = (trade: string) => items.find((item) => item.materialId === `labor-${trade}`)!;
    // Per m² of floor for the builder's stages, per m² tiled, per metre of boundary.
    expect(line('to_slab').totalUsd).toBeCloseTo(12 * 120, 2);
    expect(line('to_wall_plate').totalUsd).toBeCloseTo(14 * 120, 2);
    expect(line('roof_work').totalUsd).toBeCloseTo(6.7 * 120, 2);
    expect(line('plastering').totalUsd).toBeCloseTo(7.4 * 120, 2);
    expect(line('plastering').calculationNote).toBe('$7.40/m² of floor × 120 m² of floor');
    expect(line('boundary_wall').calculationNote).toMatch(/^\$20\.00\/m of wall × \d/);
    // Plumbers and electricians quote separately: a share of their materials.
    expect(line('plumbing').calculationNote).toMatch(/^35% of plumbing materials/);
    // Each line sits in its stage, not in a section of its own.
    expect(line('to_slab').category).toBe('labor_substructure');
    expect(line('plumbing').category).toBe('labor_services');
    expect(items.some((item) => item.category === 'labor')).toBe(false);
    // Doors and windows are hung as part of the builder's price.
    expect(items.some((item) => item.materialId === 'labor-joinery')).toBe(false);
  });

  it('keeps labour within the Zimbabwe market share of material cost', () => {
    const items = house();
    const labour = items.filter((item) => isLaborCategory(item.category)).reduce((sum, item) => sum + item.totalUsd, 0);
    const materials = items.filter((item) => !isLaborCategory(item.category)).reduce((sum, item) => sum + item.totalUsd, 0);
    expect(materials).toBeGreaterThan(0);
    expect(labour / materials).toBeGreaterThan(0.25);
    expect(labour / materials).toBeLessThan(0.45);
  });

  it('prices only the trades a scope includes', () => {
    const items = house({ scope: 'roofing' });
    expect(items.filter((item) => isLaborCategory(item.category)).map((item) => item.materialId)).toEqual(['labor-roof_work']);
  });

});

describe('exterior works', () => {
  const base = {
    floorArea: 120,
    roomCount: 6,
    wallHeight: 2.7,
    brickTypes: ['common'],
    cementTypes: ['cement_425'],
    scope: ['exterior'],
    includeLabor: false,
    locationType: 'urban',
  } as unknown as ManualBuilderConfig;

  it('generates priced boundary, gate and paving items', () => {
    const items = generateBOQFromBasics(base).filter((i) => i.category === 'exterior');

    // The stage used to render as "0 items — $0" because nothing generated it.
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(getBestPrice(item.materialId)?.priceUsd ?? 0, `unpriced: ${item.materialId}`).toBeGreaterThan(0);
    }

    const ids = items.map((i) => i.materialId);
    expect(ids).toContain('durawall-panel');
    expect(ids).toContain('gate-vehicle');
    expect(ids).toContain('paving-brick');
  });

  it('scales the boundary wall with stand size', () => {
    const panels = (standAreaSqm?: number) => {
      const items = generateBOQFromBasics({ ...base, standAreaSqm } as ManualBuilderConfig);
      return items.find((i) => i.materialId === 'durawall-panel')?.quantity ?? 0;
    };

    expect(panels(1200)).toBeGreaterThan(panels(600));
  });
});

describe('reading a BOQ line by line', () => {
  const items = generateBOQFromBasics({
    floorArea: 120, roomCount: 7, wallHeight: 2.7, brickTypes: ['common'], cementTypes: ['cement_325'],
    scope: 'full_house', includeLabor: false, locationType: 'urban', finishLevel: 'standard',
  });

  it('never shows two lines with the same name in one stage', () => {
    const seen = new Set<string>();
    const repeated = items.filter((item) => {
      const key = `${item.category}|${item.materialName}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    expect(repeated.map((i) => `${i.category}: ${i.materialName}`)).toEqual([]);
  });

  it('names each cement line for its job', () => {
    const cement = items.filter((i) => i.materialId.startsWith('cement') && i.category === 'substructure').map((i) => i.materialName);
    expect(cement).toEqual(expect.arrayContaining([expect.stringMatching(/\(Foundation Concrete\)$/), expect.stringMatching(/\(Foundation Mortar\)$/)]));
  });

  it('lists the wall bricks once, with the inside/outside split in the note', () => {
    const walls = items.filter((i) => i.category === 'superstructure' && i.materialId.startsWith('brick-') && i.materialId !== 'brickforce');
    expect(walls).toHaveLength(1);
    expect(walls[0].calculationNote).toMatch(/^Outside walls \(230mm\) [\d.]+m²: [\d,]+ \+ inside walls \(115mm\) [\d.]+m²: [\d,]+, less windows and doors$/);
  });

  it('leaves no line without a note', () => {
    expect(items.filter((i) => !i.calculationNote.trim()).map((i) => i.materialName)).toEqual([]);
  });
});

describe('uploaded plan costing', () => {
  it('costs a 178m² full-house scan even when the reader marks every room wall internal', () => {
    const rooms: DetectedRoom[] = Array.from({ length: 10 }, (_, index) => ({
      id: `room-${index}`,
      name: `Room ${index + 1}`,
      dimensions: { width: 4.45, length: 4 },
      area: 17.8,
      position: { x: 0, y: 0, width: 20, height: 20 },
      wallType: 'internal',
      isEdited: false,
    }));
    const walls: DetectedWall[] = rooms.flatMap((room) => [room.dimensions.width, room.dimensions.length, room.dimensions.width, room.dimensions.length].map((length, index) => ({
      id: `${room.id}-wall-${index}`,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
      length,
      height: 2.7,
      thickness: 115,
      type: 'internal' as const,
    })));
    const config = { scope: 'full_house' as const, brickType: 'common' as const, cementType: 'cement_325' as const, includeLabor: true, wallHeight: 2.7, foundationDepth: 0.6 };
    const wallsForReview = estimateVisionWallDimensions(rooms, walls);
    expect(wallsForReview.noExternalWallsDetected).toBe(true);
    expect(wallsForReview.perimeter).toBeGreaterThan(50);
    const uploaded = generateBOQ(rooms, walls, config);
    const manual = generateBOQFromBasics({ floorArea: 178, roomCount: 10, wallHeight: 2.7, brickTypes: ['common'], cementTypes: ['cement_325'], scope: 'full_house', includeLabor: true });

    expect(new Set(uploaded.map((item) => item.category))).toEqual(new Set(['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior', 'labor_substructure', 'labor_superstructure', 'labor_roofing', 'labor_finishing', 'labor_services', 'labor_exterior']));
    expect(uploaded.find((item) => item.materialName.includes('Foundation Walls'))?.quantity).toBeGreaterThan(0);
    expect(uploaded.find((item) => item.materialName.includes('(Walls)'))?.quantity).toBeGreaterThan(0);
    expect(uploaded.filter((item) => item.quantity > 0 && item.unitPriceUsd <= 0).map((item) => item.materialId)).toEqual([]);
    const uploadedTotal = uploaded.reduce((sum, item) => sum + item.totalUsd, 0);
    const manualTotal = manual.reduce((sum, item) => sum + item.totalUsd, 0);
    expect(uploadedTotal).toBeGreaterThan(manualTotal * 0.75);
  });

  it('honors a finishing-only scan and its detected window count', () => {
    const room: DetectedRoom = {
      id: 'room-1', name: 'Lounge', dimensions: { width: 10, length: 10 }, area: 100,
      position: { x: 0, y: 0, width: 100, height: 100 }, wallType: 'internal', isEdited: false,
    };
    const items = generateBOQ([room], [], {
      scope: 'finishing', brickType: 'common', cementType: 'cement_325',
      includeLabor: false, wallHeight: 2.7, foundationDepth: 0.6,
    }, 4, 5);

    expect(new Set(items.map((item) => item.category))).toEqual(new Set(['finishing']));
    expect(items.find((item) => item.materialId === 'window-sill-brick')?.quantity).toBe(6);
    expect(items.find((item) => item.materialId === 'window-steel')?.calculationNote).toBe('4 windows');
    expect(items.find((item) => item.materialId === 'door-interior')?.quantity).toBe(3);
    expect(items.find((item) => item.materialId === 'hinges-door')?.quantity).toBe(5);
  });

  it('recalculates a full-house BOQ when a missed room is added during scan review', () => {
    const first: DetectedRoom = {
      id: 'lounge', name: 'Lounge', dimensions: { width: 5, length: 4 }, area: 20,
      position: { x: 10, y: 10, width: 50, height: 40 }, wallType: 'external', isEdited: false,
    };
    const missing: DetectedRoom = {
      id: 'manual-bedroom', name: 'Bedroom', dimensions: { width: 3, length: 4 }, area: 12,
      position: { x: 0, y: 0, width: 0, height: 0 }, wallType: 'internal', isEdited: true,
    };
    const config = { scope: 'full_house' as const, brickType: 'common' as const, cementType: 'cement_325' as const, includeLabor: true, wallHeight: 2.7, foundationDepth: 0.6 };
    const before = generateBOQ([first], [], config);
    const after = generateBOQ([first, missing], [], config);
    const total = (items: ReturnType<typeof generateBOQ>) => items.reduce((sum, item) => sum + item.totalUsd, 0);
    expect(total(after)).toBeGreaterThan(total(before));
    expect(after.find((item) => item.materialId === 'window-sill-brick')?.quantity).toBeGreaterThan(before.find((item) => item.materialId === 'window-sill-brick')?.quantity ?? 0);
  });
});

describe('detailed room masonry', () => {
  it('uses full room height for internal partitions', () => {
    const base: ManualBuilderConfig = {
      floorArea: 178, roomCount: 10, wallHeight: 2.7,
      brickTypes: ['common'], cementTypes: ['cement_325'],
      scope: 'superstructure', includeLabor: false,
    };
    const quick = generateBOQFromBasics(base);
    const detailed = generateBOQFromBasics({
      ...base,
      rooms: Array.from({ length: 10 }, (_, index) => ({
        id: `room-${index}`, label: `Room ${index + 1}`,
        length: 4, width: 4.45, doors: 1, windows: 1,
        materialId: 'brick-common',
      })),
    });
    const bricks = (items: ReturnType<typeof generateBOQFromBasics>) => items
      .filter((item) => item.category === 'superstructure' && item.materialId === 'brick-common')
      .reduce((sum, item) => sum + item.quantity, 0);

    expect(bricks(detailed)).toBeGreaterThanOrEqual(bricks(quick) - 1);
  });
});

describe('labour rates set by the user', () => {
  const config = {
    floorArea: 120, roomCount: 5, wallHeight: 2.7,
    brickTypes: ['common' as const], cementTypes: ['cement_325' as const],
    scope: 'full_house' as const, includeLabor: true, locationType: 'urban' as const,
  };

  it('uses a trade’s own rate, in its own unit, and leaves the others at the default', () => {
    const items = generateBOQFromBasics({ ...config, laborRates: { plastering: 10, plumbing: 20 } });
    expect(items.find((item) => item.materialId === 'labor-plastering')!.totalUsd).toBeCloseTo(10 * 120, 2);
    const plumbingMaterials = items.filter((item) => item.category === 'services' && !/cable|conduit|socket|switch|db-|mcb|light-/.test(item.materialId)).reduce((sum, item) => sum + item.totalUsd, 0);
    expect(items.find((item) => item.materialId === 'labor-plumbing')!.totalUsd).toBeCloseTo(plumbingMaterials * 0.2, 1);
    expect(items.find((item) => item.materialId === 'labor-to_slab')!.totalUsd).toBeCloseTo(12 * 120, 2);
  });

  it('never reads a saved percentage as dollars per square metre', () => {
    // Projects saved under the percentage model hold rates like these.
    const old = { roofing: 35, plaster: 200, boundary: 90, finishing: 40 } as Record<string, number>;
    expect(cleanLaborRates(old)).toEqual({});
    expect(laborRateFor('roof_work', old as never)).toBe(6.7);
    const items = generateBOQFromBasics({ ...config, laborRates: old as never });
    expect(items.find((item) => item.materialId === 'labor-roof_work')!.totalUsd).toBeCloseTo(6.7 * 120, 2);
  });

  it('reads saved rates back from labour line notes', () => {
    expect(laborRatesFromNotes([
      { materialId: 'labor-plastering', note: '$9.00/m² of floor × 120 m² of floor' },
      { materialId: 'labor-to_slab', note: '$12.00/m² of floor × 120 m² of floor' },
      { materialId: 'labor-plumbing', note: '40% of plumbing materials ($900.00)' },
      // Lines saved under the percentage model come back at today's defaults.
      { materialId: 'labor-plaster', note: '200% of finishing materials ($500.00)' },
      { materialId: 'cement-325', note: '40% of something' },
    ])).toEqual({ plastering: 9, plumbing: 40 });
  });

});

describe('council wall rule (Harare and Bulawayo, from 1 July 2026)', () => {
  const base = { floorArea: 120, roomCount: 7, wallHeight: 2.7, brickTypes: ['common' as const], cementTypes: ['cement_325' as const], scope: 'superstructure' as const, includeLabor: false, locationType: 'urban' as const };
  const wallBricks = (items: ReturnType<typeof generateBOQFromBasics>) => items.find((i) => i.materialName.endsWith('(Walls)'))!;

  it('recognises the two cities, suburbs included', () => {
    expect(councilRequiresFullBrickWalls('Harare - Borrowdale')).toBe(true);
    expect(councilRequiresFullBrickWalls('bulawayo')).toBe(true);
    expect(councilRequiresFullBrickWalls('Gweru')).toBe(false);
    expect(councilRequiresFullBrickWalls(undefined)).toBe(false);
  });

  it('builds inside walls one brick thick there, half a brick elsewhere', () => {
    const elsewhere = wallBricks(generateBOQFromBasics(base));
    const harare = wallBricks(generateBOQFromBasics({ ...base, fullBrickInternalWalls: true }));
    expect(elsewhere.calculationNote).toContain('inside walls (115mm)');
    expect(harare.calculationNote).toContain('inside walls (230mm, council rule)');
    expect(harare.quantity).toBeGreaterThan(elsewhere.quantity);
  });
});

describe('BOQ audit against real builds (2026-10-28)', () => {
  const house = (overrides: Partial<ManualBuilderConfig> = {}) => generateBOQFromBasics({
    floorArea: 120, roomCount: 7, wallHeight: 2.7,
    brickTypes: ['common'], cementTypes: ['cement_325'],
    scope: 'full_house', includeLabor: false, locationType: 'urban', ...overrides,
  });

  it('screeds the whole floor, under the tiles too', () => {
    const screed = house().find((item) => item.materialName === 'Cement (Floor Screed)');
    expect(screed?.quantity).toBeGreaterThan(20);
    expect(screed?.calculationNote).toContain('under the tiles');
  });

  it('builds the roof frame from the timber builders use', () => {
    const items = house({ scope: 'roofing' });
    expect(items.find((item) => item.materialId === 'timber-152x38')?.calculationNote).toContain('rafters, tie beams and hips');
    expect(items.find((item) => item.materialId === 'timber-114x38')?.calculationNote).toContain('wall plate');
    expect(items.some((item) => item.materialName.includes('Roof Frame'))).toBe(false);
    // A lean-to has rafters only: no webs.
    const leanTo = house({ scope: 'roofing', roofShape: 'lean_to' });
    expect(leanTo.find((item) => item.materialId === 'timber-114x38')?.calculationNote).toMatch(/^wall plate/);
  });
});

describe('optional extras on an uploaded plan (2026-10-28)', () => {
  const rooms: DetectedRoom[] = [
    { id: 'lounge', name: 'Lounge', dimensions: { width: 5, length: 6 }, area: 30, position: { x: 0, y: 0, width: 50, height: 60 }, wallType: 'external', isEdited: false },
    { id: 'kitchen', name: 'Kitchen', dimensions: { width: 4, length: 4 }, area: 16, position: { x: 50, y: 0, width: 40, height: 40 }, wallType: 'external', isEdited: false },
    { id: 'bed', name: 'Bedroom', dimensions: { width: 4, length: 4 }, area: 16, position: { x: 0, y: 60, width: 40, height: 40 }, wallType: 'external', isEdited: false },
    { id: 'bath', name: 'Bathroom', dimensions: { width: 2.5, length: 3 }, area: 7.5, position: { x: 40, y: 60, width: 25, height: 30 }, wallType: 'internal', isEdited: false },
  ];
  const config = { scope: 'full_house' as const, brickType: 'common' as const, cementType: 'cement_325' as const, includeLabor: true, wallHeight: 2.7, foundationDepth: 0.6 };
  const total = (items: ReturnType<typeof generateBOQ>) => items.reduce((sum, item) => sum + item.totalUsd, 0);

  it('leaves unticked extras out with their labour, and keeps ticked ones', () => {
    const everything = generateBOQ(rooms, [], config);
    const none = generateBOQ(rooms, [], { ...config, includeExtras: [] });
    const withKitchen = generateBOQ(rooms, [], { ...config, includeExtras: ['kitchen'] });
    expect(everything.some((item) => item.materialId === 'kitchen-units')).toBe(true);
    expect(none.some((item) => ['kitchen-units', 'durawall-panel', 'gate-vehicle', 'geyser-150', 'bath-skirted', 'paint-acrylic'].includes(item.materialId))).toBe(false);
    // The boundary wall's labour goes with the wall.
    expect(none.some((item) => item.materialId === 'labor-boundary_wall')).toBe(false);
    expect(withKitchen.some((item) => item.materialId === 'kitchen-units')).toBe(true);
    expect(total(none)).toBeLessThan(total(withKitchen));
    expect(total(withKitchen)).toBeLessThan(total(everything));
  });
});
