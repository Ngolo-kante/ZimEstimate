// ─── Solar Price Catalog — Zimbabwe Market Q1 2026 ────────────────────────────
// Sources: Sona Solar, Taqon Electrico, Solarpro Zimbabwe, Techzim,
//          ZERA regulations, HBOWA, strategic analysis.
// Prices use mid-range of all sources for reliability.

import { SolarApplianceInput } from './types';

export const SOLAR_PANEL_WATT = 550;
export const ZW_SUN_HOURS = 5.5;

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
    brand: 'must',
    label: 'Must',
    tier: 'budget',
    prices: { 3: 200, 5: 400, 8: 650, 10: 900, 12: 1100 },
    description: 'Best value — reliable budget choice for homes.',
  },
  {
    brand: 'codi',
    label: 'Codi',
    tier: 'budget',
    prices: { 3: 180, 5: 380 },
    description: 'Ultra-budget — high PV input voltage (450VDC) for flexible arrays.',
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
    pricePerKwh: 120,
    unitKwh: 5.12,
    unitPrice: 600,
    description: 'Budget — pairs well with Must inverters.',
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
// Market-verified Zimbabwe packages — Q1 2026 pricing.

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
  appliances: string;
  inverterBrandKey?: string;
  panelBrandKey?: string;
  batteryBrandKey?: string;
  includesInstall?: boolean;
}

