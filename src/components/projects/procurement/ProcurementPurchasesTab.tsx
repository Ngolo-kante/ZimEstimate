'use client';

import { formatQuantity } from '@/lib/format';

import EmptyState from '@/components/ui/EmptyState';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem, PurchaseRecord } from '@/lib/database.types';
import type { ProcurementStats } from '@/lib/projects/procurement';
import { Paperclip, Receipt } from '@phosphor-icons/react';

export interface ProcurementPurchasesTabProps {
  purchases: PurchaseRecord[];
  items: BOQItem[];
  stats: ProcurementStats;
  onOpenReceipt: (documentId: string | null) => void;
}

/** Every purchase, newest first, by day. */
export default function ProcurementPurchasesTab({ purchases, items, stats, onOpenReceipt }: ProcurementPurchasesTabProps) {
  const { formatPrice, exchangeRate } = useCurrency();
    const allPurchases = [...purchases].sort((a, b) =>
      new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
    );

    if (allPurchases.length === 0) {
      return (
        <EmptyState
          icon={<Receipt size={48} weight="light" />}
          title="No purchases recorded"
          description="Log purchases against BOQ items to see history here"
        />
      );
    }

    const itemMap = new Map(items.map(i => [i.id, i]));

    // Group purchases by date
    const purchasesByDate: Record<string, PurchaseRecord[]> = {};
    allPurchases.forEach((record) => {
      const dateKey = new Date(record.purchased_at).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      if (!purchasesByDate[dateKey]) {
        purchasesByDate[dateKey] = [];
      }
      purchasesByDate[dateKey].push(record);
    });

    return (
      <div className="ledger-content">
        <div className="ledger-header-bar">
          <h3>Purchase Ledger</h3>
          <span className="ledger-total">{purchases.length} {purchases.length === 1 ? 'transaction' : 'transactions'} • Total: {formatPrice(stats.totalSpent, stats.totalSpent * exchangeRate)}</span>
        </div>

        <div className="ledger-container">
          {Object.entries(purchasesByDate).map(([dateKey, dateRecords]) => {
            const dayTotal = dateRecords.reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unit_price_usd)), 0);
            return (
              <div key={dateKey} className="ledger-date-group">
                <div className="ledger-date-header">
                  <span className="ledger-date">{dateKey}</span>
                  <span className="ledger-date-total">{formatPrice(dayTotal, dayTotal * exchangeRate)}</span>
                </div>
                <table className="ledger-table full-ledger">
                  <thead>
                    <tr>
                      <th className="col-item">Material</th>
                      <th className="col-supplier">Supplier</th>
                      <th className="col-qty">Qty</th>
                      <th className="col-unit">Unit</th>
                      <th className="col-price">Unit Price</th>
                      <th className="col-total">Total</th>
                      <th className="col-receipt">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateRecords.map((record) => {
                      const item = itemMap.get(record.boq_item_id);
                      const recordTotal = Number(record.quantity) * Number(record.unit_price_usd);
                      return (
                        <tr key={record.id}>
                          <td className="col-item">
                            <span className="item-name" title={item?.material_name}>{item?.material_name || 'Unknown'}</span>
                            {item?.category && <span className="item-cat">{item.category.toLowerCase() === 'labor' ? 'Labour' : item.category}</span>}
                          </td>
                          <td className="col-supplier">{record.supplier_name}</td>
                          <td className="col-qty mono">{formatQuantity(Number(record.quantity))}</td>
                          <td className="col-unit">{item?.unit || '—'}</td>
                          <td className="col-price mono">{Number(record.unit_price_usd) > 0 ? formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate) : <span className="muted">No price yet</span>}</td>
                          <td className="col-total mono bold">{Number(record.unit_price_usd) > 0 ? formatPrice(recordTotal, recordTotal * exchangeRate) : <span className="muted">No price yet</span>}</td>
                          <td className="col-receipt">
                            {record.receipt_document_id ? (
                              <button
                                className="receipt-link min-h-11 min-w-11"
                                aria-label={`Open receipt for ${item?.material_name || 'purchase'}`}
                                onClick={() => onOpenReceipt(record.receipt_document_id)}
                              >
                                <Paperclip size={12} aria-hidden="true" />
                              </button>
                            ) : (
                              <span className="no-receipt">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    );
}
