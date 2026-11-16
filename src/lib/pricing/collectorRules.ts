export interface CollectorObservation {
  price_usd: number | null;
  unit: string | null;
  review_status: string;
  scraped_at: string;
}

const positive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

export function median(values: number[]): number | null {
  const sorted = values.filter(positive).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function convertedPrice(values: number[], factor: number): number | null {
  const price = median(values);
  const converted = price === null ? null : price * factor;
  return positive(converted) ? converted : null;
}

export function currentPrice(
  rows: CollectorObservation[], unit: string,
  verified?: number | null, catalogue?: number | null, now = Date.now(),
): number | null {
  const latest = rows.filter((row) => {
    const age = now - Date.parse(row.scraped_at);
    return positive(row.price_usd) && ['auto', 'confirmed'].includes(row.review_status)
      && row.unit?.trim().toLowerCase() === unit.trim().toLowerCase()
      && age >= 0 && age < 30 * 86400000;
  }).sort((a, b) => Date.parse(b.scraped_at) - Date.parse(a.scraped_at))[0];
  return latest?.price_usd ?? (positive(verified) ? verified : positive(catalogue) ? catalogue : null);
}

export function priceDecision(price: number, current: number | null) {
  const changePercent = positive(current) ? (price / current - 1) * 100 : null;
  return {
    changePercent,
    review_status: changePercent !== null && Math.abs(changePercent) <= 15 + 1e-10
      ? 'auto' as const : 'pending' as const,
  };
}
