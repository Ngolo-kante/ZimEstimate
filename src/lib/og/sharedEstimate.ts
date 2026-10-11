import { allocateBudget } from '@/lib/quick-projects/solar/allocateBudget';
import { BACKUP_LOADS, backupHours, describeBackup } from '@/lib/quick-projects/solar/backupHours';
import { BATTERY_BRANDS, INVERTER_BRANDS, PANEL_BRANDS } from '@/lib/quick-projects/solar/catalog';
import { decodeSolarExplorerState, SOLAR_EXPLORER_DEFAULTS } from '@/lib/quick-projects/solar/explorerUrl';
import { decodeBoreholeExplorerState } from '@/lib/quick-projects/borehole/explorerUrl';
import { fitBoreholeToBudget, getCasingLabel, type PumpType } from '@/lib/quick-projects/borehole/pricing';
import { LOCATION_DEFAULTS, boreholeAreaType } from '@/lib/quick-projects/borehole/catalog';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';
import {
  HOUSE_DEFAULTS,
  HOUSE_LOCATIONS,
  HOUSE_LOCATION_LABELS,
  HOUSE_PROFILES,
  type HouseLocation,
  type HouseProfile,
} from '@/lib/estimators/houseBudgetOptions';

/**
 * What a shared Budget Estimator link says, in a few lines.
 *
 * Used for the link preview WhatsApp shows before anyone taps: the card image
 * and the title and description beside it. Every figure comes from the same
 * calculation, options and defaults the page uses for the same link, so the
 * card cannot promise a different estimate from the one that opens.
 *
 * Returns null when the link describes no particular estimate; the site's
 * normal preview is used then.
 */

export interface SharedEstimateSummary {
  /** Small label above the headline, e.g. "SOLAR". */
  kicker: string;
  headline: string;
  /** Two or three short facts. */
  lines: string[];
  /** One sentence for the preview's description text. */
  description: string;
}

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

const PUMP_LABELS: Record<PumpType, string> = {
  solar: 'Solar pump',
  hybrid: 'Hybrid AC/DC pump',
  electric: 'Electric pump',
  hand: 'Hand pump',
};

const placeName = (location: string) =>
  location === 'other' ? 'Zimbabwe' : location.charAt(0).toUpperCase() + location.slice(1);

function summariseSolar(params: URLSearchParams): SharedEstimateSummary | null {
  const shared = decodeSolarExplorerState(params);
  if (shared.budget === undefined) return null;
  const state = { ...SOLAR_EXPLORER_DEFAULTS, ...shared, budget: shared.budget };

  const panel = PANEL_BRANDS.find((b) => b.brand === state.panelBrand) ?? PANEL_BRANDS[1];
  const inverter = INVERTER_BRANDS.find((b) => b.brand === state.inverterBrand) ?? INVERTER_BRANDS[0];
  const battery = BATTERY_BRANDS.find((b) => b.brand === state.batteryBrand) ?? BATTERY_BRANDS[2];

  const result = allocateBudget({
    totalBudget: state.budget,
    panelBrand: panel,
    inverterBrand: inverter,
    batteryBrand: battery,
    enabledCards: state.enabledCards,
    objective: state.objective,
    installCustom: state.installCustom,
    laborPct: state.laborPct,
    redistribute: state.redistribute,
    wiringKit: state.wiringKit,
  });

  const kw = ((result.panels.count * panel.watt) / 1000).toFixed(1);
  const kwh = result.battery.units * result.battery.brand.unitKwh;
  const hours = backupHours(kwh, BACKUP_LOADS[1]);

  const lines = [`${kw} kW of panels · ${result.inverter.kva} kVA inverter`];
  if (kwh > 0) {
    lines.push(`${kwh.toFixed(1)} kWh battery — ${BACKUP_LOADS[1].label} for ${describeBackup(hours)} when ZESA is off`);
  }

  return {
    kicker: 'SOLAR',
    headline: `What ${usd(state.budget)} buys in solar`,
    lines,
    description: kwh > 0
      ? `${kw} kW of panels, a ${result.inverter.kva} kVA inverter and ${kwh.toFixed(1)} kWh of storage — about ${hours} hours of backup. Open it and change anything.`
      : `${kw} kW of panels and a ${result.inverter.kva} kVA inverter. Open it and change anything.`,
  };
}

