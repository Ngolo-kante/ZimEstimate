import { SolarApplianceInput } from './types';

export const SOLAR_PANEL_WATT = 550;
export const ZW_SUN_HOURS = 5.5;

export const SOLAR_APPLIANCES: SolarApplianceInput[] = [
  { id: 'lights', label: 'LED Lights', watts: 10, category: 'essential' },
  { id: 'tv', label: 'TV', watts: 120, category: 'essential' },
  { id: 'wifi', label: 'WiFi Router', watts: 20, category: 'essential' },
  { id: 'laptop', label: 'Laptop', watts: 60, category: 'essential' },
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
];

export const SOLAR_INTENT_LABELS = {
  backup: 'Backup only (2–4 hrs)',
  heavy_backup: 'Heavy backup (4–8 hrs)',
  off_grid: 'Full off-grid (8+ hrs)',
  replace: 'Replace or upgrade existing system',
  budget: 'Budget-fit system',
  quote_check: 'Quote check',
} as const;

export const INVERTER_TIERS = [3, 5, 8, 10, 12];

export const BATTERY_TIERS = [5, 10, 15, 20];

export const PRICE_BENCHMARKS = {
  panelUsd: 110,
  inverter5kvaUsd: 900,
  battery5kwhUsd: 1100,
  installPct: 0.25,
  smallRange: [2500, 3000],
  standardRange: [4500, 5000],
  largeRange: [7000, 8000],
} as const;
