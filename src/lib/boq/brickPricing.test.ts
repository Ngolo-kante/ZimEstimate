import { describe, expect, it } from 'vitest';
import { BRICK_INFO } from '@/lib/vision/types';
import { getBestPrice, materials } from '@/lib/materials';
import { generateBOQFromBasics, type ManualBuilderConfig } from '@/lib/calculations';

/**
 * Guards the per-unit/per-pack confusion that priced a single face brick at
 * $220 — the per-1000 rate — and inflated every masonry line a thousandfold.
 *
 * The BOQ generator counts individual bricks and emits the line with unit
 * 'each', so anything BRICK_INFO points at must be priced per brick. These
 * tests fail on both directions of the mistake: a per-1000 price left on an
 * 'each' material, and a material with no price at all (which silently costed
 * the whole wall at $0).
 */

// A single brick or block. Blocks are the expensive end at ~$1.65.
const MAX_PLAUSIBLE_UNIT_PRICE_USD = 5;

describe('brick pricing units', () => {
  const brickTypes = Object.entries(BRICK_INFO);

  it.each(brickTypes)('%s resolves to a real material', (_type, info) => {
    const material = materials.find((m) => m.id === info.materialId);
    expect(material, `BRICK_INFO points at '${info.materialId}', which is not in materials.ts`).toBeDefined();
  });

  it.each(brickTypes)('%s is quantified per unit, not per pack', (_type, info) => {
    const material = materials.find((m) => m.id === info.materialId);
    // The generator hardcodes 'each' for masonry lines, so the material has to
    // agree or quantity x price is comparing different things.
    expect(material?.unit).toBe('each');
  });

  it.each(brickTypes)('%s has a per-unit price that is not a per-1000 rate', (_type, info) => {
    const price = getBestPrice(info.materialId);
    expect(price, `no price for '${info.materialId}' — the BOQ would cost this wall at $0`).toBeDefined();
    expect(price!.priceUsd).toBeGreaterThan(0);
    expect(
      price!.priceUsd,
      `$${price!.priceUsd} for one ${info.name} looks like a per-1000 rate`
    ).toBeLessThan(MAX_PLAUSIBLE_UNIT_PRICE_USD);
  });
});

describe('generated BOQ totals stay in a sane range', () => {
  const config = (brickType: string) =>
    ({
      floorArea: 120,
      roomCount: 4,
      wallHeight: 3,
      brickTypes: [brickType],
      cementTypes: ['cement_325'],
      includeLabor: false,
      scope: 'full_house',
    }) as unknown as ManualBuilderConfig;

  it.each(Object.keys(BRICK_INFO))('a 120m2 house in %s costs a believable amount', (brickType) => {
    const items = generateBOQFromBasics(config(brickType));
    const total = items.reduce((sum, item) => sum + item.totalUsd, 0);

    // Materials-only shell for 120m2 in Zimbabwe lands in the low tens of
    // thousands. The bug put this at roughly $1.8m; $0 would mean a missing
    // price. Wide bounds on purpose — this catches magnitude errors, not drift.
    expect(total).toBeGreaterThan(1_000);
    expect(total).toBeLessThan(200_000);
  });
});
