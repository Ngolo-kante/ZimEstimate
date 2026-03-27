// ─── Septic Tank BOQ Calculator ────────────────────────────────────────────────
// Converts wizard answers → BOQItem[] for septic tank construction.
// Extends the wastewater logic from src/lib/calculations/utilities.ts.

import { makeItem, type Answers, type BOQItem } from '../engine/types';
import { SEPTIC_PRICES } from './catalog';

// ─── Volume Formula ───────────────────────────────────────────────────────────
// Standard Zimbabwe sizing: 1500L base + 180L/occupant + 225L/bathroom
// Minimum 1500L, rounded up to nearest 500L.

export function calcSepticVolumeLitres(occupants: number, bathrooms: number): number {
  const raw = 1500 + occupants * 180 + bathrooms * 225;
  return Math.ceil(raw / 500) * 500;
}

// ─── Brick-built BOQ ──────────────────────────────────────────────────────────
// Internal dimensions derived from volume. Aspect ratio 2:1.2:1 (L:W:H).

function brickBuiltBOQ(volumeLitres: number, soakawayType: string): BOQItem[] {
  const volumeM3 = volumeLitres / 1000;

  // Derive internal dimensions: L × 1.2/2×L × H = V → solve for L assuming H=1.2m
  const height = 1.2;
  const width = 1.2;
  const length = volumeM3 / (width * height);

  // Wall area (internal perimeter × height)
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * height;

  // Materials
  const brickCount = Math.ceil(wallArea * 50 * 1.05); // 50 bricks/m², 5% waste
  const cementBags = Math.ceil((brickCount / 50) * 0.8); // ~0.8 bags per m² wall
  const sand = +(wallArea * 0.03).toFixed(2); // 0.03 m³/m²
  const rebarM = Math.ceil(perimeter * 2 * 1.1); // 2 horizontal rings + 10% laps

  // Slab (top cover)
  const slabArea = length * width;
  const slabConcreteM3 = +(slabArea * 0.1).toFixed(2); // 100mm slab

  const items: BOQItem[] = [
    makeItem('sep_bricks',   'Masonry', 'Common clay bricks',          brickCount,    'each', SEPTIC_PRICES.common_brick),
    makeItem('sep_cement',   'Masonry', 'Cement 42.5N (50kg)',         cementBags,    'bag',  SEPTIC_PRICES.cement_425),
    makeItem('sep_sand',     'Masonry', 'River sand',                  sand,          'm³',   SEPTIC_PRICES.river_sand),
    makeItem('sep_rebar',    'Masonry', 'Reinforcement bar Y10',       rebarM,        'm',    SEPTIC_PRICES.rebar_y10),
    makeItem('sep_concrete', 'Concrete','Concrete cover slab (1:2:4)', slabConcreteM3,'m³',   SEPTIC_PRICES.concrete_m3),
    makeItem('sep_damp',     'Concrete','DPC polythene sheeting',      slabArea,      'm²',   SEPTIC_PRICES.damp_proof),
  ];

  return [...items, ...pipeAndSoakawayItems(volumeLitres, soakawayType)];
}

// ─── Precast Rings BOQ ────────────────────────────────────────────────────────
// Each ring is Ø1200mm × 500mm (0.565 m³/ring).

function precastBOQ(volumeLitres: number, soakawayType: string): BOQItem[] {
  const ringVolumeM3 = Math.PI * 0.6 * 0.6 * 0.5; // ~0.565 m³
  const ringCount = Math.ceil(volumeLitres / 1000 / ringVolumeM3) + 1; // +1 for base

  const items: BOQItem[] = [
    makeItem('sep_ring',   'Precast', `Precast concrete ring Ø1200mm×500mm`, ringCount, 'each', SEPTIC_PRICES.precast_ring_1200),
    makeItem('sep_base',   'Precast', 'Precast base slab 1200mm',           1,         'each', SEPTIC_PRICES.precast_base),
    makeItem('sep_cover',  'Precast', 'Precast cover slab 1200mm',          1,         'each', SEPTIC_PRICES.precast_cover),
    makeItem('sep_sand_b', 'Masonry', 'River sand (bedding)',               0.5,       'm³',   SEPTIC_PRICES.river_sand),
    makeItem('sep_cement_b','Masonry','Cement 42.5N (jointing)',            2,         'bag',  SEPTIC_PRICES.cement_425),
  ];

  return [...items, ...pipeAndSoakawayItems(volumeLitres, soakawayType)];
}

// ─── Poly/Fibreglass BOQ ──────────────────────────────────────────────────────

function polyBOQ(volumeLitres: number, soakawayType: string): BOQItem[] {
  // Select closest tank size
  const sizes = [1500, 2500, 3000, 5000];
  const size = sizes.find((s) => s >= volumeLitres) ?? 5000;
  const key = `poly_${size}L` as keyof typeof SEPTIC_PRICES;
  const price = SEPTIC_PRICES[key] ?? 950;

  const items: BOQItem[] = [
    makeItem('sep_tank',    'Tank',    `Poly septic tank ${size}L`,        1,    'each', price),
    makeItem('sep_bedding', 'Site Work','River sand bedding (150mm)',      0.3,  'm³',   SEPTIC_PRICES.river_sand),
  ];

  return [...items, ...pipeAndSoakawayItems(volumeLitres, soakawayType)];
}

