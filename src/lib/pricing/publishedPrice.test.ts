import { describe, expect, it } from 'vitest';
import { MANUAL_PRICE_SOURCE, selectPublishedObservation, type PublishedObservation } from './publishedPrice';

const now = Date.parse('2026-10-12T12:00:00Z');
const row = (overrides: Partial<PublishedObservation>): PublishedObservation => ({
  id: 'one', material_key: 'brick-common', price_usd: 0.11, price_zwg: null,
  unit: 'each', source_name: null, supplier_name: null,
  scraped_at: '2026-10-11T12:00:00Z', review_status: 'auto', ...overrides,
});

describe('published material price selection', () => {
  it('keeps a confirmed manual price ahead of newer scraper data', () => {
    const published = selectPublishedObservation([
      row({ id: 'scrape', price_usd: 0.15 }),
      row({ id: 'manual', price_usd: 0.12, source_name: MANUAL_PRICE_SOURCE, review_status: 'confirmed', scraped_at: '2026-01-01T00:00:00Z' }),
    ], 'each', 0.11, now);
    expect(published?.id).toBe('manual');
  });

  it('ignores rejected, old, mismatched-unit and implausible scraped prices', () => {
    const published = selectPublishedObservation([
      row({ id: 'rejected', review_status: 'rejected' }),
      row({ id: 'old', scraped_at: '2026-01-01T00:00:00Z' }),
      row({ id: 'wrong-unit', unit: 'per 1000' }),
      row({ id: 'huge', price_usd: 108 }),
      row({ id: 'valid', price_usd: 0.14 }),
    ], 'each', 0.11, now);
    expect(published?.id).toBe('valid');
  });
});
