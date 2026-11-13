// Test helpers for the project workspace modules: a BOQ line with defaults.
import type { BOQItem, PurchaseRecord } from '@/lib/database.types';

let seq = 0;

export function boqItem(overrides: Partial<BOQItem> = {}): BOQItem {
    seq += 1;
    return {
        id: `item-${seq}`,
        project_id: 'project-1',
        material_id: 'cement-325',
        material_name: 'Standard Cement 32.5N',
        category: 'substructure',
        quantity: 10,
        unit: 'per 50kg bag',
        unit_price_usd: 10,
        unit_price_zwg: 270,
        total_usd: 100,
        total_zwg: 2700,
        notes: null,
        sort_order: seq,
        actual_quantity: null,
        actual_price_usd: null,
        is_purchased: false,
        purchased_date: null,
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}

export function purchaseRecord(overrides: Partial<PurchaseRecord> = {}): PurchaseRecord {
    seq += 1;
    return {
        id: `purchase-${seq}`,
        project_id: 'project-1',
        boq_item_id: 'item-1',
        supplier_id: null,
        supplier_name: 'Supplier',
        quantity: 1,
        unit_price_usd: 10,
        purchased_at: '2026-09-01',
        notes: null,
        receipt_document_id: null,
        created_by: 'user-1',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
        ...overrides,
    };
}
