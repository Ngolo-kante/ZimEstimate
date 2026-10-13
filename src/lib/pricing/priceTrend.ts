// ─── How a material's price has moved ────────────────────────────────────────
// Straight from price_observations. The public price page used to read a
// weekly summary table (price_weekly) that nothing ever filled, so its
// "Market trend" and "Price movers" stayed at a dash for good.

const DAY = 24 * 60 * 60 * 1000;
/** The earlier price must be at least this much older than the current one. */
export const TREND_MIN_GAP_DAYS = 28;
/** …and no older than this, or the comparison says little about now. */
export const TREND_MAX_GAP_DAYS = 120;

export type TrendObservation = {
  price_usd: number | null;
  scraped_at: string;
  review_status: string;
};

export type PriceMove = { changePercent: number; trend: 'up' | 'down' | 'stable'; since: string };

/**
 * The change from the latest approved price recorded 4–17 weeks before the
 * current one. Null when there is no such price — or when the two are so far
 * apart (10× either way) that they are surely quoted in different units.
 */
export function priceMove(
  current: { priceUsd: number; at: string },
  history: TrendObservation[],
): PriceMove | null {
  const currentAt = new Date(current.at).getTime();
  if (!Number.isFinite(currentAt) || !(current.priceUsd > 0)) return null;

  const earlier = history
    .filter((row) => {
      if (!row.price_usd || row.price_usd <= 0) return false;
      if (!['auto', 'confirmed'].includes(row.review_status)) return false;
      const gap = (currentAt - new Date(row.scraped_at).getTime()) / DAY;
      return gap >= TREND_MIN_GAP_DAYS && gap <= TREND_MAX_GAP_DAYS;
    })
    .sort((a, b) => b.scraped_at.localeCompare(a.scraped_at))[0];
  if (!earlier?.price_usd) return null;

  const ratio = current.priceUsd / earlier.price_usd;
  if (ratio > 10 || ratio < 0.1) return null;

  const changePercent = Math.round((ratio - 1) * 1000) / 10;
  return {
    changePercent,
    trend: changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'stable',
    since: earlier.scraped_at,
  };
}
