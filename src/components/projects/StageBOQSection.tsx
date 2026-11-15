'use client';

import { isLaborCategory } from '@/lib/calculations/laborSubstages';
import { useMemo, useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { BOQItem, BOQCategory, PurchaseRecord } from '@/lib/database.types';
import { StageBudgetStats } from '@/lib/services/stages';
import { addBOQItem } from '@/lib/services/projects';
import { useCatalog } from '@/lib/catalog/useCatalog';
import { getLatestPrice } from '@/lib/services/prices';
import '@/styles/stage-boq-section.css';
import { Package, CaretDown, CaretUp, ShoppingCart, Plus } from '@phosphor-icons/react';
import PriceDisplay from '@/components/projects/PriceDisplay';
import BoqAddItemForm from './boq/BoqAddItemForm';
import BoqTableToolbar from './boq/BoqTableToolbar';
import { Table, TableHeader, TableBody } from '@/components/shadcn/table';
import BoqItemRow from './boq/BoqItemRow';
import { SIMPLE_COLUMNS, DETAILED_COLUMNS, type ColumnKey } from './boq/boqColumns';
import { getItemStatus } from '@/lib/projects/itemStatus';

type StageCategory = BOQCategory | 'labor';

interface StageBOQSectionProps {
    projectId: string;
    category: StageCategory;
    categoryLabel: string;
    items: BOQItem[];
    stats: StageBudgetStats;
    purchases?: PurchaseRecord[];
    onItemUpdate: (itemId: string, updates: Partial<BOQItem>) => Promise<void>;
    onItemDelete?: (itemId: string) => Promise<void>;
    onItemAdded?: (item: BOQItem) => void;
    onLogPurchase?: (item: BOQItem) => void;
    onRecordUsage?: (item: BOQItem) => void;
    stageScope?: BOQCategory;
    usageByItem?: Record<string, number>;
    usageTrackingEnabled?: boolean;
}

export default function StageBOQSection({
    projectId,
    category,
    categoryLabel,
    items,
    stats,
    purchases = [],
    onItemUpdate,
    onItemDelete,
    onItemAdded,
    onLogPurchase,
    onRecordUsage,
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
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'purchased' | 'over_purchased'>('all');
    const [viewPreset, setViewPreset] = useState<'simple' | 'detailed' | 'custom'>('simple');
    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({ ...SIMPLE_COLUMNS });
    const [isColumnsOpen, setIsColumnsOpen] = useState(false);
    const columnsMenuRef = useRef<HTMLDivElement | null>(null);
    const { exchangeRate } = useCurrency();
    const { success, error: showError } = useToast();
    // The catalog as an admin has edited it, so added products can be picked
    // and hidden ones are not offered.
    const { visible: materials } = useCatalog();

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
        if (isLaborCategory(category)) {
            const laborItems = materials.filter(m => isLaborCategory(m.category));
            if (stageScope) {
                return laborItems.filter(m => m.milestones.includes(stageScope));
            }
            return laborItems;
        }
        return materials.filter(m => m.milestones.includes(category));
    }, [materials, category, stageScope]);

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
            // Filter by status using purchase-based calculation
            if (statusFilter !== 'all') {
                const itemStatus = getItemStatus(item, purchases);
                if (itemStatus !== statusFilter) return false;
            }
            if (!term) return true;
            const haystack = `${item.material_name} ${item.notes || ''}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [items, searchTerm, statusFilter, purchases]);

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
            showError(isLaborCategory(category) ? 'Please select a labour item' : 'Please select a material');
            return;
        }

        const qty = parseFloat(newQuantity);
        if (isNaN(qty) || qty <= 0) {
            showError('Please enter a valid quantity');
            return;
        }

        const material = materials.find(m => m.id === newMaterialId);
        if (!material) {
            showError(isLaborCategory(category) ? 'Labour item not found' : 'Material not found');
            return;
        }

        // The price the public sees: an admin's published price, a recent
        // scrape, or the reference price — the same rule as the price list.
        const bestPrice = await getLatestPrice(material.id);
        if (!bestPrice) {
            showError('This material has no price yet. Ask an admin to publish one.');
            return;
        }

        setIsAdding(true);
        const categoryValue = isLaborCategory(category) && stageScope ? `labor_${stageScope}` : category;
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

    const addLabel = isLaborCategory(category) ? 'Add labour' : 'Add item';
    const selectLabel = isLaborCategory(category) ? 'Labour/service' : 'Material';
    const emptyTitle = isLaborCategory(category)
        ? 'No labour items yet'
        : 'No items in this section';
    const emptyHint = isLaborCategory(category)
        ? 'Add labour or service items to start tracking'
        : 'Use the builder or add items manually';

    if (items.length === 0) {
        return (
            <>
                <div className="stage-boq-empty boq-card empty">
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
                        <BoqAddItemForm
                            category={category}
                            selectLabel={selectLabel}
                            availableMaterials={availableMaterials}
                            newMaterialId={newMaterialId}
                            setNewMaterialId={setNewMaterialId}
                            newQuantity={newQuantity}
                            setNewQuantity={setNewQuantity}
                            isAdding={isAdding}
                            onCancel={() => setShowAddForm(false)}
                            onAdd={handleAddItem}
                        />
                    )}
                    <div className="empty-state">
                        <div className="empty-icon">
                            <Package size={32} weight="light" />
                        </div>
                        <p>{emptyTitle}</p>
                        <span>{emptyHint}</span>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className={`stage-boq boq-card ${expanded ? 'expanded' : 'collapsed'}`}>
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

                        <button className="expand-trigger" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${categoryLabel}`} aria-expanded={expanded}>
                            {expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="card-content">
                        <BoqTableToolbar
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            viewPreset={viewPreset}
                            applyPreset={applyPreset}
                            columnsMenuRef={columnsMenuRef}
                            isColumnsOpen={isColumnsOpen}
                            setIsColumnsOpen={setIsColumnsOpen}
                            visibleColumns={visibleColumns}
                            toggleColumn={toggleColumn}
                            usageTrackingEnabled={usageTrackingEnabled}
                        />
                        {showAddForm && (
                            <BoqAddItemForm
                                category={category}
                                selectLabel={selectLabel}
                                availableMaterials={availableMaterials}
                                newMaterialId={newMaterialId}
                                setNewMaterialId={setNewMaterialId}
                                newQuantity={newQuantity}
                                setNewQuantity={setNewQuantity}
                                isAdding={isAdding}
                                onCancel={() => setShowAddForm(false)}
                                onAdd={handleAddItem}
                            />
                        )}

                        <div className="table-responsive">
                            <Table className="boq-table">
                                <TableHeader>
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
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map((item) => (
                                        <BoqItemRow
                                            key={item.id}
                                            item={item}
                                            purchases={purchases}
                                            visibleColumns={visibleColumns}
                                            usageByItem={usageByItem}
                                            usageTrackingEnabled={usageTrackingEnabled}
                                            handleQuantityUpdate={handleQuantityUpdate}
                                            handleActualPriceUpdate={handleActualPriceUpdate}
                                            handleActualQuantityUpdate={handleActualQuantityUpdate}
                                            onLogPurchase={onLogPurchase}
                                            onRecordUsage={onRecordUsage}
                                            onItemDelete={onItemDelete}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>

        </>
    );
}
