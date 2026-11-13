'use client';

import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem, MaterialUsage } from '@/lib/database.types';
import { Receipt } from '@phosphor-icons/react';

export interface UsageLedgerTabProps {
  usageHistory: MaterialUsage[];
  ledgerByDate: Record<string, MaterialUsage[]>;
  itemLookup: Map<string, BOQItem>;
  totalUsedCost: number;
}

/** Every usage entry, newest first, by day. */
export default function UsageLedgerTab({
  usageHistory,
  ledgerByDate,
  itemLookup,
  totalUsedCost,
}: UsageLedgerTabProps) {
  const { formatPrice, exchangeRate } = useCurrency();
  return (
    <div className="ledger-tab">
      <div className="ledger-header-bar">
        <h3>Usage Ledger</h3>
        <span className="ledger-total">
          {usageHistory.length} entries • Total: {formatPrice(totalUsedCost, totalUsedCost * exchangeRate)}
        </span>
      </div>

      {Object.keys(ledgerByDate).length === 0 ? (
        <div className="empty-ledger">
          <Receipt size={48} />
          <p>No usage records yet.</p>
          <span>Log material usage to see entries here.</span>
        </div>
      ) : (
        <div className="ledger-container">
          {Object.entries(ledgerByDate).map(([dateKey, records]) => {
            const dayTotal = records.reduce((sum, r) => {
              const item = itemLookup.get(r.boq_item_id);
              const price = Number(item?.unit_price_usd || 0);
              return sum + (r.quantity_used * price);
            }, 0);

            return (
              <div key={dateKey} className="ledger-date-group">
                <div className="ledger-date-header">
                  <span className="ledger-date">{dateKey}</span>
                  <span className="ledger-date-total">{formatPrice(dayTotal, dayTotal * exchangeRate)}</span>
                </div>
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th className="col-material">Material</th>
                      <th className="col-qty">Quantity</th>
                      <th className="col-unit">Unit</th>
                      <th className="col-price">Unit Price</th>
                      <th className="col-total">Value</th>
                      <th className="col-notes">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const item = itemLookup.get(record.boq_item_id);
                      const unitPrice = Number(item?.unit_price_usd || 0);
                      const recordValue = record.quantity_used * unitPrice;

                      return (
                        <tr key={record.id}>
                          <td className="col-material">
                            <span className="material-name">{item?.material_name || 'Unknown'}</span>
                            {item?.category && <span className="material-cat">{item.category}</span>}
                          </td>
                          <td className="col-qty mono">{record.quantity_used.toFixed(2)}</td>
                          <td className="col-unit">{item?.unit || '—'}</td>
                          <td className="col-price mono">{formatPrice(unitPrice, unitPrice * exchangeRate)}</td>
                          <td className="col-total mono bold">{formatPrice(recordValue, recordValue * exchangeRate)}</td>
                          <td className="col-notes">{record.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
