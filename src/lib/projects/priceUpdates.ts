// ─── Price updates for a project's BOQ ───────────────────────────────────────
// The project workspace compares each line's average price with the latest
// weekly price and offers to apply the difference. Moved out of the page
// unchanged so it can be tested on its own.

import type { BOQItem } from '@/lib/database.types';

export type PriceUpdate = {
    itemId: string;
    materialId: string;
    materialName: string;
    currentPriceUsd: number;
    newPriceUsd: number;
    deltaPercent: number;
    lastUpdated: string;
};

export type LatestPrices = Record<string, { priceUsd: number; lastUpdated: string; sourceUrl?: string | null }>;

/** localStorage key holding when the owner last applied or ignored price updates. */
export const priceUpdateAckKey = (projectId: string) => `boq_price_update_ack_${projectId}`;

/** The stored acknowledgement as a date; nothing, or anything unreadable, is null. */
export function parseAcknowledgedAt(stored: string | null): Date | null {
    if (!stored) return null;
    const parsed = new Date(stored);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * One update per BOQ line whose latest price differs by a cent or more from
 * the line's average price, skipping prices no newer than the acknowledgement.
 * A line priced at zero gets a 0% change rather than an infinite one.
 */
export function findPriceUpdates(items: BOQItem[], prices: LatestPrices, acknowledgedAt: Date | null): PriceUpdate[] {
    const updates: PriceUpdate[] = [];

    items.forEach((item) => {
        const latest = prices[item.material_id];
        if (!latest) return;
        const latestDate = new Date(latest.lastUpdated);
        if (acknowledgedAt && latestDate <= acknowledgedAt) return;

        const currentPrice = Number(item.unit_price_usd) || 0;
        const nextPrice = Number(latest.priceUsd);
        if (Math.abs(nextPrice - currentPrice) < 0.01) return;

        const deltaPercent = currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;
        updates.push({
            itemId: item.id,
            materialId: item.material_id,
            materialName: item.material_name,
            currentPriceUsd: currentPrice,
            newPriceUsd: nextPrice,
            deltaPercent,
            lastUpdated: latest.lastUpdated,
        });
    });

    return updates;
}

/** "Cement, Sand, Paint +2 more": the first three material names. */
export function priceUpdatePreview(updates: PriceUpdate[]): string {
    if (updates.length === 0) return '';
    const names = [...new Set(updates.map((update) => update.materialName))];
    const suffix = names.length > 3 ? ` +${names.length - 3} more` : '';
    return `${names.slice(0, 3).join(', ')}${suffix}`;
}

/** The newest price date among the updates, or null when there are none. */
export function latestPriceUpdateAt(updates: PriceUpdate[]): Date | null {
    if (updates.length === 0) return null;
    return updates.reduce((latest, update) => {
        const updateDate = new Date(update.lastUpdated);
        if (!latest) return updateDate;
        return updateDate > latest ? updateDate : latest;
    }, null as Date | null);
}

/** The lines with the new average prices in place (USD, and ZWG at the given rate). */
export function applyPriceUpdatesToItems(items: BOQItem[], updates: PriceUpdate[], exchangeRate: number): BOQItem[] {
    const updatesById = new Map<string, PriceUpdate>();
    updates.forEach((update) => updatesById.set(update.itemId, update));
    return items.map((item) => {
        const update = updatesById.get(item.id);
        if (!update) return item;
        return {
            ...item,
            unit_price_usd: update.newPriceUsd,
            unit_price_zwg: update.newPriceUsd * exchangeRate,
        };
    });
}

/** Quantity × average price over every line. */
export const estimateFromPrices = (items: BOQItem[]): number =>
    items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const priceUsd = Number(item.unit_price_usd) || 0;
        return sum + qty * priceUsd;
    }, 0);
