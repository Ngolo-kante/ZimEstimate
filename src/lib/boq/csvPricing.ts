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
  cement_50kg: 7.5,
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
  roofing_ibr_0_4: 11.8,
  roof_truss_timber: 4.5,
  roof_purlins: 3.2,
  gutters_pvc: 6.2,
};

const MATERIAL_TO_CSV_PRICE: Record<string, { key: string; multiplier?: number }> = {
  'cement-325': { key: 'cement_50kg' },
  'cement-425': { key: 'cement_50kg' },
  'sand-river': { key: 'river_sand' },
  'sand-pit': { key: 'pit_sand' },
  'sand-bricks': { key: 'pit_sand' },
  'stone-19mm': { key: '19mm_stone' },
  hardcore: { key: 'hardcore_fill' },
  'brick-common': { key: 'common_bricks' },
  'farm-brick': { key: 'common_bricks_hardburn' },
  'brick-face-red': { key: 'facebrick_red_rustic' },
  'block-6inch': { key: 'concrete_blocks_6' },
  'block-8inch': { key: 'concrete_blocks_9' },
  'rebar-10': { key: 'y10_rebar' },
  'rebar-12': { key: 'y12_rebar' },
  'rebar-16': { key: 'y16_rebar' },
  'mesh-ref193': { key: 'reinforcement_mesh_a193' },
  'mesh-ref-193': { key: 'reinforcement_mesh_a193' },
  'ibr-04-3m': { key: 'roofing_ibr_0_4' },
  'ibr-05-3m': { key: 'roofing_ibr_0_4' },
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
