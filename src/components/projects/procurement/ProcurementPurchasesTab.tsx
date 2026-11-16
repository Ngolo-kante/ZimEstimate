'use client';

import { formatQuantity } from '@/lib/format';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/shadcn/table';
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
          <h3>Purchase ledger</h3>
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
                <div className="buying-purchase-rows">
                  {dateRecords.map(record => {
                    const item = itemMap.get(record.boq_item_id);
                    const price = Number(record.unit_price_usd);
                    const total = Number(record.quantity) * price;
                    return <div className="buying-purchase-row" key={record.id}>
                      <div className="buying-purchase-heading"><strong title={item?.material_name}>{item?.material_name || 'Unknown'}</strong><strong>{price > 0 ? formatPrice(total, total * exchangeRate) : 'No price yet'}</strong></div>
                      <div className="buying-purchase-detail">{formatQuantity(Number(record.quantity))} × {price > 0 ? formatPrice(price, price * exchangeRate) : 'No price yet'}</div>
                      <div className="buying-purchase-detail">{record.supplier_name}{record.notes && ` · ${record.notes}`}</div>
                      {record.receipt_document_id && <button className="receipt-link min-h-11 min-w-11" aria-label={`Open receipt for ${item?.material_name || 'purchase'}`} onClick={() => onOpenReceipt(record.receipt_document_id)}><Paperclip aria-hidden="true" /> View receipt</button>}
                    </div>;
                  })}
                </div>
                <div className="buying-purchase-table"><Table className="ledger-table full-ledger">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="col-item">Material</TableHead>
                      <TableHead className="col-supplier">Supplier</TableHead>
                      <TableHead className="col-qty">Qty</TableHead>
                      <TableHead className="col-unit">Unit</TableHead>
                      <TableHead className="col-price">Unit price</TableHead>
                      <TableHead className="col-total">Total</TableHead>
                      <TableHead className="col-receipt">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateRecords.map((record) => {
                      const item = itemMap.get(record.boq_item_id);
                      const recordTotal = Number(record.quantity) * Number(record.unit_price_usd);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="col-item">
                            <span className="item-name" title={item?.material_name}>{item?.material_name || 'Unknown'}</span>
                            {item?.category && <span className="item-cat">{item.category.toLowerCase() === 'labor' ? 'Labour' : item.category}</span>}
                          </TableCell>
                          <TableCell className="col-supplier">{record.supplier_name}</TableCell>
                          <TableCell className="col-qty mono">{formatQuantity(Number(record.quantity))}</TableCell>
                          <TableCell className="col-unit">{item?.unit || '—'}</TableCell>
                          <TableCell className="col-price mono">{Number(record.unit_price_usd) > 0 ? formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate) : <span className="muted">No price yet</span>}</TableCell>
                          <TableCell className="col-total mono bold">{Number(record.unit_price_usd) > 0 ? formatPrice(recordTotal, recordTotal * exchangeRate) : <span className="muted">No price yet</span>}</TableCell>
                          <TableCell className="col-receipt">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table></div>
              </div>
            );
          })}
        </div>
      </div>
    );
}
