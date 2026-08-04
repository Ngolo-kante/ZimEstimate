import { describe, expect, it } from 'vitest';
import { normaliseScannedBoq } from './boq-scan';

/**
 * The model is asked for JSON and mostly returns it. This is what stands
 * between "mostly" and a BOQ full of NaN, blank rows and invented prices.
 *
 * The scanner's whole value is that the numbers came off the page rather than
 * out of a model, so anything that cannot be trusted has to be dropped or
 * flagged rather than smoothed over.
 */

const scan = (over: Record<string, unknown> = {}) =>
  normaliseScannedBoq({
    title: 'BOQ',
    items: [{ description: 'Cement 32.5N', quantity: 40, unit: 'bags', unitPriceUsd: 10, confidence: 95 }],
    ...over,
  });

describe('rows that cannot be used are dropped', () => {
  it('drops a row with no description rather than showing a blank line', () => {
    const result = scan({ items: [{ description: '   ', quantity: 40, unit: 'bags' }] });
    expect(result.items).toHaveLength(0);
  });

  it('drops a row with no quantity', () => {
    const result = scan({ items: [{ description: 'Cement', unit: 'bags' }] });
    expect(result.items).toHaveLength(0);
  });

  it('drops a zero or negative quantity', () => {
    const result = scan({
      items: [
        { description: 'Cement', quantity: 0, unit: 'bags' },
        { description: 'Sand', quantity: -5, unit: 'cubes' },
      ],
    });
    expect(result.items).toHaveLength(0);
  });

  it('keeps the good rows when only some are unusable', () => {
    const result = scan({
      items: [
        { description: 'Cement 32.5N', quantity: 40, unit: 'bags', confidence: 95 },
        { description: '', quantity: 10, unit: 'bags' },
        { description: 'River sand', quantity: 3, unit: 'cubes', confidence: 80 },
      ],
    });
    expect(result.items.map((i) => i.description)).toEqual(['Cement 32.5N', 'River sand']);
  });
});

describe('numbers are read, never invented', () => {
  it('treats a missing price as unpriced rather than free', () => {
    // Plenty of BOQs list quantities only. A $0 line would read as "costs
    // nothing" and quietly drag a total down.
    const result = scan({ items: [{ description: 'Cement', quantity: 40, unit: 'bags', confidence: 90 }] });
    expect(result.items[0].unitPriceUsd).toBeNull();
  });

  it('treats an explicit zero price the same way', () => {
    const result = scan({
      items: [{ description: 'Cement', quantity: 40, unit: 'bags', unitPriceUsd: 0, confidence: 90 }],
    });
    expect(result.items[0].unitPriceUsd).toBeNull();
  });

  it('recovers a number written as a currency string', () => {
    const result = scan({
      items: [{ description: 'Cement', quantity: '40', unit: 'bags', unitPriceUsd: '$10.50', confidence: 90 }],
    });
    expect(result.items[0].quantity).toBe(40);
    expect(result.items[0].unitPriceUsd).toBe(10.5);
  });

  it('drops a row whose quantity is not a number at all', () => {
    const result = scan({ items: [{ description: 'Cement', quantity: 'lots', unit: 'bags' }] });
    expect(result.items).toHaveLength(0);
  });
});

describe('confidence is about legibility, and defaults to doubt', () => {
  it('treats an unstated confidence as needing review, not as certainty', () => {
    const result = scan({ items: [{ description: 'Cement', quantity: 40, unit: 'bags' }] });
    expect(result.items[0].confidence).toBe(50);
  });

  it('clamps values outside 0-100', () => {
    const result = scan({
      items: [
        { description: 'A', quantity: 1, unit: 'each', confidence: 150 },
        { description: 'B', quantity: 1, unit: 'each', confidence: -20 },
      ],
    });
    expect(result.items.map((i) => i.confidence)).toEqual([100, 0]);
  });

  it('averages the document figure from the rows, so the two cannot disagree', () => {
    const result = scan({
      items: [
        { description: 'A', quantity: 1, unit: 'each', confidence: 100 },
        { description: 'B', quantity: 1, unit: 'each', confidence: 50 },
      ],
      confidence: 99, // the model's own claim is ignored
    });
    expect(result.confidence).toBe(75);
  });
});

describe('documents that are not a BOQ', () => {
  it('reports notABoq when the model says so', () => {
    expect(scan({ notABoq: true, items: [] }).notABoq).toBe(true);
  });

  it('reports notABoq when nothing usable survived, whatever the model claimed', () => {
    const result = scan({ notABoq: false, items: [{ description: '', quantity: 0 }] });
    expect(result.notABoq).toBe(true);
    expect(result.confidence).toBe(0);
  });
});

describe('surviving malformed responses', () => {
  it('returns an empty result rather than throwing on null', () => {
    const result = normaliseScannedBoq(null);
    expect(result.items).toEqual([]);
    expect(result.notABoq).toBe(true);
  });

  it('returns an empty result when items is not an array', () => {
    expect(normaliseScannedBoq({ items: 'cement' }).items).toEqual([]);
  });

  it('defaults a missing unit rather than dropping the row', () => {
    const result = scan({ items: [{ description: 'Door frame', quantity: 4, confidence: 90 }] });
    expect(result.items[0].unit).toBe('each');
  });
});

describe('document metadata', () => {
  it('keeps a supplier name when the document is a quote', () => {
    expect(scan({ supplierName: 'Baines Building Supplies' }).supplierName).toBe('Baines Building Supplies');
  });

  it('is null for a builder BOQ with no supplier', () => {
    expect(scan({}).supplierName).toBeNull();
  });

  it('only accepts currencies we handle', () => {
    expect(scan({ currency: 'ZWG' }).currency).toBe('ZWG');
    expect(scan({ currency: 'EUR' }).currency).toBeNull();
  });
});
