import { describe, expect, it } from 'vitest';
import { estimateVisionWallDimensions, generateBOQ, generateBOQFromBasics, ManualBuilderConfig } from './index';
import { getBestPrice } from '../materials';
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

    const urbanFoundationCement = getItemQuantity(urban, 'Foundation concrete');
    const ruralFoundationCement = getItemQuantity(rural, 'Foundation concrete');
    expect(urbanFoundationCement).toBeGreaterThan(ruralFoundationCement);

    const urbanRoofSheets = getItemQuantity(urban, 'Roof area');
    const ruralRoofSheets = getItemQuantity(rural, 'Roof area');
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

    const sheets = getItemQuantity(items, 'Roof area');

    // 120m2 x 1.15 pitch = 138m2, +10% urban waste = 151.8m2.
    // A 3m sheet covers 3 x 0.686 = 2.06m2, so ~74 sheets.
    const roofAreaWithWaste = 120 * 1.15 * 1.1;
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
  it('keeps labour within the Zimbabwe market share of material cost', () => {
    const items = generateBOQFromBasics({
      floorArea: 120,
      roomCount: 6,
      wallHeight: 2.7,
      brickTypes: ['common'],
      cementTypes: ['cement_425'],
      scope: ['full_house'],
      includeLabor: true,
      locationType: 'urban',
    } as unknown as ManualBuilderConfig);

    let materials = 0;
    let labour = 0;
    for (const item of items) {
      const line = (getBestPrice(item.materialId)?.priceUsd ?? 0) * item.quantity;
      if (item.category === 'labor') labour += line;
      else materials += line;
    }

    expect(materials).toBeGreaterThan(0);
    // Contractors in Zimbabwe charge roughly 25-30% of the material spend. The
    // previous area-based model produced labour worth 113% of materials.
    const share = labour / materials;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.35);
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
    expect(walls[0].calculationNote).toMatch(/^External walls [\d,]+ \+ internal walls [\d,]+$/);
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

    expect(new Set(uploaded.map((item) => item.category))).toEqual(new Set(['substructure', 'superstructure', 'roofing', 'finishing', 'exterior', 'labor']));
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
