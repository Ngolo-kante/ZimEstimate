// ─── Extras for a full house BOQ ─────────────────────────────────────────────
//
// What a Zimbabwe build needs beyond the five construction stages, following
// the step-by-step building guide (step 2: guard cabin, water to site, site
// toilet and clearing; later: septic, geyser, gate motor, security, the cable
// to the road) plus the quick-project calculators people already use for a
// septic tank, water tank, borehole and solar. Reusing those calculators keeps
// a borehole priced the same in a house BOQ as on its own.
//
// Deliberately not here, because the stages already cost them: the boundary
// wall, vehicle and pedestrian gates and driveway paving (Exterior works), and
// the 150 L electric geyser (Finishing). The solar geyser swaps that geyser
// rather than adding a second one.
//
// Prices: the calculators carry their own catalogs. The 50,000 L site tank
// ($550) and a tanker fill ($50) are the guide's figures; the solar geyser is
// Halsteds' 200 L listing. Everything without a published Zimbabwe price (the
// cabin, gate motor, burglar bars, alarm, ZESA connection, cable to the road)
// is a counted line at $0 for the user's quote — never an invented figure.

import type { BOQItem } from '@/store/boqWizardStore';
import type { BOQItem as QuickItem } from '@/lib/quick-projects/engine/types';
import { calculateSepticBOQ } from '@/lib/quick-projects/septic/calculations';
import { calculateWaterBOQ } from '@/lib/quick-projects/water/calculations';
import { calculateBoreholeBOQ } from '@/lib/quick-projects/borehole/calculations';
import { buildDefaultSelections, computeSolarSizing } from '@/lib/quick-projects/solar/calculations';
import { solarSizingToBOQ } from '@/lib/quick-projects/solar/boq';
import type { SolarWizardAnswers } from '@/lib/quick-projects/solar/types';
import type { RoofCovering } from '@/lib/calculations/roofingOptions';

export type SepticMethod = 'brick' | 'precast' | 'poly';
export type SolarPackage = 'essentials' | 'most' | 'whole';
export type BoreholePump = 'solar' | 'electric' | 'none';

export interface HouseExtras {
  site_setup: { enabled: boolean; cabin: boolean; toilet: boolean; tank: boolean; waterFills: number; clearing: boolean };
  septic: { enabled: boolean; method: SepticMethod; occupants: number };
  water_tank: { enabled: boolean; litres: 2500 | 5000 | 10000; pump: boolean };
  borehole: { enabled: boolean; depthM: number; pump: BoreholePump };
  solar: { enabled: boolean; size: SolarPackage };
  solar_geyser: { enabled: boolean };
  gate_motor: { enabled: boolean };
  security: { enabled: boolean; burglarBars: boolean; securityGates: boolean; alarm: boolean; electricFence: boolean };
  power_connection: { enabled: boolean; cableMetres: number };
}

export type HouseExtraId = keyof HouseExtras;

export const DEFAULT_HOUSE_EXTRAS: HouseExtras = {
  site_setup: { enabled: false, cabin: true, toilet: true, tank: false, waterFills: 4, clearing: true },
  septic: { enabled: false, method: 'brick', occupants: 5 },
  water_tank: { enabled: false, litres: 5000, pump: true },
  borehole: { enabled: false, depthM: 40, pump: 'solar' },
  solar: { enabled: false, size: 'essentials' },
  solar_geyser: { enabled: false },
  gate_motor: { enabled: false },
  security: { enabled: false, burglarBars: true, securityGates: true, alarm: false, electricFence: false },
  power_connection: { enabled: false, cableMetres: 30 },
};

export const HOUSE_EXTRAS_INFO: Record<HouseExtraId, { label: string; description: string }> = {
  site_setup: { label: 'Site setup', description: 'Guard and storage cabin, site toilet, water to site and clearing — the guide’s step 2.' },
  septic: { label: 'Septic tank & soakaway', description: 'For stands without a municipal sewer connection.' },
  water_tank: { label: 'Water tank & pump', description: 'A storage tank on a stand, with a booster pump.' },
  borehole: { label: 'Borehole', description: 'Drilling, casing and a pump, priced like the borehole estimate.' },
  solar: { label: 'Solar backup', description: 'Panels, inverter and batteries, sized for what you want to keep running.' },
  solar_geyser: { label: 'Solar geyser', description: 'Replaces the 150 L electric geyser already in Plumbing & Electrical.' },
  gate_motor: { label: 'Gate motor', description: 'Automates the vehicle gate already in Exterior works.' },
  security: { label: 'Security', description: 'Burglar bars, security gates, alarm and electric fence.' },
  power_connection: { label: 'Power to the road', description: 'ZESA connection and the cable from the house to the road.' },
};

