'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import InlineEdit from '@/components/ui/InlineEdit';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { BOQItem, BOQCategory } from '@/lib/database.types';
import { StageBudgetStats } from '@/lib/services/stages';
import { addBOQItem } from '@/lib/services/projects';
import { materials, getBestPrice } from '@/lib/materials';
import { Package, CaretDown, CaretUp, Trash, ShoppingCart, Plus, TrendUp, TrendDown, Minus, MagnifyingGlass } from '@phosphor-icons/react';

type StageCategory = BOQCategory | 'labor';

interface StageBOQSectionProps {
    projectId: string;
    category: StageCategory;
    categoryLabel: string;
    items: BOQItem[];
    stats: StageBudgetStats;
    onItemUpdate: (itemId: string, updates: Partial<BOQItem>) => Promise<void>;
    onItemDelete?: (itemId: string) => Promise<void>;
    onItemAdded?: (item: BOQItem) => void;
    stageScope?: BOQCategory;
    usageByItem?: Record<string, number>;
    usageTrackingEnabled?: boolean;
}

function PriceDisplay({ priceUsd, priceZwg, bold = false }: { priceUsd: number; priceZwg: number; bold?: boolean }) {
    const { formatPrice } = useCurrency();
    return <span className={bold ? 'font-semibold' : ''}>{formatPrice(priceUsd, priceZwg)}</span>;
}

const SIMPLE_COLUMNS = {
    item: true,
    avgPrice: true,
    actualPrice: true,
    priceVar: false,
    qty: true,
    actualQty: true,
    qtyVar: false,
    actualTotal: true,
    estTotal: false,
    totalVar: false,
    usage: false,
    status: true,
} as const;

const DETAILED_COLUMNS = {
    item: true,
    avgPrice: true,
    actualPrice: true,
    priceVar: true,
    qty: true,
    actualQty: true,
    qtyVar: true,
    actualTotal: true,
    estTotal: true,
    totalVar: true,
    usage: true,
    status: true,
} as const;

type ColumnKey = keyof typeof SIMPLE_COLUMNS;

const COLUMN_LABELS: Record<ColumnKey, string> = {
    item: 'Item Description',
    avgPrice: 'Avg. Price',
    actualPrice: 'Actual Price',
    priceVar: 'Price Var %',
    qty: 'Qty (Est)',
    actualQty: 'Actual Qty',
    qtyVar: 'Qty Var %',
    actualTotal: 'Actual Total',
    estTotal: 'Est Total',
    totalVar: 'Total Var',
    usage: 'Usage',
    status: 'Status',
};

