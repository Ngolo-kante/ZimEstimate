// Price aggregation service for ZimEstimate
// Pulls live pricing from price_observations with fallback to static data

import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { getBestPrice as getStaticBestPrice, getPricesForMaterial } from '@/lib/materials';

type PriceObservation = Database['public']['Tables']['price_observations']['Row'];
type PriceWeekly = Database['public']['Tables']['price_weekly']['Row'];

export interface LivePrice {
  materialKey: string;
  priceUsd: number;
  priceZwg: number;
  source: 'scraped' | 'static';
  confidence: number; // 1-5 scale
  lastUpdated: Date;
  supplierName?: string;
  location?: string;
}

export interface PriceWithTrend extends LivePrice {
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  priceHistory: { date: Date; price: number }[];
}

export interface PriceAggregation {
  materialKey: string;
  currentPrice: LivePrice;
  lowestPrice: LivePrice | null;
  highestPrice: LivePrice | null;
  avgPriceUsd: number;
  priceCount: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  priceHistory: { date: Date; price: number }[];
}

export interface PriceComparison {
  supplierName: string;
  priceUsd: number;
  priceZwg: number;
  lastUpdated: Date;
  confidence: number;
  source: 'scraped' | 'static';
  location?: string;
}

// Cache for performance (5 minute TTL)
const priceCache = new Map<string, { data: LivePrice; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the latest price for a material, preferring scraped data
 * Falls back to static price if no recent scrape exists
 */
export async function getLatestPrice(materialKey: string): Promise<LivePrice | null> {
  // Check cache first
  const cached = priceCache.get(materialKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Try to get scraped price from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: observations, error } = await supabase
    .from('price_observations')
    .select('*')
    .eq('material_key', materialKey)
    .gte('scraped_at', thirtyDaysAgo.toISOString())
    .in('review_status', ['auto', 'confirmed'])
    .order('scraped_at', { ascending: false })
    .limit(1);

  if (!error && observations && observations.length > 0) {
    const obs = observations[0] as PriceObservation;
    const livePrice: LivePrice = {
      materialKey: obs.material_key,
      priceUsd: obs.price_usd || 0,
      priceZwg: obs.price_zwg || (obs.price_usd || 0) * 30, // Fallback ZWG conversion
      source: 'scraped',
      confidence: obs.confidence,
      lastUpdated: new Date(obs.scraped_at),
      supplierName: obs.supplier_name || undefined,
      location: obs.location || undefined,
    };

    // Cache the result
    priceCache.set(materialKey, { data: livePrice, timestamp: Date.now() });
    return livePrice;
  }

  // Fall back to static price
  const staticPrice = getStaticBestPrice(materialKey);
  if (staticPrice) {
    const livePrice: LivePrice = {
      materialKey,
      priceUsd: staticPrice.priceUsd,
      priceZwg: staticPrice.priceZwg,
      source: 'static',
      confidence: 3, // Medium confidence for static data
      lastUpdated: new Date(staticPrice.lastUpdated),
    };

    priceCache.set(materialKey, { data: livePrice, timestamp: Date.now() });
    return livePrice;
  }

  return null;
}

/**
 * Get price with trend data for sparkline display
 */
export async function getPriceWithTrend(materialKey: string): Promise<PriceWithTrend | null> {
  const currentPrice = await getLatestPrice(materialKey);
  if (!currentPrice) return null;

  // Fetch weekly price history for trend
  const { data: weeklyPrices } = await supabase
    .from('price_weekly')
    .select('*')
    .eq('material_key', materialKey)
    .order('week_start', { ascending: false })
    .limit(8); // 8 weeks of data

  let trend: 'up' | 'down' | 'stable' = 'stable';
  let changePercent = 0;
  const priceHistory: { date: Date; price: number }[] = [];

  if (weeklyPrices && weeklyPrices.length >= 2) {
    const prices = weeklyPrices as PriceWeekly[];

    // Build price history (reverse to chronological order)
    prices.reverse().forEach(wp => {
      if (wp.avg_price_usd !== null) {
        priceHistory.push({
          date: new Date(wp.week_start),
          price: wp.avg_price_usd,
        });
      }
    });

    // Calculate trend from most recent two weeks
    const latest = prices[prices.length - 1];
    const previous = prices[prices.length - 2];

    if (latest.avg_price_usd !== null && previous.avg_price_usd !== null) {
      const priceDiff = latest.avg_price_usd - previous.avg_price_usd;
      changePercent = (priceDiff / previous.avg_price_usd) * 100;

      if (changePercent > 1) {
        trend = 'up';
      } else if (changePercent < -1) {
        trend = 'down';
      }
    }
  }

  return {
    ...currentPrice,
    trend,
    changePercent: Math.round(changePercent * 10) / 10,
    priceHistory,
  };
}

/**
 * Get full price aggregation with all supplier prices
 */
export async function getPriceAggregation(materialKey: string): Promise<PriceAggregation | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch all recent observations for this material
  const { data: observations } = await supabase
    .from('price_observations')
    .select('*')
    .eq('material_key', materialKey)
    .gte('scraped_at', thirtyDaysAgo.toISOString())
    .in('review_status', ['auto', 'confirmed'])
    .order('scraped_at', { ascending: false });

  const priceWithTrend = await getPriceWithTrend(materialKey);
  if (!priceWithTrend) return null;

  let lowestPrice: LivePrice | null = null;
  let highestPrice: LivePrice | null = null;
  let totalPrice = 0;
  let priceCount = 0;

  if (observations && observations.length > 0) {
    const obs = observations as PriceObservation[];

    obs.forEach(o => {
      if (o.price_usd !== null) {
        totalPrice += o.price_usd;
        priceCount++;

        const livePrice: LivePrice = {
          materialKey: o.material_key,
          priceUsd: o.price_usd,
          priceZwg: o.price_zwg || o.price_usd * 30,
          source: 'scraped',
          confidence: o.confidence,
          lastUpdated: new Date(o.scraped_at),
          supplierName: o.supplier_name || undefined,
          location: o.location || undefined,
        };

        if (!lowestPrice || o.price_usd < lowestPrice.priceUsd) {
          lowestPrice = livePrice;
        }
        if (!highestPrice || o.price_usd > highestPrice.priceUsd) {
          highestPrice = livePrice;
        }
      }
    });
  }

  return {
    materialKey,
    currentPrice: priceWithTrend,
    lowestPrice,
    highestPrice,
    avgPriceUsd: priceCount > 0 ? totalPrice / priceCount : priceWithTrend.priceUsd,
    priceCount,
    trend: priceWithTrend.trend,
    changePercent: priceWithTrend.changePercent,
    priceHistory: priceWithTrend.priceHistory,
  };
}

