// ─── Project workspace sums ───────────────────────────────────────────────────
// What the project workspace (/projects/[id]) works out from a project's BOQ
// lines, moved out of the page unchanged so it can be tested on its own.

import { isExtrasLabourLine } from '@/lib/projectFees';
import { isLaborCategory } from '@/lib/calculations/laborSubstages';
import type { BOQItem } from '@/lib/database.types';

/** Professional and council fee lines, shown in their own panel. */
export const feeItemsOf = (items: BOQItem[]): BOQItem[] =>
    items.filter((item) => item.category === 'project_fees');

/** Lines that are materials to buy: not fees, not labour, not house-extras labour. */
export const materialItemsOf = (items: BOQItem[]): BOQItem[] =>
    items.filter((item) => item.category !== 'project_fees' && !isLaborCategory(item.category) && !isExtrasLabourLine(item.material_id));

export interface PurchaseStats {
    /** Material lines only. */
    totalItems: number;
    /** Material lines marked purchased. */
    purchasedItems: number;
    /** Every line, fees and labour included: quantity × average price. */
    estimatedTotal: number;
    /** Every line at its actual quantity and price, falling back to the estimate. */
    actualTotal: number;
    /** Every purchased line at its actual quantity and price. */
    actualSpent: number;
    totalVariance: number;
    totalVariancePercent: number;
    priceVariance: number;
    priceVariancePercent: number;
    qtyVariance: number;
    qtyVariancePercent: number;
}

/**
 * Material progress and whole-project money have separate scopes. The UI
 * labels these "Materials purchased" and "Project estimate" so fees and
 * labour remain included in budgets and savings plans.
 */
export function computePurchaseStats(items: BOQItem[], materialItems: BOQItem[]): PurchaseStats {
    const totalItems = materialItems.length;
    const purchasedItems = materialItems.filter(i => i.is_purchased).length;
    const totals = items.reduce(
        (acc, item) => {
            const estimatedQty = Number(item.quantity) || 0;
            const averagePrice = Number(item.unit_price_usd) || 0;
            const actualQty = Number(item.actual_quantity ?? item.quantity) || 0;
            const actualPrice = Number(item.actual_price_usd ?? item.unit_price_usd) || 0;

            const estimatedTotal = estimatedQty * averagePrice;
            const actualTotal = actualQty * actualPrice;
            const priceVariance = (actualPrice - averagePrice) * actualQty;
            const qtyVariance = (actualQty - estimatedQty) * averagePrice;

            return {
                estimatedTotal: acc.estimatedTotal + estimatedTotal,
                actualTotal: acc.actualTotal + actualTotal,
                priceVariance: acc.priceVariance + priceVariance,
                qtyVariance: acc.qtyVariance + qtyVariance,
            };
        },
        { estimatedTotal: 0, actualTotal: 0, priceVariance: 0, qtyVariance: 0 }
    );

    const actualSpent = items
        .filter(item => item.is_purchased)
        .reduce((sum, item) => {
            const qty = item.actual_quantity ?? item.quantity;
            const price = item.actual_price_usd ?? item.unit_price_usd;
            return sum + (Number(qty) * Number(price));
        }, 0);

    const totalVariance = totals.actualTotal - totals.estimatedTotal;
    const totalVariancePercent = totals.estimatedTotal > 0
        ? (totalVariance / totals.estimatedTotal) * 100
        : 0;
    const priceVariancePercent = totals.estimatedTotal > 0
        ? (totals.priceVariance / totals.estimatedTotal) * 100
        : 0;
    const qtyVariancePercent = totals.estimatedTotal > 0
        ? (totals.qtyVariance / totals.estimatedTotal) * 100
        : 0;

    return {
        totalItems,
        purchasedItems,
        estimatedTotal: totals.estimatedTotal,
        actualTotal: totals.actualTotal,
        actualSpent,
        totalVariance,
        totalVariancePercent,
        priceVariance: totals.priceVariance,
        priceVariancePercent,
        qtyVariance: totals.qtyVariance,
        qtyVariancePercent,
    };
}

/** Share of material lines purchased, as a whole percentage. */
export const completionRate = (stats: Pick<PurchaseStats, 'totalItems' | 'purchasedItems'>): number =>
    stats.totalItems > 0
        ? Math.round((stats.purchasedItems / stats.totalItems) * 100)
        : 0;

export type UsageByStage = Record<string, { items: BOQItem[]; usageByItem: Record<string, number> }>;

/** Usage per BOQ line across every stage. */
export function sumUsageByItem(usageByStage: UsageByStage): Record<string, number> {
    const allUsage: Record<string, number> = {};
    Object.values(usageByStage).forEach(stageData => {
        Object.entries(stageData.usageByItem).forEach(([itemId, usage]) => {
            allUsage[itemId] = (allUsage[itemId] || 0) + usage;
        });
    });
    return allUsage;
}

/** One line edited: the edit applied, and that line's totals worked out again. */
export function applyItemUpdate(items: BOQItem[], itemId: string, updates: Partial<BOQItem>): BOQItem[] {
    return items.map(i => {
        if (i.id !== itemId) return i;
        const next = { ...i, ...updates };
        const qty = Number(next.quantity) || 0;
        const priceUsd = Number(next.unit_price_usd) || 0;
        const priceZwg = Number(next.unit_price_zwg) || 0;
        return {
            ...next,
            total_usd: qty * priceUsd,
            total_zwg: qty * priceZwg,
        };
    });
}

/** Does this edit change what the line costs? */
export const changesItemTotal = (updates: Partial<BOQItem>): boolean =>
    'quantity' in updates || 'unit_price_usd' in updates || 'unit_price_zwg' in updates;

/** The project total from the lines' stored totals. */
export const sumItemTotals = (items: BOQItem[]): number =>
    items.reduce((sum, i) => sum + Number(i.total_usd), 0);
