// ─── Water Tank Materials Catalog ─────────────────────────────────────────────
export interface WaterMaterial {
  key: string;
  description: string;
  unit: string;
  priceUsd: number;
  category: string;
}

export const WATER_CATALOG: WaterMaterial[] = [
  // ── Tanks ──────────────────────────────────────────────────────────────────
  { key: 'jojo_1000',    description: 'Jojo poly tank 1000L',             unit: 'each', priceUsd: 120.00, category: 'Tank' },
  { key: 'jojo_2500',    description: 'Jojo poly tank 2500L',             unit: 'each', priceUsd: 250.00, category: 'Tank' },
  { key: 'jojo_5000',    description: 'Jojo poly tank 5000L',             unit: 'each', priceUsd: 420.00, category: 'Tank' },
  { key: 'jojo_10000',   description: 'Jojo poly tank 10000L',            unit: 'each', priceUsd: 750.00, category: 'Tank' },
  { key: 'granite_2500', description: 'Graniteside poly tank 2500L',      unit: 'each', priceUsd: 230.00, category: 'Tank' },
  { key: 'granite_5000', description: 'Graniteside poly tank 5000L',      unit: 'each', priceUsd: 390.00, category: 'Tank' },
  { key: 'dal_2500',     description: 'Dal Tank poly 2500L',              unit: 'each', priceUsd: 220.00, category: 'Tank' },
  { key: 'dal_5000',     description: 'Dal Tank poly 5000L',              unit: 'each', priceUsd: 380.00, category: 'Tank' },
  // ── Stands ─────────────────────────────────────────────────────────────────
  { key: 'stand_steel_12', description: 'Steel tank stand 1.2m',          unit: 'each', priceUsd: 130.00, category: 'Stand' },
  { key: 'stand_steel_18', description: 'Steel tank stand 1.8m',          unit: 'each', priceUsd: 180.00, category: 'Stand' },
  { key: 'stand_steel_24', description: 'Steel tank stand 2.4m',          unit: 'each', priceUsd: 250.00, category: 'Stand' },
  { key: 'stand_brick',    description: 'Brick plinth (materials)',        unit: 'each', priceUsd: 95.00,  category: 'Stand' },
  { key: 'stand_concrete', description: 'Concrete plinth slab',           unit: 'each', priceUsd: 120.00, category: 'Stand' },
  // ── Pumps ──────────────────────────────────────────────────────────────────
  { key: 'pump_sub_075',   description: 'Submersible pump 0.75kW',        unit: 'each', priceUsd: 250.00, category: 'Pump' },
  { key: 'pump_sub_15',    description: 'Submersible pump 1.5kW',         unit: 'each', priceUsd: 380.00, category: 'Pump' },
  { key: 'pump_surface',   description: 'Surface centrifugal pump 0.75kW',unit: 'each', priceUsd: 180.00, category: 'Pump' },
  { key: 'pressure_tank',  description: 'Pressure tank 24L',             unit: 'each', priceUsd: 65.00,  category: 'Pump' },
  // ── Pipework ───────────────────────────────────────────────────────────────
  { key: 'hdpe_25',        description: 'HDPE rising main 25mm',          unit: 'm',    priceUsd: 2.80,   category: 'Pipework' },
  { key: 'hdpe_32',        description: 'HDPE rising main 32mm',          unit: 'm',    priceUsd: 3.50,   category: 'Pipework' },
  { key: 'upvc_25',        description: 'uPVC pressure pipe 25mm',        unit: 'm',    priceUsd: 2.20,   category: 'Pipework' },
  { key: 'float_valve_32', description: 'Float valve 32mm (tank)',        unit: 'each', priceUsd: 15.00,  category: 'Pipework' },
  { key: 'ball_valve_32',  description: 'Ball valve 32mm',                unit: 'each', priceUsd: 12.00,  category: 'Pipework' },
  { key: 'ball_valve_25',  description: 'Ball valve 25mm',                unit: 'each', priceUsd: 9.00,   category: 'Pipework' },
  { key: 'gal_nipple',     description: 'Tank connector galvanised',      unit: 'each', priceUsd: 4.50,   category: 'Pipework' },
  { key: 'overflow_pipe',  description: 'Overflow pipe 50mm uPVC',        unit: 'm',    priceUsd: 3.80,   category: 'Pipework' },
  // ── Electrical ─────────────────────────────────────────────────────────────
  { key: 'cable_25',       description: '3-core cable 2.5mm² (pump)',     unit: 'm',    priceUsd: 1.60,   category: 'Electrical' },
  { key: 'cable_40',       description: '3-core cable 4mm² (pump)',       unit: 'm',    priceUsd: 2.40,   category: 'Electrical' },
  // ── Site Work ──────────────────────────────────────────────────────────────
  { key: 'trench_m',       description: 'Pipe trench excavation (hand)',  unit: 'm',    priceUsd: 4.00,   category: 'Site Work' },
  { key: 'transport',      description: 'Material delivery / transport',  unit: 'trip', priceUsd: 80.00,  category: 'Site Work' },
];

export const WATER_PRICES: Record<string, number> = Object.fromEntries(
  WATER_CATALOG.map((m) => [m.key, m.priceUsd])
);
