import { getBestPrice } from '@/lib/materials';
import type {
  SolarAppliance,
  SolarDailyUsage,
  SolarRoofType,
  SolarSystemType,
  WaterSource,
  PumpType,
  SanitationType,
  SepticTankType,
  SoakawayType,
  RainwaterGutterType,
  GreywaterSource,
  GreywaterUse,
} from '@/lib/database.types';
import type { GeneratedBOQItem } from '@/lib/vision/types';

export interface SolarSizingInput {
  bedrooms: number;
  appliances: SolarAppliance[];
  dailyUsage: SolarDailyUsage;
  systemType: SolarSystemType;
  roofType?: SolarRoofType | null;
}

export interface SolarSizingOutput {
  panelCount: number;
  panelWattage: number;
  inverterKva: number;
  batteryKwh: number;
  dcCableMeters: number;
  acCableMeters: number;
}

export interface WaterSizingInput {
  source: WaterSource;
  boreholeExists: boolean;
  boreholeDepth?: number;
  pumpType?: PumpType | null;
  tankCount: number;
  tankSize: number;
  tankStandRequired: boolean;
}

export interface WastewaterSizingInput {
  sanitationType: SanitationType;
  bathroomCount: number;
  occupantCount: number;
  tankType: SepticTankType;
  soakawayType: SoakawayType;
}

export interface RainwaterSizingInput {
  roofAreaM2: number;
  gutterType: RainwaterGutterType;
  tankSizeLitres: number;
  firstFlush: boolean;
  sandFilter: boolean;
}

export interface GreywaterSizingInput {
  sources: GreywaterSource[];
  use: GreywaterUse;
}

type MaterialPrice = { usd: number; zwg: number };

const DEFAULT_PRICES: MaterialPrice = { usd: 0, zwg: 0 };

const getMaterialPrice = (materialId: string): MaterialPrice => {
  const price = getBestPrice(materialId);
  if (!price) return DEFAULT_PRICES;
  return { usd: price.priceUsd, zwg: price.priceZwg };
};

const createBoqItem = (
  materialId: string,
  materialName: string,
  quantity: number,
  unit: string,
  calculationNote: string
): GeneratedBOQItem => {
  const prices = getMaterialPrice(materialId);
  const roundedQty = Math.ceil(quantity);
  return {
    id: `${materialId}-${Math.random().toString(36).slice(2, 9)}`,
    materialId,
    materialName,
    category: 'utilities',
    quantity: roundedQty,
    unit,
    unitPriceUsd: prices.usd,
    unitPriceZwg: prices.zwg,
    totalUsd: roundedQty * prices.usd,
    totalZwg: roundedQty * prices.zwg,
    calculationNote,
    isEdited: false,
  };
};

export function sizeSolarSystem(input: SolarSizingInput): SolarSizingOutput {
  const base = {
    essential: { panels: 4, inverter: 3, battery: 5 },
    moderate: { panels: 8, inverter: 5, battery: 10 },
    full: { panels: 10, inverter: 8, battery: 15 },
  }[input.dailyUsage];

  let panelCount = base.panels;
  let inverterKva = base.inverter;
  let batteryKwh = base.battery;

  if (input.systemType === 'hybrid') {
    inverterKva += 1;
  }

  if (input.appliances.includes('geyser')) {
    panelCount += 2;
    batteryKwh += 5;
  }

  if (input.appliances.includes('borehole_pump')) {
    panelCount += 2;
    batteryKwh += 5;
    inverterKva += 1;
  }

  if (input.appliances.includes('stove')) {
    inverterKva += 2;
  }

  const panelWattage = panelCount >= 10 ? 550 : 450;
  const dcCableMeters = Math.max(10, panelCount * 3);
  const acCableMeters = 20;

  return {
    panelCount,
    panelWattage,
    inverterKva,
    batteryKwh,
    dcCableMeters,
    acCableMeters,
  };
}

