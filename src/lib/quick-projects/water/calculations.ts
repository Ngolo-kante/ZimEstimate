import { makeItem, type Answers, type BOQItem } from '../engine/types';
import { WATER_PRICES } from './catalog';

function selectTankKey(brand: string, sizeLitres: number): string {
  const size = sizeLitres <= 1000 ? 1000 : sizeLitres <= 2500 ? 2500 : sizeLitres <= 5000 ? 5000 : 10000;
  if (brand === 'graniteside') return `granite_${size}`;
  if (brand === 'dal') return `dal_${size}`;
  return `jojo_${size}`; // jojo, cheapest, no_pref, not_sure all default to jojo pricing
}

function selectTankSizeLitres(answers: Answers): number {
  if (answers.tank_size !== 'not_sure') return parseInt(answers.tank_size as string) || 5000;
  const people = parseInt(answers.household_size as string) || 5;
  const usage = (answers.daily_usage as string) || 'moderate';
  const litresPerPersonPerDay = usage === 'high' ? 150 : usage === 'low' ? 80 : 100;
  const storageDays = 3; // 3-day reserve
  const raw = people * litresPerPersonPerDay * storageDays;
  // round to nearest standard size
  if (raw <= 1000) return 1000;
  if (raw <= 2500) return 2500;
  if (raw <= 5000) return 5000;
  return 10000;
}

export function calculateWaterBOQ(answers: Answers): BOQItem[] {
  const scope = (answers.scope as string) || 'tank_only';
  const brand = (answers.tank_brand as string) || 'jojo';
  const sizeLitres = selectTankSizeLitres(answers);
  const standType = (answers.stand_type as string) || 'steel_18';
  const ownsTank = answers.owns_tank === true;
  const ownsStand = answers.owns_stand === true;
  const ownsPump = answers.owns_pump === true;

  const items: BOQItem[] = [];

  // ── Tank ──────────────────────────────────────────────────────────────────
  if (!ownsTank) {
    const tankKey = selectTankKey(brand, sizeLitres);
    const tankPrice = WATER_PRICES[tankKey] ?? WATER_PRICES.jojo_5000;
    const brandLabel = brand === 'jojo' ? 'Jojo' : brand === 'graniteside' ? 'Graniteside' : brand === 'dal' ? 'Dal Tank' : 'Poly';
    items.push(makeItem('water_tank', 'Tank', `${brandLabel} poly tank ${sizeLitres}L`, 1, 'each', tankPrice, { owned: ownsTank }));
  } else {
    items.push(makeItem('water_tank', 'Tank', `Poly water tank (owned)`, 1, 'each', 0, { owned: true }));
  }

  // ── Stand ─────────────────────────────────────────────────────────────────
  const standKey = standType === 'brick' ? 'stand_brick' : standType === 'concrete' ? 'stand_concrete' : `stand_steel_${(answers.stand_height as string || '18').replace('.', '')}`;
  const standPrice = WATER_PRICES[standKey as string] ?? WATER_PRICES.stand_steel_18;
  items.push(makeItem('water_stand', 'Stand', `Tank stand (${standType.replace('_', ' ')})`, 1, 'each', standPrice, { owned: ownsStand }));

  // ── Float valve + connections ─────────────────────────────────────────────
  items.push(makeItem('water_float',    'Pipework', 'Float valve 32mm (tank inlet)', 1, 'each', WATER_PRICES.float_valve_32));
  items.push(makeItem('water_ball1',    'Pipework', 'Ball valve 32mm (outlet)',       1, 'each', WATER_PRICES.ball_valve_32));
  items.push(makeItem('water_connect',  'Pipework', 'Tank connector galvanised',      2, 'each', WATER_PRICES.gal_nipple));
  items.push(makeItem('water_overflow', 'Pipework', 'Overflow pipe 50mm (3m)',        3, 'm',    WATER_PRICES.overflow_pipe));

  // ── Borehole pump + rising main ───────────────────────────────────────────
  if (scope === 'tank_pump' || scope === 'tank_pump_mains') {
    const pumpDepth = parseInt(answers.borehole_depth as string) || 40;
    const pumpType = (answers.pump_type as string) || 'submersible';
    const pumpKey = pumpType === 'surface' ? 'pump_surface' : pumpDepth > 30 ? 'pump_sub_15' : 'pump_sub_075';
    const pipeKey = pumpDepth > 30 ? 'hdpe_32' : 'hdpe_25';
    const cableKey = pumpDepth > 30 ? 'cable_40' : 'cable_25';

    items.push(makeItem('water_pump',     'Pump', `${pumpType === 'surface' ? 'Surface' : 'Submersible'} pump`, 1, 'each', WATER_PRICES[pumpKey], { owned: ownsPump }));
    items.push(makeItem('water_ptank',    'Pump', 'Pressure tank 24L',              1, 'each', WATER_PRICES.pressure_tank));
    items.push(makeItem('water_rising',   'Pipework', `HDPE rising main ${pipeKey.includes('32') ? '32' : '25'}mm`, pumpDepth + 5, 'm', WATER_PRICES[pipeKey]));
    items.push(makeItem('water_cable',    'Electrical', `3-core pump cable ${cableKey.includes('40') ? '4' : '2.5'}mm²`, pumpDepth + 10, 'm', WATER_PRICES[cableKey]));
    items.push(makeItem('water_ball2',    'Pipework', 'Ball valve 32mm (pump outlet)',1, 'each', WATER_PRICES.ball_valve_32));
  }

  // ── Municipal connection ──────────────────────────────────────────────────
  if (scope === 'tank_mains' || scope === 'tank_pump_mains') {
    const pipeRun = parseInt(answers.mains_pipe_run as string) || 5;
    items.push(makeItem('water_mains_pipe', 'Pipework', 'uPVC pressure pipe 25mm (mains)', pipeRun, 'm', WATER_PRICES.upvc_25));
    items.push(makeItem('water_mains_ball', 'Pipework', 'Ball valve 25mm (mains inlet)',   1, 'each', WATER_PRICES.ball_valve_25));
  }

  // ── Optional ─────────────────────────────────────────────────────────────
  if (answers.include_transport) {
    items.push(makeItem('water_transport', 'Site Work', 'Material delivery / transport', 1, 'trip', WATER_PRICES.transport, { optional: true }));
  }
  if (answers.include_trench) {
    const trenchLen = parseInt(answers.trench_length as string) || 20;
    items.push(makeItem('water_trench', 'Site Work', 'Pipe trench excavation', trenchLen, 'm', WATER_PRICES.trench_m, { optional: true }));
  }

  return items;
}
