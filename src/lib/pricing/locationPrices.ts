/**
 * What materials cost delivered outside the cities.
 *
 * The catalogue prices are Harare: bulk loads from city suppliers. Builders in
 * the rural homes groups (October 2026, research/facebook-building-market,
 * sources 66–81) paid about three to four times as much for sand and stone,
 * which come in 5 m³ loads trucked a long way, and a little more for cement.
 * Farm bricks, made locally, cost less than the city's common bricks: $45 per
 * thousand delivered, in rural and peri-urban quotes alike.
 *
 * Only items with a reported price are here; everything else keeps its
 * Harare price.
 */
import type { LocationType } from '@/lib/calculations/assumptions';

interface LocationPrice {
  priceUsd: number;
  /** Shown on the BOQ line, so the higher or lower price is explained. */
  note: string;
}

const FARM_BRICKS: LocationPrice = { priceUsd: 0.045, note: 'farm bricks $45 per 1,000 delivered (rural quotes)' };

export const LOCATION_PRICES: Partial<Record<LocationType, Record<string, LocationPrice>>> = {
  rural: {
    'farm-brick': FARM_BRICKS,
    'sand-river': { priceUsd: 60, note: 'rural price: 5 m³ loads delivered' },
    'stone-19mm': { priceUsd: 60, note: 'rural price: 5 m³ loads delivered' },
    'sand-pit': { priceUsd: 30, note: 'rural price: 5 m³ loads delivered' },
    'sand-bricks': { priceUsd: 30, note: 'rural price: 5 m³ loads delivered' },
    'cement-325': { priceUsd: 13, note: 'rural price, delivered' },
    // Not reported directly: the same $1.20 a bag delivery as 32.5 cement.
    'cement-425': { priceUsd: 15, note: 'rural price, delivered' },
  },
  'peri-urban': {
    'farm-brick': FARM_BRICKS,
  },
};

/** The delivered price of a material in this kind of area, if it differs from Harare's. */
export function locationPrice(materialId: string, locationType: LocationType | undefined): LocationPrice | undefined {
  return locationType ? LOCATION_PRICES[locationType]?.[materialId] : undefined;
}

type PricedLine = {
  materialId: string;
  quantity: number;
  unitPriceUsd: number;
  unitPriceZwg: number;
  totalUsd: number;
  totalZwg: number;
  calculationNote: string;
};

/** Reprices BOQ lines for the area they will be delivered to, in place. */
export function applyLocationPrices<T extends PricedLine>(items: T[], locationType: LocationType | undefined): T[] {
  for (const item of items) {
    const local = locationPrice(item.materialId, locationType);
    if (!local) continue;
    // Same USD-to-ZWG rate as the catalogue, so the two stay consistent.
    const zwgPerUsd = item.unitPriceUsd > 0 ? item.unitPriceZwg / item.unitPriceUsd : 30;
    item.unitPriceUsd = local.priceUsd;
    item.unitPriceZwg = Math.round(local.priceUsd * zwgPerUsd * 100) / 100;
    item.totalUsd = Math.round(item.quantity * local.priceUsd * 100) / 100;
    item.totalZwg = Math.round(item.quantity * item.unitPriceZwg * 100) / 100;
    item.calculationNote = item.calculationNote ? `${item.calculationNote} · ${local.note}` : local.note;
  }
  return items;
}
