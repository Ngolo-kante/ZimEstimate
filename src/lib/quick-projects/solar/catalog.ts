// ─── Solar Price Catalog — Zimbabwe Market Q1 2026 ────────────────────────────
// Sources: Sona Solar, Taqon Electrico, Solarpro Zimbabwe, Techzim,
//          ZERA regulations, HBOWA, strategic analysis.
// Prices use mid-range of all sources for reliability.

import { SolarApplianceInput } from './types';

export const SOLAR_PANEL_WATT = 550;
export const ZW_SUN_HOURS = 5.5;

// ─── Sizing Constants (NotebookLM Solar Rules) ────────────────────────────────
// Source: NotebookLM "Solar Energy Zim" project memory

/** Multiply daily Wh by this to account for system losses (cables, conversion, etc.) */
export const PANEL_LOSS_FACTOR = 1.3;
/** Zimbabwe panel generation factor — divide adjusted Wh by this to get Wp needed */
export const ZW_PANEL_GEN_FACTOR = 3.1;
/** Inverter should be 25-30% larger than simultaneous load */
export const INVERTER_OVERSIZE = 1.25;
/** Motors/compressors need 3x inverter capacity for starting surge */
export const MOTOR_SURGE_FACTOR = 3;
/** Simultaneous / diversity factor — not all appliances run at once (60-70%) */
export const SIMULTANEOUS_FACTOR = 0.65;
/** LiFePO4 Depth of Discharge — safe to discharge 80-95% */
export const BATTERY_DOD_LIFEPO4 = 0.9;
/** Lead-acid Depth of Discharge — limit to 50-60% */
export const BATTERY_DOD_LEAD_ACID = 0.5;
/** Continuous nighttime loads should not exceed 25% of total battery capacity */
export const BATTERY_NIGHT_LOAD_MAX = 0.25;
/** Charge controller safety factor — Isc × this */
export const CHARGE_CONTROLLER_SAFETY = 1.3;

// ─── Appliances ───────────────────────────────────────────────────────────────

export const SOLAR_APPLIANCES: SolarApplianceInput[] = [
  { id: 'lights', label: 'LED Lights', watts: 10, category: 'essential' },
  { id: 'tv', label: 'TV', watts: 120, category: 'essential' },
  { id: 'wifi', label: 'WiFi Router', watts: 20, category: 'essential' },
  { id: 'laptop', label: 'Laptop', watts: 60, category: 'essential' },
  { id: 'phone_charger', label: 'Phone Charger', watts: 15, category: 'essential' },
  { id: 'fridge', label: 'Fridge', watts: 150, category: 'essential' },
  { id: 'freezer', label: 'Deep Freezer', watts: 200, category: 'essential' },
  { id: 'kettle', label: 'Kettle', watts: 2000, category: 'heavy' },
  { id: 'microwave', label: 'Microwave', watts: 1500, category: 'heavy' },
  { id: 'iron', label: 'Iron', watts: 2200, category: 'heavy' },
  { id: 'washing_machine', label: 'Washing Machine', watts: 800, category: 'heavy' },
  { id: 'dishwasher', label: 'Dishwasher', watts: 1800, category: 'heavy' },
  { id: 'aircon', label: 'Air Conditioner', watts: 1500, category: 'heavy' },
  { id: 'geyser', label: 'Geyser', watts: 3000, category: 'heavy' },
  { id: 'stove_plate', label: 'Electric Stove Plate', watts: 2000, category: 'heavy' },
  { id: 'borehole_pump', label: 'Borehole Pump', watts: 1200, category: 'pump' },
  { id: 'booster_pump', label: 'Booster Pump', watts: 900, category: 'pump' },
  { id: 'pool_pump', label: 'Pool Pump', watts: 1200, category: 'pump' },
  { id: 'office', label: 'Office Equipment', watts: 200, category: 'other' },
  { id: 'security', label: 'Security System / CCTV', watts: 50, category: 'other' },
];

// ─── Intent Labels ────────────────────────────────────────────────────────────

