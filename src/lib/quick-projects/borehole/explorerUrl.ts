import { LOCATION_DEFAULTS } from './catalog';
import type { CasingGrade, PumpType, TankSize } from './pricing';

/**
 * The Borehole Budget Explorer's choices, as a link.
 *
 * Share used to send the page's bare address, so whoever opened the WhatsApp
 * message got a fresh $5,000 explorer rather than the borehole being shown to
 * them. Same approach as the solar explorer's links: everything the estimate
 * depends on goes in the query string, and decoding drops anything the
 * explorer cannot actually show, leaving its own default.
 */

export const BOREHOLE_CARD_IDS = ['drilling', 'casing', 'pump', 'tank', 'services', 'permits', 'transport'] as const;
export type BoreholeCardId = (typeof BOREHOLE_CARD_IDS)[number];

export interface BoreholeExplorerState {
  budget: number;
  depth: number;
  purpose: 'domestic' | 'commercial';
  location: string;
  enabledCards: Record<BoreholeCardId, boolean>;
  pumpType: PumpType;
  casingGrade: CasingGrade;
  tankSize: TankSize;
  useCombo: boolean;
  /**
   * Whether the components were chosen by hand. A link must carry it: without
   * it the recipient's explorer would re-fit pump, casing and tank to the
   * budget and quietly show a different borehole from the one shared.
   */
  userPickedComponents: boolean;
}

const PUMPS: PumpType[] = ['solar', 'hybrid', 'electric', 'hand'];
const CASINGS: CasingGrade[] = ['class_6', 'class_9', 'class_10'];
const TANKS: TankSize[] = ['2000', '2500', '5000', '10000', 'none'];

// The depth slider's own range and step.
export const MIN_DEPTH = 20;
export const MAX_DEPTH = 160;
const DEPTH_STEP = 5;
const MAX_BUDGET = 1_000_000;

export function encodeBoreholeExplorerState(state: BoreholeExplorerState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('mode', 'borehole');
  params.set('budget', String(Math.round(state.budget)));
  params.set('depth', String(state.depth));
  params.set('purpose', state.purpose);
  params.set('location', state.location);
  params.set('parts', BOREHOLE_CARD_IDS.filter((id) => state.enabledCards[id]).join(','));
  if (state.userPickedComponents) {
    params.set('pump', state.pumpType);
    params.set('casing', state.casingGrade);
    params.set('tank', state.tankSize);
    params.set('combo', state.useCombo ? '1' : '0');
  }
  return params;
}

export function decodeBoreholeExplorerState(params: URLSearchParams): Partial<BoreholeExplorerState> {
  const decoded: Partial<BoreholeExplorerState> = {};

  const budget = Number(params.get('budget'));
  if (params.get('budget') !== null && Number.isFinite(budget) && budget > 0 && budget <= MAX_BUDGET) {
    decoded.budget = Math.round(budget);
  }

  const depth = Number(params.get('depth'));
  if (params.get('depth') !== null && Number.isFinite(depth)) {
    // Snapped to the slider, so a hand-edited link cannot show a depth the
    // slider itself could never reach.
    const clamped = Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, depth));
    decoded.depth = Math.round(clamped / DEPTH_STEP) * DEPTH_STEP;
  }

  const purpose = params.get('purpose');
  if (purpose === 'domestic' || purpose === 'commercial') decoded.purpose = purpose;

  const location = params.get('location');
  if (location && Object.hasOwn(LOCATION_DEFAULTS, location)) decoded.location = location;

  const parts = params.get('parts');
  if (parts !== null) {
    const on = new Set(parts.split(',').map((part) => part.trim()));
    decoded.enabledCards = Object.fromEntries(
      BOREHOLE_CARD_IDS.map((id) => [id, on.has(id)]),
    ) as Record<BoreholeCardId, boolean>;
  }

  // Components travel together and only when they were chosen by hand; a
  // partial set would leave the explorer re-fitting the rest around them.
  const pump = params.get('pump');
  const casing = params.get('casing');
  const tank = params.get('tank');
  const combo = params.get('combo');
  if (
    PUMPS.includes(pump as PumpType) &&
    CASINGS.includes(casing as CasingGrade) &&
    TANKS.includes(tank as TankSize) &&
    (combo === '0' || combo === '1')
  ) {
    decoded.pumpType = pump as PumpType;
    decoded.casingGrade = casing as CasingGrade;
    decoded.tankSize = tank as TankSize;
    decoded.useCombo = combo === '1';
    decoded.userPickedComponents = true;
  }

  return decoded;
}
