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
      brickType: 'common',
      cementType: 'cement_425',
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
      brickType: 'common',
      cementType: 'cement_325',
      scope: 'superstructure',
      includeLabor: false,
      locationType: 'urban',
    };

    const economy = generateBOQFromBasics({ ...base, cementType: 'cement_325' });
    const standard = generateBOQFromBasics({ ...base, cementType: 'cement_425' });

    const economyMortarCement = getItemQuantity(economy, 'Superstructure mortar');
    const standardMortarCement = getItemQuantity(standard, 'Superstructure mortar');
    expect(standardMortarCement).toBeGreaterThan(economyMortarCement);
  });
});
