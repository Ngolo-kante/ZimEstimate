// ─── Buying and quotes ───────────────────────────────────────────────────────
// What the procurement view works out from BOQ lines, purchases and quote
// requests, shared by the procurement components.

import type { BOQItem, PurchaseRecord } from '@/lib/database.types';
import { purchasedQuantity, purchaseStatus } from './itemStatus';

export type ProcurementStage = 'boq' | 'rfq' | 'history';
export type ProcurementItemStatus = 'pending' | 'in_progress' | 'purchased' | 'over_purchased';
export type StatusFilter = ProcurementItemStatus | 'all' | 'outstanding' | 'fulfilled';
export type GroupByOption = 'stage' | 'category' | 'none';
export type BOQStage = 'substructure' | 'superstructure' | 'roofing' | 'finishing' | 'services' | 'exterior';

export const PROCUREMENT_STAGE_ORDER: BOQStage[] = ['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior'];

export interface ItemWithPurchases extends BOQItem {
    purchaseRecords: PurchaseRecord[];
    totalPurchased: number;
    totalSpent: number;
    status: ProcurementItemStatus;
    remainingQty: number;
}

/** Shared with the BOQ table, including typed actual quantities. */
export const procurementItemStatus = purchaseStatus;

/** Each line with its purchases (newest first), totals and status. */
export function withPurchases(items: BOQItem[], purchases: PurchaseRecord[]): ItemWithPurchases[] {
    const purchasesByItem = new Map<string, PurchaseRecord[]>();

    purchases.forEach((p) => {
        const list = purchasesByItem.get(p.boq_item_id) || [];
        list.push(p);
        purchasesByItem.set(p.boq_item_id, list);
    });

    return items.map((item) => {
        const itemPurchases = purchasesByItem.get(item.id) || [];
        const totalPurchased = purchasedQuantity(item, itemPurchases);
        const recordedQty = itemPurchases.reduce((sum, p) => sum + Number(p.quantity), 0);
        const recordedSpend = itemPurchases.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price_usd), 0);
        const unloggedQty = Math.max(0, totalPurchased - recordedQty);
        const totalSpent = recordedSpend + unloggedQty * Number(item.actual_price_usd ?? item.unit_price_usd);
        const estimatedQty = Number(item.quantity) || 0;
        const status = procurementItemStatus(estimatedQty, totalPurchased);
        const remainingQty = Math.max(0, estimatedQty - totalPurchased);

        return {
            ...item,
            purchaseRecords: itemPurchases.sort((a, b) =>
                new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
            ),
            totalPurchased,
            totalSpent,
            status,
            remainingQty,
        };
    });
}

/** Search by material name or category, then filter by status. */
export function filterProcurementItems(items: ItemWithPurchases[], searchQuery: string, statusFilter: StatusFilter): ItemWithPurchases[] {
    let result = items;

    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        result = result.filter((item) =>
            item.material_name.toLowerCase().includes(lowerQuery) ||
            item.category?.toLowerCase().includes(lowerQuery)
        );
    }

    if (statusFilter === 'outstanding') {
        result = result.filter((item) => item.status === 'pending' || item.status === 'in_progress');
    } else if (statusFilter === 'fulfilled') {
        result = result.filter((item) => item.status === 'purchased' || item.status === 'over_purchased');
    } else if (statusFilter !== 'all') {
        result = result.filter((item) => item.status === statusFilter);
    }

    return result;
}

/** Groups by stage (in building order, others after), by category, or one group. */
export function groupProcurementItems(items: ItemWithPurchases[], groupBy: GroupByOption): Record<string, ItemWithPurchases[]> {
    if (groupBy === 'none') {
        return { 'All Items': items };
    }

    const groups: Record<string, ItemWithPurchases[]> = {};

    items.forEach((item) => {
        const key = groupBy === 'stage'
            ? (item.category?.toLowerCase() as BOQStage) || 'other'
            : item.category || 'Uncategorized';

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    });

    if (groupBy === 'stage') {
        const sortedGroups: Record<string, ItemWithPurchases[]> = {};

        PROCUREMENT_STAGE_ORDER.forEach((stage) => {
            if (groups[stage]) {
                sortedGroups[stage] = groups[stage];
            }
        });

        Object.keys(groups).forEach((key) => {
            if (!sortedGroups[key]) {
                sortedGroups[key] = groups[key];
            }
        });

        return sortedGroups;
    }

    return groups;
}

export type ProcurementStats = ReturnType<typeof procurementStats>;

/**
 * The budget is the lines' quantity × average price, or the project total
 * when that comes to nothing. Spend includes logged and manually entered purchases.
 */
