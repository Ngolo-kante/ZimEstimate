import { describe, expect, it } from 'vitest';
import { buildExtraItems, DEFAULT_HOUSE_EXTRAS, extraIdOf, normalizeHouseExtras, type HouseExtras } from './houseExtras';

const context = {
  windows: 8,
  exteriorDoors: 2,
  boundaryLengthM: 98,
  laborIncluded: true,
  roofCovering: 'ibr_05' as const,
  city: 'Harare',
  locationType: 'urban',
};

const allOn = (): HouseExtras => {
  const extras = normalizeHouseExtras({});
  for (const value of Object.values(extras)) value.enabled = true;
  extras.site_setup.tank = true;
  extras.security.alarm = true;
  extras.security.electricFence = true;
  return extras;
};

const total = (items: ReturnType<typeof buildExtraItems>, id: string) =>
  items.filter((item) => extraIdOf(item.materialId) === id).reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0);

describe('house extras', () => {
  it('adds nothing until an extra is switched on', () => {
    expect(buildExtraItems(DEFAULT_HOUSE_EXTRAS, context)).toEqual([]);
  });

  it('prices the extras that have calculators, and leaves quote-only ones at $0 with a count', () => {
    const items = buildExtraItems(allOn(), context);
    for (const id of ['septic', 'water_tank', 'borehole', 'solar']) expect(total(items, id)).toBeGreaterThan(0);
    expect(total(items, 'solar_geyser')).toBe(790);
    // Guide figures: $550 tank and 4 fills at $50.
    expect(total(items, 'site_setup')).toBe(550 + 4 * 50);
    const bars = items.find((item) => item.materialId === 'extra-security--bars')!;
    expect(bars.quantity).toBe(8);
    expect(bars.actualPriceUsd).toBe(0);
    expect(items.find((item) => item.materialId === 'extra-security--fence')!.quantity).toBe(98);
    expect(items.find((item) => item.materialId === 'extra-gate_motor--motor')!.actualPriceUsd).toBe(0);
  });

  it('adds labour to septic and tank work only when labour is included, and never to the borehole or solar', () => {
    const withLabour = buildExtraItems(allOn(), context);
    const labourIds = withLabour.filter((item) => item.materialId.endsWith('--labour')).map((item) => extraIdOf(item.materialId));
    expect(labourIds.sort()).toEqual(['septic', 'water_tank']);
    const septicMaterials = withLabour.filter((item) => extraIdOf(item.materialId) === 'septic' && !item.materialId.endsWith('--labour'))
      .reduce((sum, item) => sum + (item.quantity || 0) * item.actualPriceUsd, 0);
    expect(withLabour.find((item) => item.materialId === 'extra-septic--labour')!.actualPriceUsd).toBeCloseTo(septicMaterials * 0.25, 1);
    expect(buildExtraItems(allOn(), { ...context, laborIncluded: false }).some((item) => item.materialId.endsWith('--labour'))).toBe(false);
  });

  it('sizes solar up from essentials to the whole house', () => {
    const solarTotal = (size: 'essentials' | 'whole') => {
      const extras = normalizeHouseExtras({ solar: { enabled: true, size } });
      return total(buildExtraItems(extras, context), 'solar');
    };
    expect(solarTotal('whole')).toBeGreaterThan(solarTotal('essentials'));
  });

  it('gives every line a stable, unique id', () => {
    const items = buildExtraItems(allOn(), context);
    expect(new Set(items.map((item) => item.materialId)).size).toBe(items.length);
    expect(buildExtraItems(allOn(), context).map((item) => item.materialId)).toEqual(items.map((item) => item.materialId));
  });

  it('fills a partly saved set of extras with defaults', () => {
    const restored = normalizeHouseExtras({ borehole: { enabled: true, depthM: 60 } });
    expect(restored.borehole).toEqual({ enabled: true, depthM: 60, pump: 'solar' });
    expect(restored.septic).toEqual(DEFAULT_HOUSE_EXTRAS.septic);
  });
});
