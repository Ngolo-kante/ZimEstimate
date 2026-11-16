'use client';

import UsageCompactRow from './UsageCompactRow';
import { formatQuantity } from '@/lib/format';

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
        <h3>Usage ledger</h3>
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
                <div className="usage-mobile-list">{records.map(record => {
                  const item = itemLookup.get(record.boq_item_id);
                  const price = Number(item?.unit_price_usd || 0);
                  return <UsageCompactRow key={record.id} name={item?.material_name || 'Unknown'} fact={`${formatQuantity(record.quantity_used)} ${item?.unit || ''} · ${price > 0 ? formatPrice(record.quantity_used * price, record.quantity_used * price * exchangeRate) : 'No price yet'}`}>
                    <dl><div><dt>Unit price</dt><dd>{price > 0 ? formatPrice(price, price * exchangeRate) : 'No price yet'}</dd></div><div><dt>Category</dt><dd>{item?.category || '—'}</dd></div></dl><p>{record.notes || 'No notes'}</p>
                  </UsageCompactRow>;
                })}</div>
                <table className="ledger-table usage-desktop-list">
                  <thead>
                    <tr>
                      <th className="col-material">Material</th>
                      <th className="col-qty">Quantity</th>
                      <th className="col-unit">Unit</th>
                      <th className="col-price">Unit price</th>
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
                            <span className="material-name" title={item?.material_name}>{item?.material_name || 'Unknown'}</span>
                            {item?.category && <span className="material-cat">{item.category.toLowerCase() === 'labor' ? 'Labour' : item.category}</span>}
                          </td>
                          <td className="col-qty mono">{formatQuantity(record.quantity_used)}</td>
                          <td className="col-unit">{item?.unit || '—'}</td>
                          <td className="col-price mono">{unitPrice > 0 ? formatPrice(unitPrice, unitPrice * exchangeRate) : <span className="muted">No price yet</span>}</td>
                          <td className="col-total mono bold">{unitPrice > 0 ? formatPrice(recordValue, recordValue * exchangeRate) : <span className="muted">No price yet</span>}</td>
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