export function calculateSolarSystem(input: SolarSizingInput): GeneratedBOQItem[] {
  const sizing = sizeSolarSystem(input);
  const items: GeneratedBOQItem[] = [];

  const panelId = sizing.panelWattage >= 550 ? 'solar-panel-550w' : 'solar-panel-450w';
  const panelName = sizing.panelWattage >= 550 ? 'Solar Panel 550W' : 'Solar Panel 450W';

  const inverterId = sizing.inverterKva >= 8 ? 'solar-inverter-8kva' : sizing.inverterKva >= 5 ? 'solar-inverter-5kva' : 'solar-inverter-3kva';
  const inverterName = sizing.inverterKva >= 8 ? 'Hybrid Inverter 8kVA' : sizing.inverterKva >= 5 ? 'Hybrid Inverter 5kVA' : 'Hybrid Inverter 3kVA';

  const batteryId = sizing.batteryKwh >= 10 ? 'solar-battery-10kwh' : 'solar-battery-5kwh';
  const batteryName = sizing.batteryKwh >= 10 ? 'Lithium Battery 10kWh' : 'Lithium Battery 5kWh';
  const batteryUnits = Math.max(1, Math.ceil(sizing.batteryKwh / (sizing.batteryKwh >= 10 ? 10 : 5)));

  items.push(
    createBoqItem(panelId, panelName, sizing.panelCount, 'each', `${sizing.panelCount} panels @ ${sizing.panelWattage}W`)
  );
  items.push(
    createBoqItem(inverterId, inverterName, 1, 'each', `${sizing.inverterKva}kVA system`)
  );
  items.push(
    createBoqItem(batteryId, batteryName, batteryUnits, 'each', `${sizing.batteryKwh}kWh storage`)
  );

  items.push(createBoqItem('solar-mounting-roof', 'Roof Mounting Kit', 1, 'set', 'Roof-mounted array'));
  items.push(createBoqItem('solar-cable-dc-6mm', 'DC Cable 6mm2', sizing.dcCableMeters, 'per meter', 'PV array DC runs'));
  items.push(createBoqItem('solar-cable-ac', 'AC Cable 4mm2', sizing.acCableMeters, 'per meter', 'Inverter AC output'));
  items.push(createBoqItem('solar-combiner-box', 'Combiner Box', 1, 'each', 'String combiner'));
  items.push(createBoqItem('solar-isolator-dc', 'DC Isolator', 1, 'each', 'DC safety isolator'));
  items.push(createBoqItem('solar-isolator-ac', 'AC Isolator', 1, 'each', 'AC safety isolator'));
  items.push(createBoqItem('solar-surge-protector', 'Surge Protector', 1, 'each', 'Solar surge protection'));
  items.push(createBoqItem('solar-earthing-kit', 'Earthing Kit', 1, 'set', 'PV earthing set'));

  return items;
}

export function calculateWaterSupply(input: WaterSizingInput): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  const depth = input.boreholeDepth && input.boreholeDepth > 0 ? input.boreholeDepth : 40;

  if (input.source === 'borehole' || input.source === 'borehole_tanks') {
    if (!input.boreholeExists) {
      items.push(createBoqItem('borehole-drilling', 'Borehole Drilling', depth, 'per meter', `Drill depth ${depth}m`));
      items.push(createBoqItem('borehole-casing-110', 'Borehole Casing 110mm', depth, 'per meter', `Casing depth ${depth}m`));
      items.push(createBoqItem('borehole-gravel-pack', 'Gravel Pack', Math.ceil(depth / 6), 'per bag', 'Filter gravel'));
    }

    const pumpId =
      input.pumpType === 'surface'
        ? 'pump-surface-05hp'
        : depth > 50
          ? 'pump-submersible-1hp'
          : 'pump-submersible-05hp';
    const pumpName =
      input.pumpType === 'surface'
        ? 'Surface Pump 0.5HP'
        : depth > 50
          ? 'Submersible Pump 1HP'
          : 'Submersible Pump 0.5HP';

    items.push(createBoqItem(pumpId, pumpName, 1, 'each', 'Borehole pump'));
    items.push(createBoqItem('pump-control-box', 'Pump Control Box', 1, 'each', 'Pump controls'));
    items.push(createBoqItem('pipe-rising-32mm', 'Rising Main 32mm', depth, 'per meter', `Rising main ${depth}m`));
    items.push(createBoqItem('float-valve-25mm', 'Float Valve 25mm', 1, 'each', 'Tank float valve'));
  }

  if (input.tankCount > 0) {
    const tankId =
      input.tankSize >= 10000
        ? 'tank-jojo-10000'
        : input.tankSize >= 5000
          ? 'tank-jojo-5000'
          : 'tank-jojo-2500';
    const tankName =
      input.tankSize >= 10000
        ? 'Water Tank 10,000L'
        : input.tankSize >= 5000
          ? 'Water Tank 5,000L'
          : 'Water Tank 2,500L';
    items.push(createBoqItem(tankId, tankName, input.tankCount, 'each', `${input.tankCount} tank(s)`));

    if (input.tankStandRequired) {
      items.push(createBoqItem('tank-stand-brick', 'Tank Stand (Brick)', input.tankCount, 'each', 'Tank stand'));
    }
  }

  return items;
}