export const SOLAR_PACKAGES: SolarPackage[] = [
  // ── Base packages ──────────────────────────────────────────────────────────
  {
    id: 'pkg_1kva_economy',
    name: '1kVA Economy',
    provider: '',
    kva: 1, batteryKwh: 2.56, panelCount: 2, panelWatt: 440,
    price: 900,
    description: 'Basic backup for essential devices.',
    appliances: 'Lights, WiFi, TV, Phone charging',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'svolt',
  },
  {
    id: 'pkg_3kva_basic',
    name: '3kVA Basic',
    provider: '',
    kva: 3, batteryKwh: 2.56, panelCount: 2, panelWatt: 440,
    price: 1850,
    description: 'Entry-level with solar charging.',
    appliances: 'Lights, TV, Fridge, Laptop',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_3kva_eco',
    name: '3.2kVA Eco',
    provider: '',
    kva: 3, batteryKwh: 5.12, panelCount: 4, panelWatt: 440,
    price: 1500,
    description: 'Good backup for a small household.',
    appliances: 'Lights, TV, Fridge, Laptop',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_3kva_premium',
    name: '3kVA Premium',
    provider: '',
    kva: 3, batteryKwh: 5.12, panelCount: 4, panelWatt: 440,
    price: 2850,
    description: 'Extended backup with double battery storage.',
    appliances: 'Lights, TVs, Fridge, Freezer, 0.5HP pump',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_5kva_standard',
    name: '5kVA Standard',
    provider: '',
    kva: 5, batteryKwh: 10.24, panelCount: 8, panelWatt: 440,
    price: 3360,
    description: 'Most popular — covers a medium home with pump.',
    appliances: 'Lights, TV, Fridge, Booster pump, Borehole pump',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_5kva_luxury',
    name: '5kVA Luxury',
    provider: '',
    kva: 5, batteryKwh: 9.6, panelCount: 8, panelWatt: 550,
    price: 2500,
    description: 'Full household power with lithium batteries.',
    appliances: 'Lights, TV, Fridge, Borehole pump, Entertainment',
    inverterBrandKey: 'deye', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_6kva_offgrid',
    name: '6kVA Off-Grid',
    provider: '',
    kva: 6, batteryKwh: 10.24, panelCount: 10, panelWatt: 440,
    price: 4180,
    description: 'Full off-grid for a large household.',
    appliances: '2 TVs, 2 Fridges, Microwave, Lights',
    inverterBrandKey: 'deye', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_8kva_ultra',
    name: '8kVA Ultra',
    provider: '',
    kva: 8, batteryKwh: 20.48, panelCount: 16, panelWatt: 420,
    price: 6000,
    description: 'Heavy-duty — powers everything including heavy loads.',
    appliances: 'Full household, Heavy appliances, Multiple pumps',
    inverterBrandKey: 'deye', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_10kva_pro',
    name: '10kVA Pro',
    provider: '',
    kva: 10, batteryKwh: 20.48, panelCount: 22, panelWatt: 420,
    price: 7700,
    description: 'Commercial-grade for large properties.',
    appliances: 'Full household, Multiple heavy loads, Air conditioner',
    inverterBrandKey: 'deye', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_12kva_commercial',
    name: '12kVA Commercial',
    provider: '',
    kva: 12, batteryKwh: 20.48, panelCount: 22, panelWatt: 420,
    price: 6070,
    description: 'Entry-level commercial system.',
    appliances: 'Small business, Lodge, School, Office',
    inverterBrandKey: 'deye', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },

  // ── 1–1.5 kVA ─────────────────────────────────────────────────────────────
  {
    id: 'pkg_1kva_starter',
    name: '1kVA Starter',
    provider: '',
    kva: 1, batteryKwh: 1.2, panelCount: 1, panelWatt: 440,
    price: 749,
    description: 'Entry-level backup for small spaces.',
    appliances: 'Lights, TV, WiFi, Phone charging, Laptop',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'svolt',
  },
  {
    id: 'pkg_12kva_basic',
    name: '1.2kVA Basic',
    provider: '',
    kva: 1.2, batteryKwh: 1.2, panelCount: 2, panelWatt: 410,
    price: 870,
    description: 'Two panels for daytime charging of essentials.',
    appliances: 'Lights, TV, Fan, Laptop, Phone charging, Entertainment',
    inverterBrandKey: 'must', panelBrandKey: 'longi', batteryBrandKey: 'svolt',
  },
  {
    id: 'pkg_15kva_light',
    name: '1.5kVA Light',
    provider: '',
    kva: 1.5, batteryKwh: 1.2, panelCount: 1, panelWatt: 440,
    price: 849,
    description: 'Slightly larger backup with extra headroom.',
    appliances: 'Lights, TV, WiFi, Laptop, Phone charging, Entertainment',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'svolt',
  },

  // ── 3–3.6 kVA ─────────────────────────────────────────────────────────────
  {
    id: 'pkg_32kva_entry',
    name: '3.2kVA Entry',
    provider: '',
    kva: 3.2, batteryKwh: 2.56, panelCount: 2, panelWatt: 550,
    price: 950,
    description: 'Entry-level 3kVA with installation included.',
    appliances: 'Lights, TV, Fridge, WiFi, Phone charging',
    inverterBrandKey: 'must', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_35kva_mid',
    name: '3.5kVA Mid',
    provider: '',
    kva: 3.5, batteryKwh: 2.56, panelCount: 4, panelWatt: 550,
    price: 1050,
    description: '4-panel system with installation included.',
    appliances: 'Lights, TV, Fridge, Laptop, WiFi',
    inverterBrandKey: 'must', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_32kva_power',
    name: '3.2kVA Power',
    provider: '',
    kva: 3.2, batteryKwh: 5.12, panelCount: 6, panelWatt: 560,
    price: 1100,
    description: 'Higher panel count for maximum solar generation.',
    appliances: 'Lights, TV, Fridge, WiFi, Fan, Laptop',
    inverterBrandKey: 'must', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_32kva_solar',
    name: '3.2kVA Solar',
    provider: '',
    kva: 3.2, batteryKwh: 2.56, panelCount: 2, panelWatt: 440,
    price: 1149,
    description: 'Well-rounded 3kVA for a small household.',
    appliances: 'Lights, TV, WiFi, Laptop, Fridge, Borehole pump',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_35kva_plus',
    name: '3.5kVA Plus',
    provider: '',
    kva: 3.5, batteryKwh: 5.12, panelCount: 6, panelWatt: 560,
    price: 1200,
    description: 'More panels and bigger battery for extended backup.',
    appliances: 'Lights, TV, Fridge, WiFi, Laptop, Fan',
    inverterBrandKey: 'must', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_36kva_home',
    name: '3.6kVA Home',
    provider: '',
    kva: 3.6, batteryKwh: 2.56, panelCount: 4, panelWatt: 435,
    price: 1250,
    description: 'Handles upright fridge and light pump loads.',
    appliances: 'Lights, TV, WiFi, Fridge, Freezer, Booster pump',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_36kva_linked',
    name: '3.6kVA Connected',
    provider: '',
    kva: 3.6, batteryKwh: 2.56, panelCount: 3, panelWatt: 440,
    price: 1299,
    description: 'Balanced system for home and small business needs.',
    appliances: 'Lights, TV, WiFi, Laptop, Fridge, Business pump',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_3kva_household',
    name: '3kVA Household',
    provider: '',
    kva: 3, batteryKwh: 2.56, panelCount: 4, panelWatt: 410,
    price: 1400,
    description: 'Four-panel system with accessories included.',
    appliances: 'Lights, TV, Fan, Laptop, Fridge, Entertainment, 0.5HP pump',
    inverterBrandKey: 'must', panelBrandKey: 'longi', batteryBrandKey: 'dyness',
  },

  // ── 4–5.5 kVA ─────────────────────────────────────────────────────────────
  {
    id: 'pkg_4kva_power',
    name: '4kVA Power',
    provider: '',
    kva: 4, batteryKwh: 5.12, panelCount: 8, panelWatt: 560,
    price: 1280,
    description: 'Eight panels for great daytime generation.',
    appliances: 'Lights, TV, Fridge, Freezer, WiFi, Booster pump',
    inverterBrandKey: 'must', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_42kva_smart',
    name: '4.2kVA Smart',
    provider: '',
    kva: 4.2, batteryKwh: 2.56, panelCount: 4, panelWatt: 750,
    price: 1250,
    description: 'High-watt panels with mid-range inverter.',
    appliances: 'Lights, TV, Fridge, WiFi, Laptop, Fan',
    inverterBrandKey: 'deye', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_42kva_family',
    name: '4.2kVA Family',
    provider: '',
    kva: 4.2, batteryKwh: 2.56, panelCount: 4, panelWatt: 450,
    price: 1290,
    description: 'Handles freezer, fridge and borehole together.',
    appliances: 'Lights, TV, WiFi, Fridge, Freezer, Borehole pump, Booster pump',
    inverterBrandKey: 'must', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_45kva_standard',
    name: '4.5kVA Standard',
    provider: '',
    kva: 4.5, batteryKwh: 5.12, panelCount: 4, panelWatt: 550,
    price: 1200,
    description: 'Solid mid-range system with installation included.',
    appliances: 'Lights, TV, Laptop, WiFi, Fridge, 0.5HP pump',
    inverterBrandKey: 'must', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_55kva_mid',
    name: '5.5kVA Mid',
    provider: '',
    kva: 5.5, batteryKwh: 5.12, panelCount: 4, panelWatt: 750,
    price: 1500,
    description: 'Reliable mid-range with high-watt panels.',
    appliances: 'Lights, TVs, WiFi, Fridge, Freezer, 0.5HP pump, Laptop',
    inverterBrandKey: 'deye', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_52kva_pro',
    name: '5.2kVA Pro',
    provider: '',
    kva: 5.2, batteryKwh: 5.12, panelCount: 4, panelWatt: 880,
    price: 1999,
    description: 'High-efficiency panels with premium hybrid inverter.',
    appliances: 'Lights, TV, WiFi, Fridge, Computers, Borehole pump, Booster pump, Printer',
    inverterBrandKey: 'deye', panelBrandKey: 'aiko', batteryBrandKey: 'dyness',
  },

  // ── 6–6.5 kVA ─────────────────────────────────────────────────────────────
  {
    id: 'pkg_62kva_entry',
    name: '6.2kVA Entry',
    provider: '',
    kva: 6.2, batteryKwh: 5.12, panelCount: 4, panelWatt: 550,
    price: 1650,
    description: 'Full household system with installation included.',
    appliances: 'Lights, TVs, WiFi, 2 Fridges, Borehole pump',
    inverterBrandKey: 'must', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_62kva_power',
    name: '6.2kVA Power',
    provider: '',
    kva: 6.2, batteryKwh: 10.24, panelCount: 6, panelWatt: 560,
    price: 1700,
    description: 'Double battery for extended overnight backup.',
    appliances: 'Lights, TVs, WiFi, 2 Fridges, Borehole pump, Booster pump',
    inverterBrandKey: 'deye', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_65kva_extended',
    name: '6.5kVA Extended',
    provider: '',
    kva: 6.5, batteryKwh: 3.84, panelCount: 6, panelWatt: 550,
    price: 1750,
    description: 'Six panels for excellent solar charging capacity.',
    appliances: 'Lights, TVs, WiFi, 2 Fridges, Washing machine, Borehole pump',
    inverterBrandKey: 'must', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_62kva_premium',
    name: '6.2kVA Premium',
    provider: '',
    kva: 6.2, batteryKwh: 10.24, panelCount: 5, panelWatt: 880,
    price: 2099,
    description: 'Premium high-efficiency panels and 10kWh battery.',
    appliances: 'Lights, TVs, WiFi, 2 Fridges, Washing machine, Borehole pump, Booster pump',
    inverterBrandKey: 'deye', panelBrandKey: 'aiko', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_62kva_full',
    name: '6kVA Full Home',
    provider: '',
    kva: 6, batteryKwh: 5.12, panelCount: 6, panelWatt: 410,
    price: 2400,
    description: 'Complete home system with accessories.',
    appliances: 'Lights, TV, Fan, Laptops, Fridge, Entertainment, 0.5HP pump, Booster pump',
    inverterBrandKey: 'must', panelBrandKey: 'longi', batteryBrandKey: 'dyness',
  },

  // ── 8–12 kVA ──────────────────────────────────────────────────────────────
  {
    id: 'pkg_82kva_standard',
    name: '8.2kVA Standard',
    provider: '',
    kva: 8.2, batteryKwh: 10.24, panelCount: 8, panelWatt: 550,
    price: 1950,
    description: 'Eight-panel system with installation included.',
    appliances: 'Full household, Washing machine, 1HP borehole pump',
    inverterBrandKey: 'must', panelBrandKey: 'canadian', batteryBrandKey: 'dyness',
    includesInstall: true,
  },
  {
    id: 'pkg_82kva_elite',
    name: '8.2kVA Elite',
    provider: '',
    kva: 8.2, batteryKwh: 10.24, panelCount: 10, panelWatt: 750,
    price: 2200,
    description: 'Heavy-duty with high-watt panels.',
    appliances: 'Lights, TVs, WiFi, 2 Fridges, Washing machine, Borehole pump, Air conditioner',
    inverterBrandKey: 'deye', panelBrandKey: 'jinko', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_10kva_heavy',
    name: '10kVA Heavy',
    provider: '',
    kva: 10, batteryKwh: 10.24, panelCount: 12, panelWatt: 450,
    price: 3299,
    description: 'High-capacity system for large homes and boreholes.',
    appliances: 'Full household, 2 Boreholes, 2 Fridges, LED TVs, Air conditioner, Drill',
    inverterBrandKey: 'codi', panelBrandKey: 'ja_solar', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_10kva_ultimate',
    name: '10.2kVA Ultimate',
    provider: '',
    kva: 10.2, batteryKwh: 10.24, panelCount: 8, panelWatt: 410,
    price: 4500,
    description: 'Complete system with premium inverter and accessories.',
    appliances: 'Full household, 1-2HP borehole, Washing machine, Air conditioner',
    inverterBrandKey: 'deye', panelBrandKey: 'longi', batteryBrandKey: 'dyness',
  },
  {
    id: 'pkg_8kw_premium',
    name: '8kW Premium',
    provider: '',
    kva: 8, batteryKwh: 13.24, panelCount: 11, panelWatt: 550,
    price: 5400,
    description: 'Top-tier premium hybrid with large lithium bank.',
    appliances: 'Full household, Multiple heavy loads, Air conditioner, Office equipment',
    inverterBrandKey: 'sunsynk', panelBrandKey: 'canadian', batteryBrandKey: 'pylontech',
  },
];