/** Fill anything missing (an older saved project, a new option) with defaults. */
export function normalizeHouseExtras(value: unknown): HouseExtras {
  const saved = (value && typeof value === 'object' ? value : {}) as Partial<Record<HouseExtraId, Record<string, unknown>>>;
  const result = {} as HouseExtras;
  for (const id of Object.keys(DEFAULT_HOUSE_EXTRAS) as HouseExtraId[]) {
    (result as unknown as Record<string, unknown>)[id] = { ...DEFAULT_HOUSE_EXTRAS[id], ...(saved[id] ?? {}) };
  }
  return result;
}

export const SITE_TANK_PRICE_USD = 550;
export const SITE_TANK_FILL_USD = 50;
/** Halsteds, Solara 200 L solar pressure geyser (read 2026-10-13). */
export const SOLAR_GEYSER_PRICE_USD = 790;
/** Labour on extras whose calculator prices materials only — the quick projects’ default. */
export const EXTRAS_LABOUR_PERCENT = 25;

/** Every extra line's material id starts with this, so labour and restores can tell them apart. */
export const EXTRA_ID_PREFIX = 'extra-';

export function isExtraLine(materialId: string): boolean {
  return materialId.startsWith(EXTRA_ID_PREFIX);
}

export function extraIdOf(materialId: string): HouseExtraId | null {
  if (!isExtraLine(materialId)) return null;
  const id = materialId.slice(EXTRA_ID_PREFIX.length).split('--')[0];
  return id in DEFAULT_HOUSE_EXTRAS ? (id as HouseExtraId) : null;
}

export interface ExtrasContext {
  windows: number;
  exteriorDoors: number;
  boundaryLengthM: number;
  laborIncluded: boolean;
  roofCovering: RoofCovering;
  city: string;
  locationType: string;
  zwgRate?: number;
}

type Line = { key: string; name: string; quantity: number; unit: string; priceUsd: number; note: string; category?: 'exterior' | 'substructure' | 'finishing' | 'services' };

const QUOTE = 'Add your quote — no published Zimbabwe price.';

function toItem(extra: HouseExtraId, line: Line, zwgRate: number): BOQItem {
  const materialId = `${EXTRA_ID_PREFIX}${extra}--${line.key}`;
  return {
    id: `auto-${materialId}`,
    materialId,
    materialName: line.name,
    quantity: line.quantity,
    calculatedQuantity: line.quantity,
    unit: line.unit,
    averagePriceUsd: line.priceUsd,
    averagePriceZwg: line.priceUsd * zwgRate,
    actualPriceUsd: line.priceUsd,
    actualPriceZwg: line.priceUsd * zwgRate,
    description: line.note,
    category: line.category ?? 'exterior',
    isOverridden: false,
    isEnablementCost: line.category === 'substructure',
  };
}

