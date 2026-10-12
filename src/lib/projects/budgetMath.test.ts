import { describe, expect, it } from 'vitest';
import { projectMoney, savingsPace } from './budgetMath';

describe('one meaning for each money word', () => {
  it('uses the limit as the budget when one is set', () => {
    const m = projectMoney({ estimateUsd: 32914.79, limitUsd: 25000, spentUsd: 1000 });
    expect(m).toMatchObject({ budgetUsd: 25000, basis: 'limit', overspentUsd: 0 });
    expect(m.stillToFundUsd).toBeCloseTo(31914.79, 2);
    expect(m.estimateOverLimitUsd).toBeCloseTo(7914.79, 2);
  });

  it('falls back to the BOQ estimate without a limit', () => {
    const m = projectMoney({ estimateUsd: 32914.79, limitUsd: null, spentUsd: 0 });
    expect(m).toMatchObject({ budgetUsd: 32914.79, basis: 'estimate', estimateOverLimitUsd: 0 });
  });

  it('reports overspending against whichever budget applies', () => {
    expect(projectMoney({ estimateUsd: 1000, limitUsd: null, spentUsd: 1200 }).overspentUsd).toBe(200);
    expect(projectMoney({ estimateUsd: 1000, limitUsd: 800, spentUsd: 900 }).overspentUsd).toBe(100);
  });

  it('ignores a zero or missing limit', () => {
    expect(projectMoney({ estimateUsd: 500, limitUsd: 0, spentUsd: 0 }).basis).toBe('estimate');
  });
});

describe('savings pace', () => {
  it('never asks for more than the target, however close the deadline', () => {
    const pace = savingsPace(32914.79, 1)!;
    expect(pace.perDay).toBeCloseTo(32914.79, 2);
    expect(pace.perWeek).toBeNull();
    expect(pace.perMonth).toBeNull();
    expect(pace.recommended).toBe('daily');
  });

  it('splits by the contributions that fit before the deadline', () => {
    const pace = savingsPace(15000, 45)!;
    expect(pace.perWeek).toBeCloseTo(15000 / 7, 2); // 45 days = 7 weekly contributions
    expect(pace.perMonth).toBeCloseTo(15000 / 2, 2);
    expect(pace.recommended).toBe('weekly');
    for (const amount of [pace.perDay, pace.perWeek!, pace.perMonth!]) expect(amount).toBeLessThanOrEqual(15000);
  });

  it('recommends monthly when the target is months away', () => {
    expect(savingsPace(20000, 200)!.recommended).toBe('monthly');
  });

  it('has no plan without a target or a future date', () => {
    expect(savingsPace(0, 30)).toBeNull();
    expect(savingsPace(1000, 0)).toBeNull();
  });
});