/**
 * Get a comparison list of supplier prices for a material.
 * Prefers recent scraped observations, falls back to static supplier prices.
 */
export async function getPriceComparisons(materialKey: string): Promise<PriceComparison[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: observations } = await supabase
    .from('price_observations')
    .select('price_usd, price_zwg, supplier_name, location, scraped_at, confidence')
    .eq('material_key', materialKey)
    .gte('scraped_at', thirtyDaysAgo.toISOString())
    .in('review_status', ['auto', 'confirmed'])
    .order('price_usd', { ascending: true });

  if (observations && observations.length > 0) {
    return (observations as PriceObservation[]).map((obs) => ({
      supplierName: obs.supplier_name || 'Supplier',
      priceUsd: obs.price_usd || 0,
      priceZwg: obs.price_zwg || (obs.price_usd || 0) * 30,
      lastUpdated: new Date(obs.scraped_at),
      confidence: obs.confidence || 3,
      source: 'scraped',
      location: obs.location || undefined,
    }));
  }

  const staticPrices = getPricesForMaterial(materialKey);
  return staticPrices.map((priceInfo) => ({
    supplierName: priceInfo.supplier.name,
    priceUsd: priceInfo.priceUsd,
    priceZwg: priceInfo.priceZwg,
    lastUpdated: new Date(priceInfo.lastUpdated),
    confidence: 3,
    source: 'static',
    location: priceInfo.supplier.location,
  }));
}

/**
 * Batch fetch prices for multiple materials
 */
export async function getBatchPrices(materialKeys: string[]): Promise<Map<string, LivePrice>> {
  const result = new Map<string, LivePrice>();

  // Check cache first
  const uncached: string[] = [];
  materialKeys.forEach(key => {
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result.set(key, cached.data);
    } else {
      uncached.push(key);
    }
  });

  if (uncached.length === 0) return result;

  // Fetch uncached prices from database
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: observations } = await supabase
    .from('price_observations')
    .select('*')
    .in('material_key', uncached)
    .gte('scraped_at', thirtyDaysAgo.toISOString())
    .in('review_status', ['auto', 'confirmed'])
    .order('scraped_at', { ascending: false });

  // Group by material and take latest
  const latestByMaterial = new Map<string, PriceObservation>();
  if (observations) {
    (observations as PriceObservation[]).forEach(obs => {
      if (!latestByMaterial.has(obs.material_key)) {
        latestByMaterial.set(obs.material_key, obs);
      }
    });
  }

  // Process each uncached material
  uncached.forEach(key => {
    const obs = latestByMaterial.get(key);

    if (obs && obs.price_usd !== null) {
      const livePrice: LivePrice = {
        materialKey: obs.material_key,
        priceUsd: obs.price_usd,
        priceZwg: obs.price_zwg || obs.price_usd * 30,
        source: 'scraped',
        confidence: obs.confidence,
        lastUpdated: new Date(obs.scraped_at),
        supplierName: obs.supplier_name || undefined,
        location: obs.location || undefined,
      };
      result.set(key, livePrice);
      priceCache.set(key, { data: livePrice, timestamp: Date.now() });
    } else {
      // Fall back to static
      const staticPrice = getStaticBestPrice(key);
      if (staticPrice) {
        const livePrice: LivePrice = {
          materialKey: key,
          priceUsd: staticPrice.priceUsd,
          priceZwg: staticPrice.priceZwg,
          source: 'static',
          confidence: 3,
          lastUpdated: new Date(staticPrice.lastUpdated),
        };
        result.set(key, livePrice);
        priceCache.set(key, { data: livePrice, timestamp: Date.now() });
      }
    }
  });

  return result;
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 4) return 'High';
  if (confidence >= 3) return 'Medium';
  if (confidence >= 2) return 'Low';
  return 'Very Low';
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 4) return '#16a34a'; // green
  if (confidence >= 3) return '#eab308'; // yellow
  if (confidence >= 2) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Format relative time for "Last Updated" display
 */
export function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Clear the price cache (useful after scraping)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
