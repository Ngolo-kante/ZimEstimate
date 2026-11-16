import { describe, expect, it } from 'vitest';
import { convertedPrice, currentPrice, median, priceDecision } from './collectorRules';
import { ZBMS_PRODUCTS } from './zbmsProducts';
import { materials } from '../materials';

describe('owner-confirmed ZBMS mappings', () => {
  it('uses catalogue ids and units, unique materials and valid factors/product ids', () => {
    expect(new Set(ZBMS_PRODUCTS.map((m) => m.materialId)).size).toBe(ZBMS_PRODUCTS.length);
    for (const mapping of ZBMS_PRODUCTS) {
      const material = materials.find((m) => m.id === mapping.materialId);
      expect(material).toBeDefined();
      expect(mapping.unit).toBe(material?.unit);
      expect(mapping.factor).toBeGreaterThan(0);
      expect(Number.isFinite(mapping.factor)).toBe(true);
      expect(mapping.zbmsProductIds.length).toBeGreaterThan(0);
      expect(mapping.zbmsProductIds.every((id) => Number.isSafeInteger(id) && id > 0)).toBe(true);
    }
  });
});

describe('collector price decisions', () => {
  it('takes a median without mutating inputs and converts units before approval', () => {
    const prices = [300, 100, 200, 400];
    expect(median(prices)).toBe(250);
    expect(prices).toEqual([300, 100, 200, 400]);
    expect(median([0, -1, NaN, Infinity])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(convertedPrice([100, 200], 1 / 1000)).toBe(0.15);
    expect(convertedPrice([3.6], 4 / 3.6)).toBe(4);
    expect(convertedPrice([], 1)).toBeNull();
    expect(convertedPrice([1], -1)).toBeNull();
  });
  it('auto approves both inclusive 15% boundaries and queues larger or unknown changes', () => {
    for (const price of [85, 100, 115]) expect(priceDecision(price, 100).review_status).toBe('auto');
    for (const price of [84.99, 115.01]) expect(priceDecision(price, 100).review_status).toBe('pending');
    expect(priceDecision(1, null)).toEqual({ changePercent: null, review_status: 'pending' });
    expect(priceDecision(1, 0).review_status).toBe('pending');
  });
  it('chooses the newest eligible unit-matched observation, then verified, then catalogue', () => {
    const now = Date.parse('2026-11-16T12:00:00Z');
    const row = { price_usd: 10, unit: 'each', review_status: 'auto', scraped_at: new Date(now - 1000).toISOString() };
    const rows = [
      { ...row, price_usd: 12, scraped_at: new Date(now - 2000).toISOString(), review_status: 'confirmed' }, row,
      { ...row, price_usd: 20, review_status: 'pending' },
      { ...row, price_usd: 20, review_status: 'rejected' },
      { ...row, price_usd: 20, unit: 'box' },
      { ...row, price_usd: 20, scraped_at: new Date(now + 1000).toISOString() },
      { ...row, price_usd: 20, scraped_at: new Date(now - 30 * 86400000).toISOString() },
      { ...row, price_usd: 20, scraped_at: 'invalid' },
    ];
    expect(currentPrice(rows, 'each', 5, 3, now)).toBe(10);
    expect(currentPrice(rows.slice(2), 'each', 5, 3, now)).toBe(5);
    expect(currentPrice([], 'each', null, 3, now)).toBe(3);
    expect(currentPrice([], 'each', 0, 0, now)).toBeNull();
  });
});
