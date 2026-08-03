// ─── Solar BOQ Generator ───────────────────────────────────────────────────────
// Converts SolarSizingResult + wizard answers → BOQItem[]
// Updated Q1 2026 with Zimbabwe mid-range market pricing.

import { makeItem, type BOQItem } from '../engine/types';
import type { SolarSizingResult, SolarWizardAnswers } from './types';
import {
  INVERTER_BRANDS,
  BATTERY_BRANDS,
  PANEL_BRANDS,
  MAINTENANCE_SERVICES,
  getRequiredZeraTier,
} from './catalog';

// ─── Price Catalog ─────────────────────────────────────────────────────────────
// 2025 Zimbabwe mid-range prices. Overridden at runtime by Supabase weekly_prices.

const SOLAR_PRICES: Record<string, number> = {
  // ── Balance of System (Protection Layer) ──────────────────────────────────
  mounting_kit:          120.00,   // set - roof mounting rails + hardware
  dc_cable_6mm:            2.50,   // m - UV-resistant
  ac_cable_4mm:            1.80,   // m
  combiner_4str:          35.00,   // each - 4-string combiner box
  dc_isolator:            22.00,   // each
  ac_isolator:            18.00,   // each
  surge_dc:               25.00,   // each - DC surge protection device
  surge_ac:               25.00,   // each - AC surge protection device
  avs:                    35.00,   // each - Automatic Voltage Switcher (ZESA protection)
  battery_breaker:        28.00,   // each - 125A DC breaker for battery
  changeover_switch:      45.00,   // each - Solar/ZESA/Generator selector
  distribution_board:     55.00,   // each - 8-way DB board
  earthing_kit:           45.00,   // set - dedicated solar + AC earthing (<5 ohm)
  cable_trunking_m:        1.20,   // m
  antitheft_brackets:      8.00,   // set - panel anti-theft bolts

  // ── Installation ──────────────────────────────────────────────────────────
  transport:              80.00,   // trip
  install_labor_pct:        0.20,  // 20% of hardware cost (was 25%)
};

/**
 * Balance-of-system and protection cost for a given system size.
 *
 * The budget explorer used to carry its own constant for this — PROTECTION_FIXED,
 * a hardcoded $461 — while the BOQ priced the same parts per item, with cable
 * and trunking scaling by panel count. The two disagreed by over $100 on a
 * small system and by more as the array grew, so the figure shown while
 * choosing a budget was never the figure the BOQ produced.
 *
 * One function, used by both. Everything here mirrors the items
 * solarSizingToBOQ emits, so if you add a part there, add it here.
 */
export function solarBalanceOfSystemCost(panelCount: number, hasBattery: boolean): number {
  const dcCableM = panelCount * 4 + 5;
  const acCableM = 10;

  const fixed =
    SOLAR_PRICES.mounting_kit +
    SOLAR_PRICES.antitheft_brackets +
    SOLAR_PRICES.combiner_4str +
    SOLAR_PRICES.dc_isolator +
    SOLAR_PRICES.ac_isolator +
    SOLAR_PRICES.surge_dc +
    SOLAR_PRICES.surge_ac +
    SOLAR_PRICES.avs +
    SOLAR_PRICES.changeover_switch +
    SOLAR_PRICES.distribution_board +
    SOLAR_PRICES.earthing_kit;

  const cable =
    dcCableM * SOLAR_PRICES.dc_cable_6mm +
    acCableM * SOLAR_PRICES.ac_cable_4mm +
    (dcCableM + acCableM) * SOLAR_PRICES.cable_trunking_m;

  // Only meaningful when there is a battery to isolate.
  const batteryProtection = hasBattery ? SOLAR_PRICES.battery_breaker : 0;

  return +(fixed + cable + batteryProtection).toFixed(2);
}

/** The share of hardware cost the BOQ adds for installation labour. */
export const SOLAR_INSTALL_LABOR_PCT = SOLAR_PRICES.install_labor_pct;

/** Transport cost the BOQ adds when delivery is included. */
export const SOLAR_TRANSPORT_COST = SOLAR_PRICES.transport;

// ─── Brand Lookup Helpers ──────────────────────────────────────────────────────

function panelPrice(brand: string): { price: number; watt: number; label: string } {
  const found = PANEL_BRANDS.find((p) => p.brand === brand);
  if (found) return { price: found.pricePerPanel, watt: found.watt, label: found.label };
  // Default to JA Solar (best value mid-range)
  return { price: 56, watt: 440, label: 'JA Solar' };
}

