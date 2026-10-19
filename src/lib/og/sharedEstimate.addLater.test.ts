import { describe, expect, it } from 'vitest';
import { summariseSharedEstimate } from './sharedEstimate';
import { estimateStageReach, stageStatusFromParams } from '@/lib/estimators/stageBudgetEstimator';
import { ADD_LATER_IDS, addLaterFromParam } from '@/lib/estimators/addLater';
import { HOUSE_DEFAULTS, HOUSE_PROFILES } from '@/lib/estimators/houseBudgetOptions';

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

describe('house preview add-later choices', () => {
  it.each([
    '',
    'kitchen,boundary',
    ADD_LATER_IDS.join(','),
    'unknown,kitchen',
  ])('matches the move-in estimate with add=%s and stage choices', (add) => {
    const params = new URLSearchParams({ budget: '12000', add, done: 'substructure', later: 'roofing' });
    const config = HOUSE_PROFILES[HOUSE_DEFAULTS.profile];
    const estimate = estimateStageReach({
      budgetUsd: 12000,
      floorAreaM2: HOUSE_DEFAULTS.area,
      locationType: HOUSE_DEFAULTS.location,
      wallHeightM: config.wallHeightM,
      cementTypes: [config.cementType],
      includeLabor: true,
      stageStatus: stageStatusFromParams(params),
      addLater: addLaterFromParam(add),
    });
    const summary = summariseSharedEstimate(params)!;
    expect(summary.lines[1]).toContain(`${usd(estimate.estimatedTotalUsd)} to move in`);
    expect(summary.lines[0]).toBe(`Reaches: ${estimate.reachableStageLabel}`);
  });

  it('changes the preview total when optional items are counted', () => {
    const base = 'budget=60000&area=120';
    const moveIn = summariseSharedEstimate(new URLSearchParams(base))!;
    const all = summariseSharedEstimate(new URLSearchParams(`${base}&add=${ADD_LATER_IDS.join(',')}`))!;
    expect(all.lines[1]).not.toBe(moveIn.lines[1]);
    expect(all.description).toContain('to move in');
  });
});
