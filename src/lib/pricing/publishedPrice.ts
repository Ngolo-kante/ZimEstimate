export const MANUAL_PRICE_SOURCE = 'Admin manual price';

export type PublishedObservation = {
  id: string;
  material_key: string;
  price_usd: number | null;
  price_zwg: number | null;
  unit: string | null;
  source_name: string | null;
  supplier_name: string | null;
  scraped_at: string;
  review_status: 'auto' | 'pending' | 'confirmed' | 'rejected';
};

/** Manual prices stay published until an admin replaces or withdraws them. */
export function selectPublishedObservation(
  rows: PublishedObservation[],
  unit: string,
  baselineUsd?: number | null,
  now = Date.now(),
): PublishedObservation | null {
  const valid = rows.filter((row) => {
    if (!row.price_usd || row.price_usd <= 0) return false;
    if (!['auto', 'confirmed'].includes(row.review_status)) return false;
    // An empty expected unit means the caller does not know it; skip the check.
    if (unit.trim() && row.unit && row.unit.trim().toLowerCase() !== unit.trim().toLowerCase()) return false;
    if (row.source_name === MANUAL_PRICE_SOURCE) return row.review_status === 'confirmed';
    const age = now - new Date(row.scraped_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 30 * 24 * 60 * 60 * 1000) return false;
    if (baselineUsd && baselineUsd > 0) {
      const ratio = row.price_usd / baselineUsd;
      if (ratio > 10 || ratio < 0.1) return false;
    }
    return true;
  });

  const latest = (items: PublishedObservation[]) => items.sort((a, b) => b.scraped_at.localeCompare(a.scraped_at))[0] ?? null;
  return latest(valid.filter((row) => row.source_name === MANUAL_PRICE_SOURCE))
    ?? latest(valid.filter((row) => row.source_name !== MANUAL_PRICE_SOURCE));
}
