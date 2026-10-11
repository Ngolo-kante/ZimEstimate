import { BATTERY_BRANDS, INVERTER_BRANDS, PANEL_BRANDS } from './catalog';
import type { Objective } from './allocateBudget';
import { SOLAR_INSTALL_LABOR_PCT, type SolarWiringKit } from './boq';

/**
 * The Solar Budget Explorer's choices, as a link.
 *
 * The Share button used to send the page's bare address. The budget and every
 * choice lived only in component state, so whoever opened the WhatsApp
 * message landed on an empty explorer rather than the system being shown to
 * them. Everything the estimate depends on now travels in the query string.
 *
 * Decoding trusts nothing: a link can be edited by hand or truncated by a
 * chat app, so each value is checked against what the explorer can actually
 * show and dropped if it is not, leaving the explorer's own default.
 */

export const SOLAR_CARD_IDS = ['panels', 'inverter', 'battery', 'protection', 'installation', 'transport'] as const;
export type SolarCardId = (typeof SOLAR_CARD_IDS)[number];

export interface SolarExplorerState {
  budget: number;
  objective: Objective;
  panelBrand: string;
  inverterBrand: string;
  batteryBrand: string;
  /** Share of hardware, e.g. 0.15. */
  laborPct: number;
  /** The installer's own quote in dollars, which overrides the rate. */
  installCustom: number | null;
  /** The rows switched on. */
  enabledCards: Record<SolarCardId, boolean>;
  /** false is the plain proportional split. */
  redistribute: boolean;
  wiringKit: SolarWiringKit;
}

/**
 * What the explorer starts with, before a link or the user changes anything.
 *
 * Lives here, not in the component, because the WhatsApp link preview has to
 * fill in whatever a link leaves out exactly as the page would. Two copies of
 * these would drift, and the preview card would then describe a different
 * system from the page it links to.
 */
export const SOLAR_EXPLORER_DEFAULTS: Omit<SolarExplorerState, 'budget'> = {
  objective: 'balanced',
  panelBrand: 'ja_solar',
  inverterBrand: 'must',
  batteryBrand: 'dyness',
  laborPct: SOLAR_INSTALL_LABOR_PCT,
  installCustom: null,
  enabledCards: {
    panels: true,
    inverter: true,
    battery: true,
    // On: a "what your budget buys" figure without isolators, earthing or an
    // AVS describes a system no installer would quote, and the BOQ added the
    // missing parts anyway.
    protection: true,
    // On: labour is a real cost. The rate is what people argue about, not
    // whether they pay — so it is included and adjustable.
    installation: true,
    // Off: typically bundled in urban quotes here.
    transport: false,
  },
  // Spend the whole budget; a page asking "what can your budget buy?" should
  // not answer with a fifth of it idle.
  redistribute: true,
  wiringKit: 'full',
};

const OBJECTIVES: Objective[] = ['economy', 'balanced', 'quality'];

// The same bounds the BOQ clamps to, so a link cannot quote labour the saved
// estimate would refuse.
const MIN_LABOR_PCT = 0.05;
const MAX_LABOR_PCT = 0.4;

// Comfortably above the largest system the catalog can build.
const MAX_BUDGET = 1_000_000;

export function encodeSolarExplorerState(state: SolarExplorerState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('mode', 'solar');
  params.set('budget', String(Math.round(state.budget)));
  params.set('priority', state.objective);
  params.set('panel', state.panelBrand);
  params.set('inverter', state.inverterBrand);
  params.set('battery', state.batteryBrand);
  params.set('labour', String(Math.round(state.laborPct * 100)));
  if (state.installCustom !== null && state.installCustom > 0) {
    params.set('quote', String(Math.round(state.installCustom)));
  }
  params.set('parts', SOLAR_CARD_IDS.filter((id) => state.enabledCards[id]).join(','));
  if (!state.redistribute) params.set('split', 'plain');
  params.set('wiring', state.wiringKit);
  return params;
}

const positiveNumber = (raw: string | null, max: number): number | null => {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= max ? value : null;
};

export function decodeSolarExplorerState(params: URLSearchParams): Partial<SolarExplorerState> {
  const decoded: Partial<SolarExplorerState> = {};

  const budget = positiveNumber(params.get('budget'), MAX_BUDGET);
  if (budget !== null) decoded.budget = Math.round(budget);

  const priority = params.get('priority');
  if (OBJECTIVES.includes(priority as Objective)) decoded.objective = priority as Objective;

  const panel = params.get('panel');
  if (PANEL_BRANDS.some((b) => b.brand === panel)) decoded.panelBrand = panel as string;

  const inverter = params.get('inverter');
  if (INVERTER_BRANDS.some((b) => b.brand === inverter)) decoded.inverterBrand = inverter as string;

  const battery = params.get('battery');
  if (BATTERY_BRANDS.some((b) => b.brand === battery)) decoded.batteryBrand = battery as string;

  const labour = positiveNumber(params.get('labour'), 100);
  if (labour !== null) {
    decoded.laborPct = Math.min(MAX_LABOR_PCT, Math.max(MIN_LABOR_PCT, labour / 100));
  }

  // A rate with no quote means "use the rate" — said explicitly, so a quote
  // the recipient had typed earlier does not quietly override the link.
  const quote = positiveNumber(params.get('quote'), MAX_BUDGET);
  if (quote !== null) decoded.installCustom = Math.round(quote);
  else if (labour !== null) decoded.installCustom = null;

  // An empty "parts=" is a real choice (everything off); a missing one is not.
  const parts = params.get('parts');
  if (parts !== null) {
    const on = new Set(parts.split(',').map((part) => part.trim()));
    decoded.enabledCards = Object.fromEntries(
      SOLAR_CARD_IDS.map((id) => [id, on.has(id)]),
    ) as Record<SolarCardId, boolean>;
  }

  if (params.get('split') === 'plain') decoded.redistribute = false;

  const wiring = params.get('wiring');
  if (wiring === 'full' || wiring === 'basic') decoded.wiringKit = wiring;

  return decoded;
}