export const SOLAR_INTENT_LABELS = {
  backup: 'Backup only (2–4 hrs)',
  heavy_backup: 'Heavy backup (4–8 hrs)',
  off_grid: 'Full off-grid (8+ hrs)',
  replace: 'Replace or upgrade existing system',
  budget: 'Budget-fit system',
  quote_check: 'Quote check',
  maintenance: 'Maintenance & servicing',
} as const;

// ─── Standard Tiers ───────────────────────────────────────────────────────────

export const INVERTER_TIERS = [3, 5, 8, 10, 12];
export const BATTERY_TIERS = [5, 10, 15, 20];

// ─── Price Benchmarks (2025 mid-range) ────────────────────────────────────────
// Updated from 2022 prices to 2025 Zimbabwe market mid-range.
// Panel prices dropped ~60%, inverters ~40%, batteries ~30%.

export const PRICE_BENCHMARKS = {
  panelUsd: 70,              // mid-range 440-550W panel (was $110)
  inverter5kvaUsd: 650,      // mid-range 5kVA hybrid (was $900)
  battery5kwhUsd: 700,       // mid-range 5kWh LiFePO4 (was $1100)
  installPct: 0.25,
  smallRange: [1400, 2000],  // 1-3kVA systems (was $2500-3000)
  standardRange: [2500, 3500], // 5kVA systems (was $4500-5000)
  largeRange: [4500, 7000],  // 8-12kVA systems (was $7000-8000)
} as const;

// ─── Inverter Brands & Pricing ────────────────────────────────────────────────
// Per-unit prices for specific kVA sizes. Source: Sona Solar, Taqon, Techzim.

export interface InverterOption {
  brand: string;
  label: string;
  tier: 'budget' | 'mid' | 'premium';
  prices: Record<number, number>; // kVA → USD
  description: string;
}

export const INVERTER_BRANDS: InverterOption[] = [
  {
    brand: 'sumry',
    label: 'Sumry',
    tier: 'budget',
    prices: { 1: 120 },
    description: 'Ultra-budget 1kVA — cheapest entry into solar.',
  },
  {
    brand: 'codi',
    label: 'Codi',
    tier: 'budget',
    prices: { 3: 160 },
    description: 'Ultra-budget — high PV input voltage (450VDC) for flexible arrays.',
  },
  {
    brand: 'must',
    label: 'Must',
    tier: 'budget',
    prices: { 3: 200, 5: 460, 8: 650, 10: 900, 12: 1100 },
    description: 'Best value — reliable budget workhorse for homes.',
  },
  {
    brand: 'rebel',
    label: 'Rebel',
    tier: 'budget',
    prices: { 5: 750 },
    description: 'Budget 5kVA option — solid performance at a low price.',
  },
  {
    brand: 'kodak',
    label: 'Kodak',
    tier: 'mid',
    prices: { 5: 700, 6: 650, 8: 950 },
    description: 'Solid mid-range — good value for 5-8kVA systems.',
  },
  {
    brand: 'srne',
    label: 'SRNE',
    tier: 'mid',
    prices: { 3: 350, 5: 650, 8: 1000, 10: 1400 },
    description: 'Robust quality — popular with installers for reliability.',
  },
  {
    brand: 'growatt',
    label: 'Growatt',
    tier: 'mid',
    prices: { 5: 850, 8: 1200, 10: 1600, 12: 2000 },
    description: 'Scalable — silent operation, ideal for commercial use.',
  },
  {
    brand: 'phocos',
    label: 'Phocos',
    tier: 'mid',
    prices: { 5: 1050 },
    description: 'German-engineered — built for harsh African environments.',
  },
  {
    brand: 'primax',
    label: 'Primax II',
    tier: 'mid',
    prices: { 8: 800, 10: 1000 },
    description: 'Powerhouse Elite — exceptional value for large systems.',
  },
  {
    brand: 'deye',
    label: 'Deye',
    tier: 'mid',
    prices: { 5: 800, 8: 1200, 10: 1500, 12: 1900 },
    description: 'Popular — stores daily totals on device, no internet needed.',
  },
  {
    brand: 'sunsynk',
    label: 'Sunsynk',
    tier: 'premium',
    prices: { 5: 900, 8: 1400, 10: 1700, 12: 2100 },
    description: 'Premium — best when paired with Pylontech batteries.',
  },
  {
    brand: 'solis',
    label: 'Solis',
    tier: 'premium',
    prices: { 5: 950, 8: 1400, 10: 1800, 12: 2200 },
    description: 'High efficiency — 4ms changeover, handles 2x PV array capacity.',
  },
  {
    brand: 'victron',
    label: 'Victron Energy',
    tier: 'premium',
    prices: { 3: 1200, 5: 1875, 8: 2800, 10: 3500 },
    description: 'Best-in-class — unmatched longevity, modular, handles severe power fluctuations.',
  },
];

