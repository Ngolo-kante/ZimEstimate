import { makeItem, type Answers, type BOQItem } from '../engine/types';
import { BOREHOLE_PRICES as P, LOCATION_DEFAULTS } from './catalog';
import {
  getCasingLabel,
  getCasingPrice,
  getMobilisationCost,
  getPumpPrice,
  getSurveyCost,
  getTankCost,
  type CasingDiameter,
  type CasingGrade,
  type PumpType,
  type TankSize,
} from './pricing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function needsWork(a: Answers, work: string): boolean {
  const w = a.existing_work_needed;
  return Array.isArray(w) && w.includes(work);
}

/** Match solar kit to depth using TSG Projects pump-to-depth matrix. */
function getSolarKit(depth: number): { key: keyof typeof P; desc: string } {
  if (depth > 120) return { key: 'solar_kit_3hp', desc: 'Solar pump kit — 3.0 HP (deep / commercial borehole)' };
  if (depth > 100) return { key: 'solar_kit_2hp', desc: 'Solar pump kit — 2.0 HP (deep borehole)' };
  if (depth > 80)  return { key: 'solar_kit_15hp', desc: 'Solar pump kit — 1.5 HP (high yield)' };
  if (depth > 50)  return { key: 'solar_kit_1hp', desc: 'Solar pump kit — 1.0 HP' };
  if (depth > 30)  return { key: 'solar_kit_075hp', desc: 'Solar pump kit — 0.75 HP' };
  return { key: 'solar_kit_05hp', desc: 'Solar pump kit — 0.5 HP' };
}

/** Match hybrid kit to depth. */
function getHybridKit(depth: number): { key: keyof typeof P; desc: string } {
  if (depth > 100) return { key: 'hybrid_kit_2hp', desc: 'Hybrid AC/DC pump kit — 2.0 HP (deep borehole)' };
  if (depth > 60)  return { key: 'hybrid_kit_15hp', desc: 'Hybrid AC/DC pump kit — 1.5 HP' };
  return { key: 'hybrid_kit_1hp', desc: 'Hybrid AC/DC pump kit — 1.0 HP (auto solar/grid switching)' };
}

/** Match electric kit to depth using TSG Projects matrix. */
function getElectricKit(depth: number): { key: keyof typeof P; desc: string } {
  if (depth > 120) return { key: 'electric_kit_3hp', desc: 'Electric submersible pump — 3.0 HP (deep borehole)' };
  if (depth > 100) return { key: 'electric_kit_2hp', desc: 'Electric submersible pump — 2.0 HP' };
  if (depth > 50)  return { key: 'electric_kit_1hp', desc: 'Electric submersible pump — 1.0 HP' };
  return { key: 'electric_kit_075hp', desc: 'Electric submersible pump — 0.75 HP' };
}

function getMobilizationCost(areaType: string, distanceKm?: number): number {
  // If user provided a specific distance, use formula: base + max(0, distance - freeRadius) × rate
  if (distanceKm && distanceKm > 0) {
    const extraKm = Math.max(0, distanceKm - P.mobilization_free_radius_km);
    return P.mobilization_base + extraKm * P.mobilization_per_km;
  }
  // Otherwise estimate by area type
  if (areaType === 'rural') return P.mobilization_base + 40 * P.mobilization_per_km;
  if (areaType === 'peri_urban') return P.mobilization_base + 15 * P.mobilization_per_km;
  return P.mobilization_base;
}

// ─── Main Calculator ─────────────────────────────────────────────────────────

export function calculateBoreholeBOQ(answers: Answers): BOQItem[] {
  // The budget explorer sends the configuration the user actually chose, so the
  // BOQ itemises that rather than re-deciding it. Without this the explorer
  // could display "Class 6 — standard" and the BOQ emit "Class 10 — premium",
  // and every toggle the user switched off was ignored.
  if (answers.estimate_mode === 'budget' && answers.configured === true) {
    return calculateConfiguredBoreholeBOQ(answers);
  }
  if (answers.estimate_mode === 'budget') return calculateBudgetBOQ(answers);
  if (answers.project_scope === 'quick_service') return calculateQuickServiceBOQ(answers);
  if (answers.project_scope === 'existing_borehole') return calculateExistingBoreholeBOQ(answers);
  return calculateNewBoreholeBOQ(answers);
}


// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURED BUDGET BOQ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Itemises exactly the system the budget explorer is showing.
 *
 * calculateBudgetBOQ below runs its own greedy allocation — permits, drilling,
 * casing capped at 30% of what is left, then a pump, then a tank if enough
 * remains. That is the right behaviour when all we know is a budget, and the
 * wrong behaviour once the user has picked a pump type, a casing grade and a
 * tank size, because it silently overrides all of them. Measured at $5,000 the
 * two disagreed by $503 and swapped the casing grade.
 *
 * Every price here comes from ./pricing, which the explorer also uses, so the
 * two cannot drift apart again.
 */
