// ─── Solar BOQ Generator ───────────────────────────────────────────────────────
// Converts SolarSizingResult + wizard answers → BOQItem[]
// Fills the gap between the existing sizing engine and the new BOQ table.

import { makeItem, type BOQItem } from '../engine/types';
import type { SolarSizingResult, SolarWizardAnswers } from './types';

// ─── Price Catalog ─────────────────────────────────────────────────────────────
// Prices are per-component; overridden at runtime by Supabase weekly_prices.

const SOLAR_PRICES: Record<string, number> = {
  panel_550w:            110.00,   // each - generic 550W panel
  panel_ja_550w:         115.00,   // each - JA Solar 550W
  panel_canadian_550w:   120.00,   // each - Canadian Solar 550W
  inverter_3kva:         550.00,   // each - 3kVA hybrid
  inverter_5kva:         900.00,   // each - 5kVA hybrid
  inverter_8kva:        1350.00,   // each - 8kVA hybrid
  inverter_10kva:       1700.00,   // each - 10kVA hybrid
  inverter_12kva:       2100.00,   // each - 12kVA hybrid
  inverter_deye_5kva:    920.00,
  inverter_victron_5kva:1450.00,
  inverter_solarmd_5kva: 880.00,
  battery_5kwh:          550.00,   // each - generic 5kWh LiFePO4 unit
  battery_pylontech_5kwh:580.00,
  battery_freedomwon_5kwh:620.00,
  mounting_kit:          120.00,   // set - roof mounting rails + hardware
  dc_cable_6mm:            2.50,   // m
  ac_cable_4mm:            1.80,   // m
  combiner_4str:          35.00,   // each - 4-string combiner box
  dc_isolator:            22.00,   // each
  ac_isolator:            18.00,   // each
  surge_dc:               25.00,   // each - DC surge protection
  surge_ac:               25.00,   // each - AC surge protection
  earthing_kit:           45.00,   // set
  cable_trunking_m:        1.20,   // m
  transport:              80.00,   // trip
  install_labor_pct:        0.25,  // 25% of hardware cost
};

function panelPrice(brand: string): number {
  if (brand === 'ja_solar') return SOLAR_PRICES.panel_ja_550w;
  if (brand === 'canadian_solar') return SOLAR_PRICES.panel_canadian_550w;
  return SOLAR_PRICES.panel_550w;
}

function inverterPrice(kva: number, brand: string): number {
  const key = `inverter_${brand === 'deye' ? 'deye' : brand === 'victron' ? 'victron' : brand === 'solarmd' ? 'solarmd' : ''}_${kva}kva`.replace('_kva', 'kva');
  if (SOLAR_PRICES[key]) return SOLAR_PRICES[key];
  const generic = `inverter_${kva}kva`;
  return SOLAR_PRICES[generic] ?? SOLAR_PRICES.inverter_5kva;
}

function batteryUnitPrice(brand: string): number {
  if (brand === 'pylontech') return SOLAR_PRICES.battery_pylontech_5kwh;
  if (brand === 'freedom_won') return SOLAR_PRICES.battery_freedomwon_5kwh;
  return SOLAR_PRICES.battery_5kwh;
}

// ─── Main Converter ────────────────────────────────────────────────────────────

