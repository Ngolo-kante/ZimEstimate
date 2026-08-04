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

export function getMobilisationCost(areaType: string): number {
  const extraKm = areaType === 'urban' ? 0 : 15;
  return P.mobilization_base + Math.max(0, extraKm) * P.mobilization_per_km;
}

export function getSurveyCost(areaType: string): number {
  const key = `site_survey_${areaType}` as keyof typeof P;
  return (P[key] as number) || P.site_survey_peri_urban;
}
