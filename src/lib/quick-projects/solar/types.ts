export type SolarIntent =
  | 'backup'
  | 'heavy_backup'
  | 'off_grid'
  | 'replace'
  | 'budget'
  | 'quote_check';

export type PropertyType = 'apartment' | 'house' | 'farm' | 'business';

export type RoofShading = 'none' | 'partial' | 'heavy';

export type RoofType = 'tile' | 'ibr' | 'concrete' | 'other';

export interface SolarApplianceInput {
  id: string;
  label: string;
  watts: number;
  category: 'essential' | 'heavy' | 'pump' | 'other';
}

export interface SolarApplianceSelection {
  id: string;
  qty: number;
  hours: number;
  include: boolean;
}

export interface SolarWizardAnswers {
  intent: SolarIntent | null;
  backupHours: number | null;
  location: string;
  propertyType: PropertyType | null;
  appliances: Record<string, SolarApplianceSelection>;
  simultaneousLoads: {
    kettleMicrowave: boolean;
    pumpWithHouse: boolean;
    geyserWithHouse: boolean;
  };
  roof: {
    type: RoofType | null;
    shading: RoofShading | null;
    orientation: string;
    spaceM2: number | null;
  };
  existing: {
    hasExisting: boolean;
    inverterKva: number | null;
    batteryKwh: number | null;
    panelCount: number | null;
    issues: string;
  };
  budgetUsd: number | null;
  quote: {
    totalUsd: number | null;
    inverterKva: number | null;
    batteryKwh: number | null;
    panelCount: number | null;
    panelWatt: number | null;
    notes: string;
  };
}

export interface SolarSizingResult {
  peakLoadWatts: number;
  inverterKva: number;
  batteryKwh: number;
  solarArrayKw: number;
  panelCount: number;
  dailyEnergyKwh: number;
  tier: 'small' | 'standard' | 'large';
  estimatedCostUsd: {
    low: number;
    high: number;
  };
  warnings: string[];
}

export interface SolarWizardOutput {
  answers: SolarWizardAnswers;
  result: SolarSizingResult | null;
}
