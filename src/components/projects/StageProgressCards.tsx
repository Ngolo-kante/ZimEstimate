'use client';

import React from 'react';
import {
    CheckCircle,
    HourglassSimple,
    Warehouse,
    Wall,
    House,
    PaintBrush,
    Tree,
} from '@phosphor-icons/react';
import { ProjectStageWithTasks, BOQCategory, StageStatus } from '@/lib/database.types';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { BOQItem } from '@/lib/database.types';

interface StageProgressCardsProps {
    stages: ProjectStageWithTasks[];
    items: BOQItem[];
    onStageClick?: (category: BOQCategory) => void;
    activeStage?: BOQCategory;
}

const stageIcons: Record<BOQCategory, React.ComponentType<{ size: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; className?: string }>> = {
    substructure: Warehouse,
    superstructure: Wall,
    roofing: House,
    finishing: PaintBrush,
    exterior: Tree,
};

const stageLabels: Record<BOQCategory, { short: string; full: string }> = {
    substructure: { short: 'Foundation', full: 'Site & Foundation' },
    superstructure: { short: 'Walls', full: 'Structural Walls' },
    roofing: { short: 'Roof', full: 'Roofing' },
    finishing: { short: 'Interior', full: 'Interior Finishing' },
    exterior: { short: 'Exterior', full: 'External Work' },
};

const statusConfig: Record<StageStatus, { color: string; bg: string; label: string }> = {
    planning: { color: 'text-slate-500', bg: 'bg-slate-100', label: 'Planning' },
    pending_approval: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Pending' },
    in_progress: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'In Progress' },
    on_hold: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'On Hold' },
    completed: { color: 'text-green-600', bg: 'bg-green-50', label: 'Complete' },
};

export function StageProgressCards({
    stages,
    items,
    onStageClick,
    activeStage
}: StageProgressCardsProps) {
    const { formatPrice, exchangeRate } = useCurrency();

    // Calculate stats per stage
    const stageStats = stages.reduce((acc, stage) => {
        const stageItems = items.filter(i => i.category === stage.boq_category);
        const totalCost = stageItems.reduce((sum, item) => {
            return sum + (Number(item.quantity) * Number(item.unit_price_usd));
        }, 0);
        const purchasedCount = stageItems.filter(i => i.is_purchased).length;
        const totalCount = stageItems.length;
        const completionPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

        acc[stage.boq_category] = { totalCost, purchasedCount, totalCount, completionPercent };
        return acc;
    }, {} as Record<BOQCategory, { totalCost: number; purchasedCount: number; totalCount: number; completionPercent: number }>);

    const applicableStages = stages.filter(s => s.is_applicable);

    return (
        <div className="stage-progress-cards">
            <div className="stages-container">
                {applicableStages.map((stage, index) => {
                    const Icon = stageIcons[stage.boq_category];
                    const labels = stageLabels[stage.boq_category];
                    const stats = stageStats[stage.boq_category] || { totalCost: 0, purchasedCount: 0, totalCount: 0, completionPercent: 0 };
                    const config = statusConfig[stage.status];
                    const isActive = activeStage === stage.boq_category;
                    const isCompleted = stage.status === 'completed';
                    const isInProgress = stage.status === 'in_progress';

                    return (
                        <React.Fragment key={stage.id}>
                            <div
                                className={`stage-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isInProgress ? 'in-progress' : ''}`}
                                onClick={() => onStageClick?.(stage.boq_category)}
                            >
                                <div className={`stage-icon-wrapper ${config.bg}`}>
                                    {isCompleted ? (
                                        <CheckCircle size={28} weight="fill" className="text-green-500" />
                                    ) : isInProgress ? (
                                        <HourglassSimple size={28} weight="fill" className="text-blue-500" />
                                    ) : (
                                        <Icon size={28} weight="duotone" className={config.color} />
                                    )}
                                </div>

                                <div className="stage-info">
                                    <h4 className="stage-name">{labels.short}</h4>
                                    <span className={`stage-status ${config.color}`}>{config.label}</span>
                                </div>

                                <div className="stage-stats">
                                    <span className="stage-cost">{formatPrice(stats.totalCost, stats.totalCost * exchangeRate)}</span>
                                    <span className="stage-items">{stats.purchasedCount}/{stats.totalCount} items</span>
                                </div>

                                <div className="stage-progress">
                                    <div
                                        className="stage-progress-fill"
                                        style={{
                                            width: `${stats.completionPercent}%`,
                                            background: isCompleted
                                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                            </div>

                            {index < applicableStages.length - 1 && (
                                <div className={`stage-connector ${applicableStages[index + 1]?.status === 'completed' || stage.status === 'completed' ? 'completed' : ''}`}>
                                    <div className="connector-line" />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <style jsx>{`
                .stage-progress-cards {
                    background: white;
                    border-radius: 16px;
                    padding: 24px;
                    border: 1px solid #e2e8f0;
                }

                .stages-container {
                    display: flex;
                    align-items: stretch;
                    gap: 0;
                    overflow-x: auto;
                    padding-bottom: 8px;
                }

                .stage-card {
                    flex: 1;
                    min-width: 140px;
                    max-width: 180px;
                    background: #f8fafc;
                    border: 2px solid transparent;
                    border-radius: 12px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .stage-card:hover {
                    background: #f1f5f9;
                    transform: translateY(-2px);
                }

                .stage-card.active {
                    border-color: #FCA311;
                    background: #fffbeb;
                }

                .stage-card.completed {
                    background: #f0fdf4;
                }

                .stage-card.in-progress {
                    background: #eff6ff;
                }

                .stage-icon-wrapper {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stage-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .stage-name {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0;
                }

                .stage-status {
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .stage-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .stage-cost {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #0f172a;
                }

                .stage-items {
                    font-size: 0.75rem;
                    color: #64748b;
                }

                .stage-progress {
                    height: 4px;
                    background: #e2e8f0;
                    border-radius: 2px;
                    overflow: hidden;
                }

                .stage-progress-fill {
                    height: 100%;
                    border-radius: 2px;
                    transition: width 0.5s ease-out;
                }

                .stage-connector {
                    display: flex;
                    align-items: center;
                    padding: 0 4px;
                    align-self: center;
                }

                .connector-line {
                    width: 24px;
                    height: 2px;
                    background: #e2e8f0;
                    border-radius: 1px;
                }

                .stage-connector.completed .connector-line {
                    background: #22c55e;
                }

                @media (max-width: 768px) {
                    .stage-card {
                        min-width: 120px;
                        padding: 12px;
                    }

                    .stage-icon-wrapper {
                        width: 40px;
                        height: 40px;
                    }

                    .stage-name {
                        font-size: 0.8125rem;
                    }

                    .connector-line {
                        width: 16px;
                    }
                }
            `}</style>
        </div>
    );
}

export default StageProgressCards;
