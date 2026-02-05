import { describe, expect, it } from 'vitest';
import { applyAveragePriceUpdate, calculateVariance, getScaledPriceZwg } from './boqPricing';

describe('boqPricing', () => {
  it('scales ZWG based on average price ratio', () => {
    const result = getScaledPriceZwg(120, 100, 3000, 30);
    expect(result).toBeCloseTo(3600, 2);
  });

  it('falls back to exchange rate when average is zero', () => {
    const result = getScaledPriceZwg(50, 0, 0, 30);
    expect(result).toBe(1500);
  });

  it('calculates variance and variance percent', () => {
    const { variance, variancePct } = calculateVariance(100, 110);
    expect(variance).toBe(10);
    expect(variancePct).toBeCloseTo(10, 4);
  });

  it('returns null variance percent when average is zero', () => {
    const { variance, variancePct } = calculateVariance(0, 100);
    expect(variance).toBe(100);
    expect(variancePct).toBeNull();
  });

  it('updates actual price when it matches the previous average', () => {
    const updated = applyAveragePriceUpdate(
      { averagePriceUsd: 10, averagePriceZwg: 300, actualPriceUsd: 10 },
      12,
      360,
      30
    );
    expect(updated.actualPriceUsd).toBe(12);
    expect(updated.averagePriceUsd).toBe(12);
    expect(updated.actualPriceZwg).toBeCloseTo(360, 2);
  });

  it('preserves actual price when it differs from the previous average', () => {
    const updated = applyAveragePriceUpdate(
      { averagePriceUsd: 10, averagePriceZwg: 300, actualPriceUsd: 15 },
      12,
      360,
      30
    );
    expect(updated.actualPriceUsd).toBe(15);
    expect(updated.averagePriceUsd).toBe(12);
    expect(updated.actualPriceZwg).toBeCloseTo(450, 2);
  });
});
