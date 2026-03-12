import { SOLAR_APPLIANCES, SOLAR_PANEL_WATT, ZW_SUN_HOURS, INVERTER_TIERS, BATTERY_TIERS, PRICE_BENCHMARKS } from './catalog';
import { SolarApplianceSelection, SolarSizingResult, SolarWizardAnswers } from './types';

const roundToTier = (value: number, tiers: number[]) => {
  const sorted = [...tiers].sort((a, b) => a - b);
  for (const tier of sorted) {
    if (value <= tier) return tier;
  }
  return sorted[sorted.length - 1];
};

const clampNumber = (value: number, fallback = 0) => {
  if (Number.isFinite(value)) return value;
  return fallback;
};

export const buildDefaultSelections = () => {
  return SOLAR_APPLIANCES.reduce((acc, item) => {
    acc[item.id] = {
      id: item.id,
      qty: 0,
      hours: 0,
      include: false,
    };
    return acc;
  }, {} as Record<string, SolarApplianceSelection>);
};

export const computeSolarSizing = (answers: SolarWizardAnswers): SolarSizingResult => {
  const warnings: string[] = [];
  const applianceMap = SOLAR_APPLIANCES.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, { watts: number; label: string }>);

  const selections = Object.values(answers.appliances).filter((item) => item.include);

  const peakLoadWatts = selections.reduce((sum, sel) => {
    const watts = applianceMap[sel.id]?.watts ?? 0;
    return sum + watts * clampNumber(sel.qty, 0);
  }, 0);

  const dailyEnergyKwh = selections.reduce((sum, sel) => {
    const watts = applianceMap[sel.id]?.watts ?? 0;
    const hours = clampNumber(sel.hours, 0);
    return sum + (watts * clampNumber(sel.qty, 0) * hours) / 1000;
  }, 0);

  const adjustedPeak = peakLoadWatts * 1.3;
  const inverterKva = roundToTier(adjustedPeak / 0.8 / 1000, INVERTER_TIERS);

  const baseBattery = dailyEnergyKwh * 1.2;
  const batteryKwh = roundToTier(baseBattery, BATTERY_TIERS);

  const solarArrayKw = Math.max(0.5, (dailyEnergyKwh / ZW_SUN_HOURS) * 1.2);
  const panelCount = Math.max(1, Math.ceil((solarArrayKw * 1000) / SOLAR_PANEL_WATT));

  const tier: SolarSizingResult['tier'] = inverterKva <= 3 ? 'small' : inverterKva <= 5 ? 'standard' : 'large';

  const benchmarkRange =
    tier === 'small'
      ? PRICE_BENCHMARKS.smallRange
      : tier === 'standard'
        ? PRICE_BENCHMARKS.standardRange
        : PRICE_BENCHMARKS.largeRange;

  const estimatedCostUsd = {
    low: benchmarkRange[0],
    high: benchmarkRange[1],
  };

  if (answers.simultaneousLoads.kettleMicrowave && inverterKva <= 3) {
    warnings.push('Kettle and microwave together may overload a 3kVA inverter.');
  }

  if (answers.simultaneousLoads.geyserWithHouse && inverterKva <= 5) {
    warnings.push('Geyser loads will require a larger inverter or dedicated circuit.');
  }

  if (answers.simultaneousLoads.pumpWithHouse && inverterKva <= 5) {
    warnings.push('Pumps have surge power; consider 8kVA if pumps run with household loads.');
  }

  if (answers.roof.spaceM2 && panelCount * 2 > answers.roof.spaceM2) {
    warnings.push('Roof space may be insufficient for the recommended panel count.');
  }

  if (answers.roof.shading === 'heavy') {
    warnings.push('Heavy shading will reduce output; consider additional panels or trimming.');
  }

  return {
    peakLoadWatts,
    inverterKva,
    batteryKwh,
    solarArrayKw: Number(solarArrayKw.toFixed(1)),
    panelCount,
    dailyEnergyKwh: Number(dailyEnergyKwh.toFixed(1)),
    tier,
    estimatedCostUsd,
    warnings,
  };
};

export const estimateHardwareCost = (result: SolarSizingResult) => {
  const inverterPrice = (result.inverterKva / 5) * PRICE_BENCHMARKS.inverter5kvaUsd;
  const batteryUnits = Math.max(1, Math.round(result.batteryKwh / 5));
  const batteryCost = batteryUnits * PRICE_BENCHMARKS.battery5kwhUsd;
  const panelCost = result.panelCount * PRICE_BENCHMARKS.panelUsd;
  const hardware = inverterPrice + batteryCost + panelCost;
  const install = hardware * PRICE_BENCHMARKS.installPct;
  return {
    hardware: Math.round(hardware),
    install: Math.round(install),
    total: Math.round(hardware + install),
  };
};
