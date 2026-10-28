/**
 * Prices checked against live Zimbabwe supplier listings, with their sources.
 *
 * Checked 2026-10-11 by reading the suppliers' own online stores:
 *   - ZBMS (zbms.co.zw) — its public WooCommerce product API
 *   - Union Hardware (unionhardware.co.zw) — its WooCommerce product API
 *   - Halsted Builders Express (halsteds.co.zw, Msasa) — its product search API
 *
 * The prices these replace were dated January–February 2026 and had drifted a
 * long way: timber was charged at about three times the shelf price, rebar
 * and brickforce at roughly 1.5–2x, an 8-way DB board at nearly four times,
 * and every branded cement had no price at all.
 *
 * Method: where two or more suppliers list the same item at the same size,
 * the median is used; one source is used where it is the only listing whose
 * size matches exactly. A price is only taken when the listing states a unit
 * that matches the catalogue's (a 6 m bar, a 20 m roll, a 50 kg bag), or the
 * conversion is a plain length or area scaling, which is noted. Items with no
 * unit-matched listing are deliberately absent and keep their older price —
 * see UNVERIFIED_NOTES below for which, and why.
 *
 * Bulk vs retail: bricks are priced at the bulk delivered rate (ZBMS, $0.11)
 * rather than a single brick off a hardware shelf (Halsteds, $0.25), because
 * builders buy them by the thousand.
 */

export const VERIFIED_PRICES_CHECKED_ON = '2026-10-11';
export const VERIFIED_SUPPLIER_ID = 'sup-market-check-2026-10';

export interface PriceSource {
  supplier: 'ZBMS' | 'Union Hardware' | 'Halsteds';
  listing: string;
  priceUsd: number;
}

export interface VerifiedPrice {
  materialId: string;
  priceUsd: number;
  /** How priceUsd was reached from the sources. */
  method: string;
  sources: PriceSource[];
  /**
   * The listings are a different size from the catalogue unit (a 3.6 m sheet
   * for a 3 m price, a 500 g pack for a per-kg price), so their prices cannot
   * be compared with priceUsd directly — only the converted priceUsd can.
   */
  sourcesInOtherUnits?: true;
}

