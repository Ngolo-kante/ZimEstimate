import { describe, expect, it } from 'vitest';
import { ADD_LATER_IDS } from './addLater';
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
    // Plumbing and electrical sit inside the interior on this quick check.
    const interior = result.rows.find((row) => row.id === 'finishing')!;
    expect(interior.parts?.map((part) => part.label)).toEqual(['Finishes', 'Plumbing & electrical']);
    expect(interior.parts!.reduce((sum, part) => sum + part.usd, 0)).toBeCloseTo(interior.stageCostUsd, 6);
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
  it('adds each trade’s labour, priced the way builders quote it, on top of its materials', () => {
    const base = { budgetUsd: 10000, floorAreaM2: 120, locationType: 'urban' as const };
    const materialsOnly = estimateStageReach(base);
    const withLabour = estimateStageReach({ ...base, includeLabor: true });
    expect(materialsOnly.laborUsd).toBe(0);
    expect(withLabour.materialsUsd).toBeCloseTo(materialsOnly.materialsUsd, 6);
    expect(withLabour.laborUsd).toBeGreaterThan(withLabour.materialsUsd * 0.25);
    expect(withLabour.laborUsd).toBeLessThan(withLabour.materialsUsd * 0.45);
    // Explained trade by trade, in each trade's own unit, adding up to the total.
    const plastering = withLabour.laborByTrade.find((trade) => trade.id === 'plastering')!;
    expect(plastering.rateLabel).toBe('$7.40/m² of floor');
    expect(plastering.usd).toBeCloseTo(7.4 * 120, 2);
    expect(withLabour.laborByTrade.find((trade) => trade.id === 'plumbing')!.rateLabel).toBe('35% of materials');
    expect(withLabour.laborByTrade.reduce((sum, trade) => sum + trade.usd, 0)).toBeCloseTo(withLabour.laborUsd, 6);
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
    // The whole house, "add later" items ticked, so the exterior has its wall and paving.
    const all = estimateStageReach({ ...base, addLater: ADD_LATER_IDS });
    const noExterior = estimateStageReach({ ...base, addLater: ADD_LATER_IDS, stageStatus: { exterior: 'skip' } });
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
  it('replaces that trade’s default and leaves the others', () => {
    const base = { budgetUsd: 10000, floorAreaM2: 120, locationType: 'urban' as const, includeLabor: true };
    const standard = estimateStageReach(base);
    const own = estimateStageReach({ ...base, laborRates: { plastering: 10 } });
    expect(own.laborUsd - standard.laborUsd).toBeCloseTo((10 - 7.4) * 120, 2);
  });
});

describe('parts people add later', () => {
  const base = { budgetUsd: 20000, floorAreaM2: 120, locationType: 'urban' as const, includeLabor: true };
  const everything = ADD_LATER_IDS;

  it('leaves them out of the headline, with their labour, and lists what they cost', () => {
    const moveIn = estimateStageReach(base);
    const full = estimateStageReach({ ...base, addLater: everything });
    expect(moveIn.addLater.map((item) => item.id)).toEqual(['kitchen', 'boundary', 'paving', 'geyser', 'bath', 'outside_paint']);
    expect(moveIn.addLater.every((item) => !item.included && item.usd > 0)).toBe(true);
    // Ticking everything puts back exactly what was left out, labour included.
    expect(moveIn.estimatedTotalUsd + moveIn.addLaterUsd).toBeCloseTo(full.estimatedTotalUsd, 0);
    expect(full.addLaterUsd).toBe(0);
    // The boundary wall takes its own labour with it.
    const boundary = moveIn.addLater.find((item) => item.id === 'boundary')!;
    expect(boundary.usd).toBeGreaterThan(full.laborByTrade.find((trade) => trade.id === 'boundary_wall')!.usd);
    expect(moveIn.laborByTrade.some((trade) => trade.id === 'boundary_wall')).toBe(false);
    expect(moveIn.laborByTrade.reduce((sum, trade) => sum + trade.usd, 0)).toBeCloseTo(moveIn.laborUsd, 1);
    // Floor tiles and ceilings stay in.
    expect(moveIn.laborByTrade.some((trade) => trade.id === 'tiling')).toBe(true);
    expect(moveIn.laborByTrade.some((trade) => trade.id === 'ceilings')).toBe(true);
  });

  it('counts a ticked item and only that one', () => {
    const moveIn = estimateStageReach(base);
    const withKitchen = estimateStageReach({ ...base, addLater: ['kitchen'] });
    const kitchen = moveIn.addLater.find((item) => item.id === 'kitchen')!.usd;
    expect(withKitchen.estimatedTotalUsd - moveIn.estimatedTotalUsd).toBeCloseTo(kitchen, 1);
    expect(withKitchen.addLater.find((item) => item.id === 'kitchen')!.included).toBe(true);
    expect(moveIn.addLaterUsd - withKitchen.addLaterUsd).toBeCloseTo(kitchen, 1);
  });

  it('treats an emptied stage as done, and offers nothing in a stage already built', () => {
    const moveIn = estimateStageReach({ ...base, budgetUsd: 1e6 });
    const exterior = moveIn.rows.find((row) => row.id === 'exterior')!;
    expect(exterior.stageCostUsd).toBe(0);
    expect(exterior.coveragePercent).toBe(100);
    const built = estimateStageReach({ ...base, stageStatus: { exterior: 'built' } });
    expect(built.addLater.some((item) => item.id === 'boundary' || item.id === 'paving')).toBe(false);
  });
});
