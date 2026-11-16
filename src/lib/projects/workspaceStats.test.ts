import { describe, expect, it } from 'vitest';
import {
    applyItemUpdate,
    changesItemTotal,
    completionRate,
    computePurchaseStats,
    feeItemsOf,
    materialItemsOf,
    sumItemTotals,
    sumUsageByItem,
} from './workspaceStats';
import { boqItem } from './testItems';

describe('splitting BOQ lines', () => {
    const cement = boqItem({ category: 'substructure' });
    const fee = boqItem({ category: 'project_fees', material_id: 'fee-plan-approval' });
    const stageLabour = boqItem({ category: 'labor_superstructure', material_id: 'labor-bricklaying' });
    const oldLabour = boqItem({ category: 'labor', material_id: 'labor-foreman' });
    const all = [cement, fee, stageLabour, oldLabour];

    it('keeps fee lines apart', () => {
        expect(feeItemsOf(all)).toEqual([fee]);
    });

    it('treats only non-fee, non-labour lines as materials', () => {
        expect(materialItemsOf(all)).toEqual([cement]);
    });
});

describe('purchase stats', () => {
    it('is all zeros for an empty BOQ', () => {
        const stats = computePurchaseStats([], []);
        expect(stats).toEqual({
            totalItems: 0, purchasedItems: 0, estimatedTotal: 0, actualTotal: 0, actualSpent: 0,
            totalVariance: 0, totalVariancePercent: 0, priceVariance: 0, priceVariancePercent: 0,
            qtyVariance: 0, qtyVariancePercent: 0,
        });
    });

    it('falls back to the estimate where there is no actual quantity or price', () => {
        const items = [boqItem({ quantity: 10, unit_price_usd: 12 })];
        const stats = computePurchaseStats(items, items);
        expect(stats.estimatedTotal).toBe(120);
        expect(stats.actualTotal).toBe(120);
        expect(stats.totalVariance).toBe(0);
    });

    it('splits the variance into price and quantity', () => {
        const items = [boqItem({ quantity: 10, unit_price_usd: 10, actual_quantity: 12, actual_price_usd: 11, is_purchased: true })];
        const stats = computePurchaseStats(items, items);
        expect(stats.estimatedTotal).toBe(100);
        expect(stats.actualTotal).toBe(132);
        expect(stats.actualSpent).toBe(132);
        expect(stats.priceVariance).toBe(12); // (11 - 10) × 12
        expect(stats.qtyVariance).toBe(20); // (12 - 10) × 10
        expect(stats.totalVariancePercent).toBe(32);
        expect(stats.priceVariancePercent).toBe(12);
        expect(stats.qtyVariancePercent).toBe(20);
    });

    it('keeps material progress separate from the whole-project budget, including labour', () => {
        const cement = boqItem({ quantity: 10, actual_quantity: 10, unit_price_usd: 10, is_purchased: true });
        const labour = boqItem({ category: 'labor_superstructure', material_id: 'labor-bricklaying', quantity: 1, unit_price_usd: 500, is_purchased: true });
        const items = [cement, labour];
        const stats = computePurchaseStats(items, materialItemsOf(items));
        expect(stats.totalItems).toBe(1);
        expect(stats.purchasedItems).toBe(1);
        expect(stats.estimatedTotal).toBe(600);
        expect(stats.actualSpent).toBe(600);
    });

    it('spends only purchased lines', () => {
        const items = [boqItem({ quantity: 2, unit_price_usd: 5, is_purchased: false })];
        expect(computePurchaseStats(items, items).actualSpent).toBe(0);
    });

    it('reads numbers stored as strings, and treats junk as zero in the totals', () => {
        const items = [
            boqItem({ quantity: '4' as unknown as number, unit_price_usd: '2.5' as unknown as number }),
            boqItem({ quantity: Number.NaN, unit_price_usd: 3 }),
        ];
        expect(computePurchaseStats(items, items).estimatedTotal).toBe(10);
    });
});

describe('completion rate', () => {
    it('rounds to a whole percentage', () => {
        expect(completionRate({ totalItems: 3, purchasedItems: 1 })).toBe(33);
        expect(completionRate({ totalItems: 3, purchasedItems: 2 })).toBe(67);
    });

    it('is zero with nothing to buy', () => {
        expect(completionRate({ totalItems: 0, purchasedItems: 0 })).toBe(0);
    });
});

describe('usage by line', () => {
    it('adds the same line up across stages', () => {
        expect(sumUsageByItem({
            substructure: { items: [], usageByItem: { a: 5, b: 1 } },
            superstructure: { items: [], usageByItem: { a: 2.5 } },
        })).toEqual({ a: 7.5, b: 1 });
    });

    it('is empty with no stages loaded', () => {
        expect(sumUsageByItem({})).toEqual({});
    });
});

describe('editing a line', () => {
    it('works out the edited line totals again and leaves the others', () => {
        const a = boqItem({ id: 'a', quantity: 10, unit_price_usd: 10, unit_price_zwg: 270, total_usd: 100, total_zwg: 2700 });
        const b = boqItem({ id: 'b', total_usd: 999 });
        const next = applyItemUpdate([a, b], 'a', { quantity: 12 });
        expect(next[0]).toMatchObject({ quantity: 12, total_usd: 120, total_zwg: 3240 });
        expect(next[1]).toBe(b);
    });

    it('recomputes totals even when the edit is not about money', () => {
        const a = boqItem({ id: 'a', quantity: 2, unit_price_usd: 3, total_usd: 999, unit_price_zwg: 0 });
        expect(applyItemUpdate([a], 'a', { notes: 'x' })[0]).toMatchObject({ total_usd: 6, total_zwg: 0 });
    });

    it('knows which edits change the cost', () => {
        expect(changesItemTotal({ quantity: 1 })).toBe(true);
        expect(changesItemTotal({ unit_price_usd: 1 })).toBe(true);
        expect(changesItemTotal({ unit_price_zwg: 1 })).toBe(true);
        expect(changesItemTotal({ actual_price_usd: 1 })).toBe(false);
        expect(changesItemTotal({ actual_quantity: 1 })).toBe(false);
    });

    it('adds the stored line totals for the project total', () => {
        expect(sumItemTotals([boqItem({ total_usd: 100 }), boqItem({ total_usd: '50.5' as unknown as number })])).toBe(150.5);
    });
});
