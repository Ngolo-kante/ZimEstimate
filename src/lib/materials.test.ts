import { describe, expect, it } from 'vitest';
import { getBestPrice } from './materials';

describe('materials pricing', () => {
  it('uses CSV baseline prices for BOQ material IDs that are mapped', () => {
    const price = getBestPrice('mesh-ref193');
    expect(price).toBeDefined();
    expect(price!.priceUsd).toBe(38);
  });

  it('falls back to static material prices when no CSV mapping exists', () => {
    const price = getBestPrice('brickforce');
    expect(price).toBeDefined();
    expect(price!.priceUsd).toBe(3.5);
  });

  it('has priced temporary works items for one-click suggestions', () => {
    const temporaryWorks = ['temp-cabin-6x3', 'temp-toilet', 'water-tank-50000l', 'site-clear-level'];
    temporaryWorks.forEach((materialId) => {
      const price = getBestPrice(materialId);
      expect(price).toBeDefined();
      expect(price!.priceUsd).toBeGreaterThan(0);
    });
  });
});
