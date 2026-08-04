import { describe, expect, it } from 'vitest';
import { fitBoreholeToBudget, getPumpPrice, getCasingPrice, getTankCost } from './pricing';

/**
 * The explorer asked "what can your budget buy?" and ignored the answer.
 *
 * It held fixed defaults — 40m, Class 6 casing, a 0.75HP solar kit, a 5,000L
 * combo tank — and reported $5,495 allocated whether the budget was $15,000 or
 * $2,000, with a maxed-out bar reading "$3,495 over". Nothing about the
 * configuration responded to the number the user typed.
 */

const fit = (budget: number, over: Partial<Parameters<typeof fitBoreholeToBudget>[0]> = {}) =>
  fitBoreholeToBudget({
    budget,
    depth: 40,
    purpose: 'domestic',
    areaType: 'peri_urban',
    councilFee: 50,
    ...over,
  });

describe('the configuration responds to the budget', () => {
  it('buys a better pump with more money', () => {
    const lean = fit(2000);
    const rich = fit(15000);
    expect(rich.pumpType).not.toBe(lean.pumpType);
    expect(getPumpPrice(rich.pumpType, 40).price).toBeGreaterThan(getPumpPrice(lean.pumpType, 40).price);
  });

  it('buys better casing with more money', () => {
    expect(getCasingPrice(fit(15000).casingGrade, '140mm'))
      .toBeGreaterThan(getCasingPrice(fit(2000).casingGrade, '140mm'));
  });

  it('never returns the same configuration across the whole budget range', () => {
    // The bug in one line: every budget produced an identical $5,495 package.
    const configs = [2000, 3000, 5000, 7500, 10000, 15000].map((b) => {
      const f = fit(b);
      return `${f.casingGrade}|${f.pumpType}|${f.tankSize}`;
    });
    expect(new Set(configs).size).toBeGreaterThan(1);
  });

  it('costs more as the budget grows, never less', () => {
    const costs = [2000, 5000, 10000, 15000].map((b) => fit(b).fittedCostUsd);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
    }
  });
});

describe('what a small budget gets', () => {
  it('falls back to a hand pump rather than no pump', () => {
    // A borehole you cannot draw water from is not a cheaper borehole.
    expect(fit(2000).pumpType).toBe('hand');
  });

  it('drops storage before it drops the pump', () => {
    const lean = fit(2000);
    expect(lean.tankSize).toBe('none');
    expect(lean.pumpType).toBeTruthy();
  });

  it('says plainly when the budget does not cover a viable borehole', () => {
    const f = fit(500);
    expect(f.budgetTooLow).toBe(true);
    expect(f.fittedCostUsd).toBeGreaterThan(500);
  });

  it('does not claim to be over budget when it fits', () => {
    expect(fit(15000).budgetTooLow).toBe(false);
  });
});

describe('what a generous budget gets', () => {
  it('takes the premium casing and a solar kit', () => {
    const f = fit(15000);
    expect(f.casingGrade).toBe('class_10');
    expect(f.pumpType).toBe('solar');
  });

  it('adds storage, and always with a stand', () => {
    const f = fit(15000);
    expect(f.tankSize).not.toBe('none');
    expect(getTankCost(f.tankSize, f.useCombo).desc).toMatch(/stand/i);
  });
});

describe('depth is an input, not something to solve for', () => {
  it('costs more to go deeper on the same budget', () => {
    // Silently redrilling to 20m to hit a number would be dishonest — the user
    // set the depth on a slider.
    const shallow = fit(8000, { depth: 30 });
    const deep = fit(8000, { depth: 120 });
    expect(deep.fittedCostUsd).toBeGreaterThan(shallow.fittedCostUsd);
  });

  it('downgrades components rather than the hole when depth eats the budget', () => {
    const deep = fit(6000, { depth: 150 });
    const shallow = fit(6000, { depth: 30 });
    expect(getPumpPrice(deep.pumpType, 150).price)
      .toBeLessThanOrEqual(getPumpPrice(shallow.pumpType, 30).price * 3);
    expect(deep.budgetTooLow || deep.tankSize === 'none').toBe(true);
  });
});

describe('commercial boreholes', () => {
  it('uses the wider casing, which costs more for the same budget', () => {
    const dom = fit(10000, { purpose: 'domestic' });
    const com = fit(10000, { purpose: 'commercial' });
    expect(getCasingPrice(com.casingGrade, '180mm'))
      .toBeGreaterThan(getCasingPrice(dom.casingGrade, '140mm') * 0.5);
  });
});