// ─── Battery Brands & Pricing ─────────────────────────────────────────────────
// Per-unit prices. Most units are ~5kWh (48V/51.2V × 100Ah).

export interface BatteryOption {
  brand: string;
  label: string;
  tier: 'budget' | 'mid' | 'premium';
  pricePerKwh: number;        // USD per kWh
  unitKwh: number;            // standard unit size
  unitPrice: number;          // price per unit
  description: string;
}

export const BATTERY_BRANDS: BatteryOption[] = [
  {
    brand: 'svolt',
    label: 'Svolt',
    tier: 'budget',
    pricePerKwh: 117,
    unitKwh: 2.56,
    unitPrice: 300,
    description: 'Budget — good entry-level option.',
  },
  {
    brand: 'must',
    label: 'Must',
    tier: 'budget',
    pricePerKwh: 117,
    unitKwh: 5.12,
    unitPrice: 600,
    description: 'Budget — pairs well with Must inverters. Also available: 51.2V 200Ah ($1,200).',
  },
  {
    brand: 'dyness',
    label: 'Dyness',
    tier: 'mid',
    pricePerKwh: 160,
    unitKwh: 5.12,
    unitPrice: 790,
    description: 'Sweet spot — premium performance at mid-tier price. 90-95% DoD.',
  },
  {
    brand: 'pylontech',
    label: 'Pylontech',
    tier: 'mid',
    pricePerKwh: 280,
    unitKwh: 4.8,
    unitPrice: 1350,
    description: 'Industry standard — cross-inverter compatible, scalable across generations.',
  },
  {
    brand: 'deye_batt',
    label: 'Deye',
    tier: 'mid',
    pricePerKwh: 236,
    unitKwh: 5.3,
    unitPrice: 1250,
    description: 'Pairs perfectly with Deye inverters — 104Ah/51.2V.',
  },
  {
    brand: 'huawei',
    label: 'Huawei',
    tier: 'mid',
    pricePerKwh: 281,
    unitKwh: 4.8,
    unitPrice: 1350,
    description: 'Telecom-grade reliability — smart monitoring included.',
  },
  {
    brand: 'narada',
    label: 'Narada',
    tier: 'mid',
    pricePerKwh: 281,
    unitKwh: 4.8,
    unitPrice: 1350,
    description: 'Industrial-grade — 6000+ cycles, excellent for off-grid.',
  },
  {
    brand: 'leoch',
    label: 'Leoch',
    tier: 'mid',
    pricePerKwh: 281,
    unitKwh: 4.8,
    unitPrice: 1350,
    description: 'Proven reliability — used in telecom towers across Africa.',
  },
  {
    brand: 'byd',
    label: 'BYD',
    tier: 'premium',
    pricePerKwh: 300,
    unitKwh: 5.12,
    unitPrice: 1536,
    description: 'Global leader — blade technology, 6000+ cycles, EV-grade safety.',
  },
  {
    brand: 'freedomwon',
    label: 'FreedomWon',
    tier: 'premium',
    pricePerKwh: 280,
    unitKwh: 5.0,
    unitPrice: 1400,
    description: 'Made for Africa — 6000+ cycles, engineered for harsh climates.',
  },
  {
    brand: 'cento',
    label: 'Cento',
    tier: 'mid',
    pricePerKwh: 200,
    unitKwh: 5.12,
    unitPrice: 1024,
    description: '5-layer safety, AI monitoring, IP65 rated (indoor/outdoor).',
  },
  {
    brand: 'revov',
    label: 'Revov',
    tier: 'mid',
    pricePerKwh: 180,
    unitKwh: 5.12,
    unitPrice: 920,
    description: 'Eco-friendly — repurposed second-life EV batteries.',
  },
];

