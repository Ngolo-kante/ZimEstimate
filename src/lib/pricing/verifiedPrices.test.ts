import { describe, expect, it } from 'vitest';
import { VERIFIED_PRICES, VERIFIED_PRICES_CHECKED_ON, getVerifiedPrice } from './verifiedPrices';
import { getBestPrice, materials } from '@/lib/materials';

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

describe('verified market prices', () => {
  it('only price items that exist in the catalogue', () => {
    const ids = new Set(materials.map((m) => m.id));
    for (const entry of VERIFIED_PRICES) expect(ids.has(entry.materialId), entry.materialId).toBe(true);
  });

  it('price each item once', () => {
    const ids = VERIFIED_PRICES.map((entry) => entry.materialId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every price has at least one real listing behind it', () => {
    for (const entry of VERIFIED_PRICES) {
      expect(entry.sources.length, entry.materialId).toBeGreaterThan(0);
      for (const source of entry.sources) expect(source.priceUsd, `${entry.materialId}: ${source.listing}`).toBeGreaterThan(0);
    }
  });

  it('a "median" or "mean" really is the median or mean of its sources', () => {
    // So a price cannot quietly drift from the evidence recorded beside it.
    // A cent of tolerance for rounding ($15.305 is entered as $15.31).
    for (const entry of VERIFIED_PRICES) {
      const prices = entry.sources.map((s) => s.priceUsd);
      if (/^median/.test(entry.method)) expect(Math.abs(entry.priceUsd - median(prices)), entry.materialId).toBeLessThanOrEqual(0.01);
      if (/^mean of/.test(entry.method)) expect(Math.abs(entry.priceUsd - mean(prices)), entry.materialId).toBeLessThanOrEqual(0.01);
      if (/^single source/.test(entry.method)) expect(entry.priceUsd, entry.materialId).toBeCloseTo(prices[0], 2);
    }
  });

  it('three-supplier items sit within the range the suppliers quoted', () => {
    for (const entry of VERIFIED_PRICES.filter((e) => /^median of three/.test(e.method))) {
      const prices = entry.sources.map((s) => s.priceUsd);
      expect(entry.priceUsd).toBeGreaterThanOrEqual(Math.min(...prices));
      expect(entry.priceUsd).toBeLessThanOrEqual(Math.max(...prices));
    }
  });

  it('are what estimates and the marketplace now use', () => {
    for (const entry of VERIFIED_PRICES) {
      const best = getBestPrice(entry.materialId);
      expect(best?.priceUsd, entry.materialId).toBe(entry.priceUsd);
      expect(best?.lastUpdated).toBe(VERIFIED_PRICES_CHECKED_ON);
    }
  });

  it('leave unverified items on their older price rather than inventing one', () => {
    expect(getVerifiedPrice('sand-river')).toBeUndefined();
    expect(getBestPrice('sand-river')?.priceUsd).toBe(18);
  });
});
