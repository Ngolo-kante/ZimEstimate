'use client';

import InlineEdit from '@/components/ui/InlineEdit';
import PriceDisplay from '@/components/projects/PriceDisplay';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem, PurchaseRecord } from '@/lib/database.types';
import {
    getItemStatus,
    getStatusConfig as statusLabelFor,
    isEnablementItem,
    stripEnablementTag,
    type ItemStatus,
} from '@/lib/projects/itemStatus';
import type { ColumnKey } from './boqColumns';
import { Check, ClipboardText, Clock, Minus, Package, ShoppingCart, Trash, TrendDown, TrendUp, Warning } from '@phosphor-icons/react';

const STATUS_ICONS: Record<ItemStatus, typeof Clock> = {
    pending: Clock,
    in_progress: Package,
    purchased: Check,
    over_purchased: Warning,
};

function getStatusConfig(status: ItemStatus) {
    return { ...statusLabelFor(status), icon: STATUS_ICONS[status] };
}

export interface BoqItemRowProps {
    item: BOQItem;
    purchases: PurchaseRecord[];
    visibleColumns: Record<ColumnKey, boolean>;
    usageByItem?: Record<string, number>;
    usageTrackingEnabled: boolean;
    handleQuantityUpdate: (item: BOQItem, quantity: number) => Promise<void>;
    handleActualPriceUpdate: (item: BOQItem, price: number) => Promise<void>;
    handleActualQuantityUpdate: (item: BOQItem, quantity: number) => Promise<void>;
    onLogPurchase?: (item: BOQItem) => void;
    onRecordUsage?: (item: BOQItem) => void;
    onItemDelete?: (itemId: string) => Promise<void>;
}