// ─── Panel Brands & Pricing ───────────────────────────────────────────────────

export interface PanelOption {
  brand: string;
  label: string;
  watt: number;
  pricePerPanel: number;
  pricePerWatt: number;
}

export const PANEL_BRANDS: PanelOption[] = [
  { brand: 'longi', label: 'Longi', watt: 430, pricePerPanel: 50, pricePerWatt: 0.116 },
  { brand: 'ja_solar', label: 'JA Solar', watt: 440, pricePerPanel: 56, pricePerWatt: 0.127 },
  { brand: 'aiko', label: 'Aiko', watt: 595, pricePerPanel: 72, pricePerWatt: 0.121 },
  { brand: 'jinko', label: 'Jinko', watt: 585, pricePerPanel: 80, pricePerWatt: 0.137 },
  { brand: 'canadian', label: 'Canadian Solar', watt: 550, pricePerPanel: 90, pricePerWatt: 0.164 },
  { brand: 'trina', label: 'Trina', watt: 550, pricePerPanel: 100, pricePerWatt: 0.182 },
];

// ─── Pre-Built Packages ───────────────────────────────────────────────────────
// Sourced from Solarpro, Sona Solar. These are real market packages.

export interface SolarPackage {
  id: string;
  name: string;
  provider: string;
  kva: number;
  batteryKwh: number;
  panelCount: number;
  panelWatt: number;
  price: number;
  description: string;
  appliances: string;        // what it can run
}

export const SOLAR_PACKAGES: SolarPackage[] = [
  {
    id: 'pkg_1kva_economy',
    name: '1kVA Economy Lite',
    provider: 'Sona Solar',
    kva: 1, batteryKwh: 2.56, panelCount: 2, panelWatt: 440,
    price: 900,
    description: 'Basic backup for essential devices.',
    appliances: 'Lights, WiFi, TV, phone charging',
  },
  {
    id: 'pkg_3kva_basic',
    name: '3kVA Basic',
    provider: 'Solarpro',
    kva: 3, batteryKwh: 2.56, panelCount: 2, panelWatt: 440,
    price: 1850,
    description: 'Entry-level with solar charging.',
    appliances: 'Lights, TV, fridge, laptop',
  },
  {
    id: 'pkg_3kva_eco',
    name: '3.2kVA Eco Luxury',
    provider: 'Sona Solar',
    kva: 3, batteryKwh: 5.12, panelCount: 4, panelWatt: 440,
    price: 1500,
    description: 'Good backup for a small household.',
    appliances: 'Lights, TV, fridge, laptop',
  },
  {
    id: 'pkg_3kva_premium',
    name: '3kVA Premium',
    provider: 'Solarpro',
    kva: 3, batteryKwh: 5.12, panelCount: 4, panelWatt: 440,
    price: 2850,
    description: 'Extended backup with double battery storage.',
    appliances: 'Lights, TVs, fridge, freezer, 0.5HP pump',
  },
  {
    id: 'pkg_5kva_standard',
    name: '5kVA Standard',
    provider: 'Solarpro',
    kva: 5, batteryKwh: 10.24, panelCount: 8, panelWatt: 440,
    price: 3360,
    description: 'Most popular — covers a medium home with pump.',
    appliances: 'Lights, TV, fridge, booster/borehole pump',
  },
  {
    id: 'pkg_5kva_luxury',
    name: '5kVA Luxury Beta',
    provider: 'Sona Solar',
    kva: 5, batteryKwh: 9.6, panelCount: 8, panelWatt: 550,
    price: 2500,
    description: 'Full household power with lithium batteries.',
    appliances: 'Lights, TV, fridge, borehole pump, entertainment',
  },
  {
    id: 'pkg_6kva_offgrid',
    name: '6kVA Off-Grid Home',
    provider: 'Solarpro',
    kva: 6, batteryKwh: 10.24, panelCount: 10, panelWatt: 440,
    price: 4180,
    description: 'Full off-grid for a large household.',
    appliances: '2 TVs, 2 fridges, microwave, lights',
  },
  {
    id: 'pkg_8kva_ultra',
    name: '8kVA Ultra Power',
    provider: 'Solarpro',
    kva: 8, batteryKwh: 20.48, panelCount: 16, panelWatt: 420,
    price: 6000,
    description: 'Heavy-duty — powers everything including heavy loads.',
    appliances: 'Full household + heavy appliances',
  },
  {
    id: 'pkg_10kva_pro',
    name: '10kVA Pro Power',
    provider: 'Solarpro',
    kva: 10, batteryKwh: 20.48, panelCount: 22, panelWatt: 420,
    price: 7700,
    description: 'Commercial-grade for large properties.',
    appliances: 'Full household + multiple heavy loads',
  },
  {
    id: 'pkg_12kva_commercial',
    name: '12kVA Commercial',
    provider: 'Solarpro',
    kva: 12, batteryKwh: 20.48, panelCount: 22, panelWatt: 420,
    price: 6070,
    description: 'Entry-level commercial system.',
    appliances: 'Small business, lodge, school',
  },
];

