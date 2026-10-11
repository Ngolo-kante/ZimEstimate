import { getBestPrice, getMaterialById } from '@/lib/materials';
import { VERIFIED_PRICES, VERIFIED_PRICES_CHECKED_ON } from '@/lib/pricing/verifiedPrices';

/**
 * Compares a builder's or supplier's quote with market prices, line by line.
 *
 * No AI here: an AI step only says which catalogue item a quote line is, and
 * how its unit relates (quotes say "3.6m sheet", the catalogue prices a 3 m
 * sheet). Every price in the verdict comes from the quote itself or from the
 * catalogue. A line that cannot be compared fairly — no price, an item not in
 * the catalogue, a unit that does not line up — is reported as unchecked, not
 * guessed at, because telling someone their builder overcharged is a serious
 * thing to get wrong.
 */

export interface QuoteLine {
  description: string;
  quantity: number;
  unit: string;
  unitPriceUsd: number | null;
}

export interface LineMatch {
  /** The catalogue item this line is, or null when it is not in the catalogue. */
  materialId: string | null;
  /** How many catalogue units one quote unit equals; null when it cannot be told. */
  unitFactor: number | null;
}

export type Verdict = 'high' | 'fair' | 'low' | 'unchecked';

export interface MarketRange {
  lowUsd: number;
  highUsd: number;
  midUsd: number;
  /** true: checked against live supplier listings; false: an older reference price. */
  verified: boolean;
  checkedOn: string;
}

export interface CheckedLine extends QuoteLine {
  materialId: string | null;
  materialName: string | null;
  verdict: Verdict;
  /** The market range per quote unit, after any unit conversion. */
  market: MarketRange | null;
  /** For a "high" line, how much more the line costs than the top of the range. */
  overByUsd: number;
  reason: string;
}

/* A quote has to be clearly outside the range before it is called high or
   low: suppliers round, deliver, and price by branch. */
export const HIGH_TOLERANCE = 1.1;
export const LOW_TOLERANCE = 0.85;
/* An older reference price is a single point; widened so it is a range. */
const OLDER_PRICE_SPREAD = 0.2;
/* A current price that is a single point — one listing, or converted from
   another pack size — is widened less: it is current, but one shop's. */
const SINGLE_PRICE_SPREAD = 0.1;

export function marketRange(materialId: string): MarketRange | null {
  const verified = VERIFIED_PRICES.find((entry) => entry.materialId === materialId);
  // Listings in a different size give only the converted price per unit, and
  // one listing (or several at the same price) gives no spread of its own.
  if (verified && (verified.sourcesInOtherUnits || new Set(verified.sources.map((s) => s.priceUsd)).size < 2)) {
    return {
      lowUsd: verified.priceUsd * (1 - SINGLE_PRICE_SPREAD),
      highUsd: verified.priceUsd * (1 + SINGLE_PRICE_SPREAD),
      midUsd: verified.priceUsd,
      verified: true,
      checkedOn: VERIFIED_PRICES_CHECKED_ON,
    };
  }
  if (verified) {
    const prices = verified.sources.map((s) => s.priceUsd);
    return {
      lowUsd: Math.min(...prices),
      highUsd: Math.max(...prices),
      midUsd: verified.priceUsd,
      verified: true,
      checkedOn: VERIFIED_PRICES_CHECKED_ON,
    };
  }
  const best = getBestPrice(materialId);
  if (!best || !(best.priceUsd > 0)) return null;
  return {
    lowUsd: best.priceUsd * (1 - OLDER_PRICE_SPREAD),
    highUsd: best.priceUsd * (1 + OLDER_PRICE_SPREAD),
    midUsd: best.priceUsd,
    verified: false,
    checkedOn: best.lastUpdated,
  };
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export function checkLine(line: QuoteLine, match: LineMatch): CheckedLine {
  const material = match.materialId ? getMaterialById(match.materialId) : undefined;
  const base = {
    ...line,
    materialId: material ? match.materialId : null,
    materialName: material?.name ?? null,
    market: null,
    overByUsd: 0,
  };

  if (!(line.unitPriceUsd !== null && line.unitPriceUsd > 0)) {
    return { ...base, verdict: 'unchecked', reason: 'No price on the quote for this line.' };
  }
  if (!material) {
    return { ...base, verdict: 'unchecked', reason: 'We do not have a price for this exact item and size yet.' };
  }
  const factor = match.unitFactor;
  if (!(factor !== null && factor > 0)) {
    return { ...base, verdict: 'unchecked', reason: `Sold in a different unit from our "${material.unit}" price, so not compared.` };
  }
  const range = marketRange(material.id);
  if (!range) {
    return { ...base, verdict: 'unchecked', reason: 'We have no market price for this item yet.' };
  }

  const market: MarketRange = {
    ...range,
    lowUsd: range.lowUsd * factor,
    highUsd: range.highUsd * factor,
    midUsd: range.midUsd * factor,
  };
  const price = line.unitPriceUsd;
  const older = market.verified ? '' : ' (compared with an older price, so treat as a rough guide)';

  if (price > market.highUsd * HIGH_TOLERANCE) {
    const overByUsd = Math.max(0, (price - market.highUsd) * (line.quantity || 0));
    return {
      ...base,
      market,
      verdict: 'high',
      overByUsd,
      reason: `${usd(price)} against a market range of ${usd(market.lowUsd)}–${usd(market.highUsd)}${older}.`,
    };
  }
  if (price < market.lowUsd * LOW_TOLERANCE) {
    return {
      ...base,
      market,
      verdict: 'low',
      reason: `Below the market range of ${usd(market.lowUsd)}–${usd(market.highUsd)} — worth checking it is the same grade and size${older}.`,
    };
  }
  return {
    ...base,
    market,
    verdict: 'fair',
    reason: `Within the market range of ${usd(market.lowUsd)}–${usd(market.highUsd)}${older}.`,
  };
}

export interface QuoteCheckSummary {
  lines: number;
  checked: number;
  high: number;
  fair: number;
  low: number;
  unchecked: number;
  quotedTotalUsd: number;
  /** Total by which "high" lines exceed the top of their market ranges. */
  overByUsd: number;
}

export function summariseCheck(lines: CheckedLine[]): QuoteCheckSummary {
  const count = (v: Verdict) => lines.filter((l) => l.verdict === v).length;
  return {
    lines: lines.length,
    checked: lines.length - count('unchecked'),
    high: count('high'),
    fair: count('fair'),
    low: count('low'),
    unchecked: count('unchecked'),
    quotedTotalUsd: lines.reduce((sum, l) => sum + (l.unitPriceUsd ?? 0) * (l.quantity || 0), 0),
    overByUsd: lines.reduce((sum, l) => sum + l.overByUsd, 0),
  };
}