export const VERIFIED_PRICES: VerifiedPrice[] = [
  // ── Bricks ──────────────────────────────────────────────────────────────
  { materialId: 'brick-common', priceUsd: 0.11, method: 'bulk delivered rate', sources: [
    { supplier: 'ZBMS', listing: 'Red solid common / Blue Heart common brick', priceUsd: 0.11 },
    { supplier: 'Halsteds', listing: 'Brick Common Single (retail, one brick)', priceUsd: 0.25 },
  ] },
  { materialId: 'farm-brick', priceUsd: 0.07, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Semi hard burn brick', priceUsd: 0.07 },
  ] },

  // ── Cement (per bag; ZBMS lists them as "bag", the standard 50 kg) ───────
  { materialId: 'cement-325', priceUsd: 11.8, method: 'median of 32.5-grade Portland bags', sources: [
    { supplier: 'ZBMS', listing: 'Portland Diamond', priceUsd: 11.5 },
    { supplier: 'ZBMS', listing: 'Portland Midlands', priceUsd: 11.5 },
    { supplier: 'ZBMS', listing: 'PC15 Khaya', priceUsd: 11.8 },
    { supplier: 'ZBMS', listing: 'PC15', priceUsd: 12.3 },
    { supplier: 'ZBMS', listing: 'PPC Unicem 32.5R', priceUsd: 12.5 },
  ] },
  { materialId: 'cement-425', priceUsd: 13.8, method: 'median of 42.5R bags', sources: [
    { supplier: 'ZBMS', listing: 'PPC Surebuild 42.5R', priceUsd: 13.8 },
    { supplier: 'ZBMS', listing: 'Khayah SupaSet 42.5R', priceUsd: 13.8 },
    { supplier: 'ZBMS', listing: 'Sino-Zimbabwe Sinoma 42.5R', priceUsd: 13.8 },
  ] },
  { materialId: 'cement-ppc-unicem-325r', priceUsd: 12.5, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Unicem (PPC 32.5R)', priceUsd: 12.5 },
  ] },
  { materialId: 'cement-ppc-surebuild-425r', priceUsd: 13.8, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Surebuild', priceUsd: 13.8 },
  ] },
  { materialId: 'cement-khayah-portland', priceUsd: 11.8, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'PC15 Khaya', priceUsd: 11.8 },
  ] },
  { materialId: 'cement-khayah-supaset-425r', priceUsd: 13.8, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Supaset', priceUsd: 13.8 },
  ] },
  { materialId: 'cement-sino-portland-composite-325r', priceUsd: 12.0, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Premium Midlands (Sino-Zimbabwe)', priceUsd: 12.0 },
  ] },
  { materialId: 'cement-sino-mc-225', priceUsd: 11.5, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Masonry Midlands (Sino-Zimbabwe)', priceUsd: 11.5 },
  ] },
  { materialId: 'cement-sino-sinoma-high-strength-425r', priceUsd: 13.8, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'Sinoma', priceUsd: 13.8 },
  ] },

  // ── Steel (per 6 m bar unless stated) ───────────────────────────────────
  { materialId: 'rebar-10', priceUsd: 3.76, method: 'median of three', sources: [
    { supplier: 'ZBMS', listing: 'Y10 deformed bar', priceUsd: 3.08 },
    { supplier: 'Union Hardware', listing: '10mm deformed bars 6m', priceUsd: 3.76 },
    { supplier: 'Halsteds', listing: 'Deformed Bar 10mm x 6M', priceUsd: 5.06 },
  ] },
  { materialId: 'rebar-12', priceUsd: 4.88, method: 'mean of two', sources: [
    { supplier: 'ZBMS', listing: 'Y12 deformed bar', priceUsd: 4.5 },
    { supplier: 'Union Hardware', listing: '12mm deformed bar 6m', priceUsd: 5.26 },
  ] },
  { materialId: 'rebar-16', priceUsd: 9.34, method: 'median of three', sources: [
    { supplier: 'ZBMS', listing: 'Y16 deformed bar', priceUsd: 7.5 },
    { supplier: 'Union Hardware', listing: '16mm deformed bar 6m', priceUsd: 9.34 },
    { supplier: 'Halsteds', listing: 'Deformed Bar 16mm x 6M', priceUsd: 9.93 },
  ] },
  { materialId: 'mesh-ref193', priceUsd: 39.21, method: 'median of three (6 m x 2.4 m sheet)', sources: [
    { supplier: 'ZBMS', listing: 'S193 6m by 2.4m', priceUsd: 30 },
    { supplier: 'Union Hardware', listing: 'Reinforced mesh wire S193', priceUsd: 39.21 },
    { supplier: 'Halsteds', listing: 'Builders Mesh 2.4 x 6M BM193', priceUsd: 40.58 },
  ] },
  { materialId: 'bindwire', priceUsd: 7.28, method: 'per kg, from a 500 g pack', sourcesInOtherUnits: true, sources: [
    { supplier: 'Halsteds', listing: 'Starline galv binding wire 1.60mm x 500g', priceUsd: 3.64 },
  ] },
  { materialId: 'brickforce', priceUsd: 1.88, method: 'median, per 20 m roll', sources: [
    { supplier: 'ZBMS', listing: 'Brickforce 230 (9 inch wall)', priceUsd: 1.7 },
    { supplier: 'ZBMS', listing: 'Brickforce 115mm (4.5 inch)', priceUsd: 1.8 },
    { supplier: 'Halsteds', listing: 'Brickforce 115mm x 20m 1.8mm', priceUsd: 1.95 },
    { supplier: 'Halsteds', listing: 'Brickforce 230mm x 20m 1.8mm', priceUsd: 1.98 },
  ] },

  // ── Roofing ─────────────────────────────────────────────────────────────
  { materialId: 'ibr-04-3m', priceUsd: 15.62, method: '3.6 m sheet scaled to 3 m', sourcesInOtherUnits: true, sources: [
    { supplier: 'Halsteds', listing: 'IBR Galvanised 0.40mm x 686mm x 3.6m', priceUsd: 18.75 },
  ] },
  { materialId: 'gutter-pvc', priceUsd: 18.95, method: 'single source (6 m half-round)', sources: [
    { supplier: 'Union Hardware', listing: 'Gutter PVC 0.5 round 6M', priceUsd: 18.95 },
  ] },

  // ── Timber (per 6 m length) ─────────────────────────────────────────────
  { materialId: 'timber-50x76', priceUsd: 9.0, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: '76mm by 50mm by 6m', priceUsd: 9.0 },
  ] },
  // Truss sizes builders use (BOQ audit against real builds, 2026-10-28);
  // ZBMS store prices read that day.
  { materialId: 'timber-152x38', priceUsd: 17.0, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: '152 by 38 by 6m |Beam', priceUsd: 17.0 },
  ] },
  { materialId: 'timber-114x38', priceUsd: 13.0, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: '114 by 38 by 6m |Wallplate| Roof Timber', priceUsd: 13.0 },
  ] },
  { materialId: 'timber-38x38', priceUsd: 4.8, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: '38 by 38 by 6m (brandering)', priceUsd: 4.8 },
  ] },
  { materialId: 'timber-50x228', priceUsd: 31.0, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: '228mm by 50mm by 6m', priceUsd: 31.0 },
  ] },

  // ── Electrical ──────────────────────────────────────────────────────────
  { materialId: 'db-8way', priceUsd: 17.35, method: 'median of three 8-way boards', sources: [
    { supplier: 'Halsteds', listing: 'Himel dist board plastic surface 8 ways', priceUsd: 11.19 },
    { supplier: 'Halsteds', listing: 'Himel dist board steel flush 8 ways', priceUsd: 17.35 },
    { supplier: 'Halsteds', listing: 'Himel dist board steel surface 8 ways', priceUsd: 18.81 },
  ] },
  { materialId: 'conduit-20', priceUsd: 1.75, method: 'single source (19 mm x 4 m)', sources: [
    { supplier: 'Union Hardware', listing: '19mm conduit white 4M', priceUsd: 1.75 },
  ] },

  // ── Plumbing ────────────────────────────────────────────────────────────
  { materialId: 'pipe-110-pvc', priceUsd: 22.0, method: 'above-ground 110 mm x 6 m', sources: [
    { supplier: 'ZBMS', listing: '110mm x 6m SL420 A/G', priceUsd: 22.0 },
    { supplier: 'ZBMS', listing: '110mm x 6m UL420 U/G', priceUsd: 25.0 },
  ] },
  { materialId: 'pipe-15-copper', priceUsd: 28.9, method: 'single source (15 mm x 5.5 m)', sources: [
    { supplier: 'Union Hardware', listing: 'Copper pipe 5.5M standard (class 0) 15mm', priceUsd: 28.9 },
  ] },
  { materialId: 'geyser-150', priceUsd: 480.07, method: 'single source', sources: [
    { supplier: 'Union Hardware', listing: 'Kwikot 150L pressure geyser', priceUsd: 480.07 },
  ] },
  { materialId: 'water-tank-50000l', priceUsd: 1650, method: 'single source', sources: [
    { supplier: 'ZBMS', listing: 'MTA05 50 000lt mesh tank', priceUsd: 1650 },
  ] },

  // ── Finishes ────────────────────────────────────────────────────────────
  { materialId: 'paint-pva', priceUsd: 38.01, method: 'median of contractor/standard 20 L', sources: [
    { supplier: 'Halsteds', listing: 'Dune Contractors PVA White 20L', priceUsd: 29.98 },
    { supplier: 'Halsteds', listing: 'Berger Master Econocoat PVA 20L', priceUsd: 38.01 },
    { supplier: 'Halsteds', listing: 'Berger Master Nukote PVA 20L', priceUsd: 57.95 },
  ] },
  { materialId: 'paint-acrylic', priceUsd: 99.0, method: 'single source (20 L)', sources: [
    { supplier: 'ZBMS', listing: '20l Astra Acrylic Paint', priceUsd: 99.0 },
  ] },
  { materialId: 'tiles-floor-ceramic', priceUsd: 9.25, method: 'per m², from a 1.44 m² box', sourcesInOtherUnits: true, sources: [
    { supplier: 'Halsteds', listing: 'Tile floor glazed 600x600 1.44m²', priceUsd: 13.32 },
  ] },
  { materialId: 'tile-adhesive', priceUsd: 4.51, method: 'median of four 20 kg ceramic adhesives', sources: [
    { supplier: 'Halsteds', listing: 'Solid ceramic tile adhesive 20kg', priceUsd: 4.1 },
    { supplier: 'Union Hardware', listing: 'Khayah Superfix ceramic adhesive 20kg', priceUsd: 4.4 },
    { supplier: 'Halsteds', listing: 'Supafix ceramic tile adhesive 20kg', priceUsd: 4.61 },
    { supplier: 'Halsteds', listing: 'Tylon ceramic S tile adhesive 20kg', priceUsd: 5.05 },
  ] },
  { materialId: 'grout', priceUsd: 7.29, method: 'median of seven 5 kg grouts', sources: [
    { supplier: 'Halsteds', listing: 'Solid tile grout grey 5kg', priceUsd: 4.79 },
    { supplier: 'Halsteds', listing: 'Solid tile grout white 5kg', priceUsd: 4.8 },
    { supplier: 'Halsteds', listing: 'Tylon tile grout light grey 5kg', priceUsd: 5.3 },
    { supplier: 'Halsteds', listing: 'Tylon tile grout white 5kg', priceUsd: 7.29 },
    { supplier: 'Halsteds', listing: 'Tylon tile grout mid/dark brown 5kg', priceUsd: 7.37 },
    { supplier: 'Halsteds', listing: 'Tylon tile grout dove grey 5kg', priceUsd: 7.72 },
    { supplier: 'Halsteds', listing: 'Tylon tile grout ivory 5kg', priceUsd: 9.04 },
  ] },
  { materialId: 'ceiling-board', priceUsd: 7.06, method: 'per m², from a 3.6 m² board', sourcesInOtherUnits: true, sources: [
    { supplier: 'Halsteds', listing: 'Nutec ceiling tap board 1.2m x 3.0m x 4mm', priceUsd: 25.41 },
  ] },
  { materialId: 'cornice', priceUsd: 6.25, method: 'mean, scaled to a 4 m length', sourcesInOtherUnits: true, sources: [
    { supplier: 'Halsteds', listing: 'Cornice 76x19 3.0M', priceUsd: 4.09 },
    { supplier: 'Halsteds', listing: 'Rhino cornice 3.6M', priceUsd: 6.34 },
  ] },
  { materialId: 'dpc', priceUsd: 2.01, method: 'median, per 115 mm x 20 m roll', sources: [
    { supplier: 'Union Hardware', listing: 'DPC 1-ply 115mm', priceUsd: 1.55 },
    { supplier: 'Halsteds', listing: 'DPC Bitroid 115mm x 20M', priceUsd: 1.92 },
    { supplier: 'ZBMS', listing: 'DPC 115mm (4.5 inch)', priceUsd: 2.1 },
    { supplier: 'Union Hardware', listing: 'DPC blue 2-ply 115mm', priceUsd: 2.4 },
  ] },
  { materialId: 'dpm', priceUsd: 37.56, method: 'mean, 250 micron scaled to a 30 m roll', sourcesInOtherUnits: true, sources: [
    { supplier: 'ZBMS', listing: '250mic by 100m by 2.4m', priceUsd: 100 },
    { supplier: 'Halsteds', listing: 'Poly sheeting 250mc 2.4m x 100m', priceUsd: 150.38 },
  ] },

  // ── Hardware ────────────────────────────────────────────────────────────
  { materialId: 'nails-75', priceUsd: 2.09, method: 'single source (per kg)', sources: [
    { supplier: 'Halsteds', listing: 'Wire nails 75mm 1kg', priceUsd: 2.09 },
  ] },
  { materialId: 'nails-100', priceUsd: 2.06, method: 'single source (per kg)', sources: [
    { supplier: 'Halsteds', listing: 'Wire nails 100mm 1kg', priceUsd: 2.06 },
  ] },
  { materialId: 'screws-roof', priceUsd: 9.89, method: 'median of 75 mm packs of 100', sources: [
    { supplier: 'Halsteds', listing: 'Safe Top roofing screws 75mm azure blue 100s', priceUsd: 8.26 },
    { supplier: 'Halsteds', listing: 'Safe Top roofing screws 75mm dark dolphin P100', priceUsd: 8.86 },
    { supplier: 'Halsteds', listing: 'Safe Top roofing screws 75mm grey 100s', priceUsd: 9.89 },
    { supplier: 'Halsteds', listing: 'Safe Top roofing screws 75mm charcoal P100', priceUsd: 9.89 },
    { supplier: 'Halsteds', listing: 'Safe Top roofing screws 75mm traffic green P100', priceUsd: 9.89 },
  ] },
  { materialId: 'hinges-door', priceUsd: 4.05, method: 'mean of two 100 mm pairs', sources: [
    { supplier: 'Halsteds', listing: 'Safe Top butt hinge 100mm pair', priceUsd: 3.29 },
    { supplier: 'Halsteds', listing: 'Fixit butt hinge 100mm pair', priceUsd: 4.8 },
  ] },
  { materialId: 'lock-mortice', priceUsd: 15.31, method: 'median of four 3-lever locks', sources: [
    { supplier: 'Halsteds', listing: 'Yale lockset 3 lever CP blister', priceUsd: 10.81 },
    { supplier: 'Halsteds', listing: 'Cobalt lockset 3 lever', priceUsd: 12.0 },
    { supplier: 'Halsteds', listing: 'Yale sash lock 3 lever', priceUsd: 18.61 },
    { supplier: 'Halsteds', listing: 'Yale lockset 3 lever CP blister (DY4972495)', priceUsd: 21.98 },
  ] },
];

