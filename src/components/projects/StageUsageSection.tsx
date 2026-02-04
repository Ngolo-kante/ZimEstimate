'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { BOQItem } from '@/lib/database.types';
import { recordUsage } from '@/lib/services/projects';
import {
    TrendDown,
    Plus,
    Check,
    CaretDown,
    CaretUp,
} from '@phosphor-icons/react';

interface StageUsageSectionProps {
    projectId: string;
    items: BOQItem[];
    usageByItem: Record<string, number>;
    onUsageRecorded: () => void;
}

interface UsageFormData {
    itemId: string;
    quantity: string;
    date: string;
    notes: string;
}

export default function StageUsageSection({
    projectId,
    items,
    usageByItem,
    onUsageRecorded,
}: StageUsageSectionProps) {
    const { formatPrice, exchangeRate } = useCurrency();
    const { success, error: showError } = useToast();
    const [expanded, setExpanded] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<UsageFormData>({
        itemId: '',
        quantity: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    // Calculate stats
    const stats = items.reduce(
        (acc, item) => {
            const purchased = Number(item.actual_quantity) || Number(item.quantity);
            const used = usageByItem[item.id] || 0;
            return {
                totalPurchased: acc.totalPurchased + purchased,
                totalUsed: acc.totalUsed + used,
                usedCost: acc.usedCost + used * Number(item.unit_price_usd),
                remainingCost: acc.remainingCost + (purchased - used) * Number(item.unit_price_usd),
            };
        },
        { totalPurchased: 0, totalUsed: 0, usedCost: 0, remainingCost: 0 }
    );

    const handleSubmit = async () => {
        if (!formData.itemId || !formData.quantity) {
            showError('Please select a material and enter quantity');
            return;
        }

        const qty = parseFloat(formData.quantity);
        if (isNaN(qty) || qty <= 0) {
            showError('Please enter a valid quantity');
            return;
        }

        setIsSubmitting(true);
        const { error } = await recordUsage(
            projectId,
            formData.itemId,
            qty,
            formData.date,
            formData.notes || undefined
        );

        if (error) {
            showError('Failed to record usage');
        } else {
            success('Usage recorded');
            setFormData({
                itemId: '',
                quantity: '',
                date: new Date().toISOString().split('T')[0],
                notes: '',
            });
            setShowForm(false);
            onUsageRecorded();
        }
        setIsSubmitting(false);
    };

    const getStatusColor = (item: BOQItem) => {
        const purchased = Number(item.actual_quantity) || Number(item.quantity);
        const used = usageByItem[item.id] || 0;
        const usagePercent = purchased > 0 ? (used / purchased) * 100 : 0;

        if (usagePercent >= 100) return 'var(--color-error)';
        if (usagePercent >= 80) return 'var(--color-warning)';
        return 'var(--color-success)';
    };

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            <div className="usage-section">
                <div className="section-header" onClick={() => setExpanded(!expanded)}>
                    <div className="header-info">
                        <TrendDown size={20} weight="duotone" />
                        <h4>Usage Tracking</h4>
                    </div>
                    <div className="header-stats">
                        <div className="stat">
                            <span className="stat-label">Used</span>
                            <span className="stat-value used">
                                {formatPrice(stats.usedCost, stats.usedCost * exchangeRate)}
                            </span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Remaining</span>
                            <span className="stat-value">
                                {formatPrice(stats.remainingCost, stats.remainingCost * exchangeRate)}
                            </span>
                        </div>
                        <button className="expand-btn">
                            {expanded ? <CaretUp size={18} /> : <CaretDown size={18} />}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="usage-content">
                        {/* Record Usage Button */}
                        {!showForm && (
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={<Plus size={14} />}
                                onClick={() => setShowForm(true)}
                                className="record-btn"
                            >
                                Record Usage
                            </Button>
                        )}

                        {/* Record Form */}
                        {showForm && (
                            <div className="usage-form">
                                <div className="form-row">
                                    <div className="form-group flex-2">
                                        <label>Material</label>
                                        <select
                                            value={formData.itemId}
                                            onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                                        >
                                            <option value="">Select material...</option>
                                            {items.map((item) => {
                                                const purchased = Number(item.actual_quantity) || Number(item.quantity);
                                                const used = usageByItem[item.id] || 0;
                                                const remaining = purchased - used;
                                                return (
                                                    <option key={item.id} value={item.id}>
                                                        {item.material_name} ({remaining} {item.unit} remaining)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Quantity</label>
                                        <input
                                            type="number"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Date</label>
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group flex-1">
                                        <label>Notes (optional)</label>
                                        <input
                                            type="text"
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="e.g., Foundation pour day 1"
                                        />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setShowForm(false);
                                            setFormData({
                                                itemId: '',
                                                quantity: '',
                                                date: new Date().toISOString().split('T')[0],
                                                notes: '',
                                            });
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={<Check size={14} />}
                                        onClick={handleSubmit}
                                        loading={isSubmitting}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Materials Usage List */}
                        <div className="materials-usage">
                            {items.map((item) => {
                                const purchased = Number(item.actual_quantity) || Number(item.quantity);
                                const used = usageByItem[item.id] || 0;
                                const remaining = purchased - used;
                                const usagePercent = purchased > 0 ? (used / purchased) * 100 : 0;

                                return (
                                    <div key={item.id} className="material-usage-item">
                                        <div className="material-info">
                                            <span className="material-name">{item.material_name}</span>
                                            <span className="material-stats">
                                                {used.toLocaleString()} / {purchased.toLocaleString()} {item.unit} used
                                            </span>
                                        </div>
                                        <div className="usage-bar-container">
                                            <div className="usage-bar">
                                                <div
                                                    className="usage-fill"
                                                    style={{
                                                        width: `${Math.min(usagePercent, 100)}%`,
                                                        background: getStatusColor(item),
                                                    }}
                                                />
                                            </div>
                                            <span className="usage-percent" style={{ color: getStatusColor(item) }}>
                                                {usagePercent.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .usage-section {
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
                    color: #f97316;
                }

                .header-info h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
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

                .stat-value.used {
                    color: #f97316;
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

                .usage-content {
                    padding: var(--spacing-md);
                }

                :global(.record-btn) {
                    margin-bottom: var(--spacing-md);
                }

                .usage-form {
                    background: var(--color-background);
                    border-radius: var(--radius-md);
                    padding: var(--spacing-md);
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

                .form-group.flex-1 {
                    flex: 1;
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

                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-sm);
                    margin-top: var(--spacing-sm);
                }

                .materials-usage {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .material-usage-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--spacing-md);
                    padding: var(--spacing-sm);
                    background: var(--color-background);
                    border-radius: var(--radius-md);
                }

                .material-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    flex: 1;
                }

                .material-name {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-text);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .material-stats {
                    font-size: 0.625rem;
                    color: var(--color-text-muted);
                }

                .usage-bar-container {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    min-width: 120px;
                }

                .usage-bar {
                    flex: 1;
                    height: 6px;
                    background: var(--color-border-light);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .usage-fill {
                    height: 100%;
                    transition: width 0.3s ease;
                }

                .usage-percent {
                    font-size: 0.75rem;
                    font-weight: 600;
                    min-width: 36px;
                    text-align: right;
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

                    .form-row {
                        flex-direction: column;
                    }
                }
            `}</style>
        </>
    );
}
