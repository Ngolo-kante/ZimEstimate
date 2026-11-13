import { describe, expect, it } from 'vitest';
import {
    filterProcurementItems,
    groupProcurementItems,
    groupStats,
    procurementItemStatus,
    procurementStats,
    purchasesCsv,
    spendingBarColor,
    toIsoMidday,
    validatePurchaseForm,
    withPurchases,
} from './procurement';
import { boqItem, purchaseRecord } from './testItems';

describe('purchase status in procurement', () => {
    it('follows purchases against the estimate, to within 0.01', () => {
        expect(procurementItemStatus(10, 0)).toBe('pending');
        expect(procurementItemStatus(10, 4)).toBe('in_progress');
        expect(procurementItemStatus(10, 9.995)).toBe('purchased');
        expect(procurementItemStatus(10, 10.02)).toBe('over_purchased');
    });

    it('includes typed actual quantities in status, remaining quantity and spend', () => {
        const [line] = withPurchases([boqItem({ id: 'a', quantity: 10, actual_quantity: 10 })], []);
        expect(line.status).toBe('purchased');
        expect(line.totalPurchased).toBe(10);
        expect(line.remainingQty).toBe(0);
        expect(line.totalSpent).toBe(10 * line.unit_price_usd);
    });
});

describe('lines with their purchases', () => {
    it('does not add stored actual quantities to the same logged purchases', () => {
        const [line] = withPurchases([boqItem({ id: 'a', quantity: 10, actual_quantity: 5, actual_price_usd: 12 })], [
            purchaseRecord({ boq_item_id: 'a', quantity: 5, unit_price_usd: 12 }),
        ]);
        expect(line.totalPurchased).toBe(5);
        expect(line.totalSpent).toBe(60);
        expect(line.remainingQty).toBe(5);
    });

    it('uses the same status as BOQ for partial and over purchases', () => {
        const items = [boqItem({ id: 'a', quantity: 10, actual_quantity: 4 }), boqItem({ id: 'b', quantity: 10, actual_quantity: 11 })];
        expect(withPurchases(items, []).map(i => i.status)).toEqual(['in_progress', 'over_purchased']);
    });
    it('adds purchases up, newest first, with what is left to buy', () => {
        const [line] = withPurchases([boqItem({ id: 'a', quantity: 10 })], [
            purchaseRecord({ boq_item_id: 'a', quantity: 3, unit_price_usd: 10, purchased_at: '2026-09-01' }),
            purchaseRecord({ boq_item_id: 'a', quantity: 2, unit_price_usd: 12, purchased_at: '2026-10-01' }),
            purchaseRecord({ boq_item_id: 'b', quantity: 99 }),
        ]);
        expect(line.totalPurchased).toBe(5);
        expect(line.totalSpent).toBe(54);
        expect(line.remainingQty).toBe(5);
        expect(line.status).toBe('in_progress');
        expect(line.purchaseRecords.map((p) => p.purchased_at)).toEqual(['2026-10-01', '2026-09-01']);
    });
});

describe('searching and filtering', () => {
    const lines = withPurchases([
        boqItem({ id: 'a', material_name: 'Cement', category: 'substructure', quantity: 10 }),
        boqItem({ id: 'b', material_name: 'Roof tile', category: 'roofing', quantity: 10 }),
        boqItem({ id: 'c', material_name: 'Paint', category: 'finishing', quantity: 1 }),
    ], [purchaseRecord({ boq_item_id: 'b', quantity: 5 }), purchaseRecord({ boq_item_id: 'c', quantity: 2 })]);

    it('searches name and category, ignoring case', () => {
        expect(filterProcurementItems(lines, 'CEMENT', 'all').map((l) => l.id)).toEqual(['a']);
        expect(filterProcurementItems(lines, 'roof', 'all').map((l) => l.id)).toEqual(['b']);
    });

    it('filters outstanding, fulfilled, or one status', () => {
        expect(filterProcurementItems(lines, '', 'outstanding').map((l) => l.id)).toEqual(['a', 'b']);
        expect(filterProcurementItems(lines, '', 'fulfilled').map((l) => l.id)).toEqual(['c']);
        expect(filterProcurementItems(lines, '', 'in_progress').map((l) => l.id)).toEqual(['b']);
    });
});