// ─── Maintenance Services ─────────────────────────────────────────────────────

export interface MaintenanceService {
  id: string;
  label: string;
  description: string;
  price: number;
}

export const MAINTENANCE_SERVICES: MaintenanceService[] = [
  {
    id: 'panel_cleaning',
    label: 'Solar panel cleaning',
    description: 'Professional cleaning to remove dust, pollen, and bird droppings. Can restore 5-30% output.',
    price: 50,
  },
  {
    id: 'system_health_check',
    label: 'System health check',
    description: 'Full inspection — wiring, connections, grounding, ventilation, and voltage verification.',
    price: 80,
  },
  {
    id: 'inverter_diagnostics',
    label: 'Inverter diagnostics & reprogramming',
    description: 'Fix ZESA tripping, battery charging issues, temper mode, or voltage range problems.',
    price: 100,
  },
  {
    id: 'battery_replacement',
    label: 'Battery replacement',
    description: 'Remove old battery and install new one. Battery cost separate.',
    price: 75,
  },
  {
    id: 'wiring_inspection',
    label: 'Wiring inspection & repair',
    description: 'Check for loose connections, water ingress, arc faults, and earthing issues.',
    price: 120,
  },
  {
    id: 'surge_protection_install',
    label: 'Surge protection upgrade',
    description: 'Install or replace DC/AC surge protection devices and automatic voltage switcher.',
    price: 150,
  },
];

// ─── ZERA License Tiers ───────────────────────────────────────────────────────

export const ZERA_TIERS = {
  ST1: { maxWatt: 400, label: 'Up to 400W (basic lighting systems)' },
  ST2: { maxWatt: 2000, label: 'Up to 2kW (small home systems)' },
  ST3: { maxWatt: 50000, label: 'Up to 50kW grid-tied / 10kW hybrid' },
  ST4: { maxWatt: Infinity, label: 'Unlimited capacity' },
} as const;

/** Returns the minimum ZERA technician tier needed for a given system size in watts. */
export function getRequiredZeraTier(systemWatts: number): string {
  if (systemWatts <= 400) return 'ST1';
  if (systemWatts <= 2000) return 'ST2';
  if (systemWatts <= 50000) return 'ST3';
  return 'ST4';
}
