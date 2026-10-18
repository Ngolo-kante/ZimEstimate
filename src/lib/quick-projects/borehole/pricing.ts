// ─── Borehole component pricing ───────────────────────────────────────────────
// One source of truth for what each part of a borehole costs.
//
// These lived inside BoreholeBudgetExplorer while calculations.ts carried its
// own near-duplicates, so the figure shown while choosing a budget and the
// figure the BOQ produced were computed by different code. They disagreed: the
// explorer displayed "PVC 140mm Class 6 — standard" and the BOQ emitted "Class
// 10 — premium", because the BOQ re-picked the grade instead of being told
// which one the user had chosen.
//
// Both sides import from here now. Change a price and both move together.

import { BOREHOLE_PRICES as P, inHarareArea } from './catalog';

export type PumpType = 'solar' | 'hybrid' | 'electric' | 'hand';
export type CasingGrade = 'class_6' | 'class_9' | 'class_10';
export type TankSize = '2000' | '2500' | '5000' | '10000' | 'none';
export type CasingDiameter = '140mm' | '180mm';

export function getSolarKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 120) return { price: P.solar_kit_3hp, desc: '3.0 HP solar pump package (deep/commercial)' };
  if (depth > 100) return { price: P.solar_kit_2hp, desc: '2.0 HP solar pump package' };
  if (depth > 80) return { price: P.solar_kit_15hp, desc: '1.5 HP solar pump package (high yield)' };
  if (depth > 50) return { price: P.solar_kit_1hp, desc: '1.0 HP solar pump package' };
  if (depth > 30) return { price: P.solar_kit_075hp, desc: '0.75 HP solar pump package' };
  return { price: P.solar_kit_05hp, desc: '0.5 HP solar pump package' };
}

export function getHybridKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 100) return { price: P.hybrid_kit_2hp, desc: '2.0 HP hybrid AC/DC kit' };
  if (depth > 60) return { price: P.hybrid_kit_15hp, desc: '1.5 HP hybrid AC/DC kit' };
  return { price: P.hybrid_kit_1hp, desc: '1.0 HP hybrid AC/DC kit' };
}

export function getElectricKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 120) return { price: P.electric_kit_3hp, desc: '3.0 HP electric submersible' };
  if (depth > 100) return { price: P.electric_kit_2hp, desc: '2.0 HP electric submersible' };
  if (depth > 50) return { price: P.electric_kit_1hp, desc: '1.0 HP electric submersible' };
  return { price: P.electric_kit_075hp, desc: '0.75 HP electric submersible' };
}

export function getPumpPrice(type: PumpType, depth: number): { price: number; desc: string } {
  switch (type) {
    case 'solar': return getSolarKitPrice(depth);
    case 'hybrid': return getHybridKitPrice(depth);
    case 'electric': return getElectricKitPrice(depth);
    case 'hand': return { price: P.pump_hand_afridev, desc: 'Afridev hand pump' };
  }
}

export function getCasingPrice(grade: CasingGrade, diameter: CasingDiameter): number {
  const d = diameter === '180mm' ? '180' : '140';
  const c = grade === 'class_10' ? 'c10' : grade === 'class_9' ? 'c9' : 'c6';
  const key = `casing_upvc_${d}_${c}` as keyof typeof P;
  return (P[key] as number) ?? P.casing_upvc_140_c6;
}

/**
 * Drilling to a depth as drillers sell it: the first 40 m as one package —
 * with 20 m of casing, the gravel pack and seal, their fees and a Harare site
 * visit — then each metre beyond. A shallower hole still costs the package.
 */
export function getDrillingCost(depth: number): number {
  return P.drilling_package_40m + getExtraDrillingMetres(depth) * P.extra_drilling_per_m;
}

export function getExtraDrillingMetres(depth: number): number {
  return Math.max(0, Math.round(depth) - P.drilling_package_depth_m);
}

export interface CasingExtras {
  /** Metres of the package's casing upgraded to a better grade or size, and the extra per metre. */
  upgradeM: number;
  upgradePerM: number;
  /** Metres cased beyond the package's 20 m, and their price per metre. */
  extraM: number;
  extraPerM: number;
  total: number;
}

