import { describe, expect, it } from 'vitest';
import { allocateBudget, type BudgetAllocation, type Objective } from './allocateBudget';
import { solarBalanceOfSystemCost } from './boq';
import { BATTERY_BRANDS, INVERTER_BRANDS, PANEL_BRANDS } from './catalog';

/**
 * The rules the budget split has to keep. Each one was broken at some point
 * and only noticed by eye in the browser — these make the next break loud.
 */

const pick = <T extends { brand: string }>(list: T[], key: string): T => {
  const found = list.find((item) => item.brand === key);
  if (!found) throw new Error(`No catalog entry for ${key}`);
  return found;
};

const PANEL = pick(PANEL_BRANDS, 'ja_solar');
const INVERTER = pick(INVERTER_BRANDS, 'must');
const BATTERY = pick(BATTERY_BRANDS, 'dyness');

const ALL_ON = {
  panels: true,
  inverter: true,
  battery: true,
  protection: true,
  installation: true,
  transport: false,
};

interface Options {
  objective?: Objective;
  enabled?: Partial<typeof ALL_ON>;
  installCustom?: number | null;
  laborPct?: number;
  redistribute?: boolean;
  battery?: typeof BATTERY;
  wiringKit?: 'full' | 'basic';
}

const allocate = (budget: number, options: Options = {}) =>
  allocateBudget({
    totalBudget: budget,
    panelBrand: PANEL,
    inverterBrand: INVERTER,
    batteryBrand: options.battery ?? BATTERY,
    enabledCards: { ...ALL_ON, ...options.enabled },
    objective: options.objective ?? 'balanced',
    installCustom: options.installCustom ?? null,
    laborPct: options.laborPct ?? 0.15,
    redistribute: options.redistribute ?? true,
    wiringKit: options.wiringKit,
  });

const kwhOf = (a: BudgetAllocation) => a.battery.units * a.battery.brand.unitKwh;

const totalOf = (a: BudgetAllocation) =>
  a.panels.cost + a.inverter.cost + a.battery.cost + a.protection.cost + a.installation.cost + a.transport.cost;

// Every preset on the page, plus the awkward amounts between them.
const BUDGETS = [500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 3500, 5000, 7500, 10000];
const OBJECTIVES: Objective[] = ['economy', 'balanced', 'quality'];