function summariseBorehole(params: URLSearchParams): SharedEstimateSummary | null {
  const shared = decodeBoreholeExplorerState(params);
  if (shared.budget === undefined) return null;

  const depth = shared.depth ?? 40;
  const location = shared.location ?? 'other';
  const purpose = shared.purpose ?? 'domestic';

  // Hand-picked components travel in the link; otherwise the page fits them
  // to the budget, so the preview does the same.
  const components = shared.userPickedComponents && shared.pumpType && shared.casingGrade
    ? { pumpType: shared.pumpType, casingGrade: shared.casingGrade }
    : fitBoreholeToBudget({
        budget: shared.budget,
        depth,
        purpose,
        areaType: boreholeAreaType(location),
        councilFee: (LOCATION_DEFAULTS[location] ?? LOCATION_DEFAULTS.other).councilFee,
      });

  return {
    kicker: 'BOREHOLE',
    headline: `A ${usd(shared.budget)} borehole plan`,
    lines: [
      `${depth} m deep · ${placeName(location)}`,
      `${PUMP_LABELS[components.pumpType]} · ${getCasingLabel(components.casingGrade)} casing`,
    ],
    description: `A ${depth} m borehole in ${placeName(location)} with a ${PUMP_LABELS[components.pumpType].toLowerCase()}, priced against a ${usd(shared.budget)} budget. Open it and change anything.`,
  };
}

function summariseHouse(params: URLSearchParams): SharedEstimateSummary | null {
  const budget = Number(params.get('budget'));
  if (!params.get('budget') || !Number.isFinite(budget) || budget <= 0) return null;

  const areaRaw = Number(params.get('area'));
  const area = Number.isFinite(areaRaw) && areaRaw > 0 ? areaRaw : HOUSE_DEFAULTS.area;
  const loc = params.get('loc');
  const location: HouseLocation = HOUSE_LOCATIONS.includes(loc as HouseLocation) ? (loc as HouseLocation) : HOUSE_DEFAULTS.location;
  const profileRaw = params.get('profile');
  const profile: HouseProfile = profileRaw && profileRaw in HOUSE_PROFILES ? (profileRaw as HouseProfile) : HOUSE_DEFAULTS.profile;
  const config = HOUSE_PROFILES[profile];

  const result = estimateStageReach({
    budgetUsd: budget,
    floorAreaM2: area,
    locationType: location,
    wallHeightM: config.wallHeightM,
    cementTypes: [config.cementType],
  });
  const coverage = Math.round(result.coveragePercent);

  return {
    kicker: 'HOUSE BUILD',
    // A non-breaking space keeps "120 m²" together when the headline wraps.
    headline: `How far ${usd(budget)} goes on a ${area}\u00a0m² house`,
    lines: [
      result.reachableStageId ? `Reaches: ${result.reachableStageLabel}` : 'Not yet enough for the foundation',
      // "100% of an estimated $17,187 build" beside a $25,000 budget reads as
      // a mistake; when it covers everything, say that.
      coverage >= 100
        ? `Covers the full build — estimated ${usd(result.estimatedTotalUsd)} · ${HOUSE_LOCATION_LABELS[location]}`
        : `${coverage}% of an estimated ${usd(result.estimatedTotalUsd)} build · ${HOUSE_LOCATION_LABELS[location]}`,
    ],
    description: result.reachableStageId
      ? coverage >= 100
        ? `${usd(budget)} covers the whole of a ${area} m² ${HOUSE_LOCATION_LABELS[location].toLowerCase()} house, estimated at ${usd(result.estimatedTotalUsd)}. Open it and change anything.`
        : `${usd(budget)} covers about ${coverage}% of a ${area} m² ${HOUSE_LOCATION_LABELS[location].toLowerCase()} house — through ${result.reachableStageLabel.toLowerCase()}. Open it and change anything.`
      : `${usd(budget)} is about ${coverage}% of what a ${area} m² house costs — not yet enough for the foundation. Open it to see what it takes.`,
  };
}

export function summariseSharedEstimate(params: URLSearchParams): SharedEstimateSummary | null {
  const mode = params.get('mode');
  if (mode === 'solar') return summariseSolar(params);
  if (mode === 'borehole') return summariseBorehole(params);
  if (mode === null || mode === 'house') return summariseHouse(params);
  return null;
}
