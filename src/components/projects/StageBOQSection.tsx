'use client';

import { useMemo, useState } from 'react';
import InlineEdit from '@/components/ui/InlineEdit';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { BOQItem, BOQCategory } from '@/lib/database.types';
import { StageBudgetStats } from '@/lib/services/stages';
import { addBOQItem } from '@/lib/services/projects';
import { materials, getBestPrice } from '@/lib/materials';
import { Package, CaretDown, CaretUp, Trash, ShoppingCart, Plus, TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

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
}

function PriceDisplay({ priceUsd, priceZwg, bold = false }: { priceUsd: number; priceZwg: number; bold?: boolean }) {
    const { formatPrice } = useCurrency();
    return <span className={bold ? 'font-semibold' : ''}>{formatPrice(priceUsd, priceZwg)}</span>;
}

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
}: StageBOQSectionProps) {
    const [expanded, setExpanded] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMaterialId, setNewMaterialId] = useState('');
    const [newQuantity, setNewQuantity] = useState('1');
    const [isAdding, setIsAdding] = useState(false);
    const { exchangeRate, formatPrice } = useCurrency();
    const { success, error: showError } = useToast();

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
                        background: #fff;
                        border: 1px solid var(--color-border-light);
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
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
                        width: 32px;
                        height: 32px;
                        background: #f1f5f9;
                        border-radius: 8px;
                        color: #475569;
                    }
                    h4 {
                        margin: 0;
                        font-size: 15px;
                        font-weight: 600;
                        color: #1e293b;
                    }
                    .add-form {
                        padding: 20px 24px;
                        background: #f8fafc;
                        border-bottom: 1px solid var(--color-border-light);
                    }
                    .form-grid {
                        display: grid;
                        grid-template-columns: 2fr 1fr;
                        gap: 16px;
                        margin-bottom: 16px;
                    }
                    .form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    .form-group label {
                        font-size: 12px;
                        font-weight: 600;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.02em;
                    }
                    .select-wrapper {
                        position: relative;
                    }
                    select, input {
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        font-size: 14px;
                        background: #fff;
                        outline: none;
                        transition: border-color 0.2s;
                        appearance: none;
                    }
                    select:focus, input:focus {
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
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
                        gap: 8px;
                    }
                    .empty-state {
                        padding: 48px 20px;
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
                        font-weight: 500;
                        color: #334155;
                    }
                    .empty-state span {
                        font-size: 13px;
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
                                    {items.length} items
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
                            <span className="label">Total</span>
                            <span className="value">
                                <PriceDisplay priceUsd={stats.totalBudget} priceZwg={stats.totalBudget * exchangeRate} bold />
                            </span>
                        </div>

                        <div className="divider"></div>

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
                                        <th className="col-item">Item Description</th>
                                        <th className="col-price text-right">Avg. Price</th>
                                        <th className="col-price text-right">Actual Price</th>
                                        <th className="col-var text-right">Variance</th>
                                        <th className="col-qty text-right">Qty</th>
                                        <th className="col-total text-right">Total</th>
                                        <th className="col-status">Status</th>
                                        <th className="col-actions"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => {
                                        const averagePrice = Number(item.unit_price_usd);
                                        const actualPrice = Number(item.actual_price_usd ?? item.unit_price_usd);
                                        const variance = actualPrice - averagePrice;
                                        const variancePercent = averagePrice > 0 ? (variance / averagePrice) * 100 : 0;
                                        const lineTotalUsd = Number(item.quantity) * actualPrice;
                                        const lineTotalZwg = lineTotalUsd * exchangeRate;

                                        return (
                                            <tr key={item.id} className={`item-row ${item.is_purchased ? 'is-purchased' : ''}`}>
                                                <td className="col-item">
                                                    <div className="item-info">
                                                        <span className="item-name">{item.material_name}</span>
                                                        {item.notes && <span className="item-notes">{item.notes}</span>}
                                                    </div>
                                                </td>
                                                <td className="col-price text-right">
                                                    <span className="price-subtle">
                                                        <PriceDisplay priceUsd={averagePrice} priceZwg={Number(item.unit_price_zwg)} />
                                                    </span>
                                                </td>
                                                <td className="col-price text-right">
                                                    <InlineEdit
                                                        value={actualPrice}
                                                        type="currency"
                                                        prefix="$"
                                                        onSave={(val) => handleActualPriceUpdate(item, Number(val))}
                                                        className="price-edit"
                                                    />
                                                </td>
                                                <td className="col-var text-right">
                                                    <div className={`variance-badge ${variance >= 0 ? (variance === 0 ? 'neutral' : 'positive') : 'negative'}`}>
                                                        {variance === 0 ? <Minus size={10} /> : variance < 0 ? <TrendDown size={12} /> : <TrendUp size={12} />}
                                                        <span>{Math.abs(variancePercent).toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className="col-qty text-right">
                                                    <InlineEdit
                                                        value={Number(item.quantity)}
                                                        type="number"
                                                        suffix={` ${item.unit}`}
                                                        onSave={(val) => handleQuantityUpdate(item, Number(val))}
                                                        className="qty-edit"
                                                    />
                                                </td>
                                                <td className="col-total text-right">
                                                    <div className="line-total">
                                                        <PriceDisplay priceUsd={lineTotalUsd} priceZwg={lineTotalZwg} bold />
                                                    </div>
                                                </td>
                                                <td className="col-status">
                                                    {item.is_purchased ? (
                                                        <span className="status-pill purchased">Purchased</span>
                                                    ) : (
                                                        <span className="status-pill pending">Pending</span>
                                                    )}
                                                </td>
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
                    background: #fff;
                    border: 1px solid var(--color-border-light);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                    transition: all 0.2s ease;
                }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    cursor: pointer;
                    background: #fff;
                    transition: background 0.15s;
                }
                
                .card-header:hover {
                    background: #f8fafc;
                }
                
                .header-main {
                    flex: 1;
                }
                
                .header-title {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
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
                    width: 32px;
                    height: 32px;
                    background: #eff6ff;
                    color: #2563eb;
                    border-radius: 8px;
                }
                
                h4 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #0f172a;
                }
                
                .meta-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding-left: 44px;
                }
                
                .item-badge, .purchased-badge {
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 12px;
                    background: #f1f5f9;
                    color: #64748b;
                    font-weight: 500;
                }
                
                .purchased-badge {
                    background: #f0fdf4;
                    color: #166534;
                    display: flex;
                    align-items: center;
                    gap: 4px;
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
                    background: #f8fafc;
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                
                .stat-pill .label {
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #64748b;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                }
                
                .stat-pill .value {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
                }
                
                .divider {
                    width: 1px;
                    height: 24px;
                    background: #e2e8f0;
                }
                
                .expand-trigger {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    background: transparent;
                    color: #94a3b8;
                    cursor: pointer;
                    border-radius: 6px;
                }
                
                .expand-trigger:hover {
                    background: #e2e8f0;
                    color: #475569;
                }
                
                .add-form {
                    padding: 24px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .form-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }
                
                .table-responsive {
                    overflow-x: auto;
                }
                
                .boq-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                
                .boq-table th {
                    text-align: left;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.05em;
                    padding: 12px 16px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #fcfcfc;
                }
                
                .boq-table td {
                    padding: 16px;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 14px;
                }
                
                .item-row:last-child td {
                    border-bottom: none;
                }
                
                .item-row.is-purchased {
                    background: #f8fafc;
                }
                
                .item-row:hover {
                    background: #f8fafc;
                }
                
                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .item-name {
                    font-weight: 500;
                    color: #1e293b;
                }
                
                .item-notes {
                    font-size: 12px;
                    color: #94a3b8;
                }
                
                .text-right { text-align: right; }
                
                .price-subtle {
                    color: #64748b;
                }
                
                .variance-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                }
                
                .variance-badge.neutral {
                    color: #94a3b8;
                    background: #f1f5f9;
                }
                
                .variance-badge.positive {
                    color: #ef4444; /* Cost increase is bad! Adjust logic if needed */
                    background: #fef2f2;
                }
                
                .variance-badge.negative {
                    color: #10b981; /* Cost savings */
                    background: #ecfdf5;
                }
                
                .status-pill {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 4px 8px;
                    border-radius: 20px;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                
                .status-pill.purchased {
                    background: #dcfce7;
                    color: #15803d;
                }
                
                .status-pill.pending {
                    background: #f1f5f9;
                    color: #64748b;
                }
                
                .action-btn {
                    border: none;
                    background: transparent;
                    color: #cbd5e1;
                    padding: 6px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                }
                
                .action-btn:hover {
                    background: #fee2e2;
                    color: #ef4444;
                }
                
                .col-item { width: 30%; }
                .col-price { width: 12%; }
                .col-var { width: 10%; }
                .col-qty { width: 12%; }
                .col-total { width: 15%; }
                .col-status { width: 10%; padding-left: 24px; }
                .col-actions { width: 5%; }
                
                /* Selection & Inputs */
                .select-wrapper { position: relative; }
                select, input {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 14px;
                    background: #fff;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                select:focus, input:focus {
                select:focus, input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                }

                @media (max-width: 768px) {
                    .card-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }

                    .header-main {
                        width: 100%;
                    }
                    
                    .header-actions {
                        width: 100%;
                        justify-content: space-between;
                    }
                    
                    .add-btn-header {
                        margin-left: auto;
                    }

                    .boq-table {
                        font-size: 13px;
                    }
                    
                    .col-var, .col-status {
                        display: none;
                    }
                }
            `}</style>
        </>
    );
}
