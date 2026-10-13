import { describe, expect, it } from 'vitest';
import { priceMove } from './priceTrend';

const obs = (price_usd: number, scraped_at: string, review_status = 'auto') => ({ price_usd, scraped_at, review_status });

describe('how a price has moved', () => {
  it('compares with the latest price from at least four weeks earlier', () => {
    const move = priceMove({ priceUsd: 12.1, at: '2026-10-12' }, [
      obs(11.0, '2026-08-01'),
      obs(11.5, '2026-09-10'),
      obs(12.0, '2026-10-01'), // too recent to compare with
    ]);
    expect(move).toMatchObject({ changePercent: 5.2, trend: 'up', since: '2026-09-10' });
  });

  it('calls a change of a percent or less stable', () => {
    expect(priceMove({ priceUsd: 10.05, at: '2026-10-12' }, [obs(10, '2026-09-01')])?.trend).toBe('stable');
  });

  it('reports a fall', () => {
    expect(priceMove({ priceUsd: 9, at: '2026-10-12' }, [obs(10, '2026-09-01')])).toMatchObject({ changePercent: -10, trend: 'down' });
  });

  it('has nothing to say without an earlier price in range', () => {
    expect(priceMove({ priceUsd: 10, at: '2026-10-12' }, [obs(9, '2026-10-01')])).toBeNull();
    expect(priceMove({ priceUsd: 10, at: '2026-10-12' }, [obs(9, '2026-01-01')])).toBeNull();
  });

  it('ignores rejected prices and ones clearly in another unit', () => {
    expect(priceMove({ priceUsd: 10, at: '2026-10-12' }, [obs(9, '2026-09-01', 'rejected')])).toBeNull();
    expect(priceMove({ priceUsd: 0.12, at: '2026-10-12' }, [obs(108, '2026-09-01')])).toBeNull();
  });
});
