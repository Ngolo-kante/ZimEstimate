// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BOREHOLE_PRICES as P, LOCATION_DEFAULTS, boreholeAreaType, inHarareArea } from './catalog';
import {
  fitBoreholeToBudget,
  getCasingExtras,
  getDrillingCost,
  getPumpPrice,
  getPumpSetCost,
  getTankCost,
  getTransportCost,
  type CasingDiameter,
  type CasingGrade,
  type PumpType,
} from './pricing';

const casingRates: [CasingGrade, CasingDiameter, number][] = [
  ['class_6', '140mm', P.casing_upvc_140_c6],
  ['class_9', '140mm', P.casing_upvc_140_c9],
  ['class_10', '140mm', P.casing_upvc_140_c10],
  ['class_6', '180mm', P.casing_upvc_180_c6],
  ['class_9', '180mm', P.casing_upvc_180_c9],
  ['class_10', '180mm', P.casing_upvc_180_c10],
];
const pumpTypes: PumpType[] = ['solar', 'hybrid', 'electric', 'hand'];
const tankSizes = ['2000', '2500', '5000', '10000'] as const;

// Expected kit prices come from the catalog, independently of the selectors.
function kitPrice(type: PumpType, depth: number): number {
  if (type === 'hand') return P.pump_hand_afridev;
  const tiers: [number, number][] = type === 'solar'
    ? [[30, P.solar_kit_05hp], [50, P.solar_kit_075hp], [80, P.solar_kit_1hp],
      [100, P.solar_kit_15hp], [120, P.solar_kit_2hp], [Infinity, P.solar_kit_3hp]]
    : type === 'hybrid'
      ? [[60, P.hybrid_kit_1hp], [100, P.hybrid_kit_15hp], [Infinity, P.hybrid_kit_2hp]]
      : [[50, P.electric_kit_075hp], [100, P.electric_kit_1hp],
        [120, P.electric_kit_2hp], [Infinity, P.electric_kit_3hp]];
  return tiers.find(([maxDepth]) => depth <= maxDepth)![1];
}

function pumpSetPrice(type: PumpType, depth: number, purpose: string): number {
  const kit = kitPrice(type, depth);
  if (type === 'solar') return kit;
  if (type === 'hand') return kit + P.pump_installation;
  return kit + (depth + 5) * (purpose === 'domestic' ? P.rising_hdpe_25mm : P.rising_hdpe_32mm) + P.pump_installation;
}

describe('drilling packages', () => {
  it.each([25, P.drilling_package_depth_m - 1, P.drilling_package_depth_m])(
    'charges the whole package for a %i m hole', (depth) => {
      expect(getDrillingCost(depth)).toBe(P.drilling_package_40m);
    },
  );

  it.each([1, 20, 120])('charges only the extra metres beyond the package: +%i m', (extra) => {
    expect(getDrillingCost(P.drilling_package_depth_m + extra))
      .toBe(P.drilling_package_40m + extra * P.extra_drilling_per_m);
  });
});

describe('casing included in the package', () => {
  it('includes the default 140 mm Class 6 casing without an extra charge', () => {
    expect(getCasingExtras('class_6', '140mm').total).toBe(0);
    expect(getCasingExtras('class_6', '140mm', P.drilling_package_casing_m).total).toBe(0);
  });

  it.each(casingRates)('charges only the upgrade difference for included %s / %s casing', (grade, diameter, rate) => {
    const result = getCasingExtras(grade, diameter);
    expect(result.upgradePerM).toBe(rate - P.casing_upvc_140_c6);
    expect(result.extraM).toBe(0);
    expect(result.total).toBe(P.drilling_package_casing_m * (rate - P.casing_upvc_140_c6));
  });

  it.each(casingRates)('charges the full rate beyond the included %s / %s casing', (grade, diameter, rate) => {
    const extra = 15;
    const result = getCasingExtras(grade, diameter, P.drilling_package_casing_m + extra);
    expect(result.extraM).toBe(extra);
    expect(result.extraPerM).toBe(rate);
    expect(result.total).toBe(P.drilling_package_casing_m * (rate - P.casing_upvc_140_c6) + extra * rate);
  });
});

describe('transport', () => {
  it.each(['harare', 'chitungwiza'])('is included in the Harare area: %s', (location) => {
    expect(inHarareArea(location)).toBe(true);
    expect(getTransportCost(location)).toBe(0);
  });

  it.each(Object.keys(LOCATION_DEFAULTS).filter((location) => !inHarareArea(location)))(
    'adds transport outside Harare: %s', (location) => {
      expect(getTransportCost(location)).toBe(P.transport_outside_harare);
    },
  );
});

