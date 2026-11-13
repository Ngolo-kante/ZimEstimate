'use client';

import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem } from '@/lib/database.types';
import type { ItemWithPurchases } from '@/lib/projects/procurement';
import { getStatusConfig } from './procurementConfig';
import { CaretDown, CaretUp, Paperclip, Plus, Receipt, Storefront } from '@phosphor-icons/react';

export interface ProcurementItemCardProps {
  item: ItemWithPurchases;
  isExpanded: boolean;
  isSaving: boolean;
  toggleItemExpanded: (itemId: string) => void;
  openPurchaseModal: (item: BOQItem) => void;
  onOpenReceipt: (documentId: string | null) => void;
}

/** One BOQ line: how much is bought, and its purchases when opened. */
export default function ProcurementItemCard({
  item,
  isExpanded,
  isSaving,
  toggleItemExpanded,
  openPurchaseModal,
  onOpenReceipt,
}: ProcurementItemCardProps) {
  const { formatPrice, exchangeRate } = useCurrency();
    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;
    const progressPercent = item.quantity > 0
      ? Math.min(100, (item.totalPurchased / Number(item.quantity)) * 100)
      : 0;

    return (
      <div key={item.id} className={`boq-item-card !rounded-lg ${statusConfig.bgClass} ${isSaving ? 'is-saving' : ''}`}>
        <div
          className="item-main"
          onClick={() => item.purchaseRecords.length > 0 && toggleItemExpanded(item.id)}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && item.purchaseRecords.length > 0 && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              toggleItemExpanded(item.id);
            }
          }}
          role={item.purchaseRecords.length > 0 ? 'button' : undefined}
          tabIndex={item.purchaseRecords.length > 0 ? 0 : undefined}
          aria-expanded={item.purchaseRecords.length > 0 ? isExpanded : undefined}
          aria-label={item.purchaseRecords.length > 0 ? `${item.material_name}: ${isExpanded ? 'hide' : 'show'} purchase history` : undefined}
        >
          <div className="item-expand">
            {item.purchaseRecords.length > 0 ? (
              isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />
            ) : (
              <span className="expand-placeholder" />
            )}
          </div>

          <div className="item-info">
            <div className="item-name">{item.material_name}</div>
            <div className="item-meta">
              {item.category && <span className="item-category">{item.category}</span>}
              <span className="item-unit">{item.unit}</span>
              {item.purchaseRecords.length > 0 && (
                <span className="purchase-count">{item.purchaseRecords.length} purchase{item.purchaseRecords.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          <div className="item-quantities">
            <div className="qty-group">
              <span className="qty-label">BOQ</span>
              <span className="qty-value">{Number(item.quantity).toFixed(1)}</span>
            </div>
            <div className="qty-group">
              <span className="qty-label">Bought</span>
              <span className="qty-value purchased">{item.totalPurchased.toFixed(1)}</span>
            </div>
            <div className="qty-group">
              <span className="qty-label">Left</span>
              <span className={`qty-value ${item.remainingQty <= 0 ? 'complete' : 'remaining'}`}>
                {item.remainingQty.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="item-progress">
            <div
              className="progress-bar"
              role="progressbar"
              aria-label={`${item.material_name} purchased`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent)}
            >
              <div
                className={`progress-fill ${statusConfig.bgClass}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="progress-text">{progressPercent.toFixed(0)}%</span>
          </div>

          <div className="item-spent">
            <span className="spent-label">Spent</span>
            <span className="spent-value">
              {formatPrice(item.totalSpent, item.totalSpent * exchangeRate)}
            </span>
          </div>

          <div className={`item-status ${statusConfig.bgClass}`}>
            <StatusIcon size={14} weight="bold" />
            <span>{statusConfig.label}</span>
          </div>

          <div className="item-actions">
            <Button
              size="sm"
              className="min-h-11"
              variant="primary"
              icon={<Plus size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                openPurchaseModal(item);
              }}
            >
              <span className="btn-text">Log</span>
            </Button>
          </div>
        </div>

        {/* Expanded Purchase Ledger */}
        {isExpanded && item.purchaseRecords.length > 0 && (
          <div className="item-history">
            <div className="history-header">
              <Receipt size={14} weight="duotone" />
              <span>Purchase Ledger ({item.purchaseRecords.length} entries)</span>
            </div>
            <div className="ledger-table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th className="col-date">Date</th>
                    <th className="col-supplier">Supplier</th>
                    <th className="col-qty">Qty</th>
                    <th className="col-price">Unit Price</th>
                    <th className="col-total">Total</th>
                    <th className="col-receipt">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {item.purchaseRecords.map((record) => {
                    const recordTotal = Number(record.quantity) * Number(record.unit_price_usd);
                    const isOptimistic = record.id.startsWith('optimistic-');
                    return (
                      <tr key={record.id} className={isOptimistic ? 'optimistic-row' : ''}>
                        <td className="col-date">
                          <span className="date-text">{new Date(record.purchased_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </td>
                        <td className="col-supplier">
                          <div className="supplier-name">
                            <Storefront size={14} weight="duotone" />
                            <span>{record.supplier_name}</span>
                          </div>
                          {record.notes && <div className="supplier-notes">{record.notes}</div>}
                        </td>
                        <td className="col-qty mono">{Number(record.quantity).toFixed(2)}</td>
                        <td className="col-price mono">{formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}</td>
                        <td className="col-total mono bold">{formatPrice(recordTotal, recordTotal * exchangeRate)}</td>
                        <td className="col-receipt">
                          {record.receipt_document_id ? (
                            <button
                              className="receipt-link min-h-11 min-w-11"
                              aria-label={`Open receipt from ${record.supplier_name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenReceipt(record.receipt_document_id);
                              }}
                            >
                              <Paperclip size={12} aria-hidden="true" />
                              View
                            </button>
                          ) : (
                            <span className="no-receipt">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="footer-label">Total Purchased</td>
                    <td className="col-qty mono bold">{item.totalPurchased.toFixed(2)}</td>
                    <td></td>
                    <td className="col-total mono bold">{formatPrice(item.totalSpent, item.totalSpent * exchangeRate)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    );
}
