export type LocationProcedureStatus = 'required' | 'recommended' | 'not_applicable';

export type LocationTypeRule = 'urban' | 'peri-urban' | 'rural';

export type SoilType = 'sandy' | 'clay_black_mountain' | 'loam' | 'rock';

export interface LocationProcedureRule {
  id: string;
  label: string;
  description: string;
  statusByLocation: Record<LocationTypeRule, LocationProcedureStatus>;
}

export const LOCATION_PROCEDURE_RULES: LocationProcedureRule[] = [
  {
    id: 'city_council_inspection',
    label: 'City Council Inspection Fees',
    description: 'Standard municipal inspection process for plan and stage approvals.',
    statusByLocation: {
      urban: 'required',
      'peri-urban': 'recommended',
      rural: 'not_applicable',
    },
  },
  {
    id: 'municipal_water_connection',
    label: 'Municipal Water Connection',
    description: 'Site tap/connection fees to municipal main supply.',
    statusByLocation: {
      urban: 'required',
      'peri-urban': 'recommended',
      rural: 'not_applicable',
    },
  },
  {
    id: 'rdc_site_visit',
    label: 'RDC Site Visit',
    description: 'Rural District Council verification and guidance for site compliance.',
    statusByLocation: {
      urban: 'not_applicable',
      'peri-urban': 'recommended',
      rural: 'recommended',
    },
  },
  {
    id: 'boundary_verification',
    label: 'Boundary Verification',
    description: 'Boundary peg confirmation to reduce land dispute risk.',
    statusByLocation: {
      urban: 'recommended',
      'peri-urban': 'recommended',
      rural: 'recommended',
    },
  },
  {
    id: 'health_inspector_septic',
    label: 'Health Inspector (Septic Placement)',
    description: 'Validation of septic tank/gulley location for health compliance.',
    statusByLocation: {
      urban: 'recommended',
      'peri-urban': 'recommended',
      rural: 'recommended',
    },
  },
];

export interface SoilRiskProfile {
  soilType: SoilType;
  label: string;
  severity: 'low' | 'medium' | 'high';
  warning: string;
  recommendation: string;
  adjustmentPct: number;
}

export const SOIL_RISK_PROFILES: Record<SoilType, SoilRiskProfile> = {
  sandy: {
    soilType: 'sandy',
    label: 'Sandy Soil',
    severity: 'medium',
    warning: 'Sandy soil can reduce bearing capacity and increase settlement risk if poorly compacted.',
    recommendation: 'Consider deeper foundations and improved compaction. Increase substructure allowance by 8%.',
    adjustmentPct: 8,
  },
  clay_black_mountain: {
    soilType: 'clay_black_mountain',
    label: 'Clay / Black Mountain',
    severity: 'high',
    warning: 'Clay-rich soils expand and shrink with moisture changes, creating high foundation movement risk.',
    recommendation: 'Specialized foundation design is recommended. Increase substructure allowance by 20%.',
    adjustmentPct: 20,
  },
  loam: {
    soilType: 'loam',
    label: 'Loam',
    severity: 'low',
    warning: 'Loam usually provides balanced performance with moderate drainage and bearing support.',
    recommendation: 'Standard assumptions are typically acceptable. No adjustment required unless geotech suggests otherwise.',
    adjustmentPct: 0,
  },
  rock: {
    soilType: 'rock',
    label: 'Rock',
    severity: 'medium',
    warning: 'Rock excavation can significantly increase labor and equipment effort.',
    recommendation: 'Add 15% to substructure allowance for excavation complexity and slower progress.',
    adjustmentPct: 15,
  },
};

export interface TemporaryWorksSuggestion {
  id: string;
  label: string;
  description: string;
  defaultQty: number;
  unit: string;
}

export const TEMPORARY_WORKS_SUGGESTIONS: TemporaryWorksSuggestion[] = [
  {
    id: 'temp-cabin-6x3',
    label: 'Site Cabin (6x3)',
    description: 'Storage and site-guard shelter during early build phases.',
    defaultQty: 1,
    unit: 'each',
  },
  {
    id: 'temp-toilet',
    label: 'Temporary Toilet Setup',
    description: 'Portable or fixed temporary sanitation for crews.',
    defaultQty: 1,
    unit: 'each',
  },
  {
    id: 'water-tank-50000l',
    label: 'Water Tank (50,000L)',
    description: 'Temporary water resilience when municipal line is unavailable.',
    defaultQty: 1,
    unit: 'each',
  },
  {
    id: 'site-clear-level',
    label: 'Site Clear & Level',
    description: 'Initial clearing, debris handling, and ground leveling.',
    defaultQty: 1,
    unit: 'lot',
  },
];
