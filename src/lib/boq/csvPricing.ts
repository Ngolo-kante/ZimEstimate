export type CsvDerivedPrice = {
  materialId: string;
  supplierId: string;
  priceUsd: number;
  priceZwg: number;
  lastUpdated: string;
  inStock: boolean;
};

const CSV_PRICE_LAST_UPDATED = '2026-02-18';
const CSV_SUPPLIER_ID = 'sup-csv-baseline';
const DEFAULT_ZWG_PER_USD = 30;

const CSV_PRICE_USD_BY_KEY: Record<string, number> = {
  // Cement rose ~42% through late 2025/early 2026 (US$12 -> ~US$17 spot).
  // Branded 50kg listings: Khayah 32.5R $11.29, Khayah SupaSet 42.5R $13.35.
  // Was 7.50, which understated every foundation, mortar and plaster line.
  cement_50kg: 11.29,
  cement_50kg_425: 13.35,
  river_sand: 18,
  pit_sand: 16,
  plaster_sand: 20,
  '19mm_stone': 22,
  hardcore_fill: 18,
  common_bricks: 0.12,
  common_bricks_hardburn: 0.13,
  facebrick_red_rustic: 0.22,
  concrete_blocks_6: 1.35,
  concrete_blocks_9: 1.65,
  y10_rebar: 6.1,
  y12_rebar: 8.5,
  y16_rebar: 12.8,
  reinforcement_mesh_a193: 38,
  // Zimbabwe quotes IBR per linear metre: 0.4mm ~$5.00/m, 0.5mm ~$6.50/m.
  // These keys are per 3m sheet, matching how the BOQ counts them, so the rate
  // is multiplied by the 3m length. The old single key was $11.80 tagged 'm2'
  // and served both gauges, pricing 0.5mm as though it were 0.4mm.
  roofing_ibr_0_4_sheet_3m: 15.0,
  roofing_ibr_0_5_sheet_3m: 19.5,
  roof_truss_timber: 4.5,
  roof_purlins: 3.2,
  gutters_pvc: 6.2,
};

const MATERIAL_TO_CSV_PRICE: Record<string, { key: string; multiplier?: number }> = {
  'cement-325': { key: 'cement_50kg' },
  'cement-425': { key: 'cement_50kg_425' },
  'sand-river': { key: 'river_sand' },
  'sand-pit': { key: 'pit_sand' },
  'sand-bricks': { key: 'pit_sand' },
  'stone-19mm': { key: '19mm_stone' },
  hardcore: { key: 'hardcore_fill' },
  'brick-common': { key: 'common_bricks' },
  'farm-brick': { key: 'common_bricks_hardburn' },
  // The x1000 multiplier that used to be here made the marketplace listing
  // agree with a 'per 1000' unit, but the BOQ generator counts individual
  // bricks and labels them 'each' — so every face-brick wall was costed at
  // $220 per brick. The material is now per-brick throughout and the CSV rate
  // is already per brick, so no conversion belongs here.
  'brick-face-red': { key: 'facebrick_red_rustic' },
  'block-6inch': { key: 'concrete_blocks_6' },
  'block-8inch': { key: 'concrete_blocks_9' },
  'rebar-10': { key: 'y10_rebar' },
  'rebar-12': { key: 'y12_rebar' },
  'rebar-16': { key: 'y16_rebar' },
  'mesh-ref193': { key: 'reinforcement_mesh_a193' },
  'mesh-ref-193': { key: 'reinforcement_mesh_a193' },
  'ibr-04-3m': { key: 'roofing_ibr_0_4_sheet_3m' },
  'ibr-05-3m': { key: 'roofing_ibr_0_5_sheet_3m' },
  'timber-50x76': { key: 'roof_truss_timber', multiplier: 6 },
  'timber-38x38': { key: 'roof_purlins', multiplier: 6 },
  'fascia-pvc': { key: 'gutters_pvc', multiplier: 6 },
};

export function getCsvDerivedPrice(materialId: string): CsvDerivedPrice | undefined {
  const mapping = MATERIAL_TO_CSV_PRICE[materialId];
  if (!mapping) return undefined;

  const basePriceUsd = CSV_PRICE_USD_BY_KEY[mapping.key];
  if (!Number.isFinite(basePriceUsd)) return undefined;

  const multiplier = mapping.multiplier ?? 1;
  const priceUsd = Number((basePriceUsd * multiplier).toFixed(2));

  return {
    materialId,
    supplierId: CSV_SUPPLIER_ID,
    priceUsd,
    priceZwg: Number((priceUsd * DEFAULT_ZWG_PER_USD).toFixed(2)),
    lastUpdated: CSV_PRICE_LAST_UPDATED,
    inStock: true,
  };
}