/** One BOQ line: prices, quantities, the variances, usage, status and actions. */
export default function BoqItemRow({
    item,
    purchases,
    visibleColumns,
    usageByItem,
    usageTrackingEnabled,
    handleQuantityUpdate,
    handleActualPriceUpdate,
    handleActualQuantityUpdate,
    onLogPurchase,
    onRecordUsage,
    onItemDelete,
}: BoqItemRowProps) {
    const { formatPrice, exchangeRate } = useCurrency();
    const averagePrice = Number(item.unit_price_usd);
    const actualPrice = Number(item.actual_price_usd ?? item.unit_price_usd);
    const estimatedQty = Number(item.quantity);
    const actualQty = Number(item.actual_quantity ?? item.quantity);
    const priceVariance = actualPrice - averagePrice;
    const priceVariancePercent = averagePrice > 0 ? (priceVariance / averagePrice) * 100 : 0;
    const priceVarianceAbs = Math.abs(priceVariance);
    const priceVarianceLabel = formatPrice(priceVarianceAbs, priceVarianceAbs * exchangeRate);
    const qtyVariance = actualQty - estimatedQty;
    const qtyVariancePercent = estimatedQty > 0 ? (qtyVariance / estimatedQty) * 100 : 0;
    const qtyVarianceAbs = Math.abs(qtyVariance);
    const qtyVarianceLabel = qtyVarianceAbs.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const estimatedTotal = estimatedQty * averagePrice;
    const lineTotalUsd = actualQty * actualPrice;
    const lineTotalZwg = lineTotalUsd * exchangeRate;
    const totalVariance = lineTotalUsd - estimatedTotal;
    const totalVariancePercent = estimatedTotal > 0 ? (totalVariance / estimatedTotal) * 100 : 0;
    const totalVarianceAbs = Math.abs(totalVariance);
    const totalVarianceLabel = formatPrice(totalVarianceAbs, totalVarianceAbs * exchangeRate);
    const usage = usageByItem?.[item.id] ?? 0;
    const usagePercent = actualQty > 0 ? (usage / actualQty) * 100 : 0;

    const getVarianceState = (value: number) => {
        if (value === 0) return 'neutral';
        return value > 0 ? 'positive' : 'negative';
    };

    const rowStatus = getItemStatus(item, purchases);
    const enablement = isEnablementItem(item.notes);
    return (
        <tr key={item.id} className={`item-row status-${rowStatus}${enablement ? ' enablement' : ''}`}>
            {visibleColumns.item && (
                <td data-label="Item" className="col-item">
                    <div className="item-info">
                        <span className="item-name">{item.material_name}</span>
                        {enablement && (
                            <span className="enablement-pill">Enablement Cost</span>
                        )}
                        {item.notes && <span className="item-notes">{stripEnablementTag(item.notes)}</span>}
                    </div>
                </td>
            )}
            {visibleColumns.avgPrice && (
                <td data-label="Avg. Price" className="col-price text-right">
                    <span className="price-subtle">
                        <PriceDisplay priceUsd={averagePrice} priceZwg={Number(item.unit_price_zwg)} />
                    </span>
                </td>
            )}
            {visibleColumns.actualPrice && (
                <td data-label="Actual Price" className="col-price text-right">
                    <InlineEdit
                        value={actualPrice}
                        type="currency"
                        prefix="$"
                        onSave={(val) => handleActualPriceUpdate(item, Number(val))}
                        className="price-edit"
                    />
                </td>
            )}
            {visibleColumns.priceVar && (
                <td data-label="Price Var %" className="col-var text-right">
                    <div className={`variance-badge ${getVarianceState(priceVariance)}`}>
                        {priceVariance === 0 ? <Minus size={10} /> : priceVariance < 0 ? <TrendDown size={12} /> : <TrendUp size={12} />}
                        <span>
                            {priceVariance === 0 ? priceVarianceLabel : `${priceVariance > 0 ? '+' : '-'}${priceVarianceLabel}`}
                            {` (${Math.abs(priceVariancePercent).toFixed(0)}%)`}
                        </span>
                    </div>
                </td>
            )}
            {visibleColumns.qty && (
                <td data-label="Qty (Est)" className="col-qty text-right">
                    <InlineEdit
                        value={Number(item.quantity)}
                        type="number"
                        suffix={` ${item.unit}`}
                        onSave={(val) => handleQuantityUpdate(item, Number(val))}
                        className="qty-edit"
                    />
                </td>
            )}
            {visibleColumns.actualQty && (
                <td data-label="Actual Qty" className="col-qty text-right">
                    <InlineEdit
                        value={Number(item.actual_quantity ?? item.quantity)}
                        type="number"
                        suffix={` ${item.unit}`}
                        onSave={(val) => handleActualQuantityUpdate(item, Number(val))}
                        className="qty-edit"
                    />
                </td>
            )}
            {visibleColumns.qtyVar && (
                <td data-label="Qty Var %" className="col-var text-right">
                    <div className={`variance-badge ${getVarianceState(qtyVariance)}`}>
                        {qtyVariance === 0 ? <Minus size={10} /> : qtyVariance < 0 ? <TrendDown size={12} /> : <TrendUp size={12} />}
                        <span>
                            {qtyVariance === 0 ? `${qtyVarianceLabel} ${item.unit}` : `${qtyVariance > 0 ? '+' : '-'}${qtyVarianceLabel} ${item.unit}`}
                            {` (${Math.abs(qtyVariancePercent).toFixed(0)}%)`}
                        </span>
                    </div>
                </td>
            )}
            {visibleColumns.actualTotal && (
                <td data-label="Actual Total" className="col-total text-right">
                    <div className="line-total">
                        <PriceDisplay priceUsd={lineTotalUsd} priceZwg={lineTotalZwg} bold />
                    </div>
                </td>
            )}
            {visibleColumns.estTotal && (
                <td data-label="Est Total" className="col-total text-right">
                    <div className="line-total est">
                        <PriceDisplay priceUsd={estimatedTotal} priceZwg={estimatedTotal * exchangeRate} />
                    </div>
                </td>
            )}
            {visibleColumns.totalVar && (
                <td data-label="Total Var" className="col-var text-right">
                    <div className={`variance-badge ${getVarianceState(totalVariance)}`}>
                        {totalVariance === 0 ? <Minus size={10} /> : totalVariance < 0 ? <TrendDown size={12} /> : <TrendUp size={12} />}
                        <span>
                            {totalVariance === 0 ? totalVarianceLabel : `${totalVariance > 0 ? '+' : '-'}${totalVarianceLabel}`}
                            {` (${Math.abs(totalVariancePercent).toFixed(0)}%)`}
                        </span>
                    </div>
                </td>
            )}
            {visibleColumns.usage && (
                <td data-label="Usage" className="col-usage text-right">
                    {usageTrackingEnabled ? (
                        <div className="usage-cell">
                            <span>{usage.toFixed(2)} {item.unit}</span>
                            <small>{actualQty > 0 ? `${usagePercent.toFixed(0)}%` : '—'}</small>
                        </div>
                    ) : (
                        <span className="muted">—</span>
                    )}
                </td>
            )}
            {visibleColumns.status && (() => {
                const itemStatus = getItemStatus(item, purchases);
                const statusConfig = getStatusConfig(itemStatus);
                const StatusIcon = statusConfig.icon;
                return (
                    <td data-label="Status" className="col-status">
                        <span className={`status-pill ${statusConfig.className}`}>
                            <StatusIcon size={12} weight="bold" />
                            {statusConfig.label}
                        </span>
                    </td>
                );
            })()}
            <td data-label="" className="col-actions">
                <div className="action-group">
                    {onLogPurchase && getItemStatus(item, purchases) !== 'purchased' && (
                        <button
                            className="action-btn purchase"
                            onClick={() => onLogPurchase(item)}
                            title="Log purchase"
                        >
                            <ShoppingCart size={14} />
                        </button>
                    )}
                    {onRecordUsage && usageTrackingEnabled && (
                        <button
                            className="action-btn usage"
                            onClick={() => onRecordUsage(item)}
                            title="Record usage"
                        >
                            <ClipboardText size={14} />
                        </button>
                    )}
                    {onItemDelete && (
                        <button
                            className="action-btn delete"
                            onClick={() => onItemDelete(item.id)}
                            title="Delete item"
                        >
                            <Trash size={14} />
                        </button>
                    )}
                </div>
            </td>
        </tr>
);
}
