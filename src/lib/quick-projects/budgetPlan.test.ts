import { describe, expect, it } from 'vitest';
import { buildBudgetPlan } from './budgetPlan';

/**
 * "Some may create a project to do in three months and need to budget their
 * funds towards it." This is the forward-looking half — what to put aside each
 * month to arrive funded — not budget-vs-actual, which only means something
 * once money has been spent.
 */

const AUG = new Date('2026-08-04T00:00:00Z');

const plan = (over: Partial<Parameters<typeof buildBudgetPlan>[0]> = {}) =>
  buildBudgetPlan({ totalUsd: 6000, savedUsd: 0, targetDate: null, today: AUG, ...over });

describe('what is left to raise', () => {
  it('splits the remainder evenly across the months available', () => {
    // $6,000 by November, nothing saved, 3 whole months → $2,000 a month.
    const p = plan({ targetDate: '2026-11-04' });
    expect(p.monthsRemaining).toBe(3);
    expect(p.monthlyRequiredUsd).toBe(2000);
  });

  it('counts what is already saved', () => {
    const p = plan({ savedUsd: 3000, targetDate: '2026-11-04' });
    expect(p.remainingUsd).toBe(3000);
    expect(p.monthlyRequiredUsd).toBe(1000);
    expect(p.percentFunded).toBe(50);
  });

  it('rounds the monthly figure up, so the plan actually reaches the total', () => {
    // $1,000 over 3 months is $333.33; asking for $333 arrives a dollar short.
    const p = plan({ totalUsd: 1000, targetDate: '2026-11-04' });
    expect(p.monthlyRequiredUsd).toBe(334);
  });

  it('asks for the whole remainder when the target is this month', () => {
    const p = plan({ targetDate: '2026-08-20' });
    expect(p.monthsRemaining).toBe(0);
    expect(p.monthlyRequiredUsd).toBe(6000);
  });

  it('does not count a partial month as a whole one', () => {
    // 4 Aug → 1 Sep is under a month; promising two monthly payments would be
    // a plan that cannot be met.
    expect(plan({ targetDate: '2026-09-01' }).monthsRemaining).toBe(0);
    expect(plan({ targetDate: '2026-09-04' }).monthsRemaining).toBe(1);
  });
});

describe('a funded plan stops asking for money', () => {
  it('reports fully funded and a zero monthly ask', () => {
    const p = plan({ savedUsd: 6000, targetDate: '2026-11-04' });
    expect(p.fullyFunded).toBe(true);
    expect(p.remainingUsd).toBe(0);
    expect(p.monthlyRequiredUsd).toBe(0);
  });

  it('caps at 100% rather than reporting 150% of a project', () => {
    const p = plan({ savedUsd: 9000 });
    expect(p.percentFunded).toBe(100);
    expect(p.remainingUsd).toBe(0);
  });

  it('is not overdue once funded, even past the date', () => {
    expect(plan({ savedUsd: 6000, targetDate: '2026-01-01' }).overdue).toBe(false);
  });
});

describe('a date that has passed', () => {
  it('is overdue while money is still outstanding', () => {
    const p = plan({ savedUsd: 1000, targetDate: '2026-01-01' });
    expect(p.overdue).toBe(true);
    expect(p.monthsRemaining).toBe(0);
    expect(p.monthlyRequiredUsd).toBe(5000);
  });
});

describe('no target date set', () => {
  it('still reports progress but promises no schedule', () => {
    const p = plan({ savedUsd: 1500 });
    expect(p.percentFunded).toBe(25);
    expect(p.monthsRemaining).toBeNull();
    expect(p.monthlyRequiredUsd).toBeNull();
    expect(p.overdue).toBe(false);
  });

  it('ignores a target date it cannot parse', () => {
    expect(plan({ targetDate: 'not a date' }).monthsRemaining).toBeNull();
  });
});

describe('degenerate input', () => {
  it('treats a negative saved amount as zero rather than inflating the remainder', () => {
    const p = plan({ savedUsd: -500 });
    expect(p.savedUsd).toBe(0);
    expect(p.remainingUsd).toBe(6000);
  });

  it('reports 0% for an empty estimate instead of dividing by zero', () => {
    const p = plan({ totalUsd: 0, savedUsd: 0 });
    expect(p.percentFunded).toBe(0);
    expect(p.fullyFunded).toBe(false);
  });
});
