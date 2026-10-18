// ─── Borehole Drilling Price Catalog — Zimbabwe Market, October 2026 ────────
// Drilling and solar pumps updated 2026-10-18 from the owner's figures and
// drillers' published offers: Harare 40 m packages advertised at $750, $850,
// $890, $950 and $1,000 (Sona Solar, Borehole Experts, social media adverts),
// extra metres at $25–35 (most often $28), double casing $25–28/m; Sona Solar
// solar borehole packages, September 2026.
// Earlier sources: DrillCorp, Halsteds, LAMASAT, ZINWA tariff guide, Mutare
// Boreholes, Arete World, Gokwe South RDC, Masvingo & Insiza by-laws, Nakiso
// Borehole Drilling, TSG Projects, HYBSUN Solar Pump, Sizabantu Piping.

export const BOREHOLE_PRICES = {
  // ── Drilling — sold as a package, then by the metre ──────────────────────
  // Drillers quote the first 40 m as one price ($700–1,000 in Harare) that
  // includes 18–20 m of casing, the gravel pack and seal, their professional
  // fees and getting the rig to a Harare site. Beyond 40 m they charge per
  // metre drilled, and extra casing per metre on top.
  drilling_package_40m: 850.0,       // middle of the $700–1,000 range
  drilling_package_depth_m: 40,
  drilling_package_casing_m: 20,     // 140 mm Class 6 PVC
  extra_drilling_per_m: 28.0,        // beyond 40 m

  // ── Casing beyond the package (per metre, supplied and installed) ────────
  // PVC — 140 mm
  casing_upvc_140_c6: 9.0,           // Class 6 — standard residential ($9 or more)
  casing_upvc_140_c9: 13.0,          // Class 9 — mid-grade (estimate)
  casing_upvc_140_c10: 17.0,         // Class 10 — premium / deep (estimate)
  // PVC — 180 mm (estimates)
  casing_upvc_180_c6: 15.0,          // Class 6 — higher yield
  casing_upvc_180_c9: 19.0,          // Class 9 — mid-grade higher yield
  casing_upvc_180_c10: 23.0,         // Class 10 — premium
  // Steel casing (estimates)
  casing_steel_140: 20.0,
  casing_steel_180: 28.0,
  // Double casing for sandy or collapsing ground, over the top section
  double_casing_per_m: 28.0,
  double_casing_default_m: 10,

  // ── Transport ─────────────────────────────────────────────────────────────
  // Included in the package in Harare. Elsewhere drillers usually charge
  // $100–200 more, mostly for moving the rig.
  transport_outside_harare: 150.0,
  transport_outside_harare_low: 100,
  transport_outside_harare_high: 200,

  // ── Gravel & Wellhead ─────────────────────────────────────────────────────
  gravel_pack_per_m3: 35.0,
  wellhead_assembly: 95.0,

  // ── Pumps — unit only ─────────────────────────────────────────────────────
  pump_sub_055kw: 180.0,             // submersible 0.55 kW (up to 30 m)
  pump_sub_075kw: 250.0,             // submersible 0.75 kW (up to 60 m)
  pump_sub_15kw: 380.0,              // submersible 1.5 kW  (up to 100 m)
  pump_hand_afridev: 320.0,          // Afridev hand pump

  // ── Solar Pump Packages (pump + panels + controller + pipes, cable, rope ─
  // and installation; the tank and stand are priced separately). Sona Solar's
  // September 2026 packages with a 5,000 L tank on a stand were $1,800 (0.75
  // HP), $2,000 (1 HP), $2,200 (1.5 HP) and $2,400 (2 HP); less the ~$950 tank
  // and stand, these. 0.5 HP and 3 HP are estimates on the same steps.
  // Depth matrix (TSG Projects): 0.75HP→50m, 1HP→100m, 1.5HP→100m+, 2HP→120m, 3HP→160m
  solar_kit_05hp: 750.0,             // ≤ 30 m depth
  solar_kit_075hp: 850.0,            // 30–50 m
  solar_kit_1hp: 1000.0,             // 50–100 m
  solar_kit_15hp: 1200.0,            // 80–100 m (high yield)
  solar_kit_2hp: 1400.0,             // 100–120 m
  solar_kit_3hp: 1900.0,             // 120–160 m (deep / commercial)

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

/* Which locations are priced as urban for the site survey. Shared by the
   explorer and the link preview so the two price a site the same way. */
const URBAN_BOREHOLE_LOCATIONS = ['harare', 'bulawayo', 'chitungwiza'];
export const boreholeAreaType = (location: string): 'urban' | 'peri_urban' =>
  URBAN_BOREHOLE_LOCATIONS.includes(location) ? 'urban' : 'peri_urban';

/* Where the drilling package includes getting the rig to site. Chitungwiza is
   served by the same Harare drillers without a transport charge. */
const HARARE_AREA = ['harare', 'chitungwiza'];
export const inHarareArea = (location: string): boolean => HARARE_AREA.includes(location);