/**
 * What was looked for and not changed, so nobody mistakes an old price for a
 * checked one. Shown to no one yet; kept for whoever next updates prices.
 */
export const UNVERIFIED_NOTES: Record<string, string> = {
  'sand-river': 'ZBMS lists washed river sand at $10 tagged "cubic" — unit not confirmed and no second source (Classifieds is behind a bot check). Kept at $18.',
  'sand-pit': 'ZBMS lists pit sand at $6 tagged "cubic" — same doubt. Kept.',
  'stone-19mm': 'ZBMS lists 19 mm stone at $18 — unit not stated. Kept at $22.',
  hardcore: 'No listing with a stated unit. Kept.',
  'cable-25': 'Halsteds sells 2.5 mm flat twin & earth per metre ($1.98); no 100 m roll price found. Kept at $85/roll.',
  'block-6inch': 'No hollow block listed online by these suppliers. Kept.',
  'block-8inch': 'No hollow block listed online by these suppliers. Kept.',
  'cement-dangote-portland-325r': 'ZBMS lists "Dangote" at $14.50 without a grade. Not assigned.',
  'cement-dangote-portland-425n': 'ZBMS lists "Dangote" at $14.50 without a grade. Not assigned.',
  'cement-khayah-watershield': 'ZBMS lists WaterShield at $60 with no bag size — implausible for 50 kg, left unpriced.',
  'fascia-pvc': 'Only fibre-cement fascia (225 mm x 3.6 m) found; the catalogue item is 150 mm PVC. Kept.',
  'paving-brick': 'Halsteds lists 400x400 slab pavers, not interlocking paving bricks. Kept.',
  'termite-poison': 'Listings are concentrates of unclear strength (Warthog 5 L at $4.91). Kept.',
  labour: 'Builder, assistant and foreman day rates, food and transport cannot be read from a shop. Kept; need local quotes.',
};

/** A verified price, if one exists, in the shape the rest of the app uses. */
export function getVerifiedPrice(materialId: string) {
  const verified = VERIFIED_PRICES.find((entry) => entry.materialId === materialId);
  if (!verified) return undefined;
  return {
    materialId,
    supplierId: VERIFIED_SUPPLIER_ID,
    priceUsd: verified.priceUsd,
    // Same rate the rest of the static catalogue uses, so USD and ZWG stay
    // consistent with each other across the app.
    priceZwg: Number((verified.priceUsd * 30).toFixed(2)),
    lastUpdated: VERIFIED_PRICES_CHECKED_ON,
    inStock: true,
  };
}
