import { describe, expect, it } from 'vitest';
import { estimateStageReach, stageStatusFromParams, stageStatusToParams } from './stageBudgetEstimator';

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

describe('labour in the stage estimate', () => {
  it('adds each stage’s fixed labour percentage on top of its materials', () => {
    const base = { budgetUsd: 10000, floorAreaM2: 120, locationType: 'urban' as const };
    const materialsOnly = estimateStageReach(base);
    const withLabour = estimateStageReach({ ...base, includeLabor: true });
    expect(materialsOnly.laborUsd).toBe(0);
    expect(withLabour.materialsUsd).toBeCloseTo(materialsOnly.materialsUsd, 6);
    expect(withLabour.laborUsd).toBeCloseTo(withLabour.materialsUsd * 0.35, 6);
    expect(withLabour.estimatedTotalUsd).toBeCloseTo(withLabour.materialsUsd + withLabour.laborUsd, 6);
    expect(withLabour.coveragePercent).toBeLessThan(materialsOnly.coveragePercent);
  });
});

describe('stages already built or left for later', () => {
  const base = { budgetUsd: 6000, floorAreaM2: 120, locationType: 'urban' as const, includeLabor: true };

  it('spends the budget from the first stage still to build', () => {
    const all = estimateStageReach(base);
    const fromRoof = estimateStageReach({ ...base, stageStatus: { substructure: 'built', superstructure: 'built' } });
    const cost = (id: string) => all.rows.find((row) => row.id === id)!.stageCostUsd;
    expect(fromRoof.estimatedTotalUsd).toBeCloseTo(cost('roofing') + cost('finishing') + cost('exterior'), 6);
    // The roof is now the first thing the money pays for.
    const roof = fromRoof.rows.find((row) => row.id === 'roofing')!;
    expect(roof.coveragePercent).toBeCloseTo(Math.min(100, (6000 / cost('roofing')) * 100), 6);
    expect(fromRoof.rows.find((row) => row.id === 'substructure')).toMatchObject({ status: 'built', affordable: true, coveragePercent: 100 });
    expect(fromRoof.coveragePercent).toBeGreaterThan(all.coveragePercent);
  });

  it('leaves a stage for later out of the total but keeps its cost on show', () => {
    const all = estimateStageReach(base);
    const noExterior = estimateStageReach({ ...base, stageStatus: { exterior: 'skip' } });
    const exterior = noExterior.rows.find((row) => row.id === 'exterior')!;
    expect(exterior).toMatchObject({ status: 'skip', affordable: false, coveragePercent: 0 });
    expect(exterior.stageCostUsd).toBeCloseTo(all.rows.find((row) => row.id === 'exterior')!.stageCostUsd, 6);
    expect(noExterior.estimatedTotalUsd).toBeCloseTo(all.estimatedTotalUsd - exterior.stageCostUsd, 6);
    expect(noExterior.materialsUsd + noExterior.laborUsd).toBeCloseTo(noExterior.estimatedTotalUsd, 6);
  });

  it('reports full coverage when the only stage left is affordable', () => {
    const result = estimateStageReach({
      ...base,
      budgetUsd: 1_000_000,
      stageStatus: { substructure: 'built', superstructure: 'built', roofing: 'built', finishing: 'built' },
    });
    expect(result.coveragePercent).toBe(100);
    expect(result.reachableStageId).toBe('exterior');
  });
});

describe('stage choices in links', () => {
  it('round-trips through link parameters and refuses a link with nothing left to build', () => {
    const status = { substructure: 'built', superstructure: 'built', exterior: 'skip' } as const;
    const params = new URLSearchParams(stageStatusToParams(status));
    expect(params.toString()).toBe('done=substructure%2Csuperstructure&later=exterior');
    expect(stageStatusFromParams(params)).toEqual(status);
    expect(stageStatusFromParams(new URLSearchParams('done=substructure,superstructure,roofing,finishing,exterior'))).toEqual({});
    expect(stageStatusFromParams(new URLSearchParams('done=garden'))).toEqual({});
  });
});

describe('a labour rate of the user’s own', () => {
  it('replaces the 35% default', () => {
    const base = { budgetUsd: 10000, floorAreaM2: 120, locationType: 'urban' as const, includeLabor: true };
    const result = estimateStageReach({ ...base, laborRates: { substructure: 20, superstructure: 20, roofing: 20, finishing: 20, exterior: 20 } });
    expect(result.laborUsd).toBeCloseTo(result.materialsUsd * 0.2, 6);
  });
});
