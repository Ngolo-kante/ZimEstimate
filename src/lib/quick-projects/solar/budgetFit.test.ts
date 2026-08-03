import { describe, expect, it } from 'vitest';
import { solarBalanceOfSystemCost, solarSizingToBOQ, SOLAR_INSTALL_LABOR_PCT } from './boq';
import type { BOQItem } from '../engine/types';

/**
 * The budget explorer's whole promise is that the number you type is the number
 * you get. It was not: a $1,000 budget reported $869 allocated and then
 * produced a $2,139 BOQ.
 *
 * Three causes, all of them two-cost-models-disagreeing:
 *  - the BOQ forced a battery in with Math.max(1, ...) even when the allocation
 *    could not afford one, adding $790 on its own
 *  - the explorer estimated balance-of-system as a flat constant while the BOQ
 *    priced cable and trunking per panel
 *  - installation was then charged as a percentage of the inflated total
 */

const total = (items: BOQItem[]) =>
  items.filter((i) => i.included && !i.owned).reduce((sum, i) => sum + i.totalCostUsd, 0);

const sizing = (panelCount: number, batteryKwh: number, inverterKva: number) => ({
  peakLoadWatts: inverterKva * 800,
  inverterKva,
  batteryKwh,
  solarArrayKw: (panelCount * 440) / 1000,
  panelCount,
  dailyEnergyKwh: 5,
  tier: 'small' as const,
  estimatedCostUsd: { low: 0, high: 0 },
  warnings: [] as string[],
});

const answers = (extra: Record<string, unknown> = {}) =>
  ({
    intent: 'budget',
    backupHours: null,
    location: '',
    propertyType: null,
    appliances: {},
    simultaneousLoads: { kettleMicrowave: false, pumpWithHouse: false, geyserWithHouse: false },
    roof: { type: null, shading: null, orientation: '', spaceM2: null },
    existing: { hasExisting: false, inverterKva: null, batteryKwh: null, panelCount: null, issues: '' },
    budgetUsd: 1000,
    quote: { totalUsd: null, inverterKva: null, batteryKwh: null, panelCount: null, panelWatt: null, notes: '' },
    panel_brand: 'ja_solar',
    inverter_brand: 'must',
    battery_brand: 'dyness',
    include_transport: false,
    include_install: true,
    include_contingency: false,
    ...extra,
  }) as unknown as Parameters<typeof solarSizingToBOQ>[1];

describe('a sizing with no battery does not get charged for one', () => {
  it('omits the battery line entirely at zero kWh', () => {
    const items = solarSizingToBOQ(sizing(4, 0, 3), answers());
    expect(items.find((i) => i.id === 'sol_batteries')).toBeUndefined();
  });

  it('omits the battery breaker too — nothing to isolate', () => {
    const items = solarSizingToBOQ(sizing(4, 0, 3), answers());
    expect(items.find((i) => i.id === 'sol_bat_breaker')).toBeUndefined();
  });

  it('still includes a battery when the sizing asks for one', () => {
    const items = solarSizingToBOQ(sizing(4, 5.12, 3), answers());
    const battery = items.find((i) => i.id === 'sol_batteries');
    expect(battery?.quantity).toBe(1);
    expect(items.find((i) => i.id === 'sol_bat_breaker')).toBeDefined();
  });
});

describe('the explorer and the BOQ agree on balance-of-system cost', () => {
  it.each([0, 1, 4, 12])('matches the BOQ line items at %i panels', (panelCount) => {
    const items = solarSizingToBOQ(sizing(panelCount, 5.12, 3), answers());

    // Everything the BOQ charges that is not a panel, inverter, battery or labour.
    const boqBos = items
      .filter(
        (i) =>
          !['sol_panels', 'sol_inverter', 'sol_batteries', 'sol_install', 'sol_transport', 'sol_contingency'].includes(
            i.id
          )
      )
      .reduce((sum, i) => sum + i.totalCostUsd, 0);

    expect(solarBalanceOfSystemCost(panelCount, true)).toBeCloseTo(boqBos, 2);
  });

  it('drops the battery breaker from the shared figure when there is no battery', () => {
    const withBattery = solarBalanceOfSystemCost(4, true);
    const without = solarBalanceOfSystemCost(4, false);
    expect(withBattery - without).toBeCloseTo(28, 2);
  });
});

describe('installation is a share of hardware, not of itself', () => {
  it('charges the documented percentage of the hardware total', () => {
    const items = solarSizingToBOQ(sizing(4, 5.12, 3), answers());
    const hardware = items
      .filter((i) => !i.owned && !i.optional)
      .reduce((sum, i) => sum + i.totalCostUsd, 0);
    const install = items.find((i) => i.id === 'sol_install');

    expect(install?.totalCostUsd).toBeCloseTo(hardware * SOLAR_INSTALL_LABOR_PCT, 1);
    // Guards the classic compounding error — labour priced on a total that
    // already contains labour.
    expect(install!.totalCostUsd).toBeLessThan(total(items) / 2);
  });
});

describe('the protection toggle reaches the BOQ', () => {
  const protectionIds = [
    'sol_mount', 'sol_dc_cable', 'sol_ac_cable', 'sol_combiner', 'sol_dc_iso',
    'sol_ac_iso', 'sol_surge_dc', 'sol_surge_ac', 'sol_avs', 'sol_changeover',
    'sol_db', 'sol_earth', 'sol_trunking',
  ];

  it('includes protection by default', () => {
    const items = solarSizingToBOQ(sizing(4, 5.12, 3), answers());
    expect(items.filter((i) => protectionIds.includes(i.id)).length).toBeGreaterThan(0);
  });

  it('omits every protection item when the toggle is off', () => {
    // Previously ignored, so a budget that excluded protection still produced a
    // BOQ charging ~$511 for it, plus installation as a percentage on top.
    const items = solarSizingToBOQ(sizing(4, 5.12, 3), answers({ include_protection: false }));
    expect(items.filter((i) => protectionIds.includes(i.id))).toHaveLength(0);
  });

  it('drops the BOQ total by exactly the shared balance-of-system figure', () => {
    const withProt = total(solarSizingToBOQ(sizing(4, 0, 3), answers({ include_install: false })));
    const without = total(solarSizingToBOQ(sizing(4, 0, 3), answers({ include_install: false, include_protection: false })));
    expect(withProt - without).toBeCloseTo(solarBalanceOfSystemCost(4, false), 2);
  });
});