describe('grouping', () => {
    const lines = withPurchases([
        boqItem({ id: 'r', category: 'roofing' }),
        boqItem({ id: 'x', category: 'labor_roofing' }),
        boqItem({ id: 's', category: 'substructure' }),
    ], []);

    it('puts stages in building order, then anything else', () => {
        expect(Object.keys(groupProcurementItems(lines, 'stage'))).toEqual(['substructure', 'roofing', 'labor_roofing']);
    });

    it('can group by category or not at all', () => {
        expect(Object.keys(groupProcurementItems(lines, 'category'))).toEqual(['roofing', 'labor_roofing', 'substructure']);
        expect(Object.keys(groupProcurementItems(lines, 'none'))).toEqual(['All Items']);
    });

    it('counts and sums a group', () => {
        const g = withPurchases([boqItem({ id: 'a', quantity: 2 }), boqItem({ id: 'b', quantity: 4 })], [
            purchaseRecord({ boq_item_id: 'a', quantity: 2, unit_price_usd: 5 }),
            purchaseRecord({ boq_item_id: 'b', quantity: 1, unit_price_usd: 3 }),
        ]);
        expect(groupStats(g)).toEqual({ total: 2, purchased: 1, inProgress: 1, totalSpent: 13 });
    });
});

describe('summary figures', () => {
    it('budgets from the lines, falling back to the project total, and counts open quotes', () => {
        const items = [boqItem({ id: 'a', quantity: 10, unit_price_usd: 10 })];
        const lines = withPurchases(items, [purchaseRecord({ boq_item_id: 'a', quantity: 10, unit_price_usd: 12 })]);
        const stats = procurementStats(items, lines, [{ status: 'open' }, { status: 'draft' }, { status: 'closed' }], 5000);
        expect(stats).toMatchObject({
            totalBudget: 100, totalSpent: 120, remainingBudget: -20, variance: 20, pendingRfqs: 2,
            spendingProgress: 120, purchaseProgress: 100, fulfilledItems: 1, outstandingItems: 0, totalItems: 1,
        });
        const unpriced = [boqItem({ id: 'b', unit_price_usd: 0 })];
        expect(procurementStats(unpriced, withPurchases(unpriced, []), [], 5000).totalBudget).toBe(5000);
        expect(procurementStats([], [], [], null).spendingProgress).toBe(0);
    });

    it('colours the spend bar by how far through the budget it is', () => {
        expect(spendingBarColor(50)).toBe('var(--color-accent)');
        expect(spendingBarColor(80)).toBe('var(--color-amber)');
        expect(spendingBarColor(101)).toBe('var(--color-danger)');
    });
});

describe('the purchase form', () => {
    const ok = { supplierName: 'Halsted', quantity: '2', unitPrice: '11.5', purchasedAt: '2026-11-10', notes: '', receiptFile: null };

    it('accepts a complete form', () => {
        expect(validatePurchaseForm(ok)).toEqual({});
    });

    it('needs a supplier, a positive quantity and price, and a date', () => {
        expect(validatePurchaseForm({ ...ok, supplierName: '  ', quantity: '0', unitPrice: 'abc', purchasedAt: '' })).toEqual({
            supplierName: 'Supplier name is required',
            quantity: 'Enter a valid quantity greater than 0',
            unitPrice: 'Enter a valid unit price greater than 0',
            purchasedAt: 'Purchase date is required',
        });
    });

    it('stores the date as noon UTC', () => {
        expect(toIsoMidday('2026-11-10')).toBe('2026-11-10T12:00:00.000Z');
    });
});

describe('CSV export', () => {
    it('writes one row per purchase and preserves commas in notes', () => {
        const items = [boqItem({ id: 'a', material_name: 'Cement', category: 'substructure', unit: 'bag' })];
        const csv = purchasesCsv([purchaseRecord({ boq_item_id: 'a', supplier_name: 'Halsted', quantity: 2, unit_price_usd: 11.5, notes: 'first, second', purchased_at: '2026-11-10T12:00:00.000Z' })], items);
        const [header, row] = csv.split('\n');
        expect(header).toBe('Date,Material,Category,Supplier,Quantity,Unit,Unit Price (USD),Total (USD),Notes');
        expect(row.endsWith(',Cement,substructure,Halsted,2.00,bag,11.50,23.00,"first, second"')).toBe(true);
    });

    it('quotes every field containing commas, quotes or newlines', () => {
        const items = [boqItem({ id: 'a', material_name: 'Brick, common', category: 'Walls', unit: 'each' })];
        const csv = purchasesCsv([purchaseRecord({ boq_item_id: 'a', supplier_name: 'Joe "Builder", Ltd', notes: 'first\nsecond', quantity: 2, unit_price_usd: 5 })], items);
        expect(csv).toContain(',"Brick, common",Walls,"Joe ""Builder"", Ltd",2.00,each,5.00,10.00,"first\nsecond"');
    });
});
