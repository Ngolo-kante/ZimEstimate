import { describe, expect, it } from 'vitest';
import { calculateBoreholeBOQ } from './calculations';
import { getCasingExtras, getDrillingCost, getTransportCost } from './pricing';
import type { Answers, BOQItem } from '../engine/types';

/**
 * Drilling priced the way Zimbabwean drillers quote it (owner's figures,
 * 2026-10-18): the first 40 m as one package of $700–1,000 including 18–20 m
 * of casing and their fees, then each metre beyond; extra casing at $9 or
 * more a metre; outside Harare usually $100–200 more, mostly transport.
 * Before this, a 40 m Harare hole was $30 a metre plus casing for its full
 * depth plus $250 transport — about $1,570 before any extras.
 */

const total = (items: BOQItem[]) => items.reduce((sum, i) => sum + i.totalCostUsd, 0);
const byId = (items: BOQItem[], id: string) => items.find((i) => i.id === id);

const newBorehole = (extra: Partial<Answers> = {}): BOQItem[] =>
  calculateBoreholeBOQ({
    project_scope: 'new_borehole',
    borehole_purpose: 'domestic',
    project_location: 'harare',
    drilling_depth: 40,
    system_scope: 'drilling_only',
    casing_class: 'class_6',
    include_site_survey: false,
    include_flushing: false,
    include_yield_test: false,
    include_zinwa_permit: false,
    include_council_fee: false,
    ...extra,
  } as Answers);

describe('drilling as drillers sell it', () => {
  it('prices the first 40 m as one package, then by the metre', () => {
    expect(getDrillingCost(40)).toBe(850);
    expect(getDrillingCost(60)).toBe(850 + 20 * 28);
    // A shallow hole is still the package.
    expect(getDrillingCost(30)).toBe(850);
  });

  it('quotes a 40 m Harare borehole at the package price, inside the $700–1,000 drillers charge', () => {
    const items = newBorehole();
    expect(total(items)).toBe(850);
    expect(byId(items, 'bh_extra_drilling')).toBeUndefined();
    expect(byId(items, 'bh_transport')).toBeUndefined();
  });

  it('adds the metres beyond 40 m at $28', () => {
    const items = newBorehole({ drilling_depth: 60 });
    expect(byId(items, 'bh_extra_drilling')).toMatchObject({ quantity: 20, unitCostUsd: 28 });
    expect(total(items)).toBe(1410);
  });
});

describe('casing beyond the package', () => {
  it('includes 20 m of Class 6 and offers extra metres at $9, none by default', () => {
    const extra = byId(newBorehole(), 'bh_casing_extra');
    expect(extra).toMatchObject({ quantity: 0, unitCostUsd: 9 });
    expect(getCasingExtras('class_6', '140mm', 30)).toMatchObject({ extraM: 10, total: 90 });
  });

  it('charges only the difference to upgrade the included 20 m', () => {
    const items = newBorehole({ casing_class: 'class_10' });
    expect(byId(items, 'bh_casing_upgrade')).toMatchObject({ quantity: 20, unitCostUsd: 8 });
  });

  it('double-cases sandy ground instead of mud drilling the whole hole', () => {
    const items = newBorehole({ ground_conditions: 'sandy' });
    expect(byId(items, 'bh_double_casing')).toMatchObject({ quantity: 10, unitCostUsd: 28 });
    expect(total(items)).toBe(850 + 280);
  });
});

describe('outside Harare', () => {
  it('adds transport, usually $100–200, with a note saying so', () => {
    const transport = byId(newBorehole({ project_location: 'bulawayo' }), 'bh_transport');
    expect(transport?.unitCostUsd).toBe(150);
    expect(transport?.notes).toMatch(/\$100–200/);
  });

  it('treats Chitungwiza like Harare', () => {
    expect(getTransportCost('chitungwiza')).toBe(0);
    expect(getTransportCost('other')).toBe(150);
  });
});

describe('solar pump packages', () => {
  it('price pump, panels, pipes and installation as one package, with the tank on its own line', () => {
    const items = newBorehole({ system_scope: 'complete_system', pump_power_source: 'solar', tank_capacity: '5000', include_tank_stand: 'combo' });
    expect(byId(items, 'bh_pump')).toMatchObject({ unitCostUsd: 850 });
    expect(byId(items, 'bh_rising')).toBeUndefined();
    expect(byId(items, 'bh_pump_install')).toBeUndefined();
    // Drilled, pumped and stored: about what installers charge for the same.
    expect(total(items)).toBe(850 + 850 + 1000);
  });
});