describe('pump sets', () => {
  it.each(['domestic', 'commercial'])('includes pipes, cable and installation in solar kits for %s use', (purpose) => {
    for (let depth = 20; depth <= 160; depth++) {
      expect(getPumpSetCost('solar', depth, purpose)).toBe(kitPrice('solar', depth));
    }
  });

  it.each(['electric', 'hybrid'] as const)('adds a depth + 5 m rising main and installation to %s kits', (type) => {
    for (const purpose of ['domestic', 'commercial']) {
      for (let depth = 20; depth <= 160; depth++) {
        expect(getPumpSetCost(type, depth, purpose)).toBe(pumpSetPrice(type, depth, purpose));
      }
    }
  });

  it('adds only installation to a hand pump', () => {
    expect(getPumpSetCost('hand', 40, 'domestic')).toBe(P.pump_hand_afridev + P.pump_installation);
  });

  it.each(pumpTypes)('never chooses a smaller %s pump as depth increases from 20–160 m', (type) => {
    // Compare horsepower, not price: a catalog price change must not imply a
    // change in pump size. The hand pump stays the same model at every depth.
    const size = (depth: number) => {
      const pump = getPumpPrice(type, depth);
      if (type === 'hand') {
        expect(pump.desc).toBe('Afridev hand pump');
        return 0;
      }
      const hp = pump.desc.match(/([\d.]+)\s*HP/);
      expect(hp).not.toBeNull();
      return Number(hp![1]);
    };
    let previous = size(20);
    for (let depth = 21; depth <= 160; depth++) {
      const current = size(depth);
      expect(current, `${type} at ${depth} m`).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('tank and stand pricing', () => {
  it.each(tankSizes)('always includes a stand with a separate %s L tank', (size) => {
    expect(getTankCost(size, false).cost).toBe(P[`tank_${size}L`] + P.tank_stand_4m);
  });

  it.each(tankSizes)('includes a stand when requesting a %s L combo, including unbundled sizes', (size) => {
    const expected = size === '5000' ? P.combo_5000L_4m
      : size === '10000' ? P.combo_10000L_4m : P[`tank_${size}L`] + P.tank_stand_4m;
    expect(getTankCost(size, true).cost).toBe(expected);
  });

  it.each([true, false])('charges nothing for no tank (combo: %s)', (useCombo) => {
    expect(getTankCost('none', useCombo).cost).toBe(0);
  });
});

describe('fitting a borehole to a budget', () => {
  const scenarios = (['domestic', 'commercial'] as const).flatMap((purpose) =>
    ['harare', 'chitungwiza', 'mutare'].flatMap((location) =>
      [20, 40, 60, 100, 160].map((depth) => ({
        purpose, location, depth,
        areaType: boreholeAreaType(location),
        councilFee: LOCATION_DEFAULTS[location].councilFee,
      }))),
  );
  type Scenario = (typeof scenarios)[number];

  const fixedCost = (s: Scenario) => P.zinwa_permit_gw1 + s.councilFee
    + (inHarareArea(s.location) ? 0 : P.transport_outside_harare)
    + (s.areaType === 'urban' ? P.site_survey_urban : P.site_survey_peri_urban)
    + P.drilling_package_40m + Math.max(0, s.depth - P.drilling_package_depth_m) * P.extra_drilling_per_m;
  const casingCost = (s: Scenario, grade: CasingGrade) => {
    const diameter = s.purpose === 'domestic' ? '140mm' : '180mm';
    const rate = casingRates.find(([g, d]) => g === grade && d === diameter)![2];
    return P.drilling_package_casing_m * (rate - P.casing_upvc_140_c6);
  };
  const minimumCost = (s: Scenario) => fixedCost(s) + Math.min(...casingRates
    .filter(([, d]) => d === (s.purpose === 'domestic' ? '140mm' : '180mm'))
    .map(([grade]) => casingCost(s, grade)))
    + Math.min(...pumpTypes.map((type) => pumpSetPrice(type, s.depth, s.purpose)));

  function quotedCost(s: Scenario, fit: ReturnType<typeof fitBoreholeToBudget>): number {
    const tank = fit.tankSize === 'none' ? 0
      : fit.useCombo && fit.tankSize === '5000' ? P.combo_5000L_4m
        : fit.useCombo && fit.tankSize === '10000' ? P.combo_10000L_4m
          : P[`tank_${fit.tankSize}L`] + P.tank_stand_4m;
    return fixedCost(s) + casingCost(s, fit.casingGrade) + pumpSetPrice(fit.pumpType, s.depth, s.purpose) + tank;
  }

  it('returns real totals within budget across depths, purposes and locations when comfortably funded', () => {
    for (const s of scenarios) {
      for (const multiplier of [2, 4, 8]) {
        const budget = minimumCost(s) * multiplier;
        const fit = fitBoreholeToBudget({ ...s, budget });
        expect(fit.budgetTooLow).toBe(false);
        expect(quotedCost(s, fit)).toBeLessThanOrEqual(budget);
        expect(fit.fittedCostUsd).toBeCloseTo(quotedCost(s, fit), 6);
      }
    }
  });

  it('reports an insufficient budget when even the cheapest working setup cannot fit', () => {
    for (const s of scenarios) {
      const budget = minimumCost(s) - 1;
      const fit = fitBoreholeToBudget({ ...s, budget });
      expect(fit.budgetTooLow).toBe(true);
      expect(fit.fittedCostUsd).toBeCloseTo(quotedCost(s, fit), 6);
      expect(fit.fittedCostUsd).toBeGreaterThan(budget);
      expect(fit.tankSize).toBe('none');
    }
  });

  // A casing upgrade used to take the money the cheapest pump needed, so a
  // budget that covered a working borehole came out "too low".
  it('stays within budget when the cheapest working borehole fits exactly', () => {
    for (const s of scenarios) {
      const budget = minimumCost(s);
      const fit = fitBoreholeToBudget({ ...s, budget });
      expect(quotedCost(s, fit), `${s.purpose} ${s.location} ${s.depth} m`).toBeLessThanOrEqual(budget);
      expect(fit.budgetTooLow).toBe(false);
    }
  });
});
