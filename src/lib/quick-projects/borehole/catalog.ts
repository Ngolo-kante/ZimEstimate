// ─── Borehole Drilling Price Catalog — Zimbabwe Market Q1 2026 ─────────────
// Sources: Sona Solar, Borehole Experts Zim, DrillCorp, Halsteds, LAMASAT,
//          ZINWA tariff guide, Mutare Boreholes, Arete World, Gokwe South RDC,
//          Masvingo & Insiza by-laws, Nakiso Borehole Drilling, TSG Projects,
//          HYBSUN Solar Pump, Sizabantu Piping, strategic analysis.

export const BOREHOLE_PRICES = {
  // ── Drilling ──────────────────────────────────────────────────────────────
  drilling_per_m: 30.0,              // standard rate (all-in)
  mud_drilling_per_m: 90.0,          // bentonite mud drilling — sandy / unstable soil

  // ── Casing (per metre installed) ──────────────────────────────────────────
  // PVC — 140 mm
  casing_upvc_140_c6: 5.80,          // Class 6 — standard residential (~$35/6m)
  casing_upvc_140_c9: 7.00,          // Class 9 — mid-grade durability
  casing_upvc_140_c10: 7.60,         // Class 10 — premium / deep (~$46/6m)
  // PVC — 180 mm
  casing_upvc_180_c6: 10.00,         // Class 6 — higher yield (~$60/6m)
  casing_upvc_180_c9: 11.00,         // Class 9 — mid-grade higher yield
  casing_upvc_180_c10: 12.00,        // Class 10 — premium (~$72/6m)
  // Steel casing
  casing_steel_140: 14.0,
  casing_steel_180: 22.0,
  // Double-casing surcharge (top 6–20 m for sandy soil)
  double_casing_per_m: 25.0,

  // ── Gravel & Wellhead ─────────────────────────────────────────────────────
  gravel_pack_per_m3: 35.0,
  wellhead_assembly: 95.0,

  // ── Pumps — unit only ─────────────────────────────────────────────────────
  pump_sub_055kw: 180.0,             // submersible 0.55 kW (up to 30 m)
  pump_sub_075kw: 250.0,             // submersible 0.75 kW (up to 60 m)
  pump_sub_15kw: 380.0,              // submersible 1.5 kW  (up to 100 m)
  pump_hand_afridev: 320.0,          // Afridev hand pump

  // ── Solar Pump Kits (pump + panels + controller + frame) ─────────────────
  // Depth matrix (TSG Projects): 0.75HP→50m, 1HP→100m, 1.5HP→100m+, 2HP→120m, 3HP→160m
  solar_kit_05hp: 1500.0,            // ≤ 30 m depth
  solar_kit_075hp: 1600.0,           // 30–50 m
  solar_kit_1hp: 1700.0,             // 50–100 m
  solar_kit_15hp: 2100.0,            // 80–100 m (high yield)
  solar_kit_2hp: 2800.0,             // 100–120 m
  solar_kit_3hp: 3500.0,             // 120–160 m (deep / commercial)

  // ── Hybrid Pump Kits (AC/DC VSD — auto-switches between solar & grid) ────
  hybrid_kit_1hp: 1850.0,            // 1HP hybrid AC/DC VSD (Nakiso)
  hybrid_kit_15hp: 2400.0,           // 1.5HP hybrid (estimated)
  hybrid_kit_2hp: 3200.0,            // 2HP hybrid (estimated)

  // ── Electric Pump Packages ────────────────────────────────────────────────
  electric_kit_075hp: 750.0,         // 0.75 HP submersible + cable (≤50m)
  electric_kit_1hp: 950.0,           // 1 HP submersible + cable (50–100m)
  electric_kit_2hp: 1400.0,          // 2 HP submersible + cable (100–120m)
  electric_kit_3hp: 1800.0,          // 3 HP submersible + cable (120m+)

  // ── Rising Main (per metre) ───────────────────────────────────────────────
  rising_hdpe_25mm: 2.8,             // domestic
  rising_hdpe_32mm: 3.5,             // farm / commercial

  // ── Pump Cable (per metre) ────────────────────────────────────────────────
  cable_3core_25mm: 1.6,             // 2.5 mm² — shallow
  cable_3core_40mm: 2.4,             // 4.0 mm² — deep (> 50 m)

  // ── Storage Tanks ─────────────────────────────────────────────────────────
  tank_2000L: 300.0,
  tank_2500L: 400.0,
  tank_5000L: 700.0,
  tank_10000L: 1200.0,
  // Steel stands (fixed height)
  tank_stand_4m: 500.0,              // 4 m elevated steel stand
  tank_stand_5m: 750.0,              // 5 m elevated steel stand
  // Per-metre stand pricing for custom heights
  tank_stand_per_m: 125.0,           // ~$125/m for custom stand height

  // ── Tank + Stand Combos (bundled packages — industry standard pricing) ────
  combo_5000L_4m: 1000.0,            // DrillCorp, Mutare, Sona Solar
  combo_5000L_3m: 1100.0,            // Nakiso
  combo_10000L_4m: 2500.0,           // Nakiso

  // ── Site Security ─────────────────────────────────────────────────────────
  antitheft_brackets: 1.0,           // per bracket (Sona Solar) — solar panel securing
  security_cage_estimate: 350.0,     // custom cage for pump/inverter/battery protection

  // ── Site Survey ───────────────────────────────────────────────────────────
  site_survey_urban: 70.0,
  site_survey_peri_urban: 120.0,
  site_survey_rural: 200.0,

  // ── Post-Drilling Services ────────────────────────────────────────────────
  borehole_flushing: 250.0,
  yield_test: 250.0,
  pump_retrieval: 200.0,
  water_test_bacteriological: 25.0,
  water_test_chemical: 55.0,
  purification_system: 450.0,

  // ── Labour ────────────────────────────────────────────────────────────────
  pump_installation: 150.0,

  // ── Permits & Compliance ──────────────────────────────────────────────────
  zinwa_permit_gw1: 60.0,
  council_fee_average: 50.0,

  // ── Mobilization ──────────────────────────────────────────────────────────
  mobilization_base: 250.0,          // within free radius of depot
  mobilization_free_radius_km: 20,   // free radius (Nakiso=30km, Gokwe=50km, avg=20km)
  mobilization_per_km: 3.0,          // per km beyond free radius (avg $2.50–$3.00)
} as const;

// ── Location metadata ───────────────────────────────────────────────────────

export const LOCATION_DEFAULTS: Record<string, { depth: number; councilFee: number }> = {
  harare:      { depth: 50,  councilFee: 50 },
  bulawayo:    { depth: 65,  councilFee: 44 },
  chitungwiza: { depth: 45,  councilFee: 50 },
  mutare:      { depth: 50,  councilFee: 50 },
  gweru:       { depth: 60,  councilFee: 50 },
  masvingo:    { depth: 55,  councilFee: 360 },
  kwekwe:      { depth: 55,  councilFee: 50 },
  kadoma:      { depth: 55,  councilFee: 50 },
  chinhoyi:    { depth: 50,  councilFee: 50 },
  marondera:   { depth: 50,  councilFee: 50 },
  other:       { depth: 60,  councilFee: 50 },
};