function inverterPrice(kva: number, brand: string): number {
  const found = INVERTER_BRANDS.find((b) => b.brand === brand);
  if (found) {
    // Find exact or closest kVA
    if (found.prices[kva]) return found.prices[kva];
    const sizes = Object.keys(found.prices).map(Number).sort((a, b) => a - b);
    const closest = sizes.find((s) => s >= kva) ?? sizes[sizes.length - 1];
    return found.prices[closest];
  }
  // Default mid-range pricing per kVA
  const defaults: Record<number, number> = { 3: 350, 5: 650, 8: 1000, 10: 1400, 12: 1800 };
  return defaults[kva] ?? kva * 130;
}

function inverterLabel(brand: string): string {
  const found = INVERTER_BRANDS.find((b) => b.brand === brand);
  return found?.label ?? 'Hybrid';
}

function batteryUnitPrice(brand: string): { price: number; kwh: number; label: string } {
  const found = BATTERY_BRANDS.find((b) => b.brand === brand);
  if (found) return { price: found.unitPrice, kwh: found.unitKwh, label: found.label };
  // Default mid-range
  return { price: 790, kwh: 5.12, label: 'LiFePO4' };
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
    /** Defaults to true — a system without protection is not one anyone should quote. */
    include_protection?: boolean;
    include_contingency?: boolean;
  }
): BOQItem[] {
  const pBrand = answers.panel_brand ?? 'ja_solar';
  const iBrand = answers.inverter_brand ?? 'must';
  const bBrand = answers.battery_brand ?? 'dyness';

  // Owned items from the existing wizard
  const ownedPanels = answers.existing?.hasExisting && (answers.existing.panelCount ?? 0) >= result.panelCount;
  const ownedInverter = answers.existing?.hasExisting && (answers.existing.inverterKva ?? 0) >= result.inverterKva;
  const ownedBatteries = answers.existing?.hasExisting && (answers.existing.batteryKwh ?? 0) >= result.batteryKwh;

  const panel = panelPrice(pBrand);
  const battery = batteryUnitPrice(bBrand);
  // Was Math.max(1, ...), which forced a battery into every BOQ even when the
  // sizing had deliberately allocated none. On a $1,000 budget the explorer
  // could not fit the $790 battery and allocated zero, then the BOQ added one
  // anyway — on its own that put the estimate $790 over the budget the user
  // had just typed in. A system with no battery is a real configuration
  // (day-use / grid-tie); silently charging for one is not.
  const batteryUnits = Math.max(0, Math.ceil(result.batteryKwh / battery.kwh));
  const dcCableM = result.panelCount * 4 + 5;
  const acCableM = 10;
  const invPrice = inverterPrice(result.inverterKva, iBrand);
  const invLabel = inverterLabel(iBrand);
  const systemWatts = result.solarArrayKw * 1000;

  const items: BOQItem[] = [
    // ── Hardware Layer ────────────────────────────────────────────────────
    makeItem(
      'sol_panels', 'Solar Panels',
      `${panel.watt}W ${panel.label} solar panels`,
      result.panelCount, 'each', panel.price,
      { owned: ownedPanels, notes: `${(result.panelCount * panel.watt / 1000).toFixed(1)}kW total array` }
    ),
    makeItem(
      'sol_inverter', 'Inverter',
      `${result.inverterKva}kVA ${invLabel} hybrid inverter`,
      1, 'each', invPrice,
      { owned: ownedInverter }
    ),
    // Omitted entirely at zero units rather than listed as "× 0" — and the
    // battery breaker below goes with it, since there is nothing to protect.
    ...(batteryUnits > 0
      ? [
          makeItem(
            'sol_batteries', 'Batteries',
            `${battery.kwh}kWh ${battery.label} LiFePO4 × ${batteryUnits}`,
            batteryUnits, 'each', battery.price,
            { owned: ownedBatteries, notes: `${(batteryUnits * battery.kwh).toFixed(1)}kWh total storage` }
          ),
        ]
      : []),

  ];

  // ── Protection Layer (critical for system longevity) ──────────────────────
  //
  // The budget explorer has a protection toggle, default OFF, and this function
  // had no matching flag — so it emitted these items unconditionally. The
  // explorer therefore budgeted nothing for balance-of-system while the BOQ
  // charged for all of it, then added installation as a percentage on top. That
  // was the single largest reason a $1,000 budget produced a $2,139 BOQ.
  const includeProtection = answers.include_protection !== false;
  if (includeProtection) {
    items.push(
    makeItem('sol_mount',       'Balance of System', 'Panel mounting kit (rails + hardware + anti-theft)',       1,         'set',  SOLAR_PRICES.mounting_kit + SOLAR_PRICES.antitheft_brackets),
    makeItem('sol_dc_cable',    'Balance of System', 'DC cable 6mm² (UV-resistant)',                            dcCableM,  'm',    SOLAR_PRICES.dc_cable_6mm),
    makeItem('sol_ac_cable',    'Balance of System', 'AC cable 4mm²',                                          acCableM,  'm',    SOLAR_PRICES.ac_cable_4mm),
    makeItem('sol_combiner',    'Balance of System', '4-string combiner box',                                   1,         'each', SOLAR_PRICES.combiner_4str),
    makeItem('sol_dc_iso',      'Protection',        'DC isolator',                                             1,         'each', SOLAR_PRICES.dc_isolator),
    makeItem('sol_ac_iso',      'Protection',        'AC isolator',                                             1,         'each', SOLAR_PRICES.ac_isolator),
    makeItem('sol_surge_dc',    'Protection',        'DC surge protection device (SPD)',                         1,         'each', SOLAR_PRICES.surge_dc,
      { notes: 'Protects against lightning-induced surges on solar lines' }),
    makeItem('sol_surge_ac',    'Protection',        'AC surge protection device (SPD)',                         1,         'each', SOLAR_PRICES.surge_ac,
      { notes: 'Shields inverter from grid-side surges' }),
    makeItem('sol_avs',         'Protection',        'Automatic Voltage Switcher (AVS)',                        1,         'each', SOLAR_PRICES.avs,
      { notes: 'Disconnects system during ZESA brownouts or over-voltage' }),
    ...(batteryUnits > 0
      ? [makeItem('sol_bat_breaker', 'Protection', 'Battery DC breaker (125A)', 1, 'each', SOLAR_PRICES.battery_breaker)]
      : []),
    makeItem('sol_changeover',  'Protection',        'Changeover switch (Solar/ZESA/Generator)',                 1,         'each', SOLAR_PRICES.changeover_switch),
    makeItem('sol_db',          'Protection',        'Distribution board (8-way)',                               1,         'each', SOLAR_PRICES.distribution_board),
    makeItem('sol_earth',       'Protection',        'Earthing kit (solar + AC, <5Ω)',                          1,         'set',  SOLAR_PRICES.earthing_kit),
    makeItem('sol_trunking',    'Balance of System', 'Cable trunking / conduit',                                dcCableM + acCableM, 'm', SOLAR_PRICES.cable_trunking_m),
    );
  }

  // ── Transport ─────────────────────────────────────────────────────────
  if (answers.include_transport) {
    items.push(makeItem('sol_transport', 'Site Work', 'Equipment delivery / transport', 1, 'trip', SOLAR_PRICES.transport, { optional: true }));
  }

  // ── Installation ──────────────────────────────────────────────────────
  if (answers.include_install) {
    const hardware = items.filter((i) => !i.owned).reduce((s, i) => s + i.totalCostUsd, 0);
    const installCost = +(hardware * SOLAR_PRICES.install_labor_pct).toFixed(2);
    items.push(makeItem('sol_install', 'Labor', 'Installation labor (20% of hardware)', 1, 'lump sum', installCost, {
      optional: true,
      notes: `Requires ZERA ${getRequiredZeraTier(systemWatts)} licensed technician for this ${(systemWatts / 1000).toFixed(1)}kW system`,
    }));
  }

  // ── Contingency ───────────────────────────────────────────────────────
  if (answers.include_contingency) {
    const hardware = items.filter((i) => !i.owned && !i.optional).reduce((s, i) => s + i.totalCostUsd, 0);
    items.push(makeItem('sol_contingency', 'Contingency', 'Contingency (5%)', 1, 'lump sum', +(hardware * 0.05).toFixed(2), { optional: true }));
  }

  return items;
}

// ─── Maintenance BOQ ────────────────────────────────────────────────────────────

export function maintenanceToBOQ(selectedServiceIds: string[]): BOQItem[] {
  const items: BOQItem[] = [];

  for (const svc of MAINTENANCE_SERVICES) {
    if (selectedServiceIds.includes(svc.id)) {
      items.push(makeItem(
        `maint_${svc.id}`,
        'Maintenance',
        svc.label,
        1,
        'each',
        svc.price,
        { notes: svc.description },
      ));
    }
  }

  // Add transport if any physical on-site service selected
  const onSiteServices = ['panel_cleaning', 'system_health_check', 'inverter_diagnostics', 'battery_replacement', 'wiring_inspection', 'surge_protection_install'];
  if (selectedServiceIds.some((id) => onSiteServices.includes(id))) {
    items.push(makeItem('maint_transport', 'Transport', 'Technician transport to site', 1, 'trip', SOLAR_PRICES.transport, { optional: true }));
  }

  return items;
}
