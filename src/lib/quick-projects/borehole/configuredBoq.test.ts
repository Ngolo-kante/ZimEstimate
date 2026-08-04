import { describe, expect, it } from 'vitest';
import { calculateBoreholeBOQ } from './calculations';
import { getCasingLabel, getPumpPrice, getTankCost } from './pricing';
import type { Answers, BOQItem } from '../engine/types';

/**
 * The budget explorer displays a configuration and the BOQ has to itemise that
 * configuration — not re-derive one of its own.
 *
 * Before this, buildAnswers sent only budget, depth, purpose, location and area
 * type. The BOQ re-picked the casing grade by fitting 30% of the remaining
 * budget, chose its own pump and tank, and ignored every component the user had
 * switched off. Measured at $5,000 the explorer said $5,495 and the BOQ
 * produced $4,992 — a $503 gap with a different casing grade in it.
 */

const total = (items: BOQItem[]) => items.reduce((sum, i) => sum + i.totalCostUsd, 0);

const config = (extra: Partial<Answers> = {}): Answers =>
  ({
    estimate_mode: 'budget',
    configured: true,
    budget_amount: '5000',
    budget_depth: '40',
    borehole_purpose: 'domestic',
    project_location: 'other',
    area_type: 'peri_urban',
    pump_power_source: 'solar',
    casing_class: 'class_6',
    tank_capacity: '5000',
    use_combo: true,
    include_drilling: true,
    include_casing: true,
    include_pump: true,
    include_tank: true,
    include_services: true,
    include_permits: true,
    include_transport: true,
    ...extra,
  }) as Answers;

describe('the BOQ honours the configuration it is given', () => {
  it('quotes the casing grade the user picked, not one of its own', () => {
    const casing = calculateBoreholeBOQ(config({ casing_class: 'class_6' })).find((i) => i.id === 'bg_casing');
    expect(casing?.description).toContain(getCasingLabel('class_6'));
    expect(casing?.description).not.toContain('Class 10');
  });

  it.each(['class_6', 'class_9', 'class_10'] as const)('carries %s through', (grade) => {
    const casing = calculateBoreholeBOQ(config({ casing_class: grade })).find((i) => i.id === 'bg_casing');
    expect(casing?.description).toContain(getCasingLabel(grade));
  });

  it.each(['solar', 'hybrid', 'electric', 'hand'] as const)('quotes the %s pump the user picked', (pump) => {
    const items = calculateBoreholeBOQ(config({ pump_power_source: pump }));
    expect(items.find((i) => i.id === 'bg_pump')?.description).toBe(getPumpPrice(pump, 40).desc);
  });

  it('omits the rising main for a hand pump, which has none', () => {
    const items = calculateBoreholeBOQ(config({ pump_power_source: 'hand' }));
    expect(items.find((i) => i.id === 'bg_rising')).toBeUndefined();
  });
});

describe('switching a component off removes it', () => {
  it.each([
    ['include_drilling', 'bg_drilling'],
    ['include_casing', 'bg_casing'],
    ['include_pump', 'bg_pump'],
    ['include_tank', 'bg_tank'],
    ['include_permits', 'bg_zinwa'],
    ['include_transport', 'bg_mobilization'],
    ['include_services', 'bg_survey'],
  ])('%s = false drops %s', (flag, itemId) => {
    const items = calculateBoreholeBOQ(config({ [flag]: false }));
    expect(items.find((i) => i.id === itemId)).toBeUndefined();
  });

  it('costs less with a component removed than with everything on', () => {
    const all = total(calculateBoreholeBOQ(config()));
    const noTank = total(calculateBoreholeBOQ(config({ include_tank: false })));
    expect(noTank).toBeLessThan(all);
    expect(all - noTank).toBeCloseTo(getTankCost('5000', true).cost, 2);
  });
});

describe('a tank always comes with something to stand on', () => {
  it('never quotes a tank without a stand', () => {
    // The old greedy path added a bare tank and then a stand only "if budget
    // remains", so a $5,000 borehole could be quoted a 5,000L tank with nothing
    // to raise it on — which cannot gravity feed.
    const items = calculateBoreholeBOQ(config());
    const tank = items.find((i) => i.id === 'bg_tank');
    expect(tank).toBeDefined();
    expect(tank!.description).toMatch(/stand/i);
  });

  it('omits the tank entirely when the size is none', () => {
    expect(calculateBoreholeBOQ(config({ tank_capacity: 'none' })).find((i) => i.id === 'bg_tank')).toBeUndefined();
  });
});

describe('the unconfigured path still works', () => {
  it('falls back to budget fitting when no configuration is supplied', () => {
    const items = calculateBoreholeBOQ({
      estimate_mode: 'budget',
      budget_amount: '5000',
      budget_depth: '40',
    } as Answers);
    expect(items.length).toBeGreaterThan(0);
    expect(total(items)).toBeGreaterThan(0);
  });
});