// ─── Pipework + Soakaway (shared) ─────────────────────────────────────────────

function pipeAndSoakawayItems(volumeLitres: number, soakawayType: string): BOQItem[] {
  const items: BOQItem[] = [
    makeItem('sep_inlet',   'Pipework', 'uPVC sewer pipe 110mm (inlet)',  3,  'm',    SEPTIC_PRICES.pipe_110mm),
    makeItem('sep_outlet',  'Pipework', 'uPVC sewer pipe 110mm (outlet)', 3,  'm',    SEPTIC_PRICES.pipe_110mm),
    makeItem('sep_tee',     'Pipework', 'uPVC tee 110mm',                 2,  'each', SEPTIC_PRICES.tee_110mm),
    makeItem('sep_manhole', 'Pipework', 'Precast manhole cover 600mm',    1,  'each', SEPTIC_PRICES.manhole_600),
    makeItem('sep_chamber', 'Pipework', 'Inspection chamber 450mm',       1,  'each', SEPTIC_PRICES.inspection_chamber),
  ];

  // Soakaway sizing: 1L septic → ~0.002 m³ soakaway volume (rule of thumb)
  const soakVolumeM3 = Math.ceil(volumeLitres * 0.002);
  const stoneM3 = soakVolumeM3 * 1.2; // 20% extra for compaction voids
  const fabricM2 = soakVolumeM3 * 4;  // wrap all faces

  if (soakawayType === 'french_drain') {
    const runLength = Math.ceil(soakVolumeM3 / 0.3); // 0.3m² cross section per m run
    items.push(
      makeItem('sep_perf',    'Soakaway', 'Perforated uPVC pipe 110mm',   runLength,   'm',   SEPTIC_PRICES.perf_pipe),
      makeItem('sep_stone_s', 'Soakaway', 'Broken stone 19mm',            stoneM3,     'm³',  SEPTIC_PRICES.soakaway_stone),
      makeItem('sep_fabric',  'Soakaway', 'Geotextile fabric 200gsm',     fabricM2,    'm²',  SEPTIC_PRICES.geotextile),
    );
  } else {
    // stone_pit (default)
    items.push(
      makeItem('sep_stone_s', 'Soakaway', 'Broken stone 19mm (soak pit)', stoneM3,     'm³',  SEPTIC_PRICES.soakaway_stone),
      makeItem('sep_fabric',  'Soakaway', 'Geotextile fabric 200gsm',     fabricM2,    'm²',  SEPTIC_PRICES.geotextile),
    );
  }

  // Excavation
  const excavM3 = soakVolumeM3 + 2; // tank excavation approximation
  items.push(makeItem('sep_excav', 'Site Work', 'Excavation (hand)', excavM3, 'm³', SEPTIC_PRICES.excavation));
  items.push(makeItem('sep_backfill','Site Work','Backfill & compaction', excavM3 * 0.6, 'm³', SEPTIC_PRICES.backfill));

  return items;
}

// ─── Optional Cost Items ──────────────────────────────────────────────────────

function optionalItems(answers: Answers): BOQItem[] {
  const items: BOQItem[] = [];
  if (answers.include_machine_excav) {
    items.push(makeItem('sep_tlb', 'Site Work', 'TLB hire (machine excavation)', 4, 'hr', SEPTIC_PRICES.excavation_machine, { optional: true }));
  }
  if (answers.include_transport) {
    items.push(makeItem('sep_transport', 'Site Work', 'Material delivery / transport', 2, 'trip', SEPTIC_PRICES.transport, { optional: true }));
  }
  return items;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function calculateSepticBOQ(answers: Answers): BOQItem[] {
  const method = (answers.construction_method as string) ?? 'brick';
  const soakaway = (answers.soakaway_type as string) ?? 'stone_pit';

  // If user already owns a tank, only generate soakaway + pipework
  const ownsTank = answers.owns_tank === true;

  // Size from dimensions or occupants/bathrooms
  let volumeLitres: number;
  if (answers.tank_size_method === 'custom' && answers.custom_length && answers.custom_width && answers.custom_height) {
    const l = parseFloat(answers.custom_length as string);
    const w = parseFloat(answers.custom_width as string);
    const h = parseFloat(answers.custom_height as string);
    volumeLitres = Math.ceil((l * w * h * 1000) / 500) * 500;
  } else {
    const occupants = parseInt((answers.occupants as string) ?? '5');
    const bathrooms = parseInt((answers.bathrooms as string) ?? '2');
    volumeLitres = calcSepticVolumeLitres(occupants, bathrooms);
  }

  let items: BOQItem[] = [];

  if (ownsTank) {
    // Only soakaway + pipework
    items = pipeAndSoakawayItems(volumeLitres, soakaway);
  } else if (method === 'precast') {
    items = precastBOQ(volumeLitres, soakaway);
  } else if (method === 'poly') {
    items = polyBOQ(volumeLitres, soakaway);
  } else {
    items = brickBuiltBOQ(volumeLitres, soakaway);
  }

  return [...items, ...optionalItems(answers)];
}
