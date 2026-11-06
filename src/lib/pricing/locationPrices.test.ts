import { describe, expect, it } from 'vitest';
import { applyLocationPrices, locationPrice } from './locationPrices';
import { generateBOQFromBasics, type ManualBuilderConfig } from '@/lib/calculations';
import { brickFromParam, defaultBrickFor } from '@/lib/estimators/houseBudgetOptions';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';

const house = (overrides: Partial<ManualBuilderConfig> = {}) => generateBOQFromBasics({
  floorArea: 120, roomCount: 7, wallHeight: 2.7, brickTypes: ['common'], cementTypes: ['cement_325'],
  scope: 'full_house', includeLabor: false, locationType: 'urban', ...overrides,
} as ManualBuilderConfig);
const line = (items: ReturnType<typeof house>, id: string) => items.find((item) => item.materialId === id);

describe('delivered prices outside the cities', () => {
  it('prices sand, stone and cement at rural delivered rates', () => {
    expect(locationPrice('sand-river', 'rural')?.priceUsd).toBe(60);
    expect(locationPrice('sand-river', 'urban')).toBeUndefined();
    expect(locationPrice('sand-river', 'peri-urban')).toBeUndefined();
    expect(locationPrice('farm-brick', 'peri-urban')?.priceUsd).toBe(0.045);
  });

  it('reprices a line and says why', () => {
    const [item] = applyLocationPrices([{ materialId: 'sand-river', quantity: 4, unitPriceUsd: 18, unitPriceZwg: 540, totalUsd: 72, totalZwg: 2160, calculationNote: 'Slab' }], 'rural');
    expect(item).toMatchObject({ unitPriceUsd: 60, unitPriceZwg: 1800, totalUsd: 240, totalZwg: 7200 });
    expect(item.calculationNote).toBe('Slab · rural price: 5 m³ loads delivered');
  });

  it('a rural house pays more for sand and less for farm bricks', () => {
    const urban = house();
    const rural = house({ locationType: 'rural' });
    expect(line(rural, 'sand-river')!.unitPriceUsd).toBe(60);
    expect(line(urban, 'sand-river')!.unitPriceUsd).toBe(18);
    const ruralFarm = house({ locationType: 'rural', brickTypes: ['farm'] });
    const farmLines = ruralFarm.filter((item) => item.materialId === 'farm-brick');
    expect(farmLines.length).toBeGreaterThan(0);
    for (const item of farmLines) expect(item.unitPriceUsd).toBe(0.045);
  });
});

describe('the quick budget brick choice', () => {
  it('starts out-of-town houses on farm bricks, unless the link says otherwise', () => {
    expect(defaultBrickFor('urban')).toBe('common');
    expect(defaultBrickFor('rural')).toBe('farm');
    expect(defaultBrickFor('peri-urban')).toBe('farm');
    expect(brickFromParam(null, 'rural')).toBe('farm');
    expect(brickFromParam('common', 'rural')).toBe('common');
    expect(brickFromParam('nonsense', 'urban')).toBe('common');
  });

  it('carries the brick through to the budget estimate', () => {
    const base = { budgetUsd: 20000, floorAreaM2: 120, locationType: 'rural' as const, includeLabor: true };
    const common = estimateStageReach({ ...base, brickTypes: ['common'] });
    const farm = estimateStageReach({ ...base, brickTypes: ['farm'] });
    expect(farm.coveragePercent).toBeGreaterThan(common.coveragePercent);
  });
});