describe('the solar budget split', () => {
  describe('never spends more than the budget', () => {
    for (const objective of OBJECTIVES) {
      for (const redistribute of [true, false]) {
        it(`${objective}, ${redistribute ? 'spending it all' : 'plain split'}`, () => {
          for (const budget of BUDGETS) {
            const result = allocate(budget, { objective, redistribute });
            expect(totalOf(result), `$${budget}`).toBeLessThanOrEqual(budget);
          }
        });
      }
    }
  });

  it('never fits an array the inverter cannot take', () => {
    // An 18.9 kW array on a 12 kVA inverter got through once. 1.3x is the
    // usual DC oversizing ceiling for a hybrid unit.
    for (const objective of OBJECTIVES) {
      for (const budget of BUDGETS) {
        const result = allocate(budget, { objective });
        const arrayKw = (result.panels.count * PANEL.watt) / 1000;
        expect(arrayKw, `${objective} $${budget}`).toBeLessThanOrEqual(result.inverter.kva * 1.3);
      }
    }
  });

  it('drops the wiring kit before it drops the battery', () => {
    // The original bug: on $1,000 the wiring kit was paid first and the
    // battery got nothing.
    const result = allocate(1000);
    expect(result.battery.units).toBeGreaterThan(0);
    expect(result.panels.count).toBeGreaterThan(0);
    expect(result.protection.droppedForBudget).toBe(true);
    expect(result.protection.cost).toBe(0);
  });

  it('only leaves the wiring unfunded when it genuinely does not fit', () => {
    // Deprioritising it must not mean money sitting idle next to a row that
    // says "not funded".
    for (const budget of BUDGETS) {
      const result = allocate(budget);
      if (!result.protection.droppedForBudget) continue;
      const kit = solarBalanceOfSystemCost(result.panels.count, result.battery.units > 0);
      const withKit = totalOf(result) + kit * (1 + 0.15);
      expect(withKit, `$${budget}`).toBeGreaterThan(budget);
    }
  });

  it('funds the wiring once the budget reaches it', () => {
    const result = allocate(5000);
    expect(result.protection.droppedForBudget).toBe(false);
    expect(result.protection.cost).toBeGreaterThan(0);
  });

  describe('storage as the budget rises', () => {
    // It used to fall when the inverter jumped a size: $3,100 bought 7.7 kWh,
    // $3,200 bought 5.1 kWh beside a bigger inverter.
    const sweep = (options: Options) => {
      const points: { budget: number; kwh: number; wired: boolean; brand: string }[] = [];
      for (let budget = 500; budget <= 12000; budget += 100) {
        const result = allocate(budget, options);
        points.push({ budget, kwh: kwhOf(result), wired: result.protection.cost > 0, brand: result.battery.brand.brand });
      }
      return points;
    };

    for (const battery of ['dyness', 'pylontech', 'must', 'svolt'] as const) {
      it(`never falls with the same battery — ${battery}`, () => {
        // Two steps may cost storage, both deliberate: the wiring arriving
        // (an installable system over a bigger one that is not), and the
        // selected brand taking over from the cheap stand-in once it fits —
        // the user's brand choice is kept, with the cheaper option offered.
        const points = sweep({ battery: pick(BATTERY_BRANDS, battery) });
        for (let i = 1; i < points.length; i++) {
          const [before, after] = [points[i - 1], points[i]];
          if (before.wired !== after.wired || before.brand !== after.brand) continue;
          expect(after.kwh, `$${before.budget} → $${after.budget}`).toBeGreaterThanOrEqual(before.kwh);
        }
      });
    }
  });

  describe('the battery brand', () => {
    it('is the one the user chose, once it fits', () => {
      // A cheaper brand is also cheaper per kWh, so applying it whenever it
      // stored more swapped it in at every budget and made the picker — and
      // the Quality priority — do nothing.
      for (const battery of ['dyness', 'pylontech', 'byd'] as const) {
        const result = allocate(7500, { battery: pick(BATTERY_BRANDS, battery) });
        expect(result.battery.brand.brand, battery).toBe(battery);
        expect(result.fallbackBattery, battery).toBeNull();
      }
    });

    it('offers the cheaper brand when it would store more, without applying it', () => {
      const result = allocate(5000);
      expect(result.battery.brand.brand).toBe('dyness');
      expect(result.storageOffer).not.toBeNull();
      expect(result.storageOffer?.kwh ?? 0).toBeGreaterThan(kwhOf(result));
    });

    it('stands in a cheaper unit when the chosen brand does not fit at all', () => {
      const result = allocate(1000, { battery: pick(BATTERY_BRANDS, 'byd') });
      expect(result.battery.units).toBeGreaterThan(0);
      expect(result.fallbackBattery).not.toBeNull();
      expect(result.selectedBrandKwh).toBe(0);
    });
  });

  it('a bigger budget never loses the wiring kit', () => {
    // When the kit competed with each extra battery it flickered: funded at
    // $4,500, lost at $5,500, back at $6,000.
    for (const wiringKit of ['basic', 'full'] as const) {
      let funded = false;
      for (let budget = 500; budget <= 12000; budget += 100) {
        const has = allocate(budget, { wiringKit }).protection.cost > 0;
        if (funded) expect(has, `${wiringKit} kit at $${budget}`).toBe(true);
        funded = funded || has;
      }
      expect(funded, `${wiringKit} kit is funded somewhere`).toBe(true);
    }
  });

  it('the wiring kit only ever comes with a complete system', () => {
    // Never a kit wired to nothing: if it is in, so are panels and a battery.
    for (const budget of BUDGETS) {
      const result = allocate(budget);
      if (result.protection.cost === 0) continue;
      expect(result.panels.count, `$${budget}`).toBeGreaterThan(0);
      expect(result.battery.units, `$${budget}`).toBeGreaterThan(0);
    }
  });

  it('the basic wiring kit is funded wherever the full one is, and costs less', () => {
    for (const budget of BUDGETS) {
      const full = allocate(budget, { wiringKit: 'full' });
      const basic = allocate(budget, { wiringKit: 'basic' });
      if (full.protection.cost > 0) {
        expect(basic.protection.cost, `$${budget}`).toBeGreaterThan(0);
        expect(basic.protection.cost, `$${budget}`).toBeLessThan(full.protection.cost);
        // Both wired: the cheaper kit leaves more for the system, and with the
        // same battery brand that never means less storage.
        if (basic.battery.brand === full.battery.brand) {
          expect(kwhOf(basic), `storage at $${budget}`).toBeGreaterThanOrEqual(kwhOf(full));
        }
      }
    }
  });

  it('leaves the wiring at zero when the user switched it off', () => {
    const result = allocate(5000, { enabled: { protection: false } });
    expect(result.protection.cost).toBe(0);
    // Switched off is not the same as "the money ran out".
    expect(result.protection.droppedForBudget).toBe(false);
  });

  describe('installation labour', () => {
    it('charges the chosen rate on the hardware', () => {
      for (const laborPct of [0.1, 0.15, 0.2]) {
        const result = allocate(3000, { laborPct });
        const hardware = result.panels.cost + result.inverter.cost + result.battery.cost + result.protection.cost;
        expect(result.installation.cost).toBe(Math.round(hardware * laborPct));
        expect(result.installation.pct).toBe(Math.round(laborPct * 100));
      }
    });

    it("uses the installer's quote verbatim when one is given", () => {
      const result = allocate(3000, { installCustom: 250 });
      expect(result.installation.cost).toBe(250);
      expect(result.installation.isCustom).toBe(true);
    });

    it('a cheaper rate only ever helps', () => {
      // At $2,500 a 10% rate once freed just enough for the wiring kit, which
      // was then bought before the second battery — so the cheaper installer
      // cost the user half their storage. The battery comes before the wiring
      // kit, so freed money may go to wiring or panels but never away from
      // the battery or the inverter. (The reverse is allowed and expected: at
      // $5,000 the saving buys a second battery and the kit no longer fits.)
      for (const budget of BUDGETS) {
        const cheap = allocate(budget, { laborPct: 0.1 });
        const dear = allocate(budget, { laborPct: 0.2 });
        const wired = (r: BudgetAllocation) => r.protection.cost > 0;
        // A cheaper rate may bring the wiring kit in where the dearer one
        // could not — an installable system over a bigger one that is not.
        // It must never lose the kit, and with the kit settled the same way
        // it must never cost storage or inverter size.
        if (wired(dear)) expect(wired(cheap), `wiring at $${budget}`).toBe(true);
        // Like for like — same wiring, same battery brand — the money saved
        // must show up as storage, never as less. (Inverter size is not
        // compared: it is chosen for storage, so a smaller one can win.)
        if (wired(cheap) === wired(dear) && cheap.battery.brand === dear.battery.brand) {
          expect(kwhOf(cheap), `storage at $${budget}`).toBeGreaterThanOrEqual(kwhOf(dear));
        }
      }
    });

    it('costs nothing when switched off', () => {
      const result = allocate(3000, { enabled: { installation: false } });
      expect(result.installation.cost).toBe(0);
    });
  });

  describe('spending it all', () => {
    it('never buys less storage than the plain split', () => {
      for (const budget of BUDGETS) {
        const spent = allocate(budget, { redistribute: true });
        const plain = allocate(budget, { redistribute: false });
        expect(kwhOf(spent), `$${budget}`).toBeGreaterThanOrEqual(kwhOf(plain));
      }
    });

    it('never leaves enough idle for another battery', () => {
      // Total spend can come out a little under the plain split — buying a
      // battery can leave a remainder too small for one more panel with its
      // cable and labour. What must not happen is money idle that could have
      // bought more storage.
      for (const budget of BUDGETS) {
        const result = allocate(budget, { redistribute: true });
        const idle = budget - totalOf(result);
        // Unless storage is already at its ceiling of 2 kWh per inverter kVA —
        // then the system is as big as one inverter sensibly gets, and money
        // left over is honestly left over.
        const storageFull = kwhOf(result) + result.battery.brand.unitKwh > result.inverter.kva * 2;
        if (storageFull) continue;
        expect(idle, `$${budget}`).toBeLessThan(result.battery.brand.unitPrice);
      }
    });
  });

  it('falls back to a cheaper battery rather than none', () => {
    // Pylontech at $1,350 a unit does not fit a $1,000 budget's battery share;
    // the user should still end up with storage.
    const result = allocate(1000, { battery: pick(BATTERY_BRANDS, 'pylontech') });
    expect(result.battery.units).toBeGreaterThan(0);
    expect(result.fallbackBattery).not.toBeNull();
  });
});