/**
 * Casing on top of the package. Its 20 m are 140 mm Class 6; a better grade
 * or the wider 180 mm pipe costs the difference on those metres, and casing
 * deeper than 20 m costs the full rate per metre. By default only the
 * package's 20 m are cased (the owner's choice, 2026-10-18): the driller
 * decides on site whether the ground needs more, and the estimate lets the
 * person add it.
 */
export function getCasingExtras(grade: CasingGrade, diameter: CasingDiameter, casedM: number = P.drilling_package_casing_m): CasingExtras {
  const included = P.drilling_package_casing_m;
  const extraPerM = getCasingPrice(grade, diameter);
  const upgradePerM = Math.max(0, extraPerM - P.casing_upvc_140_c6);
  const upgradeM = upgradePerM > 0 ? Math.min(Math.max(0, casedM), included) : 0;
  const extraM = Math.max(0, Math.round(casedM) - included);
  return { upgradeM, upgradePerM, extraM, extraPerM, total: upgradeM * upgradePerM + extraM * extraPerM };
}

/** Getting the rig to site: in the package in Harare, usually $100–200 more elsewhere. */
export function getTransportCost(location: string): number {
  return inHarareArea(location) ? 0 : P.transport_outside_harare;
}

export const TRANSPORT_NOTE =
  `Outside Harare, drillers usually charge $${P.transport_outside_harare_low}–${P.transport_outside_harare_high} more, mostly to bring the rig. Change this to your driller's figure.`;

export const PACKAGE_NOTE =
  `Drillers quote the first ${P.drilling_package_depth_m} m as one price, usually $700–1,000 in Harare. It includes ${P.drilling_package_casing_m} m of 140 mm Class 6 casing, the gravel pack and seal, and their professional fees. Change it to your driller's quote.`;

/**
 * A pump with what it needs to work. Solar packages already include the
 * pipes, cable and installation; other pumps add a rising main and labour.
 */
export function getPumpSetCost(type: PumpType, depth: number, purpose: 'domestic' | 'commercial' | string): number {
  const pump = getPumpPrice(type, depth).price;
  if (type === 'solar') return pump;
  if (type === 'hand') return pump + P.pump_installation;
  const risingRate = purpose === 'domestic' ? P.rising_hdpe_25mm : P.rising_hdpe_32mm;
  return pump + (depth + 5) * risingRate + P.pump_installation;
}

export function getCasingLabel(grade: CasingGrade): string {
  if (grade === 'class_10') return 'Class 10 — premium';
  if (grade === 'class_9') return 'Class 9 — mid-grade';
  return 'Class 6 — standard';
}

/**
 * A tank always comes with something to stand on.
 *
 * The budget BOQ used to add a bare tank when the combo did not fit and then
 * only add a stand "if budget remains" — so a $5,000 borehole could be quoted a
 * 5,000L tank with nothing to raise it on. That is not a cheaper option, it is
 * an installation that cannot gravity feed. If the stand does not fit, the tank
 * does not fit either.
 */
export function getTankCost(size: TankSize, useCombo: boolean): { cost: number; desc: string } {
  if (size === 'none') return { cost: 0, desc: 'No tank' };
  if (useCombo && size === '10000') return { cost: P.combo_10000L_4m, desc: '10,000L tank + 4m stand (combo)' };
  if (useCombo && size === '5000') return { cost: P.combo_5000L_4m, desc: '5,000L tank + 4m stand (combo)' };
  const tankKey = `tank_${size}L` as keyof typeof P;
  const tankPrice = (P[tankKey] as number) ?? 700;
  return { cost: tankPrice + P.tank_stand_4m, desc: `${Number(size).toLocaleString()}L tank + 4m stand (separate)` };
}

export interface BoreholeFit {
  casingGrade: CasingGrade;
  pumpType: PumpType;
  tankSize: TankSize;
  useCombo: boolean;
  /** True when even the leanest viable borehole costs more than the budget. */
  budgetTooLow: boolean;
  /** What the fitted configuration costs, so callers can show it honestly. */
  fittedCostUsd: number;
}