function calculateConfiguredBoreholeBOQ(answers: Answers): BOQItem[] {
  const depth = parseInt(answers.budget_depth as string) || 40;
  const purpose = (answers.borehole_purpose as string) || 'domestic';
  const location = (answers.project_location as string) || 'other';
  const areaType = (answers.area_type as string) || 'peri_urban';
  const locMeta = LOCATION_DEFAULTS[location] || LOCATION_DEFAULTS.other;

  const pumpType = ((answers.pump_power_source as string) || 'solar') as PumpType;
  const casingGrade = ((answers.casing_class as string) || 'class_6') as CasingGrade;
  const diameter = (purpose === 'domestic' ? '140mm' : '180mm') as CasingDiameter;
  const tankSize = ((answers.tank_capacity as string) || '5000') as TankSize;
  const useCombo = answers.use_combo !== false;

  // Absent means enabled — a caller that does not pass toggles gets everything.
  const on = (key: string) => answers[key] !== false;

  const items: BOQItem[] = [];

  if (on('include_permits')) {
    items.push(makeItem('bg_zinwa', 'Permits & Compliance', 'ZINWA drilling permit (Form GW1)', 1, 'each', P.zinwa_permit_gw1));
    items.push(makeItem('bg_council', 'Permits & Compliance', 'Local council approval fee', 1, 'each', locMeta.councilFee));
  }

  if (on('include_transport')) {
    items.push(makeItem('bg_mobilization', 'Transport & Logistics', 'Drilling rig transport to site', 1, 'each', getMobilisationCost(areaType)));
  }

  if (on('include_drilling')) {
    items.push(makeItem('bg_drilling', 'Drilling', 'Borehole drilling', depth, 'm', P.drilling_per_m));
  }

  if (on('include_casing')) {
    const casingPerM = getCasingPrice(casingGrade, diameter);
    items.push(makeItem('bg_casing', 'Casing', `PVC casing ${diameter} (${getCasingLabel(casingGrade)})`, depth, 'm', casingPerM));
    const gravelM3 = +(depth * 0.03).toFixed(1);
    items.push(makeItem('bg_gravel', 'Casing', 'Gravel pack (filter)', gravelM3, 'm³', P.gravel_pack_per_m3));
    items.push(makeItem('bg_wellhead', 'Wellhead', 'Wellhead assembly & sanitary seal', 1, 'each', P.wellhead_assembly));
  }

  if (on('include_pump')) {
    const pump = getPumpPrice(pumpType, depth);
    items.push(makeItem('bg_pump', 'Pump & Power', pump.desc, 1, pumpType === 'hand' ? 'each' : 'kit', pump.price));
    if (pumpType !== 'hand') {
      const risingRate = purpose === 'domestic' ? P.rising_hdpe_25mm : P.rising_hdpe_32mm;
      const risingDia = purpose === 'domestic' ? '25mm' : '32mm';
      items.push(makeItem('bg_rising', 'Pipework', `HDPE rising main — ${risingDia}`, depth + 5, 'm', risingRate));
    }
    items.push(makeItem('bg_pump_install', 'Transport & Logistics', 'Pump installation labour', 1, 'each', P.pump_installation));
  }

  if (on('include_tank') && tankSize !== 'none') {
    const tank = getTankCost(tankSize, useCombo);
    items.push(makeItem('bg_tank', 'Storage', tank.desc, 1, 'set', tank.cost, {
      notes: 'Tank and stand are quoted together — a tank with no stand cannot gravity feed.',
    }));
  }

  if (on('include_services')) {
    items.push(makeItem('bg_survey', 'Professional Services', 'Site survey', 1, 'each', getSurveyCost(areaType)));
    items.push(makeItem('bg_flushing', 'Professional Services', 'Borehole flushing & cleaning', 1, 'each', P.borehole_flushing));
    items.push(makeItem('bg_yield', 'Professional Services', 'Water yield / capacity test', 1, 'each', P.yield_test));
    items.push(makeItem('bg_water_test', 'Professional Services', 'Bacteriological water test', 1, 'each', P.water_test_bacteriological));
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW BOREHOLE
// ═══════════════════════════════════════════════════════════════════════════════

function calculateNewBoreholeBOQ(answers: Answers): BOQItem[] {
  const isQuick = answers.estimate_mode === 'quick';
  const purpose = (answers.borehole_purpose as string) || 'domestic';
  const location = (answers.project_location as string) || 'other';
  const areaType = (answers.area_type as string) || 'peri_urban';
  const locMeta = LOCATION_DEFAULTS[location] || LOCATION_DEFAULTS.other;

  // ── Resolve drilling depth ──────────────────────────────────────────────
  const depth = parseInt(answers.drilling_depth as string) || locMeta.depth;

  // ── Resolve casing ─────────────────────────────────────────────────────
  const casingMaterial = isQuick ? 'upvc' : (answers.casing_material as string) || 'upvc';
  const casingClass = isQuick
    ? depth > 60 || purpose !== 'domestic' ? 'class_10' : 'class_6'
    : (answers.casing_class as string) || 'class_6';
  const casingDiameter = isQuick
    ? purpose === 'domestic' ? '140mm' : '180mm'
    : (answers.casing_diameter as string) || '140mm';

  // ── Resolve ground conditions ───────────────────────────────────────────
  const ground = isQuick ? 'not_sure' : (answers.ground_conditions as string) || 'not_sure';
  const isSandy = ground === 'sandy';
  const doubleCasing = isQuick ? false : Boolean(answers.double_casing);

  // ── Resolve water system ────────────────────────────────────────────────
  const systemScope =
    (answers.system_scope as string) || (isQuick ? 'complete_system' : 'drilling_only');
  const pumpPower = isQuick ? 'solar' : (answers.pump_power_source as string) || 'solar';
  const tankCapacity = isQuick
    ? purpose === 'domestic' ? '5000' : '10000'
    : (answers.tank_capacity as string) || '5000';
  const standChoice = isQuick ? 'combo' : (answers.include_tank_stand as string) || 'standard';
  const customStandHeight = parseInt(answers.tank_stand_height as string) || 4;

  // ── Resolve site distance ──────────────────────────────────────────────
  const siteDistance = parseInt(answers.site_distance_km as string) || 0;

  // ── Resolve services ───────────────────────────────────────────────────
  const includeSiteSurvey = isQuick
    ? true
    : answers.site_survey_done !== 'yes' && Boolean(answers.include_site_survey ?? true);
  const includeFlushing = isQuick ? true : Boolean(answers.include_flushing ?? true);
  const includeYieldTest = isQuick ? true : Boolean(answers.include_yield_test ?? true);
  const waterQualityLevel = isQuick
    ? purpose === 'commercial' ? 'full' : 'basic'
    : (answers.water_quality_level as string) || 'none';
  const includeZinwaPermit = isQuick
    ? true
    : answers.has_permits !== 'yes' && Boolean(answers.include_zinwa_permit ?? true);
  const includeCouncilFee = isQuick
    ? true
    : answers.has_permits !== 'yes' && Boolean(answers.include_council_fee ?? true);
  const includeMobilization = isQuick ? true : Boolean(answers.include_mobilization ?? true);
  const includePumpInstall = isQuick
    ? systemScope !== 'drilling_only'
    : Boolean(answers.include_pump_install ?? true);
  const includePurification = isQuick
    ? purpose === 'commercial'
    : Boolean(answers.include_purification);

  // ── Resolve security ───────────────────────────────────────────────────
  const includeAntitheft = !isQuick && Boolean(answers.include_antitheft_brackets);
  const antitheftQty = parseInt(answers.antitheft_bracket_qty as string) || 6;
  const includeSecurityCage = !isQuick && Boolean(answers.include_security_cage);
  const securityCageCost = parseInt(answers.security_cage_cost as string) || P.security_cage_estimate;

  // ════════════════════════════════════════════════════════════════════════
  // BUILD BOQ
  // ════════════════════════════════════════════════════════════════════════

  const items: BOQItem[] = [];

  // ── 1. Drilling ──────────────────────────────────────────────────────────
  const useMudDrilling = isSandy;
  const drillingRate = useMudDrilling ? P.mud_drilling_per_m : P.drilling_per_m;
  items.push(
    makeItem(
      'bh_drilling', 'Drilling',
      useMudDrilling ? 'Borehole drilling — mud drilling (sandy soil)' : 'Borehole drilling',
      depth, 'm', drillingRate,
    ),
  );

  // ── 2. Casing ────────────────────────────────────────────────────────────
  const casingPricePerM = resolveCasingPrice(casingMaterial, casingClass, casingDiameter);
  const casingDesc = formatCasingDesc(casingMaterial, casingClass, casingDiameter);
  items.push(makeItem('bh_casing', 'Casing', casingDesc, depth, 'm', casingPricePerM));

  if (doubleCasing || (isSandy && !isQuick)) {
    items.push(
      makeItem('bh_double_casing', 'Casing', 'Double casing — top section (sandy soil protection)', 10, 'm', P.double_casing_per_m),
    );
  }

  // ── 3. Gravel pack & wellhead ────────────────────────────────────────────
  const gravelM3 = +(depth * 0.03).toFixed(1);
  items.push(makeItem('bh_gravel', 'Casing', 'Gravel pack (filter)', gravelM3, 'm³', P.gravel_pack_per_m3));
  items.push(makeItem('bh_wellhead', 'Wellhead', 'Wellhead assembly & sanitary seal', 1, 'each', P.wellhead_assembly));

  // ── 4. Pump ──────────────────────────────────────────────────────────────
  if (systemScope !== 'drilling_only') {
    addPumpItems(items, pumpPower, depth, purpose);
  }

  // ── 5. Tank & stand ──────────────────────────────────────────────────────
  if (systemScope === 'complete_system') {
    addTankItems(items, tankCapacity, standChoice, customStandHeight);
  }

  // ── 6. Site security ─────────────────────────────────────────────────────
  if (includeAntitheft) {
    items.push(makeItem('bh_antitheft', 'Site Security', 'Anti-theft brackets for solar panels', antitheftQty, 'pcs', P.antitheft_brackets, { optional: true }));
  }
  if (includeSecurityCage) {
    items.push(makeItem('bh_security_cage', 'Site Security', 'Security cage — pump/inverter/battery protection', 1, 'each', securityCageCost, { optional: true }));
  }

  // ── 7. Professional services ───────────────────────────────────────────
  if (includeSiteSurvey) {
    const surveyKey = `site_survey_${areaType}` as keyof typeof P;
    items.push(
      makeItem('bh_survey', 'Professional Services', 'Site survey — locating the best drilling point', 1, 'each', (P[surveyKey] as number) || P.site_survey_peri_urban, { optional: true }),
    );
  }
  if (includeFlushing) {
    items.push(makeItem('bh_flushing', 'Professional Services', 'Borehole flushing & cleaning', 1, 'each', P.borehole_flushing, { optional: true }));
  }
  if (includeYieldTest) {
    items.push(makeItem('bh_yield', 'Professional Services', 'Water yield / capacity test', 1, 'each', P.yield_test, { optional: true }));
  }
  addWaterQualityItems(items, waterQualityLevel);
  if (includePurification) {
    items.push(makeItem('bh_purification', 'Water Treatment', 'Water purification system', 1, 'each', P.purification_system, { optional: true }));
  }

  // ── 8. Permits & compliance ──────────────────────────────────────────────
  if (includeZinwaPermit) {
    items.push(makeItem('bh_zinwa', 'Permits & Compliance', 'ZINWA drilling permit (Form GW1)', 1, 'each', P.zinwa_permit_gw1, { optional: true }));
  }
  if (includeCouncilFee) {
    const councilFee = locMeta.councilFee;
    const locLabel = location === 'other' ? 'estimated average' : location.charAt(0).toUpperCase() + location.slice(1);
    items.push(makeItem('bh_council', 'Permits & Compliance', `Local council approval fee (${locLabel})`, 1, 'each', councilFee, { optional: true }));
  }

  // ── 9. Mobilization & labour ───────────────────────────────────────────
  if (includeMobilization) {
    const mobilizationCost = getMobilizationCost(areaType, siteDistance);
    const distNote = siteDistance > 0
      ? `${siteDistance} km from depot — ${Math.max(0, siteDistance - P.mobilization_free_radius_km)} km beyond free radius`
      : areaType === 'urban' ? `Within ${P.mobilization_free_radius_km} km — base rate` : `Estimated transport to ${areaType.replace('_', '-')} site`;
    items.push(
      makeItem('bh_mobilization', 'Transport & Logistics', 'Drilling rig transport to site', 1, 'each', mobilizationCost, {
        optional: true,
        notes: distNote,
      }),
    );
  }
  if (includePumpInstall && systemScope !== 'drilling_only') {
    items.push(makeItem('bh_pump_install', 'Transport & Logistics', 'Pump installation labour', 1, 'each', P.pump_installation, { optional: true }));
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING BOREHOLE
// ═══════════════════════════════════════════════════════════════════════════════

function calculateExistingBoreholeBOQ(answers: Answers): BOQItem[] {
  const isQuick = answers.estimate_mode === 'quick';
  const purpose = (answers.borehole_purpose as string) || 'domestic';
  const areaType = (answers.area_type as string) || 'peri_urban';

  const items: BOQItem[] = [];
  let needsMobilization = false;

  // ── Additional Drilling ─────────────────────────────────────────────────
  if (needsWork(answers, 'additional_drilling')) {
    const extraMetres = parseInt(answers.additional_metres as string) || 20;
    items.push(
      makeItem('ex_drilling', 'Drilling', 'Additional drilling — deepening existing borehole', extraMetres, 'm', P.drilling_per_m),
    );
    // Extra casing for the new section
    const casingPricePerM = isQuick
      ? P.casing_upvc_140_c6
      : resolveCasingPrice(
          (answers.casing_material as string) || 'upvc',
          (answers.casing_class as string) || 'class_6',
          (answers.casing_diameter as string) || '140mm',
        );
    const casingDesc = isQuick
      ? 'PVC casing 140mm (Class 6 — standard)'
      : formatCasingDesc(
          (answers.casing_material as string) || 'upvc',
          (answers.casing_class as string) || 'class_6',
          (answers.casing_diameter as string) || '140mm',
        );
    items.push(
      makeItem('ex_casing_extend', 'Casing', `${casingDesc} — extension`, extraMetres, 'm', casingPricePerM),
    );
    needsMobilization = true;
  }

  // ── Casing Replacement ──────────────────────────────────────────────────
  if (needsWork(answers, 'casing_replacement')) {
    const replaceLength = parseInt(answers.casing_replacement_length as string) || 40;
    const casingMaterial = (answers.casing_material as string) || 'upvc';
    const casingClass = (answers.casing_class as string) || 'class_6';
    const casingDiameter = (answers.casing_diameter as string) || '140mm';
    const casingPricePerM = resolveCasingPrice(casingMaterial, casingClass, casingDiameter);
    const casingDesc = formatCasingDesc(casingMaterial, casingClass, casingDiameter);

    // Old casing removal labour
    items.push(
      makeItem('ex_casing_removal', 'Casing', 'Remove old casing', replaceLength, 'm', 3.0, {
        notes: 'Labour cost for pulling and disposing of old casing',
      }),
    );
    // New casing
    items.push(
      makeItem('ex_casing_new', 'Casing', `${casingDesc} — replacement`, replaceLength, 'm', casingPricePerM),
    );
    // Gravel pack for replacement
    const gravelM3 = +(replaceLength * 0.03).toFixed(1);
    items.push(makeItem('ex_gravel', 'Casing', 'Gravel pack (filter)', gravelM3, 'm³', P.gravel_pack_per_m3));

    needsMobilization = true;
  }

  // ── Pump Replacement ────────────────────────────────────────────────────
  if (needsWork(answers, 'pump_replacement')) {
    const depth = parseInt(answers.existing_borehole_depth as string) || 50;
    const pumpPower = (answers.pump_power_source as string) || 'solar';

    // Pump retrieval (old pump must come out first)
    items.push(
      makeItem('ex_pump_retrieval', 'Pump & Power', 'Retrieve existing pump from borehole', 1, 'each', P.pump_retrieval),
    );

    // New pump
    addPumpItems(items, pumpPower, depth, purpose, 'ex_');

    // Installation labour
    items.push(
      makeItem('ex_pump_install', 'Transport & Logistics', 'Pump installation labour', 1, 'each', P.pump_installation, { optional: true }),
    );

    needsMobilization = true;
  }

  // ── Pump Retrieval Only ─────────────────────────────────────────────────
  if (needsWork(answers, 'pump_retrieval') && !needsWork(answers, 'pump_replacement')) {
    items.push(
      makeItem('ex_pump_retrieval', 'Professional Services', 'Retrieve stuck or failed pump from borehole', 1, 'each', P.pump_retrieval),
    );
    needsMobilization = true;
  }

  // ── Tank Addition ───────────────────────────────────────────────────────
  if (needsWork(answers, 'tank_addition')) {
    const tankCapacity = isQuick
      ? purpose === 'domestic' ? '5000' : '10000'
      : (answers.tank_capacity as string) || '5000';
    const standChoice = isQuick ? 'combo' : (answers.include_tank_stand as string) || 'standard';
    const customHeight = parseInt(answers.tank_stand_height as string) || 4;

    addTankItems(items, tankCapacity, standChoice, customHeight, 'ex_');
  }

  // ── Maintenance / Testing ───────────────────────────────────────────────
  if (needsWork(answers, 'maintenance')) {
    const includeFlushing = isQuick ? true : Boolean(answers.include_flushing ?? true);
    const includeYieldTest = isQuick ? true : Boolean(answers.include_yield_test ?? true);
    const waterQualityLevel = isQuick
      ? purpose === 'commercial' ? 'full' : 'basic'
      : (answers.water_quality_level as string) || 'none';

    if (includeFlushing) {
      items.push(makeItem('ex_flushing', 'Professional Services', 'Borehole flushing & cleaning', 1, 'each', P.borehole_flushing, { optional: true }));
    }
    if (includeYieldTest) {
      items.push(makeItem('ex_yield', 'Professional Services', 'Water yield / capacity test', 1, 'each', P.yield_test, { optional: true }));
    }
    addWaterQualityItems(items, waterQualityLevel, 'ex_');

    if (purpose === 'commercial' && (isQuick || Boolean(answers.include_purification))) {
      items.push(makeItem('ex_purification', 'Water Treatment', 'Water purification system', 1, 'each', P.purification_system, { optional: true }));
    }
  }

  // ── Mobilization (for any work requiring a rig or crew on-site) ─────────
  if (needsMobilization) {
    const mobilizationCost = getMobilizationCost(areaType);
    items.push(
      makeItem('ex_mobilization', 'Transport & Logistics', 'Rig / crew transport to site', 1, 'each', mobilizationCost, {
        optional: true,
        notes: areaType === 'urban' ? `Within ${P.mobilization_free_radius_km} km — base rate` : `Includes estimated transport to ${areaType.replace('_', '-')} site`,
      }),
    );
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK SERVICE (flushing, testing, retrieval only — no drilling)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateQuickServiceBOQ(answers: Answers): BOQItem[] {
  const services = (answers.quick_service_type as string[]) || [];
  const areaType = (answers.area_type as string) || 'peri_urban';
  const items: BOQItem[] = [];

  if (services.includes('flushing')) {
    items.push(makeItem('qs_flushing', 'Professional Services', 'Borehole flushing & cleaning', 1, 'each', P.borehole_flushing));
  }
  if (services.includes('yield_test')) {
    items.push(makeItem('qs_yield', 'Professional Services', 'Water yield / capacity test', 1, 'each', P.yield_test));
  }
  if (services.includes('water_test_basic')) {
    items.push(makeItem('qs_wq_basic', 'Professional Services', 'Water quality test — bacteriological', 1, 'each', P.water_test_bacteriological));
  }
  if (services.includes('water_test_full')) {
    items.push(makeItem('qs_wq_bact', 'Professional Services', 'Water quality test — bacteriological', 1, 'each', P.water_test_bacteriological));
    items.push(makeItem('qs_wq_chem', 'Professional Services', 'Water quality test — chemical analysis', 1, 'each', P.water_test_chemical));
  }
  if (services.includes('pump_retrieval')) {
    items.push(makeItem('qs_retrieval', 'Professional Services', 'Retrieve stuck or failed pump', 1, 'each', P.pump_retrieval));
  }
  if (services.includes('purification')) {
    items.push(makeItem('qs_purification', 'Water Treatment', 'Water purification system', 1, 'each', P.purification_system));
  }

  // Mobilization for on-site services
  if (services.includes('flushing') || services.includes('pump_retrieval')) {
    const mobilizationCost = getMobilizationCost(areaType);
    items.push(
      makeItem('qs_mobilization', 'Transport & Logistics', 'Crew transport to site', 1, 'each', mobilizationCost, {
        optional: true,
        notes: areaType === 'urban' ? `Within ${P.mobilization_free_radius_km} km — base rate` : `Includes transport to ${areaType.replace('_', '-')} site`,
      }),
    );
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET EXPLORER — auto-generate best-fit package within a budget
// ═══════════════════════════════════════════════════════════════════════════════

function calculateBudgetBOQ(answers: Answers): BOQItem[] {
  const budget = parseFloat(answers.budget_amount as string) || 3000;
  const purpose = (answers.borehole_purpose as string) || 'domestic';
  const location = (answers.project_location as string) || 'other';
  const areaType = (answers.area_type as string) || 'peri_urban';
  const locMeta = LOCATION_DEFAULTS[location] || LOCATION_DEFAULTS.other;

  const items: BOQItem[] = [];
  let remaining = budget;

  // ── 1. Mandatory: ZINWA permit ─────────────────────────────────────────
  items.push(makeItem('bg_zinwa', 'Permits & Compliance', 'ZINWA drilling permit (Form GW1)', 1, 'each', P.zinwa_permit_gw1));
  remaining -= P.zinwa_permit_gw1;

  // ── 2. Mandatory: Council fee ──────────────────────────────────────────
  items.push(makeItem('bg_council', 'Permits & Compliance', `Local council approval fee`, 1, 'each', locMeta.councilFee));
  remaining -= locMeta.councilFee;

  // ── 3. Mandatory: Mobilization ─────────────────────────────────────────
  const mobilCost = getMobilizationCost(areaType);
  items.push(makeItem('bg_mobilization', 'Transport & Logistics', 'Drilling rig transport to site', 1, 'each', mobilCost));
  remaining -= mobilCost;

  // ── 4. Mandatory: Site survey ──────────────────────────────────────────
  const surveyKey = `site_survey_${areaType}` as keyof typeof P;
  const surveyCost = (P[surveyKey] as number) || P.site_survey_peri_urban;
  items.push(makeItem('bg_survey', 'Professional Services', 'Site survey', 1, 'each', surveyCost));
  remaining -= surveyCost;

  // ── 5. Drilling — use user-selected depth (default 40m) ─────────────────
  const depth = parseInt(answers.budget_depth as string) || 40;
  const drillingCost = depth * P.drilling_per_m;
  items.push(makeItem('bg_drilling', 'Drilling', 'Borehole drilling', depth, 'm', P.drilling_per_m));
  remaining -= drillingCost;

  // ── 6. Casing — pick best grade that fits ──────────────────────────────
  const casingDiameter = purpose === 'domestic' ? '140mm' : '180mm';
  // Try from premium down
  const casingOptions: Array<{ cls: string; label: string }> = [
    { cls: 'class_10', label: 'Class 10 — premium' },
    { cls: 'class_9', label: 'Class 9 — mid-grade' },
    { cls: 'class_6', label: 'Class 6 — standard' },
  ];
  let chosenCasing = casingOptions[2]; // default to Class 6
  for (const opt of casingOptions) {
    const price = resolveCasingPrice('upvc', opt.cls, casingDiameter);
    if (price * depth <= remaining * 0.3) { // allocate up to 30% remaining for casing
      chosenCasing = opt;
      break;
    }
  }
  const casingPrice = resolveCasingPrice('upvc', chosenCasing.cls, casingDiameter);
  const casingCost = casingPrice * depth;
  items.push(makeItem('bg_casing', 'Casing', `PVC casing ${casingDiameter} (${chosenCasing.label})`, depth, 'm', casingPrice));
  remaining -= casingCost;

  // ── 7. Gravel pack & wellhead ──────────────────────────────────────────
  const gravelM3 = +(depth * 0.03).toFixed(1);
  const gravelCost = gravelM3 * P.gravel_pack_per_m3;
  items.push(makeItem('bg_gravel', 'Casing', 'Gravel pack (filter)', gravelM3, 'm³', P.gravel_pack_per_m3));
  items.push(makeItem('bg_wellhead', 'Wellhead', 'Wellhead assembly & sanitary seal', 1, 'each', P.wellhead_assembly));
  remaining -= gravelCost + P.wellhead_assembly;

  // ── 8. Pump — pick best type within remaining budget ───────────────────
  // Try solar first, then hybrid, then electric, then hand pump
  type PumpOption = { type: string; key: keyof typeof P; desc: string };
  const pumpOptions: PumpOption[] = [];

  const solar = getSolarKit(depth);
  pumpOptions.push({ type: 'solar', key: solar.key, desc: solar.desc });

  const hybrid = getHybridKit(depth);
  pumpOptions.push({ type: 'hybrid', key: hybrid.key, desc: hybrid.desc });

  const electric = getElectricKit(depth);
  pumpOptions.push({ type: 'electric', key: electric.key, desc: electric.desc });

  pumpOptions.push({ type: 'hand', key: 'pump_hand_afridev', desc: 'Afridev hand pump' });

  let pumpChosen: PumpOption | null = null;
  for (const opt of pumpOptions) {
    const cost = P[opt.key] as number;
    if (cost <= remaining * 0.7) { // leave 30% for tank/services
      pumpChosen = opt;
      break;
    }
  }

  if (pumpChosen) {
    const pumpCost = P[pumpChosen.key] as number;
    items.push(makeItem('bg_pump', 'Pump & Power', pumpChosen.desc, 1, pumpChosen.type === 'hand' ? 'each' : 'kit', pumpCost, {
      notes: pumpChosen.type === 'solar' ? 'Includes submersible pump, solar panels, controller, and mounting frame' :
             pumpChosen.type === 'hybrid' ? 'Auto-switches between solar and ZESA grid power' : undefined,
    }));
    remaining -= pumpCost;

    // Rising main (not for hand pumps)
    if (pumpChosen.type !== 'hand') {
      const risingDia = purpose === 'domestic' ? '25mm' : '32mm';
      const risingKey = `rising_hdpe_${risingDia}` as keyof typeof P;
      const risingRate = (P[risingKey] as number) || P.rising_hdpe_32mm;
      const risingCost = (depth + 5) * risingRate;
      items.push(makeItem('bg_rising', 'Pipework', `HDPE rising main — ${risingDia}`, depth + 5, 'm', risingRate));
      remaining -= risingCost;
    }

    // Installation
    items.push(makeItem('bg_pump_install', 'Transport & Logistics', 'Pump installation labour', 1, 'each', P.pump_installation));
    remaining -= P.pump_installation;
  }

  // ── 9. Tank + stand — try combo first, then separate, then skip ────────
  if (remaining > 500) {
    // Try combos first (best value)
    const tankCombos: Array<{ capacity: string; combo: keyof typeof P; label: string }> = [
      { capacity: '10000', combo: 'combo_10000L_4m', label: '10,000L tank + 4m stand (combo)' },
      { capacity: '5000', combo: 'combo_5000L_4m', label: '5,000L tank + 4m stand (combo)' },
    ];

    let tankAdded = false;
    for (const tc of tankCombos) {
      const comboCost = P[tc.combo] as number;
      if (comboCost <= remaining) {
        items.push(makeItem('bg_tank_combo', 'Storage', tc.label, 1, 'set', comboCost, {
          notes: 'Bundled package — discounted vs buying separately',
        }));
        remaining -= comboCost;
        tankAdded = true;
        break;
      }
    }

    // If no combo fits, try separate tank without stand
    if (!tankAdded) {
      const tankOptions: Array<{ capacity: string; key: keyof typeof P; label: string }> = [
        { capacity: '5000', key: 'tank_5000L', label: 'Water tank — 5,000 litres' },
        { capacity: '2500', key: 'tank_2500L', label: 'Water tank — 2,500 litres' },
        { capacity: '2000', key: 'tank_2000L', label: 'Water tank — 2,000 litres' },
      ];
      for (const t of tankOptions) {
        const cost = P[t.key] as number;
        if (cost <= remaining) {
          items.push(makeItem('bg_tank', 'Storage', t.label, 1, 'each', cost));
          remaining -= cost;
          // Try to add a stand
          if (remaining >= P.tank_stand_4m) {
            items.push(makeItem('bg_stand', 'Storage', 'Steel tank stand — 4 m elevated', 1, 'each', P.tank_stand_4m));
            remaining -= P.tank_stand_4m;
          }
          tankAdded = true;
          break;
        }
      }
    }
  }

  // ── 10. Post-drilling services (add what fits) ─────────────────────────
  if (remaining >= P.borehole_flushing) {
    items.push(makeItem('bg_flushing', 'Professional Services', 'Borehole flushing & cleaning', 1, 'each', P.borehole_flushing));
    remaining -= P.borehole_flushing;
  }
  if (remaining >= P.yield_test) {
    items.push(makeItem('bg_yield', 'Professional Services', 'Water yield / capacity test', 1, 'each', P.yield_test));
    remaining -= P.yield_test;
  }
  if (remaining >= P.water_test_bacteriological) {
    items.push(makeItem('bg_wq_basic', 'Professional Services', 'Water quality test — bacteriological', 1, 'each', P.water_test_bacteriological));
    remaining -= P.water_test_bacteriological;
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function resolveCasingPrice(material: string, cls: string, diameter: string): number {
  if (material === 'steel') {
    return diameter === '180mm' ? P.casing_steel_180 : P.casing_steel_140;
  }
  const classKey = cls === 'class_10' ? 'c10' : cls === 'class_9' ? 'c9' : 'c6';
  const diaKey = diameter === '180mm' ? '180' : '140';
  const key = `casing_upvc_${diaKey}_${classKey}` as keyof typeof P;
  return (P[key] as number) ?? P.casing_upvc_140_c6;
}

const CLASS_LABELS: Record<string, string> = {
  class_6: 'Class 6 — standard',
  class_9: 'Class 9 — mid-grade',
  class_10: 'Class 10 — premium',
};

function formatCasingDesc(material: string, cls: string, diameter: string): string {
  if (material === 'steel') return `Steel casing ${diameter}`;
  return `PVC casing ${diameter} (${CLASS_LABELS[cls] || 'Class 6 — standard'})`;
}

function addPumpItems(items: BOQItem[], pumpPower: string, depth: number, purpose: string, prefix = 'bh_'): void {
  if (pumpPower === 'solar') {
    const { key, desc } = getSolarKit(depth);
    items.push(
      makeItem(`${prefix}pump`, 'Pump & Power', desc, 1, 'kit', P[key] as number, {
        notes: `Includes submersible pump, solar panels, controller, and mounting frame. Solar array: ${Math.ceil((P[key] as number) * 0.4)}W+ recommended.`,
      }),
    );
  } else if (pumpPower === 'hybrid') {
    const { key, desc } = getHybridKit(depth);
    items.push(
      makeItem(`${prefix}pump`, 'Pump & Power', desc, 1, 'kit', P[key] as number, {
        notes: 'Auto-switches between solar and ZESA grid power for maximum uptime',
      }),
    );
  } else if (pumpPower === 'electric') {
    const { key, desc } = getElectricKit(depth);
    items.push(
      makeItem(`${prefix}pump`, 'Pump & Power', desc, 1, 'kit', P[key] as number),
    );
    const cableKey: keyof typeof P = depth > 50 ? 'cable_3core_40mm' : 'cable_3core_25mm';
    items.push(
      makeItem(`${prefix}cable`, 'Pump & Power', `Pump cable — ${depth > 50 ? '4.0' : '2.5'} mm² 3-core`, depth + 10, 'm', P[cableKey] as number),
    );
  } else if (pumpPower === 'hand') {
    items.push(
      makeItem(`${prefix}pump`, 'Pump & Power', 'Afridev hand pump', 1, 'each', P.pump_hand_afridev),
    );
  }

  // Rising main (not for hand pumps)
  if (pumpPower !== 'hand') {
    const risingDia = purpose === 'domestic' ? '25mm' : '32mm';
    const risingKey = `rising_hdpe_${risingDia}` as keyof typeof P;
    items.push(
      makeItem(`${prefix}rising`, 'Pipework', `HDPE rising main — ${risingDia}`, depth + 5, 'm', (P[risingKey] as number) || P.rising_hdpe_32mm),
    );
  }
}

function addTankItems(
  items: BOQItem[],
  tankCapacity: string,
  standChoice: string,
  customHeight: number,
  prefix = 'bh_',
): void {
  // ── Combo (bundled) pricing ────────────────────────────────────────────
  if (standChoice === 'combo') {
    // Check for available combo
    const comboKey = tankCapacity === '10000'
      ? 'combo_10000L_4m'
      : tankCapacity === '5000'
        ? 'combo_5000L_4m'
        : null;

    if (comboKey) {
      const comboPrice = P[comboKey as keyof typeof P] as number;
      const standHeight = tankCapacity === '10000' ? 4 : 4;
      items.push(
        makeItem(`${prefix}tank_combo`, 'Storage', `${Number(tankCapacity).toLocaleString()}L tank + ${standHeight}m stand (combo)`, 1, 'set', comboPrice, {
          notes: 'Bundled package — discounted vs buying separately',
        }),
      );
      return;
    }
    // If no combo available for this size, fall through to separate pricing
  }

  // ── Separate pricing ───────────────────────────────────────────────────
  const tankKey = `tank_${tankCapacity}L` as keyof typeof P;
  items.push(
    makeItem(`${prefix}tank`, 'Storage', `Water tank — ${Number(tankCapacity).toLocaleString()} litres`, 1, 'each', (P[tankKey] as number) || P.tank_5000L),
  );
  if (standChoice === 'standard') {
    const height = tankCapacity === '10000' ? 5 : 4;
    const standKey: keyof typeof P = height === 5 ? 'tank_stand_5m' : 'tank_stand_4m';
    items.push(
      makeItem(`${prefix}stand`, 'Storage', `Steel tank stand — ${height} m elevated`, 1, 'each', P[standKey] as number),
    );
  } else if (standChoice === 'custom') {
    const height = customHeight || 4;
    const standCost = height * P.tank_stand_per_m;
    items.push(
      makeItem(`${prefix}stand`, 'Storage', `Steel tank stand — ${height} m elevated (custom)`, 1, 'each', standCost),
    );
  }
}

function addWaterQualityItems(items: BOQItem[], level: string, prefix = 'bh_'): void {
  if (level === 'basic') {
    items.push(makeItem(`${prefix}wq_basic`, 'Professional Services', 'Water quality test — bacteriological', 1, 'each', P.water_test_bacteriological, { optional: true }));
  } else if (level === 'full') {
    items.push(makeItem(`${prefix}wq_bact`, 'Professional Services', 'Water quality test — bacteriological', 1, 'each', P.water_test_bacteriological, { optional: true }));
    items.push(makeItem(`${prefix}wq_chem`, 'Professional Services', 'Water quality test — chemical analysis', 1, 'each', P.water_test_chemical, { optional: true }));
  }
}