export default function StageBOQSection({
    projectId,
    category,
    categoryLabel,
    items,
    stats,
    onItemUpdate,
    onItemDelete,
    onItemAdded,
    stageScope,
    usageByItem,
    usageTrackingEnabled = false,
}: StageBOQSectionProps) {
    const [expanded, setExpanded] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMaterialId, setNewMaterialId] = useState('');
    const [newQuantity, setNewQuantity] = useState('1');
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'purchased' | 'pending'>('all');
    const [viewPreset, setViewPreset] = useState<'simple' | 'detailed' | 'custom'>('simple');
    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({ ...SIMPLE_COLUMNS });
    const [isColumnsOpen, setIsColumnsOpen] = useState(false);
    const columnsMenuRef = useRef<HTMLDivElement | null>(null);
    const { exchangeRate, formatPrice } = useCurrency();
    const { success, error: showError } = useToast();

    useEffect(() => {
        if (!isColumnsOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (!columnsMenuRef.current) return;
            if (!columnsMenuRef.current.contains(event.target as Node)) {
                setIsColumnsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isColumnsOpen]);

    const availableMaterials = useMemo(() => {
        if (category === 'labor') {
            const laborItems = materials.filter(m => m.category === 'labor');
            if (stageScope) {
                return laborItems.filter(m => m.milestones.includes(stageScope));
            }
            return laborItems;
        }
        return materials.filter(m => m.milestones.includes(category));
    }, [category, stageScope]);

    const handleQuantityUpdate = async (item: BOQItem, newQuantity: number) => {
        await onItemUpdate(item.id, {
            quantity: newQuantity,
        });
    };

    const handleActualPriceUpdate = async (item: BOQItem, newPrice: number) => {
        await onItemUpdate(item.id, {
            actual_price_usd: newPrice,
        });
    };

    const handleActualQuantityUpdate = async (item: BOQItem, newQuantity: number) => {
        await onItemUpdate(item.id, {
            actual_quantity: newQuantity,
        });
    };

    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return items.filter(item => {
            if (statusFilter === 'purchased' && !item.is_purchased) return false;
            if (statusFilter === 'pending' && item.is_purchased) return false;
            if (!term) return true;
            const haystack = `${item.material_name} ${item.notes || ''}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [items, searchTerm, statusFilter]);

    const isFiltered = searchTerm.trim().length > 0 || statusFilter !== 'all';

    const stageActualTotal = useMemo(() => {
        return items.reduce((sum, item) => {
            const estimatedQty = Number(item.quantity) || 0;
            const averagePrice = Number(item.unit_price_usd) || 0;
            const actualQty = Number(item.actual_quantity ?? estimatedQty) || 0;
            const actualPrice = Number(item.actual_price_usd ?? averagePrice) || 0;
            return sum + actualQty * actualPrice;
        }, 0);
    }, [items]);
    const stageEstimatedTotal = stats.totalBudget;

    const applyPreset = (preset: 'simple' | 'detailed') => {
        setViewPreset(preset);
        setVisibleColumns(preset === 'simple' ? { ...SIMPLE_COLUMNS } : { ...DETAILED_COLUMNS });
    };

    const toggleColumn = (key: ColumnKey) => {
        if (key === 'item') return;
        setVisibleColumns(prev => {
            const next = { ...prev, [key]: !prev[key] };
            return next;
        });
        setViewPreset('custom');
    };

    const handleAddItem = async () => {
        if (!newMaterialId) {
            showError(category === 'labor' ? 'Please select a labor item' : 'Please select a material');
            return;
        }

        const qty = parseFloat(newQuantity);
        if (isNaN(qty) || qty <= 0) {
            showError('Please enter a valid quantity');
            return;
        }

        const material = materials.find(m => m.id === newMaterialId);
        if (!material) {
            showError(category === 'labor' ? 'Labor item not found' : 'Material not found');
            return;
        }

        const bestPrice = getBestPrice(material.id);
        if (!bestPrice) {
            showError('No pricing available for this material');
            return;
        }

        setIsAdding(true);
        const categoryValue = category === 'labor' && stageScope ? `labor_${stageScope}` : category;
        const { item, error } = await addBOQItem({
            project_id: projectId,
            material_id: material.id,
            material_name: material.name,
            category: categoryValue,
            quantity: qty,
            unit: material.unit,
            unit_price_usd: bestPrice.priceUsd,
            unit_price_zwg: bestPrice.priceZwg,
            actual_price_usd: bestPrice.priceUsd,
            sort_order: items.length,
        });

        if (error || !item) {
            showError(error?.message || 'Failed to add item');
            setIsAdding(false);
            return;
        }

        onItemAdded?.(item);
        success('Item added');
        setShowAddForm(false);
        setNewMaterialId('');
        setNewQuantity('1');
        setIsAdding(false);
    };

    const addLabel = category === 'labor' ? 'Add Labor' : 'Add Item';
    const selectLabel = category === 'labor' ? 'Labor/Service' : 'Material';
    const emptyTitle = category === 'labor'
        ? 'No labor items yet'
        : 'No items in this section';
    const emptyHint = category === 'labor'
        ? 'Add labor or service items to start tracking'
        : 'Use the builder or add items manually';

    if (items.length === 0) {
        return (
            <>
                <div className="boq-card empty">
                    <div className="card-header">
                        <div className="header-title">
                            <div className="icon-wrapper">
                                <Package size={18} weight="duotone" />
                            </div>
                            <h4>{categoryLabel}</h4>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<Plus size={14} />}
                            onClick={() => setShowAddForm(prev => !prev)}
                        >
                            {addLabel}
                        </Button>
                    </div>
                    {showAddForm && (
                        <div className="add-form">
                            <div className="form-grid">
                                <div className="form-group span-2">
                                    <label>{selectLabel}</label>
                                    <div className="select-wrapper">
                                        <select
                                            value={newMaterialId}
                                            onChange={(e) => setNewMaterialId(e.target.value)}
                                        >
                                            <option value="">{category === 'labor' ? 'Select labor or service...' : 'Select material...'}</option>
                                            {availableMaterials.map((material) => (
                                                <option key={material.id} value={material.id}>
                                                    {material.name}
                                                </option>
                                            ))}
                                        </select>
                                        <CaretDown size={14} className="select-arrow" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Quantity</label>
                                    <input
                                        type="number"
                                        value={newQuantity}
                                        onChange={(e) => setNewQuantity(e.target.value)}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                                <Button variant="primary" size="sm" loading={isAdding} onClick={handleAddItem}>Add Item</Button>
                            </div>
                        </div>
                    )}
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Package size={32} weight="light" />
                        </div>
                        <p>{emptyTitle}</p>
                        <span>{emptyHint}</span>
                    </div>
                </div>
                <style jsx>{`
                    .boq-card {
                        background: #ffffff;
                        border: 1px solid var(--color-border-light);
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                    0 2px 4px -1px rgba(0, 0, 0, 0.01);
                        transition: border-color 0.2s, box-shadow 0.2s;
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 16px 24px;
                        border-bottom: 1px solid var(--color-border-light);
                    }
                    .header-title {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .icon-wrapper {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 36px;
                        height: 36px;
                        background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
                        border-radius: 10px;
                        color: #0284c7;
                        box-shadow: inset 0 0 0 1px rgba(2, 132, 199, 0.1);
                    }
                    h4 {
                        margin: 0;
                        font-size: 1.1rem;
                        font-weight: 600;
                        color: #0f172a;
                    }
                    .add-form {
                        padding: 24px;
                        background: #f8fafc;
                        border-bottom: 1px solid var(--color-border-light);
                    }
                    .form-grid {
                        display: grid;
                        grid-template-columns: 2fr 1fr;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .form-group label {
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .select-wrapper {
                        position: relative;
                    }
                    select, input {
                        width: 100%;
                        padding: 12px;
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        font-size: 0.9rem;
                        background: #fff;
                        outline: none;
                        transition: all 0.2s;
                        appearance: none;
                    }
                    select:focus, input:focus {
                        border-color: #0ea5e9;
                        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
                    }
                    .select-arrow {
                        position: absolute;
                        right: 12px;
                        top: 50%;
                        transform: translateY(-50%);
                        pointer-events: none;
                        color: #94a3b8;
                    }
                    .form-actions {
                        display: flex;
                        justify-content: flex-end;
                        gap: 12px;
                    }
                    .empty-state {
                        padding: 48px 24px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                        color: #64748b;
                    }
                    .empty-icon {
                        margin-bottom: 16px;
                        color: #cbd5e1;
                    }
                    .empty-state p {
                        margin: 0 0 4px;
                        font-weight: 600;
                        color: #334155;
                        font-size: 1rem;
                    }
                    .empty-state span {
                        font-size: 0.875rem;
                    }

                    @media (max-width: 768px) {
                        .form-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                `}</style>
            </>
        );
    }

    return (
        <>
            <div className={`boq-card ${expanded ? 'expanded' : 'collapsed'}`}>
                <div className="card-header" onClick={() => setExpanded(!expanded)}>
                    <div className="header-main">
                        <div className="header-title">
                            <div className="title-row">
                                <div className="icon-wrapper">
                                    <Package size={18} weight="duotone" />
                                </div>
                                <h4>{categoryLabel}</h4>
                            </div>
                            <div className="meta-row">
                                <span className="item-badge">
                                    {isFiltered ? `${filteredItems.length} of ${items.length} items` : `${items.length} items`}
                                </span>
                                {stats.purchasedCount > 0 && (
                                    <span className="purchased-badge">
                                        <ShoppingCart size={12} weight="fill" />
                                        {stats.purchasedCount} bought
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="header-actions">
                        <div className="stat-pill">
                            <span className="label">Actual Total</span>
                            <span className="value">
                                <PriceDisplay priceUsd={stageActualTotal} priceZwg={stageActualTotal * exchangeRate} bold />
                            </span>
                        </div>

                        <div className="stat-pill">
                            <span className="label">Est Total</span>
                            <span className="value">
                                <PriceDisplay priceUsd={stageEstimatedTotal} priceZwg={stageEstimatedTotal * exchangeRate} bold />
                            </span>
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            icon={<Plus size={14} />}
                            className="add-btn-header"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddForm(prev => !prev);
                            }}
                        >
                            Add
                        </Button>

                        <button className="expand-trigger">
                            {expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="card-content">
                        <div className="table-toolbar">
                            <div className="toolbar-left">
                                <div className="search-input">
                                    <MagnifyingGlass size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search items..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="select-wrapper filter-select">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'purchased' | 'pending')}
                                    >
                                        <option value="all">All statuses</option>
                                        <option value="purchased">Purchased</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                    <CaretDown size={14} className="select-arrow" />
                                </div>
                            </div>
                            <div className="toolbar-right">
                                <div className="view-toggle">
                                    <button
                                        type="button"
                                        className={viewPreset === 'simple' ? 'active' : ''}
                                        onClick={() => applyPreset('simple')}
                                    >
                                        Simple
                                    </button>
                                    <button
                                        type="button"
                                        className={viewPreset === 'detailed' ? 'active' : ''}
                                        onClick={() => applyPreset('detailed')}
                                    >
                                        Detailed
                                    </button>
                                </div>
                                <div className="columns-dropdown" ref={columnsMenuRef}>
                                    <button
                                        type="button"
                                        className="columns-btn"
                                        onClick={() => setIsColumnsOpen(prev => !prev)}
                                    >
                                        Columns
                                        <CaretDown size={12} />
                                    </button>
                                    {isColumnsOpen && (
                                        <div className="columns-menu">
                                            {Object.keys(COLUMN_LABELS).map((key) => {
                                                const columnKey = key as ColumnKey;
                                                const isLocked = columnKey === 'item';
                                                return (
                                                    <label
                                                        key={columnKey}
                                                        className={`column-option ${isLocked ? 'locked' : ''}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns[columnKey]}
                                                            onChange={() => toggleColumn(columnKey)}
                                                            disabled={isLocked}
                                                        />
                                                        <span>{COLUMN_LABELS[columnKey]}</span>
                                                    </label>
                                                );
                                            })}
                                            {!usageTrackingEnabled && (
                                                <div className="column-hint">
                                                    Enable usage tracking to populate the Usage column.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {showAddForm && (
                            <div className="add-form">
                                <div className="form-grid">
                                    <div className="form-group span-2">
                                        <label>{selectLabel}</label>
                                        <div className="select-wrapper">
                                            <select
                                                value={newMaterialId}
                                                onChange={(e) => setNewMaterialId(e.target.value)}
                                            >
                                                <option value="">{category === 'labor' ? 'Select labor or service...' : 'Select material...'}</option>
                                                {availableMaterials.map((material) => (
                                                    <option key={material.id} value={material.id}>
                                                        {material.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <CaretDown size={14} className="select-arrow" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Quantity</label>
                                        <input
                                            type="number"
                                            value={newQuantity}
                                            onChange={(e) => setNewQuantity(e.target.value)}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                                    <Button variant="primary" size="sm" loading={isAdding} onClick={handleAddItem}>Add Item</Button>
                                </div>
                            </div>
                        )}

                        <div className="table-responsive">
                            <table className="boq-table">
                                <thead>
                                    <tr>
                                        {visibleColumns.item && <th className="col-item">Item Description</th>}
                                        {visibleColumns.avgPrice && <th className="col-price text-right">Avg. Price</th>}
                                        {visibleColumns.actualPrice && <th className="col-price text-right">Actual Price</th>}
                                        {visibleColumns.priceVar && <th className="col-var text-right">Price Var %</th>}
                                        {visibleColumns.qty && <th className="col-qty text-right">Qty (Est)</th>}
                                        {visibleColumns.actualQty && <th className="col-qty text-right">Actual Qty</th>}
                                        {visibleColumns.qtyVar && <th className="col-var text-right">Qty Var %</th>}
                                        {visibleColumns.actualTotal && <th className="col-total text-right">Actual Total</th>}
                                        {visibleColumns.estTotal && <th className="col-total text-right">Est Total</th>}
                                        {visibleColumns.totalVar && <th className="col-var text-right">Total Var</th>}
                                        {visibleColumns.usage && <th className="col-usage text-right">Usage</th>}
                                        {visibleColumns.status && <th className="col-status">Status</th>}
                                        <th className="col-actions"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item) => {
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

                                        return (
                                            <tr key={item.id} className={`item-row ${item.is_purchased ? 'is-purchased' : ''}`}>
                                                {visibleColumns.item && (
                                                    <td className="col-item">
                                                        <div className="item-info">
                                                            <span className="item-name">{item.material_name}</span>
                                                            {item.notes && <span className="item-notes">{item.notes}</span>}
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.avgPrice && (
                                                    <td className="col-price text-right">
                                                        <span className="price-subtle">
                                                            <PriceDisplay priceUsd={averagePrice} priceZwg={Number(item.unit_price_zwg)} />
                                                        </span>
                                                    </td>
                                                )}
                                                {visibleColumns.actualPrice && (
                                                    <td className="col-price text-right">
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
                                                    <td className="col-var text-right">
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
                                                    <td className="col-qty text-right">
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
                                                    <td className="col-qty text-right">
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
                                                    <td className="col-var text-right">
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
                                                    <td className="col-total text-right">
                                                        <div className="line-total">
                                                            <PriceDisplay priceUsd={lineTotalUsd} priceZwg={lineTotalZwg} bold />
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.estTotal && (
                                                    <td className="col-total text-right">
                                                        <div className="line-total est">
                                                            <PriceDisplay priceUsd={estimatedTotal} priceZwg={estimatedTotal * exchangeRate} />
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleColumns.totalVar && (
                                                    <td className="col-var text-right">
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
                                                    <td className="col-usage text-right">
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
                                                {visibleColumns.status && (
                                                    <td className="col-status">
                                                        {item.is_purchased ? (
                                                            <span className="status-pill purchased">Purchased</span>
                                                        ) : (
                                                            <span className="status-pill pending">Pending</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="col-actions">
                                                    {onItemDelete && (
                                                        <button
                                                            className="action-btn delete"
                                                            onClick={() => onItemDelete(item.id)}
                                                            title="Delete item"
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .boq-card {
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                0 2px 4px -1px rgba(0, 0, 0, 0.01);
                    transition: border-color 0.2s, box-shadow 0.2s;
                    margin-bottom: 24px;
                }
                
                .boq-card.expanded {
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 
                                0 4px 6px -2px rgba(0, 0, 0, 0.02);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    background: #ffffff;
                    cursor: pointer;
                    user-select: none;
                }

                .header-main {
                    flex: 1;
                }

                .header-title {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .title-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
                    border-radius: 10px;
                    color: #0284c7;
                    box-shadow: inset 0 0 0 1px rgba(2, 132, 199, 0.1);
                }

                h4 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0f172a;
                    letter-spacing: -0.01em;
                }

                .meta-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding-left: 48px;
                }

                .item-badge, .purchased-badge {
                    font-size: 0.75rem;
                    color: #64748b;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .purchased-badge {
                    color: #059669;
                    background: #ecfdf5;
                    padding: 2px 8px;
                    border-radius: 99px;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .stat-pill {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: center;
                    padding: 0 12px;
                    border-right: 1px solid #e2e8f0;
                }
                
                .stat-pill:last-of-type {
                    border-right: none;
                }

                .stat-pill .label {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.05em;
                    font-weight: 600;
                }

                .stat-pill .value {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .expand-trigger {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .expand-trigger:hover {
                    background: #f1f5f9;
                    color: #475569;
                }

                .card-content {
                    border-top: 1px solid #f1f5f9;
                }

                /* Toolbar */
                .table-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: #ffffff;
                    gap: 16px;
                }

                .toolbar-left, .toolbar-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .search-input {
                    position: relative;
                    display: flex;
                    align-items: center;
                    color: #94a3b8;
                    background: #f8fafc;
                    border-radius: 10px;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                    width: 240px;
                }
                
                .search-input:focus-within {
                    background: #fff;
                    border-color: #cbd5e1;
                    box-shadow: 0 0 0 3px rgba(226, 232, 240, 0.4);
                    color: #475569;
                }

                .search-input svg {
                    position: absolute;
                    left: 12px;
                    pointer-events: none;
                }

                .search-input input {
                    width: 100%;
                    padding: 10px 12px 10px 36px;
                    background: transparent;
                    border: none;
                    font-size: 0.875rem;
                    color: #1e293b;
                    outline: none;
                }

                .view-toggle {
                    display: flex;
                    background: #f1f5f9;
                    padding: 3px;
                    border-radius: 10px;
                }

                .view-toggle button {
                    padding: 6px 12px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #64748b;
                    background: transparent;
                    border: none;
                    border-radius: 7px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .view-toggle button:hover {
                    color: #1e293b;
                }

                .view-toggle button.active {
                    background: #fff;
                    color: #0f172a;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                .columns-dropdown {
                    position: relative;
                }

                .columns-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .columns-btn:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }

                .columns-menu {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    width: 200px;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 8px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    z-index: 50;
                }

                .column-option {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    font-size: 0.85rem;
                    color: #475569;
                    cursor: pointer;
                    border-radius: 6px;
                }

                .column-option:hover {
                    background: #f1f5f9;
                }

                .column-hint {
                    margin-top: 8px;
                    padding: 8px 12px;
                    background: #f8fafc;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    color: #94a3b8;
                }

                /* Add Form */
                .add-form {
                    padding: 24px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .select-wrapper {
                    position: relative;
                }

                select, .form-group input {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    background: #fff;
                    outline: none;
                    transition: all 0.2s;
                    appearance: none;
                }

                select:focus, .form-group input:focus {
                    border-color: #0ea5e9;
                    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                /* Table */
                .table-responsive {
                    overflow-x: auto;
                    width: 100%;
                }

                .boq-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }

                .boq-table th {
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    white-space: nowrap;
                }

                .boq-table td {
                    padding: 16px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                    vertical-align: middle;
                }

                .boq-table tr:last-child td {
                    border-bottom: none;
                }

                .boq-table tr:hover td {
                    background: #f8fafc;
                }
                
                .boq-table tr.is-purchased td {
                    background: #f0fdf4;
                }
                
                .boq-table tr.is-purchased:hover td {
                    background: #dcfce7;
                }

                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    max-width: 250px;
                }

                .item-name {
                    font-weight: 500;
                    color: #0f172a;
                }

                .item-notes {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .text-right {
                    text-align: right;
                }

                .price-subtle {
                    color: #64748b;
                }

                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 99px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .status-pill.purchased {
                    background: #dcfce7;
                    color: #166534;
                }

                .status-pill.pending {
                    background: #f1f5f9;
                    color: #475569;
                }
                
                .variance-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }
                
                .variance-badge.neutral { color: #94a3b8; }
                .variance-badge.positive { color: #dc2626; } 
                .variance-badge.negative { color: #16a34a; } 

                .action-btn {
                    padding: 6px;
                    color: #94a3b8;
                    background: transparent;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover {
                    background: #fee2e2;
                    color: #ef4444;
                }
                
                .select-arrow {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    color: #94a3b8;
                }

                @media (max-width: 768px) {
                    .header-actions {
                        display: none;
                    }
                    .table-toolbar {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </>
    );
}
