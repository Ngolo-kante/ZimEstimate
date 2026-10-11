import { describe, expect, it } from 'vitest';
import { getBestPrice } from './materials';

describe('materials pricing', () => {
  // Order of precedence: a price checked against live supplier stores, then
  // the February CSV baseline, then the older static table.
  it('uses a market-checked price when there is one', () => {
    const price = getBestPrice('mesh-ref193');
    expect(price!.priceUsd).toBe(39.21);
    expect(price!.lastUpdated).toBe('2026-10-11');
  });

  it('uses the CSV baseline for mapped items not yet market-checked', () => {
    const price = getBestPrice('sand-river');
    expect(price).toBeDefined();
    expect(price!.priceUsd).toBe(18);
  });

  it('falls back to static material prices when neither applies', () => {
    const price = getBestPrice('brick-face-brown');
    expect(price).toBeDefined();
    expect(price!.priceUsd).toBe(0.45);
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
