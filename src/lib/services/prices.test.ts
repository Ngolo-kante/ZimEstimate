import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryHandler = (state: { table: string }) => { data: any; error: any };

const createSupabaseMock = (handlers: Record<string, QueryHandler>) => {
  return {
    from: (table: string) => {
      const state = { table };
      const exec = () => (handlers[table] ? handlers[table](state) : { data: null, error: null });
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
      };
      builder.then = (resolve: any, reject: any) => Promise.resolve(exec()).then(resolve, reject);
      builder.catch = (reject: any) => Promise.resolve(exec()).catch(reject);
      return builder;
    },
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('price services', () => {
  it('returns scraped price when observations exist', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: createSupabaseMock({
        price_observations: () => ({
          data: [
            {
              material_key: 'cement',
              price_usd: 120,
              price_zwg: 3600,
              confidence: 4,
              scraped_at: new Date().toISOString(),
              supplier_name: 'Supplier A',
              location: 'Harare',
            },
          ],
          error: null,
        }),
      }),
    }));

    vi.doMock('@/lib/materials', () => ({
      getBestPrice: () => null,
      getPricesForMaterial: () => [],
      materials: [],
    }));

    const { getLatestPrice } = await import('./prices');
    const result = await getLatestPrice('cement');

    expect(result).not.toBeNull();
    expect(result?.source).toBe('scraped');
    expect(result?.priceUsd).toBe(120);
  });

  it('falls back to static price when no observations', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: createSupabaseMock({
        price_observations: () => ({ data: [], error: null }),
      }),
    }));

    vi.doMock('@/lib/materials', () => ({
      getBestPrice: () => ({
        priceUsd: 95,
        priceZwg: 2850,
        lastUpdated: '2026-02-01',
      }),
      getPricesForMaterial: () => [],
      materials: [],
    }));

    const { getLatestPrice } = await import('./prices');
    const result = await getLatestPrice('steel');

    expect(result).not.toBeNull();
    expect(result?.source).toBe('static');
    expect(result?.priceUsd).toBe(95);
  });

  it('computes weekly trend from price_weekly history', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: createSupabaseMock({
        price_observations: () => ({
          data: [
            {
              material_key: 'bricks',
              price_usd: 10,
              price_zwg: 300,
              confidence: 3,
              scraped_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
        price_weekly: () => ({
          data: [
            { material_key: 'bricks', week_start: '2026-01-08', avg_price_usd: 10 },
            { material_key: 'bricks', week_start: '2026-01-01', avg_price_usd: 8 },
          ],
          error: null,
        }),
      }),
    }));

    vi.doMock('@/lib/materials', () => ({
      getBestPrice: () => null,
      getPricesForMaterial: () => [],
      materials: [],
    }));

    const { getPriceWithTrend } = await import('./prices');
    const result = await getPriceWithTrend('bricks');

    expect(result).not.toBeNull();
    expect(result?.trend).toBe('up');
    expect(result?.priceHistory.length).toBe(2);
  });
});
