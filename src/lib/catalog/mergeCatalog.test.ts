import { describe, expect, it } from 'vitest';
import type { Material } from '@/lib/materials';
import { featuredKeys, keyForNewProduct, mergeCatalog, type CatalogRow } from './mergeCatalog';

const base: Material[] = [
  { id: 'cement-325', name: 'Standard Cement 32.5N', category: 'cement', subcategory: 'Portland', unit: 'per 50kg bag', specifications: 'PPC/Lafarge', milestones: ['substructure'] },
  { id: 'brick-common', name: 'Common Cement Brick', category: 'bricks', subcategory: 'Cement Bricks', unit: 'each', milestones: ['superstructure'] },
];
const row = (overrides: Partial<CatalogRow>): CatalogRow => ({
  material_key: 'cement-325', name: null, description: null, category: null, subcategory: null, unit: null,
  milestones: null, is_custom: false, is_hidden: false, featured_rank: null, ...overrides,
});

describe('the catalog people see', () => {
  it('applies an admin rename and description, keeping everything else', () => {
    const [cement] = mergeCatalog(base, [row({ name: 'Cement 32.5N (50kg)', description: 'Any brand' })]);
    expect(cement).toMatchObject({ name: 'Cement 32.5N (50kg)', specifications: 'Any brand', unit: 'per 50kg bag', category: 'cement' });
  });

  it('never changes the unit of a built-in material', () => {
    const [cement] = mergeCatalog(base, [row({ unit: 'per tonne' })]);
    expect(cement.unit).toBe('per 50kg bag');
  });

  it('can clear a description with an empty string, and keeps it on null', () => {
    expect(mergeCatalog(base, [row({ description: '' })])[0].specifications).toBeUndefined();
    expect(mergeCatalog(base, [row({ description: null })])[0].specifications).toBe('PPC/Lafarge');
  });

  it('adds new products after the built-in ones, with stages from their category', () => {
    const merged = mergeCatalog(base, [row({ material_key: 'custom-membrane', name: 'Waterproof membrane', category: 'finishes', unit: 'per roll', is_custom: true })]);
    expect(merged.map((m) => m.id)).toEqual(['cement-325', 'brick-common', 'custom-membrane']);
    expect(merged[2]).toMatchObject({ custom: true, unit: 'per roll', milestones: ['finishing'], subcategory: 'Other' });
  });

  it('ignores an incomplete new product rather than showing a broken one', () => {
    expect(mergeCatalog(base, [row({ material_key: 'custom-x', name: 'X', is_custom: true })])).toHaveLength(2);
  });

  it('flags hidden materials instead of dropping them', () => {
    expect(mergeCatalog(base, [row({ is_hidden: true })])[0].hidden).toBe(true);
  });

  it('lists home-page materials in slot order, skipping hidden ones', () => {
    expect(featuredKeys([
      row({ material_key: 'b', featured_rank: 2 }),
      row({ material_key: 'a', featured_rank: 1 }),
      row({ material_key: 'c', featured_rank: 3, is_hidden: true }),
    ])).toEqual(['a', 'b']);
  });

  it('makes a readable key for a new product', () => {
    expect(keyForNewProduct('Waterproof Membrane 4mm!')).toBe('custom-waterproof-membrane-4mm');
  });
});
