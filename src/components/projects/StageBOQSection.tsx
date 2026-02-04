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
import { Package, CaretDown, CaretUp, Trash, ShoppingCart, Plus } from '@phosphor-icons/react';

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

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
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
    const { exchangeRate } = useCurrency();
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

    const handlePriceUpdate = async (item: BOQItem, newPrice: number) => {
        await onItemUpdate(item.id, {
            unit_price_usd: newPrice,
            unit_price_zwg: newPrice * exchangeRate,
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
        : 'No materials in this stage yet';
    const emptyHint = category === 'labor'
        ? 'Add labor or service items to start tracking'
        : 'Add materials in the BOQ Builder to see them here';

    if (items.length === 0) {
        return (
            <>
                <div className="boq-section empty">
                    <div className="section-header">
                        <div className="header-info">
                            <Package size={20} weight="duotone" />
                            <h4>Bill of Quantities - {categoryLabel}</h4>
                        </div>
                        <button
                            className="add-btn"
                            onClick={() => setShowAddForm(prev => !prev)}
                        >
                            <Plus size={14} />
                            {addLabel}
                        </button>
                    </div>
                    {showAddForm && (
                        <div className="add-form">
                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>{selectLabel}</label>
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
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    loading={isAdding}
                                    onClick={handleAddItem}
                                >
                                    Add Item
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="empty-content">
                        <Package size={32} weight="light" />
                        <p>{emptyTitle}</p>
                        <span className="hint">{emptyHint}</span>
                    </div>
                </div>

                <style jsx>{`
                    .boq-section {
                        background: var(--color-surface);
                        border: 1px solid var(--color-border-light);
                        border-radius: var(--radius-lg);
                        overflow: hidden;
                    }

                    .section-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: var(--spacing-md) var(--spacing-lg);
                        background: var(--color-background);
                        border-bottom: 1px solid var(--color-border-light);
                    }

                    .header-info {
                        display: flex;
                        align-items: center;
                        gap: var(--spacing-sm);
                        color: var(--color-primary);
                    }

                    .header-info h4 {
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: var(--color-text);
                        margin: 0;
                    }

                    .add-btn {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                        background: var(--color-primary-bg);
                        border: 1px solid var(--color-border-light);
                        border-radius: var(--radius-md);
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: var(--color-primary);
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }

                    .add-btn:hover {
                        border-color: var(--color-primary);
                    }

                    .add-form {
                        padding: var(--spacing-md) var(--spacing-lg);
                        background: var(--color-surface);
                        border-bottom: 1px solid var(--color-border-light);
                    }

                    .form-row {
                        display: flex;
                        gap: var(--spacing-sm);
                        margin-bottom: var(--spacing-sm);
                    }

                    .form-group {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }

                    .form-group.flex-2 {
                        flex: 2;
                    }

                    .form-group label {
                        font-size: 0.625rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: var(--color-text-muted);
                    }

                    .form-group input,
                    .form-group select {
                        padding: var(--spacing-xs) var(--spacing-sm);
                        border: 1px solid var(--color-border);
                        border-radius: var(--radius-sm);
                        font-size: 0.75rem;
                        background: var(--color-surface);
                    }

                    .form-actions {
                        display: flex;
                        justify-content: flex-end;
                        gap: var(--spacing-sm);
                    }

                    .empty-content {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: var(--spacing-xl);
                        text-align: center;
                        color: var(--color-text-muted);
                    }

                    .empty-content p {
                        margin: var(--spacing-sm) 0 var(--spacing-xs) 0;
                        font-size: 0.875rem;
                        color: var(--color-text-secondary);
                    }

                    .hint {
                        font-size: 0.75rem;
                    }
                `}</style>
            </>
        );
    }

    return (
        <>
            <div className="boq-section">
                <div className="section-header" onClick={() => setExpanded(!expanded)}>
                    <div className="header-info">
                        <Package size={20} weight="duotone" />
                        <h4>Bill of Quantities - {categoryLabel}</h4>
                        <span className="item-count">
                            {items.length} items
                            <span className="purchased-count">
                                <ShoppingCart size={12} />
                                {stats.purchasedCount} purchased
                            </span>
                        </span>
                    </div>
                    <div className="header-stats">
                        <button
                            className="add-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddForm(prev => !prev);
                            }}
                        >
                            <Plus size={14} />
                            {addLabel}
                        </button>
                        <div className="stat">
                            <span className="stat-label">Budget</span>
                            <span className="stat-value">
                                <PriceDisplay priceUsd={stats.totalBudget} priceZwg={stats.totalBudget * exchangeRate} />
                            </span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Spent</span>
                            <span className="stat-value spent">
                                <PriceDisplay priceUsd={stats.totalSpent} priceZwg={stats.totalSpent * exchangeRate} />
                            </span>
                        </div>
                        <button className="expand-btn">
                            {expanded ? <CaretUp size={18} /> : <CaretDown size={18} />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="boq-content">
                        {showAddForm && (
                            <div className="add-form">
                                <div className="form-row">
                                    <div className="form-group flex-2">
                                    <label>{selectLabel}</label>
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
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setShowAddForm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        loading={isAdding}
                                        onClick={handleAddItem}
                                    >
                                        Add Item
                                    </Button>
                                </div>
                            </div>
                        )}
                        <table className="materials-table">
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    {onItemDelete && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className={item.is_purchased ? 'purchased' : ''}>
                                        <td>
                                            <div className="material-name">{item.material_name}</div>
                                            {item.notes && <div className="material-notes">{item.notes}</div>}
                                        </td>
                                        <td>
                                            <InlineEdit
                                                value={Number(item.quantity)}
                                                type="number"
                                                suffix={` ${item.unit}`}
                                                onSave={(val) => handleQuantityUpdate(item, Number(val))}
                                            />
                                        </td>
                                        <td>
                                            <InlineEdit
                                                value={Number(item.unit_price_usd)}
                                                type="currency"
                                                prefix="$"
                                                onSave={(val) => handlePriceUpdate(item, Number(val))}
                                            />
                                        </td>
                                        <td className="total-cell">
                                            <PriceDisplay
                                                priceUsd={Number(item.total_usd)}
                                                priceZwg={Number(item.total_zwg)}
                                            />
                                        </td>
                                        <td>
                                            {item.is_purchased ? (
                                                <span className="status-badge purchased">Purchased</span>
                                            ) : (
                                                <span className="status-badge pending">Pending</span>
                                            )}
                                        </td>
                                        {onItemDelete && (
                                            <td className="delete-cell">
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => onItemDelete(item.id)}
                                                    title="Delete item"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style jsx>{`
                .boq-section {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md) var(--spacing-lg);
                    background: var(--color-background);
                    border-bottom: 1px solid var(--color-border-light);
                    cursor: pointer;
                    transition: background 0.15s ease;
                }

                .section-header:hover {
                    background: var(--color-surface);
                }

                .header-info {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    color: var(--color-primary);
                }

                .header-info h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                }

                .add-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: var(--color-primary-bg);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-primary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .add-btn:hover {
                    border-color: var(--color-primary);
                }

                .add-form {
                    padding: var(--spacing-md);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    margin-bottom: var(--spacing-md);
                }

                .form-row {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-sm);
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .form-group.flex-2 {
                    flex: 2;
                }

                .form-group label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .form-group input,
                .form-group select {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    background: var(--color-surface);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-sm);
                }

                .item-count {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    padding-left: var(--spacing-sm);
                    border-left: 1px solid var(--color-border-light);
                    margin-left: var(--spacing-sm);
                }

                .purchased-count {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: var(--color-success);
                }

                .header-stats {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-lg);
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                .stat-label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .stat-value {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .stat-value.spent {
                    color: var(--color-accent);
                }

                .expand-btn {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                }

                .expand-btn:hover {
                    background: var(--color-background);
                }

                .boq-content {
                    padding: var(--spacing-md);
                }

                .materials-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.875rem;
                }

                .materials-table th,
                .materials-table td {
                    padding: var(--spacing-sm);
                    text-align: left;
                    border-bottom: 1px solid var(--color-border-light);
                }

                .materials-table th {
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .materials-table tbody tr:last-child td {
                    border-bottom: none;
                }

                .materials-table tbody tr.purchased {
                    background: rgba(16, 185, 129, 0.03);
                }

                .material-name {
                    font-weight: 500;
                }

                .material-notes {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    margin-top: 2px;
                }

                .total-cell {
                    font-weight: 600;
                }

                .status-badge {
                    font-size: 0.625rem;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    text-transform: uppercase;
                }

                .status-badge.purchased {
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--color-success);
                }

                .status-badge.pending {
                    background: var(--color-background);
                    color: var(--color-text-muted);
                }

                .delete-cell {
                    width: 40px;
                    text-align: center;
                }

                .delete-btn {
                    background: none;
                    border: none;
                    padding: var(--spacing-xs);
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                    opacity: 0.5;
                    transition: all 0.2s ease;
                }

                .delete-btn:hover {
                    opacity: 1;
                    background: var(--color-error-bg);
                    color: var(--color-error);
                }

                @media (max-width: 768px) {
                    .section-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: var(--spacing-sm);
                    }

                    .header-stats {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .materials-table {
                        font-size: 0.75rem;
                    }

                    .materials-table th:nth-child(3),
                    .materials-table td:nth-child(3) {
                        display: none;
                    }
                }
            `}</style>
        </>
    );
}