/**
 * The best borehole a budget will actually buy.
 *
 * The explorer asked "what can your budget buy?" and then ignored the answer:
 * it held fixed defaults — 40m, Class 6 casing, a 0.75HP solar kit, a 5,000L
 * combo tank — and reported $5,495 allocated whether the budget was $15,000 or
 * $2,000, with a maxed-out bar and "$3,495 over". The fitting logic existed in
 * calculateBudgetBOQ but was unreachable, because the explorer always sends
 * configured:true so the BOQ would itemise the configuration on screen.
 *
 * Extracted here so the explorer picks the configuration and the BOQ prices it,
 * rather than each deciding separately and disagreeing.
 *
 * Depth is an input, not a variable to solve for: the user sets it on a slider
 * and silently redrilling to 20m to hit a number would be dishonest.
 */
export function fitBoreholeToBudget(params: {
  budget: number;
  depth: number;
  purpose: 'domestic' | 'commercial';
  areaType: string;
  councilFee: number;
  /** For transport: included in Harare, extra elsewhere. */
  location: string;
}): BoreholeFit {
  const { budget, depth, purpose, areaType, councilFee, location } = params;
  const diameter: CasingDiameter = purpose === 'domestic' ? '140mm' : '180mm';

  // Non-negotiables first — permit, council, transport, survey, drilling. A
  // borehole without these is not a cheaper borehole, it is not a borehole.
  const fixed =
    P.zinwa_permit_gw1 +
    councilFee +
    getTransportCost(location) +
    getSurveyCost(areaType) +
    getDrillingCost(depth);

  let remaining = budget - fixed;

  // Casing: the package's 20 m, upgraded to the best grade fitting inside 30%
  // of what is left. Class 6 is the floor and comes with the package.
  const casingGrades: CasingGrade[] = ['class_10', 'class_9', 'class_6'];
  let casingGrade: CasingGrade = 'class_6';
  for (const grade of casingGrades) {
    if (getCasingExtras(grade, diameter).total <= remaining * 0.3) {
      casingGrade = grade;
      break;
    }
  }
  remaining -= getCasingExtras(casingGrade, diameter).total;

  // Pump: richest option fitting inside 70%, leaving room for storage. A hand
  // pump is the floor rather than "no pump" — a borehole you cannot draw from
  // is not a saving.
  const pumpTypes: PumpType[] = ['solar', 'hybrid', 'electric', 'hand'];
  let pumpType: PumpType = 'hand';
  for (const type of pumpTypes) {
    if (getPumpSetCost(type, depth, purpose) <= remaining * 0.7) {
      pumpType = type;
      break;
    }
  }
  remaining -= getPumpSetCost(pumpType, depth, purpose);

  // Storage: largest that fits, else none. getTankCost always includes a stand,
  // so this never proposes a tank with nothing to raise it on.
  const tankSizes: TankSize[] = ['10000', '5000', '2500', '2000'];
  let tankSize: TankSize = 'none';
  let useCombo = true;
  for (const size of tankSizes) {
    const combo = getTankCost(size, true);
    if (combo.cost <= remaining) {
      tankSize = size;
      useCombo = true;
      break;
    }
    const separate = getTankCost(size, false);
    if (separate.cost <= remaining) {
      tankSize = size;
      useCombo = false;
      break;
    }
  }
  remaining -= getTankCost(tankSize, useCombo).cost;

  const fittedCostUsd = budget - remaining;

  return {
    casingGrade,
    pumpType,
    tankSize,
    useCombo,
    // Reported rather than hidden: at $2,000 for a 40m hole the honest answer is
    // "this does not cover it", not a configuration pretending otherwise.
    budgetTooLow: fittedCostUsd > budget,
    fittedCostUsd,
  };
}

export function getSurveyCost(areaType: string): number {
  const key = `site_survey_${areaType}` as keyof typeof P;
  return (P[key] as number) || P.site_survey_peri_urban;
}