export function procurementStats(
    items: BOQItem[],
    itemsWithPurchases: ItemWithPurchases[],
    rfqs: Array<{ status: string }>,
    projectTotalUsd: number | null | undefined,
) {
    const boqEstimate = items.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price_usd) || 0),
        0
    );
    const totalBudget = boqEstimate || projectTotalUsd || 0;
    const totalSpent = itemsWithPurchases.reduce((sum, item) => sum + item.totalSpent, 0);
    const pendingRfqs = rfqs.filter(r => r.status === 'open' || r.status === 'draft').length;

    const statusCounts = {
        pending: itemsWithPurchases.filter(i => i.status === 'pending').length,
        in_progress: itemsWithPurchases.filter(i => i.status === 'in_progress').length,
        purchased: itemsWithPurchases.filter(i => i.status === 'purchased').length,
        over_purchased: itemsWithPurchases.filter(i => i.status === 'over_purchased').length,
    };

    const fulfilledItems = statusCounts.purchased + statusCounts.over_purchased;
    const outstandingItems = statusCounts.pending + statusCounts.in_progress;

    return {
        totalBudget,
        totalSpent,
        remainingBudget: totalBudget - totalSpent,
        variance: totalSpent - totalBudget,
        pendingRfqs,
        statusCounts,
        spendingProgress: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
        purchaseProgress: items.length > 0 ? (fulfilledItems / items.length) * 100 : 0,
        fulfilledItems,
        outstandingItems,
        totalItems: items.length,
    };
}

/** Counts and spend for one group of lines. */
export function groupStats(stageItems: ItemWithPurchases[]) {
    const total = stageItems.length;
    const purchased = stageItems.filter(i => i.status === 'purchased').length;
    const inProgress = stageItems.filter(i => i.status === 'in_progress').length;
    const totalSpent = stageItems.reduce((sum, i) => sum + i.totalSpent, 0);
    return { total, purchased, inProgress, totalSpent };
}

/** Red over budget, amber past three quarters, blue otherwise. */
export const spendingBarColor = (spendingProgress: number) =>
    spendingProgress > 100
        ? 'var(--color-danger)'
        : spendingProgress > 75
            ? 'var(--color-amber)'
            : 'var(--color-accent)';

/** A yyyy-mm-dd date as noon UTC that day, so no time zone moves it; today when empty. */
export const toIsoMidday = (dateString: string) => {
    if (!dateString) return new Date().toISOString();
    const [year, month, day] = dateString.split('-').map(Number);
    const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return safeDate.toISOString();
};

export interface PurchaseFormValues {
    supplierName: string;
    quantity: string;
    unitPrice: string;
    purchasedAt: string;
    notes: string;
    receiptFile: File | null;
}

export interface PurchaseFormErrors {
    supplierName?: string;
    quantity?: string;
    unitPrice?: string;
    purchasedAt?: string;
}

/** What is wrong with the purchase form; empty when it can be saved. */
export function validatePurchaseForm(purchaseForm: PurchaseFormValues): PurchaseFormErrors {
    const errors: PurchaseFormErrors = {};

    if (!purchaseForm.supplierName.trim()) {
        errors.supplierName = 'Supplier name is required';
    }

    const quantity = Number(purchaseForm.quantity);
    if (!purchaseForm.quantity || isNaN(quantity) || quantity <= 0) {
        errors.quantity = 'Enter a valid quantity greater than 0';
    }

    const unitPrice = Number(purchaseForm.unitPrice);
    if (!purchaseForm.unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
        errors.unitPrice = 'Enter a valid unit price greater than 0';
    }

    if (!purchaseForm.purchasedAt) {
        errors.purchasedAt = 'Purchase date is required';
    }

    return errors;
}

/** Preserve commas, quotes and newlines in every CSV field. */
const csvField = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** One CSV row per purchase. */
export function purchasesCsv(purchases: PurchaseRecord[], items: BOQItem[]): string {
    const itemMap = new Map(items.map(i => [i.id, i]));
    const headers = ['Date', 'Material', 'Category', 'Supplier', 'Quantity', 'Unit', 'Unit Price (USD)', 'Total (USD)', 'Notes'];
    const rows = purchases.map(record => {
        const item = itemMap.get(record.boq_item_id);
        const qty = Number(record.quantity);
        const price = Number(record.unit_price_usd);
        return [
            new Date(record.purchased_at).toLocaleDateString(),
            item?.material_name || 'Unknown',
            item?.category || '',
            record.supplier_name,
            qty.toFixed(2),
            item?.unit || '',
            price.toFixed(2),
            (qty * price).toFixed(2),
            record.notes || '',
        ].map(csvField).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}
