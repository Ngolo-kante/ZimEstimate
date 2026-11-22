'use client';

import { useSyncExternalStore } from 'react';
import { formatQuantity } from '@/lib/format';

import { Badge } from '@/components/shadcn/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/shadcn/collapsible';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem } from '@/lib/database.types';
import type { ItemWithPurchases } from '@/lib/projects/procurement';
import { getStatusConfig } from './procurementConfig';
import { CaretDown, CaretUp, Paperclip, Plus, Receipt, Storefront } from '@phosphor-icons/react';

const desktopQuery = '(min-width: 768px)';
const subscribeDesktop = (notify: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const getDesktop = () => window.matchMedia(desktopQuery).matches;
const getServerDesktop = () => false;

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
  const desktop = useSyncExternalStore(subscribeDesktop, getDesktop, getServerDesktop);
  const { formatPrice, exchangeRate } = useCurrency();
    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;
    const progressPercent = item.quantity > 0
      ? Math.min(100, (item.totalPurchased / Number(item.quantity)) * 100)
      : 0;

    return (
      <Collapsible open={desktop || isExpanded} onOpenChange={() => toggleItemExpanded(item.id)} className={cn('boq-item-card buying-item', isSaving && 'is-saving')}>
        <CollapsibleTrigger className="buying-mobile-trigger" aria-label={`${item.material_name}: ${isExpanded ? 'hide' : 'show'} purchase history`}>
          <span className="buying-mobile-name"><span className="item-name" title={item.material_name}>{item.material_name}</span><span className="buying-key-fact">{item.remainingQty <= 0 ? 'All bought' : !Number(item.unit_price_usd) ? 'No price yet' : `${formatQuantity(item.remainingQty)} ${item.unit} left`}</span><span className={cn('buying-mini-bar', item.status === 'over_purchased' ? 'is-over' : progressPercent >= 100 && 'is-full')} aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></span></span>
          <Badge className={cn('item-status', statusConfig.bgClass)}>{statusConfig.label}</Badge>
          <CaretDown aria-hidden="true" className="buying-caret" />
        </CollapsibleTrigger>
        <CollapsibleContent className="buying-details">
        <div className="item-main">
          <CollapsibleTrigger className="item-expand buying-desktop-trigger" aria-expanded={isExpanded} aria-label={`${item.material_name}: ${isExpanded ? 'hide' : 'show'} purchase history`}>
            {isExpanded ? <CaretUp weight="bold" /> : <CaretDown weight="bold" />}
          </CollapsibleTrigger>

          <div className="item-info">
            <div className="item-name" title={item.material_name}>{item.material_name}</div>{!Number(item.unit_price_usd) && <span className="muted">No price yet</span>}
            <div className="item-meta">
              {item.category && <span className="item-category">{item.category.toLowerCase() === 'labor' ? 'Labour' : item.category}</span>}
              <span className="item-unit">{item.unit}</span>
              {item.purchaseRecords.length > 0 && (
                <span className="purchase-count">{item.purchaseRecords.length} purchase{item.purchaseRecords.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          <div className="item-quantities">
            <div className="qty-group">
              <span className="qty-label">BOQ</span>
              <span className="qty-value">{formatQuantity(Number(item.quantity))}</span>
            </div>
            <div className="qty-group">
              <span className="qty-label">Bought</span>
              <span className="qty-value purchased">{formatQuantity(item.totalPurchased)}</span>
            </div>
            <div className="qty-group">
              <span className="qty-label">Left</span>
              <span className={`qty-value ${item.remainingQty <= 0 ? 'complete' : 'remaining'}`}>
                {formatQuantity(item.remainingQty)}
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
              {!Number(item.unit_price_usd) && item.totalSpent === 0 ? <span className="muted">No price yet</span> : formatPrice(item.totalSpent, item.totalSpent * exchangeRate)}
            </span>
          </div>

          <Badge className={cn("item-status", statusConfig.bgClass)}>
            <StatusIcon weight="bold" />
            <span>{statusConfig.label}</span>
          </Badge>

          <div className="item-actions">
            <Button
              size="sm"
              className="min-h-11"
              variant={item.remainingQty > 0 ? "primary" : "secondary"}
              icon={<Plus />}
              onClick={(e) => {
                e.stopPropagation();
                openPurchaseModal(item);
              }}
            >
              <span className="btn-text"><span className="buying-desktop-log">Log</span><span className="buying-mobile-log">Log purchase</span></span>
            </Button>
          </div>
        </div>

        {/* Expanded Purchase Ledger */}
        {isExpanded && item.purchaseRecords.length > 0 && (
          <div className="item-history">
            <div className="history-header">
              <Receipt size={14} weight="duotone" />
              <span>Purchase ledger ({item.purchaseRecords.length} entries)</span>
            </div>
            <div className="ledger-table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th className="col-date">Date</th>
                    <th className="col-supplier">Supplier</th>
                    <th className="col-qty">Qty</th>
                    <th className="col-price">Unit price</th>
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
                        <td className="col-qty mono">{formatQuantity(Number(record.quantity))}</td>
                        <td className="col-price mono">{Number(record.unit_price_usd) > 0 ? formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate) : <span className="muted">No price yet</span>}</td>
                        <td className="col-total mono bold">{Number(record.unit_price_usd) > 0 ? formatPrice(recordTotal, recordTotal * exchangeRate) : <span className="muted">No price yet</span>}</td>
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
                    <td colSpan={2} className="footer-label">Total purchased</td>
                    <td className="col-qty mono bold">{formatQuantity(item.totalPurchased)}</td>
                    <td></td>
                    <td className="col-total mono bold">{!Number(item.unit_price_usd) && item.totalSpent === 0 ? <span className="muted">No price yet</span> : formatPrice(item.totalSpent, item.totalSpent * exchangeRate)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        </CollapsibleContent>
      </Collapsible>
    );
}