// ─── kVA Power Guide ──────────────────────────────────────────────────────────

export const KVA_POWER_GUIDE = [
  {
    kva: 1,
    label: '1–1.5 kVA',
    typicalUse: 'Small backup — lights and essentials',
    canPower: ['Lights', 'TV', 'WiFi', 'Phone charging', 'Laptop'],
    cannotPower: ['Fridge', 'Pumps', 'Washing machine'],
    priceRange: '$750–$900',
  },
  {
    kva: 3,
    label: '3–3.6 kVA',
    typicalUse: 'Small household with fridge',
    canPower: ['Lights', 'TV', 'WiFi', 'Laptop', 'Fridge', 'Fan'],
    cannotPower: ['Borehole pump', 'Washing machine', 'Geyser'],
    priceRange: '$950–$1,400',
  },
  {
    kva: 5,
    label: '4.5–5.5 kVA',
    typicalUse: 'Medium household with pump',
    canPower: ['Lights', 'TVs', 'WiFi', 'Fridge', 'Freezer', '0.5HP pump', 'Laptop'],
    cannotPower: ['Geyser', 'Electric stove', 'Kettle'],
    priceRange: '$1,200–$2,000',
  },
  {
    kva: 6,
    label: '6–6.5 kVA',
    typicalUse: 'Full household with borehole',
    canPower: ['Lights', 'Multiple TVs', 'WiFi', '2 Fridges', 'Washing machine', 'Borehole pump', 'Booster pump'],
    cannotPower: ['Geyser', 'Electric stove'],
    priceRange: '$1,650–$2,400',
  },
  {
    kva: 8,
    label: '8–12 kVA',
    typicalUse: 'Large household or small business',
    canPower: ['All above', 'Air conditioner (small)', 'Multiple pumps', 'Office equipment'],
    cannotPower: ['Multiple air cons', 'Industrial machinery'],
    priceRange: '$2,200–$5,400',
  },
] as const;

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