export function calculateWastewater(input: WastewaterSizingInput): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];

  if (input.sanitationType !== 'septic') return items;

  const bathrooms = Math.max(1, input.bathroomCount || 0);
  const occupants = Math.max(1, input.occupantCount || 0);
  const septicLitres = 1500 + (180 * occupants) + (225 * bathrooms);
  const septicId = input.tankType === 'precast' ? 'septic-tank-precast' : 'septic-tank-brick';
  const septicName = input.tankType === 'precast' ? 'Septic Tank (Precast)' : 'Septic Tank (Brick-built)';

  items.push(createBoqItem(septicId, septicName, 1, 'each', `${septicLitres}L required`));
  items.push(createBoqItem('septic-inlet-pipe', 'Septic Inlet Pipe 110mm', 6, 'per meter', 'Inlet pipe run'));
  items.push(createBoqItem('septic-outlet-pipe', 'Septic Outlet Pipe 110mm', 6, 'per meter', 'Outlet pipe run'));
  items.push(createBoqItem('inspection-chamber', 'Inspection Chamber', 1, 'each', 'Inspection chamber'));

  const soakawayVolume = occupants * 0.5;
  items.push(createBoqItem('soakaway-excavation', 'Soakaway Excavation', soakawayVolume, 'per m3', `${soakawayVolume.toFixed(1)}m3`));
  items.push(createBoqItem('soakaway-stone', 'Soakaway Stone', soakawayVolume, 'per m3', `${soakawayVolume.toFixed(1)}m3`));
  items.push(createBoqItem('backfill-compaction', 'Backfilling & Compaction', soakawayVolume, 'per m3', `${soakawayVolume.toFixed(1)}m3`));

  return items;
}

export function calculateRainwaterHarvesting(input: RainwaterSizingInput): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  if (!input.roofAreaM2 || input.roofAreaM2 <= 0) return items;

  const side = Math.sqrt(input.roofAreaM2);
  const perimeter = side * 4;
  const gutterRuns = Math.ceil(perimeter / 6);
  const downpipeCount = Math.max(1, Math.ceil(input.roofAreaM2 / 50));

  const gutterId = input.gutterType === 'galvanised' ? 'gutter-galv-110' : 'gutter-pvc-110';
  const gutterName = input.gutterType === 'galvanised' ? 'Galvanized Gutter 110mm' : 'PVC Gutter 110mm';
  const downpipeId = input.gutterType === 'galvanised' ? 'downpipe-galv-80' : 'downpipe-pvc-80';
  const downpipeName = input.gutterType === 'galvanised' ? 'Galvanized Downpipe 80mm' : 'PVC Downpipe 80mm';

  items.push(createBoqItem(gutterId, gutterName, gutterRuns, 'per 6m', `Perimeter ${perimeter.toFixed(1)}m`));
  items.push(createBoqItem(downpipeId, downpipeName, downpipeCount, 'per 6m', `${downpipeCount} downpipes`));
  items.push(createBoqItem('leaf-guard', 'Gutter Leaf Guard', Math.ceil(perimeter), 'per meter', 'Leaf guard'));
  items.push(createBoqItem('rainwater-tank-base', 'Tank Base Slab', 1, 'each', 'Tank base'));

  if (input.tankSizeLitres > 0) {
    const tankId =
      input.tankSizeLitres >= 10000
        ? 'tank-jojo-10000'
        : input.tankSizeLitres >= 5000
          ? 'tank-jojo-5000'
          : 'tank-jojo-2500';
    const tankName =
      input.tankSizeLitres >= 10000
        ? 'Water Tank 10,000L'
        : input.tankSizeLitres >= 5000
          ? 'Water Tank 5,000L'
          : 'Water Tank 2,500L';
    items.push(createBoqItem(tankId, tankName, 1, 'each', `${input.tankSizeLitres}L storage`));
  }

  if (input.firstFlush) {
    items.push(createBoqItem('first-flush-diverter', 'First Flush Diverter', 1, 'each', 'First flush diverter'));
  }
  if (input.sandFilter) {
    items.push(createBoqItem('sand-filter-unit', 'Sand Filter Unit', 1, 'each', 'Sand filter'));
  }

  return items;
}

export function calculateGreywater(input: GreywaterSizingInput): GeneratedBOQItem[] {
  const items: GeneratedBOQItem[] = [];
  if (!input.sources || input.sources.length === 0) return items;

  const drumCount = Math.max(1, Math.ceil(input.sources.length / 2));
  const irrigationMeters = Math.max(10, input.sources.length * 10);

  items.push(createBoqItem('greywater-diverter', 'Diverter Valve 3-Way', 1, 'each', 'Greywater diversion'));
  items.push(createBoqItem('greywater-filter', 'Greywater Filter Unit', 1, 'each', 'Greywater filtration'));
  items.push(createBoqItem('greywater-drum-200', 'Storage Drum 200L', drumCount, 'each', `${drumCount} drum(s)`));
  items.push(createBoqItem('greywater-pump-small', 'Transfer Pump (Small)', 1, 'each', 'Transfer pump'));

  if (input.use === 'garden') {
    items.push(createBoqItem('irrigation-pipe-25mm', 'Irrigation Pipe 25mm', irrigationMeters, 'per meter', 'Garden irrigation'));
  }

  return items;
}