export function solarSizingToBOQ(
  result: SolarSizingResult,
  answers: SolarWizardAnswers & {
    panel_brand?: string;
    inverter_brand?: string;
    battery_brand?: string;
    include_transport?: boolean;
    include_install?: boolean;
    include_contingency?: boolean;
  }
): BOQItem[] {
  const panelBrand = answers.panel_brand ?? 'generic';
  const invBrand = answers.inverter_brand ?? 'generic';
  const batBrand = answers.battery_brand ?? 'generic';

  // Owned items from the existing wizard
  const ownedPanels = answers.existing?.hasExisting && (answers.existing.panelCount ?? 0) >= result.panelCount;
  const ownedInverter = answers.existing?.hasExisting && (answers.existing.inverterKva ?? 0) >= result.inverterKva;
  const ownedBatteries = answers.existing?.hasExisting && (answers.existing.batteryKwh ?? 0) >= result.batteryKwh;

  const batteryUnits = Math.ceil(result.batteryKwh / 5); // each unit is 5kWh
  const dcCableM = result.panelCount * 4 + 5; // ~4m/panel + 5m spares
  const acCableM = 10;

  const items: BOQItem[] = [
    makeItem(
      'sol_panels', 'Solar Panels',
      `Solar panels ${Math.round(result.solarArrayKw * 1000 / result.panelCount)}W${panelBrand !== 'generic' ? ` (${panelBrand.replace('_', ' ')})` : ''}`,
      result.panelCount, 'each', panelPrice(panelBrand),
      { owned: ownedPanels }
    ),
    makeItem(
      'sol_inverter', 'Inverter',
      `Hybrid inverter ${result.inverterKva}kVA${invBrand !== 'generic' ? ` (${invBrand.replace('_', ' ')})` : ''}`,
      1, 'each', inverterPrice(result.inverterKva, invBrand),
      { owned: ownedInverter }
    ),
    makeItem(
      'sol_batteries', 'Batteries',
      `LiFePO4 battery 5kWh × ${batteryUnits}${batBrand !== 'generic' ? ` (${batBrand.replace('_', ' ')})` : ''}`,
      batteryUnits, 'each', batteryUnitPrice(batBrand),
      { owned: ownedBatteries }
    ),
    makeItem('sol_mount',    'Balance of System', 'Panel mounting kit (rails + hardware)',  1,         'set',  SOLAR_PRICES.mounting_kit),
    makeItem('sol_dc_cable', 'Balance of System', 'DC cable 6mm²',                          dcCableM,  'm',    SOLAR_PRICES.dc_cable_6mm),
    makeItem('sol_ac_cable', 'Balance of System', 'AC cable 4mm²',                          acCableM,  'm',    SOLAR_PRICES.ac_cable_4mm),
    makeItem('sol_combiner', 'Balance of System', '4-string combiner box',                  1,         'each', SOLAR_PRICES.combiner_4str),
    makeItem('sol_dc_iso',   'Balance of System', 'DC isolator',                            1,         'each', SOLAR_PRICES.dc_isolator),
    makeItem('sol_ac_iso',   'Balance of System', 'AC isolator',                            1,         'each', SOLAR_PRICES.ac_isolator),
    makeItem('sol_surge_dc', 'Balance of System', 'DC surge protection device',             1,         'each', SOLAR_PRICES.surge_dc),
    makeItem('sol_surge_ac', 'Balance of System', 'AC surge protection device',             1,         'each', SOLAR_PRICES.surge_ac),
    makeItem('sol_earth',    'Balance of System', 'Earthing kit',                           1,         'set',  SOLAR_PRICES.earthing_kit),
    makeItem('sol_trunking', 'Balance of System', 'Cable trunking / conduit',               dcCableM + acCableM, 'm', SOLAR_PRICES.cable_trunking_m),
  ];

  if (answers.include_transport) {
    items.push(makeItem('sol_transport', 'Site Work', 'Equipment delivery / transport', 1, 'trip', SOLAR_PRICES.transport, { optional: true }));
  }

  if (answers.include_install) {
    const hardware = items.filter((i) => !i.owned).reduce((s, i) => s + i.totalCostUsd, 0);
    const installCost = +(hardware * SOLAR_PRICES.install_labor_pct).toFixed(2);
    items.push(makeItem('sol_install', 'Labor', 'Installation labor (25% of hardware)', 1, 'lump sum', installCost, { optional: true }));
  }

  if (answers.include_contingency) {
    const hardware = items.filter((i) => !i.owned && !i.optional).reduce((s, i) => s + i.totalCostUsd, 0);
    items.push(makeItem('sol_contingency', 'Contingency', 'Contingency (5%)', 1, 'lump sum', +(hardware * 0.05).toFixed(2), { optional: true }));
  }

  return items;
}
