import { describe, expect, it } from 'vitest';
import { checkLine, marketRange, summariseCheck } from './marketCheck';

const line = (description: string, quantity: number, unit: string, unitPriceUsd: number | null) => ({ description, quantity, unit, unitPriceUsd });

describe('checking a quote against market prices', () => {
  it('flags a line clearly above the market range, with the amount', () => {
    // Y12 at $8.90 a bar; suppliers list $4.50–$5.26.
    const result = checkLine(line('Y12 deformed bar 6m', 80, 'lengths', 8.9), { materialId: 'rebar-12', unitFactor: 1 });
    expect(result.verdict).toBe('high');
    expect(result.overByUsd).toBeCloseTo((8.9 - 5.26) * 80, 2);
    expect(result.market?.verified).toBe(true);
  });

  it('calls a price within the range fair', () => {
    const result = checkLine(line('DPC 115mm', 10, 'rolls', 2.2), { materialId: 'dpc', unitFactor: 1 });
    expect(result.verdict).toBe('fair');
    expect(result.overByUsd).toBe(0);
  });

  it('allows the bulk-to-retail spread for bricks before calling one high', () => {
    // Bulk $0.11, single from a hardware shelf $0.25: $0.14 is normal.
    expect(checkLine(line('Common bricks', 12000, 'each', 0.14), { materialId: 'brick-common', unitFactor: 1 }).verdict).toBe('fair');
  });

  it('converts units before comparing — a 3.6 m sheet against a 3 m price', () => {
    const result = checkLine(line('IBR 0.4mm 3.6m', 70, 'sheets', 19), { materialId: 'ibr-04-3m', unitFactor: 1.2 });
    expect(result.market?.midUsd).toBeCloseTo(15.62 * 1.2, 2);
    expect(result.verdict).toBe('fair');
  });

  it('suggests checking the grade when a price is well below market', () => {
    const result = checkLine(line('Cement 42.5R', 50, 'bags', 9), { materialId: 'cement-425', unitFactor: 1 });
    expect(result.verdict).toBe('low');
    expect(result.reason).toMatch(/same grade/);
  });

  it('marks a comparison with an older price as a rough guide', () => {
    const result = checkLine(line('River sand', 14, 'cubes', 25), { materialId: 'sand-river', unitFactor: 1 });
    expect(result.market?.verified).toBe(false);
    expect(result.reason).toMatch(/older price/);
  });

  describe('refuses to guess', () => {
    it('when the quote has no price', () => {
      expect(checkLine(line('Cement', 10, 'bags', null), { materialId: 'cement-325', unitFactor: 1 }).verdict).toBe('unchecked');
    });
    it('when the item is not in the catalogue, or the id is made up', () => {
      expect(checkLine(line('Solar geyser', 1, 'each', 600), { materialId: null, unitFactor: null }).verdict).toBe('unchecked');
      expect(checkLine(line('Thing', 1, 'each', 10), { materialId: 'not-a-real-id', unitFactor: 1 }).verdict).toBe('unchecked');
    });
    it('when the units cannot be lined up', () => {
      const result = checkLine(line('Cement', 3, 'tonnes', 300), { materialId: 'cement-325', unitFactor: null });
      expect(result.verdict).toBe('unchecked');
      expect(result.reason).toMatch(/different unit/);
    });
  });

  it('summarises the quote: totals and how much the high lines add', () => {
    const lines = [
      checkLine(line('Y12', 80, 'lengths', 8.9), { materialId: 'rebar-12', unitFactor: 1 }),
      checkLine(line('DPC', 10, 'rolls', 2.2), { materialId: 'dpc', unitFactor: 1 }),
      checkLine(line('Mystery', 1, 'each', 50), { materialId: null, unitFactor: null }),
    ];
    const summary = summariseCheck(lines);
    expect(summary).toMatchObject({ lines: 3, checked: 2, high: 1, fair: 1, unchecked: 1 });
    expect(summary.quotedTotalUsd).toBeCloseTo(8.9 * 80 + 22 + 50, 2);
    expect(summary.overByUsd).toBeCloseTo(lines[0].overByUsd, 2);
  });

  it('gives a single listing a range of its own rather than one exact price', () => {
    // One shop lists 50x76 timber at $9.00; $9.50 from another is not "high".
    expect(marketRange('timber-50x76')).toMatchObject({ lowUsd: 8.1, highUsd: 9.9, verified: true });
    expect(checkLine(line('Timber 50x76 6m', 10, 'lengths', 9.5), { materialId: 'timber-50x76', unitFactor: 1 }).verdict).toBe('fair');
  });

  it('has a range for every market-checked item', () => {
    expect(marketRange('mesh-ref193')).toMatchObject({ lowUsd: 30, highUsd: 40.58, verified: true });
  });
});