/** A quick calculator's lines, as house BOQ lines under one extra. */
function fromQuick(prefix: string, items: QuickItem[]): Line[] {
  return items
    .filter((item) => item.included !== false && !item.owned)
    .map((item, index) => ({
      key: `${index}-${item.description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      name: `${prefix} — ${item.description}`,
      quantity: Math.round(item.quantity * 100) / 100,
      unit: item.unit,
      priceUsd: Math.round(item.unitCostUsd * 100) / 100,
      note: item.notes || item.category,
    }));
}

function labourLine(label: string, lines: Line[], context: ExtrasContext): Line[] {
  if (!context.laborIncluded) return [];
  const materials = lines.reduce((sum, line) => sum + line.quantity * line.priceUsd, 0);
  if (materials <= 0) return [];
  return [{
    key: 'labour',
    name: `Labour — ${label}`,
    quantity: 1,
    unit: 'allowance',
    priceUsd: Math.round(materials * EXTRAS_LABOUR_PERCENT) / 100,
    note: `${EXTRAS_LABOUR_PERCENT}% of ${label} materials`,
  }];
}

const SOLAR_PACKAGES: Record<SolarPackage, { label: string; appliances: [string, number, number][] }> = {
  // [appliance id, quantity, hours a day]
  essentials: { label: 'Lights, TV, Wi-Fi, fridge and charging', appliances: [['lights', 10, 6], ['tv', 1, 5], ['wifi', 1, 12], ['phone_charger', 3, 3], ['fridge', 1, 10]] },
  most: { label: 'Essentials plus freezer, laptops, microwave and a booster pump', appliances: [['lights', 14, 6], ['tv', 2, 5], ['wifi', 1, 12], ['phone_charger', 4, 3], ['laptop', 2, 5], ['fridge', 1, 10], ['freezer', 1, 10], ['microwave', 1, 0.3], ['booster_pump', 1, 1]] },
  whole: { label: 'Most of the house, including washing machine, iron and borehole pump', appliances: [['lights', 18, 6], ['tv', 2, 5], ['wifi', 1, 12], ['phone_charger', 5, 3], ['laptop', 2, 5], ['fridge', 1, 10], ['freezer', 1, 10], ['microwave', 1, 0.3], ['kettle', 1, 0.3], ['iron', 1, 0.5], ['washing_machine', 1, 1], ['borehole_pump', 1, 2], ['security', 1, 24]] },
};

export const SOLAR_PACKAGE_LABELS: Record<SolarPackage, string> = {
  essentials: SOLAR_PACKAGES.essentials.label,
  most: SOLAR_PACKAGES.most.label,
  whole: SOLAR_PACKAGES.whole.label,
};

function solarLines(size: SolarPackage, context: ExtrasContext): Line[] {
  const appliances = buildDefaultSelections();
  for (const [id, qty, hours] of SOLAR_PACKAGES[size].appliances) {
    if (appliances[id]) appliances[id] = { id, qty, hours, include: true };
  }
  const answers: SolarWizardAnswers = {
    intent: size === 'whole' ? 'heavy_backup' : 'backup',
    backupHours: null,
    location: context.city || 'harare',
    propertyType: 'house',
    appliances,
    simultaneousLoads: { kettleMicrowave: false, pumpWithHouse: size === 'whole', geyserWithHouse: false },
    // The solar mounting follows the roof chosen for the house.
    roof: { type: context.roofCovering === 'concrete_tile' ? 'tile' : 'ibr', shading: 'none', orientation: 'north', spaceM2: null },
    existing: { hasExisting: false, inverterKva: null, batteryKwh: null, panelCount: null, issues: '' },
    budgetUsd: null,
    quote: { totalUsd: null, inverterKva: null, batteryKwh: null, panelCount: null, panelWatt: null, notes: '' },
  };
  const sizing = computeSolarSizing(answers);
  // The solar calculator already prices installation (a licensed technician).
  return fromQuick('Solar', solarSizingToBOQ(sizing, { ...answers, include_install: true, include_protection: true }));
}

const BOREHOLE_LOCATIONS = ['harare', 'bulawayo', 'chitungwiza', 'mutare', 'gweru', 'masvingo', 'kwekwe', 'kadoma', 'chinhoyi', 'marondera'];

export function buildExtraItems(extras: HouseExtras, context: ExtrasContext): BOQItem[] {
  const zwg = context.zwgRate ?? 30;
  const out: BOQItem[] = [];
  const add = (id: HouseExtraId, lines: Line[]) => lines.forEach((line) => out.push(toItem(id, line, zwg)));

  const site = extras.site_setup;
  if (site.enabled) {
    const lines: Line[] = [];
    if (site.cabin) lines.push({ key: 'cabin', name: 'Site cabin 6×3 m (guard & materials store)', quantity: 1, unit: 'each', priceUsd: 0, note: QUOTE, category: 'substructure' });
    if (site.toilet) lines.push({ key: 'toilet', name: 'Temporary site toilet', quantity: 1, unit: 'each', priceUsd: 0, note: QUOTE, category: 'substructure' });
    if (site.tank) {
      lines.push({ key: 'tank', name: 'Water tank 50,000 L (no municipal connection)', quantity: 1, unit: 'each', priceUsd: SITE_TANK_PRICE_USD, note: 'Building guide figure', category: 'substructure' });
      if (site.waterFills > 0) lines.push({ key: 'fills', name: 'Water delivery to fill the site tank', quantity: site.waterFills, unit: 'fill', priceUsd: SITE_TANK_FILL_USD, note: 'Building guide figure', category: 'substructure' });
    }
    if (site.clearing) lines.push({ key: 'clearing', name: 'Site clearing & levelling', quantity: 1, unit: 'lot', priceUsd: 0, note: QUOTE, category: 'substructure' });
    add('site_setup', lines);
  }

  if (extras.septic.enabled) {
    const occupants = Math.max(1, Math.round(extras.septic.occupants));
    const lines = fromQuick('Septic', calculateSepticBOQ({
      construction_method: extras.septic.method,
      owns_tank: false,
      tank_size_method: 'calculate',
      occupants,
      bathrooms: Math.max(1, Math.ceil(occupants / 3)),
      soil_type: 'loam',
      water_table: 'deep',
      soakaway_type: 'stone_pit',
      include_machine_excav: false,
      include_transport: false,
    }));
    add('septic', [...lines, ...labourLine('septic tank', lines, context)]);
  }

  if (extras.water_tank.enabled) {
    const lines = fromQuick('Water tank', calculateWaterBOQ({
      scope: extras.water_tank.pump ? 'tank_pump' : 'tank_only',
      owns_tank: false,
      tank_size: String(extras.water_tank.litres),
      tank_brand: 'jojo',
      stand_type: 'steel_18',
      owns_stand: false,
      pump_type: 'surface',
      // A booster beside the tank, not a borehole pump: short pipe and cable
      // runs (the calculator's 40 m default is a borehole depth).
      borehole_depth: 5,
      owns_pump: false,
      include_transport: false,
      include_trench: false,
    }));
    add('water_tank', [...lines, ...labourLine('water tank', lines, context)]);
  }

  if (extras.borehole.enabled) {
    const city = context.city.trim().toLowerCase();
    add('borehole', fromQuick('Borehole', calculateBoreholeBOQ({
      estimate_mode: 'detailed',
      project_scope: 'new_borehole',
      borehole_purpose: 'domestic',
      project_location: BOREHOLE_LOCATIONS.includes(city) ? city : 'other',
      area_type: context.locationType === 'rural' ? 'rural' : context.locationType === 'peri-urban' ? 'peri_urban' : 'urban',
      drilling_depth: Math.max(10, Math.round(extras.borehole.depthM)),
      system_scope: extras.borehole.pump === 'none' ? 'drilling_only' : 'drilling_and_pump',
      pump_power_source: extras.borehole.pump === 'none' ? undefined : extras.borehole.pump,
    })));
  }

  if (extras.solar.enabled) add('solar', solarLines(extras.solar.size, context));

  if (extras.solar_geyser.enabled) {
    add('solar_geyser', [{ key: 'geyser', name: 'Solar pressure geyser 200 L', quantity: 1, unit: 'each', priceUsd: SOLAR_GEYSER_PRICE_USD, note: 'Halsteds listing; replaces the 150 L electric geyser', category: 'services' }]);
  }

  if (extras.gate_motor.enabled) {
    add('gate_motor', [{ key: 'motor', name: 'Sliding gate motor kit (motor, rack, battery, remotes, fitting)', quantity: 1, unit: 'kit', priceUsd: 0, note: `${QUOTE} The gate itself is in Exterior works.` }]);
  }

  const security = extras.security;
  if (security.enabled) {
    const lines: Line[] = [];
    if (security.burglarBars && context.windows > 0) lines.push({ key: 'bars', name: 'Burglar bars (galvanised)', quantity: context.windows, unit: 'window', priceUsd: 0, note: `${QUOTE} One per window in the plan.` });
    if (security.securityGates && context.exteriorDoors > 0) lines.push({ key: 'gates', name: 'Security gates (galvanised)', quantity: context.exteriorDoors, unit: 'door', priceUsd: 0, note: `${QUOTE} One per outside door.` });
    if (security.alarm) lines.push({ key: 'alarm', name: 'Alarm system', quantity: 1, unit: 'system', priceUsd: 0, note: QUOTE });
    if (security.electricFence && context.boundaryLengthM > 0) lines.push({ key: 'fence', name: 'Electric fence on the boundary wall', quantity: Math.round(context.boundaryLengthM), unit: 'm', priceUsd: 0, note: `${QUOTE} Length follows the boundary wall.` });
    add('security', lines);
  }

  const power = extras.power_connection;
  if (power.enabled) {
    add('power_connection', [
      { key: 'zesa', name: 'ZESA connection fee', quantity: 1, unit: 'fee', priceUsd: 0, note: 'Ask ZETDC for a quote. Reported costs were $327–$690 per house in 2021.' },
      { key: 'cable', name: 'Armoured cable, house to road connection', quantity: Math.max(1, Math.round(power.cableMetres)), unit: 'm', priceUsd: 0, note: `${QUOTE} Lay it deep enough to miss later digging.` },
    ]);
  }

  return out;
}
