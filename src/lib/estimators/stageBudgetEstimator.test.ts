import { describe, expect, it } from 'vitest';
import { estimateStageReach } from './stageBudgetEstimator';

describe('estimateStageReach', () => {
  it('returns all construction stages in order', () => {
    const result = estimateStageReach({
      budgetUsd: 15000,
      floorAreaM2: 120,
    });

    expect(result.rows).toHaveLength(5);
    expect(result.rows.map((row) => row.id)).toEqual([
      'substructure',
      'superstructure',
      'roofing',
      'finishing',
      'exterior',
    ]);
    expect(result.estimatedTotalUsd).toBeGreaterThan(0);
  });

  it('reports no completed stage for very small budgets', () => {
    const result = estimateStageReach({
      budgetUsd: 1,
      floorAreaM2: 120,
    });

    expect(result.reachableStageId).toBeNull();
    expect(result.reachableStageLabel).toBe('No stage completed');
    expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
  });

  it('can reach final stage when budget is high', () => {
    const result = estimateStageReach({
      budgetUsd: 1_000_000,
      floorAreaM2: 120,
    });

    expect(result.reachableStageId).toBe('exterior');
    expect(result.reachableStageLabel).toBe('External Work');
    expect(result.coveragePercent).toBe(100);
    expect(result.rows.every((row) => row.affordable)).toBe(true);
  });

  it('falls back to safe defaults for invalid inputs', () => {
    const result = estimateStageReach({
      budgetUsd: Number.NaN,
      floorAreaM2: 0,
    });

    expect(result.estimatedTotalUsd).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(5);
  });
});
