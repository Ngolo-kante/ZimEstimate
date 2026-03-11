// ─── Septic Tank Materials Catalog ────────────────────────────────────────────
// Hardcoded USD prices (Zimbabwe market, Q1 2026).
// Overridden at runtime by Supabase weekly_prices where available.

export interface SepticMaterial {
  key: string;
  description: string;
  unit: string;
  priceUsd: number;
  category: string;
}

export const SEPTIC_CATALOG: SepticMaterial[] = [
  // ── Brickwork ──────────────────────────────────────────────────────────────
  { key: 'common_brick',      description: 'Common clay bricks',         unit: 'each',  priceUsd: 0.12,  category: 'Masonry' },
  { key: 'cement_425',        description: 'Cement 42.5N (50kg bag)',     unit: 'bag',   priceUsd: 9.50,  category: 'Masonry' },
  { key: 'river_sand',        description: 'River sand',                  unit: 'm³',    priceUsd: 18.00, category: 'Masonry' },
  { key: 'rebar_y10',         description: 'Reinforcement bar Y10',       unit: 'm',     priceUsd: 1.20,  category: 'Masonry' },

  // ── Precast rings ──────────────────────────────────────────────────────────
  { key: 'precast_ring_1200', description: 'Precast concrete ring Ø1200mm×500mm', unit: 'each', priceUsd: 45.00, category: 'Precast' },
  { key: 'precast_cover',     description: 'Precast cover slab 1200mm',   unit: 'each',  priceUsd: 35.00, category: 'Precast' },
  { key: 'precast_base',      description: 'Precast base slab 1200mm',    unit: 'each',  priceUsd: 40.00, category: 'Precast' },

  // ── Poly / fiberglass ──────────────────────────────────────────────────────
  { key: 'poly_1500L',        description: 'Poly septic tank 1500L',      unit: 'each',  priceUsd: 380.00, category: 'Tank' },
  { key: 'poly_2500L',        description: 'Poly septic tank 2500L',      unit: 'each',  priceUsd: 550.00, category: 'Tank' },
  { key: 'poly_3000L',        description: 'Poly septic tank 3000L',      unit: 'each',  priceUsd: 650.00, category: 'Tank' },
  { key: 'poly_5000L',        description: 'Poly septic tank 5000L',      unit: 'each',  priceUsd: 950.00, category: 'Tank' },

  // ── Concrete (slab / strip foundation) ────────────────────────────────────
  { key: 'concrete_m3',       description: 'Ready-mix concrete (or site-mixed 1:2:4)', unit: 'm³', priceUsd: 85.00, category: 'Concrete' },
  { key: 'damp_proof',        description: 'DPC / polythene sheeting',    unit: 'm²',    priceUsd: 0.80,  category: 'Concrete' },

  // ── Pipework ───────────────────────────────────────────────────────────────
  { key: 'pipe_110mm',        description: 'uPVC sewer pipe 110mm',       unit: 'm',     priceUsd: 4.50,  category: 'Pipework' },
  { key: 'pipe_160mm',        description: 'uPVC sewer pipe 160mm',       unit: 'm',     priceUsd: 7.00,  category: 'Pipework' },
  { key: 'tee_110mm',         description: 'uPVC tee 110mm',              unit: 'each',  priceUsd: 3.50,  category: 'Pipework' },
  { key: 'elbow_110mm',       description: 'uPVC elbow 45° 110mm',        unit: 'each',  priceUsd: 2.80,  category: 'Pipework' },
  { key: 'manhole_600',       description: 'Precast manhole cover 600mm', unit: 'each',  priceUsd: 45.00, category: 'Pipework' },
  { key: 'inspection_chamber',description: 'Inspection chamber 450mm',    unit: 'each',  priceUsd: 55.00, category: 'Pipework' },

  // ── Soakaway ───────────────────────────────────────────────────────────────
  { key: 'soakaway_stone',    description: 'Broken stone 19mm (soakaway)', unit: 'm³',   priceUsd: 35.00, category: 'Soakaway' },
  { key: 'geotextile',        description: 'Geotextile fabric 200gsm',    unit: 'm²',    priceUsd: 1.20,  category: 'Soakaway' },
  { key: 'perf_pipe',         description: 'Perforated uPVC 110mm',       unit: 'm',     priceUsd: 3.80,  category: 'Soakaway' },

  // ── Excavation & plant hire ────────────────────────────────────────────────
  { key: 'excavation',        description: 'Excavation (by hand)',        unit: 'm³',    priceUsd: 8.00,  category: 'Site Work' },
  { key: 'excavation_machine',description: 'Machine excavation (TLB hire)',unit: 'hr',   priceUsd: 65.00, category: 'Site Work' },
  { key: 'backfill',          description: 'Backfill and compaction',     unit: 'm³',    priceUsd: 5.00,  category: 'Site Work' },
  { key: 'transport',         description: 'Material transport / delivery',unit: 'trip',  priceUsd: 80.00, category: 'Site Work' },
];

/** Look up a catalog item by key. Returns undefined if not found. */
export function getSepticMaterial(key: string): SepticMaterial | undefined {
  return SEPTIC_CATALOG.find((m) => m.key === key);
}

/** Build a price map for quick lookups: key → priceUsd */
export const SEPTIC_PRICES: Record<string, number> = Object.fromEntries(
  SEPTIC_CATALOG.map((m) => [m.key, m.priceUsd])
);
