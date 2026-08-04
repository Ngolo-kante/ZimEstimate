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

import { BOREHOLE_PRICES as P } from './catalog';

export type PumpType = 'solar' | 'hybrid' | 'electric' | 'hand';
export type CasingGrade = 'class_6' | 'class_9' | 'class_10';
export type TankSize = '2000' | '2500' | '5000' | '10000' | 'none';
export type CasingDiameter = '140mm' | '180mm';

export function getSolarKitPrice(depth: number): { price: number; desc: string } {
  if (depth > 120) return { price: P.solar_kit_3hp, desc: '3.0 HP solar kit (deep/commercial)' };
  if (depth > 100) return { price: P.solar_kit_2hp, desc: '2.0 HP solar kit' };
  if (depth > 80) return { price: P.solar_kit_15hp, desc: '1.5 HP solar kit (high yield)' };
  if (depth > 50) return { price: P.solar_kit_1hp, desc: '1.0 HP solar kit' };
  if (depth > 30) return { price: P.solar_kit_075hp, desc: '0.75 HP solar kit' };
  return { price: P.solar_kit_05hp, desc: '0.5 HP solar kit' };
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
}): BoreholeFit {
  const { budget, depth, purpose, areaType, councilFee } = params;
  const diameter: CasingDiameter = purpose === 'domestic' ? '140mm' : '180mm';

  // Non-negotiables first — permit, council, transport, survey, drilling. A
  // borehole without these is not a cheaper borehole, it is not a borehole.
  const fixed =
    P.zinwa_permit_gw1 +
    councilFee +
    getMobilisationCost(areaType) +
    getSurveyCost(areaType) +
    depth * P.drilling_per_m +
    +(depth * 0.03).toFixed(1) * P.gravel_pack_per_m3 +
    P.wellhead_assembly;

  let remaining = budget - fixed;

  // Casing: best grade fitting inside 30% of what is left, cheapest as floor.
  // Class 6 is not optional — it is the minimum that holds a hole open.
  const casingGrades: CasingGrade[] = ['class_10', 'class_9', 'class_6'];
  let casingGrade: CasingGrade = 'class_6';
  for (const grade of casingGrades) {
    if (getCasingPrice(grade, diameter) * depth <= remaining * 0.3) {
      casingGrade = grade;
      break;
    }
  }
  remaining -= getCasingPrice(casingGrade, diameter) * depth;

  // Pump: richest option fitting inside 70%, leaving room for storage. A hand
  // pump is the floor rather than "no pump" — a borehole you cannot draw from
  // is not a saving.
  const pumpTypes: PumpType[] = ['solar', 'hybrid', 'electric', 'hand'];
  let pumpType: PumpType = 'hand';
  for (const type of pumpTypes) {
    if (getPumpPrice(type, depth).price <= remaining * 0.7) {
      pumpType = type;
      break;
    }
  }
  remaining -= getPumpPrice(pumpType, depth).price;
  if (pumpType !== 'hand') {
    const risingRate = purpose === 'domestic' ? P.rising_hdpe_25mm : P.rising_hdpe_32mm;
    remaining -= (depth + 5) * risingRate + P.pump_installation;
  }

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

export function getMobilisationCost(areaType: string): number {
  const extraKm = areaType === 'urban' ? 0 : 15;
  return P.mobilization_base + Math.max(0, extraKm) * P.mobilization_per_km;
}

export function getSurveyCost(areaType: string): number {
  const key = `site_survey_${areaType}` as keyof typeof P;
  return (P[key] as number) || P.site_survey_peri_urban;
}
