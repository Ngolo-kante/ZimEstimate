import { describe, expect, it } from 'vitest';
import { fitQuantityToBudget, totalOf } from './fitQuantityToBudget';
import { calculateFencingBOQ } from './fencing/calculations';
import { calculatePavingBOQ } from './paving/calculations';
import type { Answers, BOQItem } from './engine/types';

/**
 * The solver must never contradict the wizard, so these run against the real
 * generators rather than a stub. A stubbed cost curve would prove the bisection
 * works and nothing about whether the answers it produces are buildable.
 */

const item = (over: Partial<BOQItem>): BOQItem => ({
  id: 'x',
  category: 'c',
  description: 'd',
  quantity: 1,
  unit: 'ea',
  unitCostUsd: 100,
  totalCostUsd: 100,
  included: true,
  owned: false,
  optional: false,
  ...over,
});

describe('totalling a quick-project BOQ', () => {
  it('ignores items the user excluded or already owns', () => {
    const total = totalOf([
      item({ totalCostUsd: 100 }),
      item({ totalCostUsd: 50, included: false }),
      item({ totalCostUsd: 25, owned: true }),
    ]);
    expect(total).toBe(100);
  });
});

describe('fitting fencing to a budget', () => {
  const answersFor = (fence_length: number): Answers => ({
    fence_type: 'palisade',
    fence_length,
    fence_height: 1.8,
    gate_count: 1,
  }) as unknown as Answers;

  const fit = (budgetUsd: number) =>
    fitQuantityToBudget({
      budgetUsd,
      answersFor,
      generate: calculateFencingBOQ,
      min: 5,
      max: 2000,
      step: 1,
    });

  it('returns a length whose real BOQ is within budget', () => {
    const result = fit(5000);
    expect(result.belowMinimum).toBe(false);
    expect(result.totalUsd).toBeLessThanOrEqual(5000);
    expect(result.quantity).toBeGreaterThan(5);
    // The quoted total must be the real cost of the quantity returned, not an
    // interpolation — recompute it independently.
    expect(totalOf(calculateFencingBOQ(answersFor(result.quantity)))).toBeCloseTo(result.totalUsd, 2);
  });

  it('finds the largest length that fits, not merely one that fits', () => {
    const budget = 5000;
    const result = fit(budget);
    // One step more must break the budget, otherwise the search stopped short.
    const nextUp = totalOf(calculateFencingBOQ(answersFor(result.quantity + 1)));
    expect(nextUp).toBeGreaterThan(budget);
  });

  it('a bigger budget never buys less fence', () => {
    const lengths = [2000, 4000, 8000, 16000].map((b) => fit(b).quantity);
    const sorted = [...lengths].sort((a, b) => a - b);
    expect(lengths).toEqual(sorted);
  });

  it('says so plainly when the budget cannot cover the smallest job', () => {
    const result = fit(1);
    expect(result.belowMinimum).toBe(true);
    expect(result.quantity).toBe(5);
    // Still returns a real costed BOQ, so the page can say what the minimum costs.
    expect(result.totalUsd).toBeGreaterThan(0);
    expect(result.remainingUsd).toBeLessThan(0);
  });

  it('flags when the money outruns the range rather than inventing a bigger job', () => {
    const result = fit(10_000_000);
    expect(result.atMaximum).toBe(true);
    expect(result.quantity).toBe(2000);
    expect(result.remainingUsd).toBeGreaterThan(0);
  });
});

describe('fitting paving to a budget', () => {
  const answersFor = (area_m2: number): Answers => ({
    // 'interlock' is the real option value in the paving flow. An invented
    // value still produces a BOQ via the generator's fallback, which would
    // make this test pass while exercising a path no user can reach.
    paving_type: 'interlock',
    area_method: 'total',
    area_m2,
  }) as unknown as Answers;

  it('works unchanged against a different generator', () => {
    const result = fitQuantityToBudget({
      budgetUsd: 3000,
      answersFor,
      generate: calculatePavingBOQ,
      min: 1,
      max: 5000,
      step: 1,
    });

    expect(result.belowMinimum).toBe(false);
    expect(result.totalUsd).toBeLessThanOrEqual(3000);
    expect(totalOf(calculatePavingBOQ(answersFor(result.quantity)))).toBeCloseTo(result.totalUsd, 2);
  });
});
