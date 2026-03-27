import { describe, expect, it } from 'vitest';
import { generateBOQFromBasics, ManualBuilderConfig } from './index';

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

    const economyMortarCement = getItemQuantity(economy, 'Superstructure mortar');
    const standardMortarCement = getItemQuantity(standard, 'Superstructure mortar');
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
