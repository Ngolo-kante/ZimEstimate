// ─── Purchase status of a BOQ line ───────────────────────────────────────────
// Shared by the BOQ table and procurement. Icons stay with the components.

import type { BOQItem, PurchaseRecord } from '@/lib/database.types';

export type ItemStatus = 'pending' | 'in_progress' | 'purchased' | 'over_purchased';

/**
 * How much of a line has been bought: the larger of the logged purchases and
 * the line's own actual quantity, compared with the estimate to within 0.01.
 */
export function getItemStatus(item: BOQItem, purchases: PurchaseRecord[]): ItemStatus {
    const totalPurchased = purchasedQuantity(item, purchases);
    return purchaseStatus(Number(item.quantity) || 0, totalPurchased);
}

export function purchasedQuantity(item: BOQItem, purchases: PurchaseRecord[]): number {
    const itemPurchases = purchases.filter(p => p.boq_item_id === item.id);
    const purchasedFromRecords = itemPurchases.reduce((sum, p) => sum + Number(p.quantity), 0);
    const purchasedFromItem = Number(item.actual_quantity ?? 0);
    return Math.max(purchasedFromRecords, purchasedFromItem);
}

export function purchaseStatus(estimatedQty: number, totalPurchased: number): ItemStatus {
    const epsilon = 0.01;

    if (totalPurchased < epsilon) return 'pending';
    if (totalPurchased >= estimatedQty - epsilon && totalPurchased <= estimatedQty + epsilon) return 'purchased';
    if (totalPurchased > estimatedQty + epsilon) return 'over_purchased';
    return 'in_progress';
}

/** The label and CSS class for each status. */
export function getStatusConfig(status: ItemStatus): { label: string; className: string } {
    switch (status) {
        case 'pending':
            return { label: 'Pending', className: 'pending' };
        case 'in_progress':
            return { label: 'In Progress', className: 'in-progress' };
        case 'purchased':
            return { label: 'Purchased', className: 'purchased' };
        case 'over_purchased':
            return { label: 'Over Purchased', className: 'over-purchased' };
    }
}

const ENABLEMENT_ITEM_TAG = '[Enablement Cost]';

/** A line whose note starts with the enablement tag. */
export const isEnablementItem = (notes?: string | null) =>
    (notes || '').startsWith(ENABLEMENT_ITEM_TAG);

/** The note without the enablement tag, for display. */
export const stripEnablementTag = (notes?: string | null) => {
    if (!notes) return '';
    return notes.startsWith(ENABLEMENT_ITEM_TAG)
        ? notes.replace(ENABLEMENT_ITEM_TAG, '').trim()
        : notes;
};
