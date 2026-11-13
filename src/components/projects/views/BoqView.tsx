'use client';

import { useEffect, useMemo, useRef } from 'react';
import Button from '@/components/ui/Button';
import StageTab from '@/components/projects/StageTab';
import ProjectFeesPanel from '@/components/projects/ProjectFeesPanel';
import ProjectCostSplit from '@/components/projects/ProjectCostSplit';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import { STAGE_CATEGORIES, STAGE_SHORT_LABELS as categoryShortLabels } from '@/lib/projects/workspaceStages';
import type { BOQCategory, BOQItem, ProjectStageWithTasks, PurchaseRecord } from '@/lib/database.types';
import { WarningCircle, X } from '@phosphor-icons/react';

export interface BoqViewProps {
    projectId: string;
    items: BOQItem[];
    feeItems: BOQItem[];
    stages: ProjectStageWithTasks[];
    currentStage: ProjectStageWithTasks | undefined;
    purchases: PurchaseRecord[];
    actualSpentUsd: number;
    usageByItem: Record<string, number>;
    usageTrackingEnabled: boolean;
    hasLabor: boolean;
    activeTab: BOQCategory;
    setActiveTab: (category: BOQCategory) => void;
    setActiveView: (view: ProjectView) => void;
    complianceWarnings: string[];
    isComplianceBannerDismissed: boolean;
    onDismissComplianceBanner: () => void;
    onStageUpdate: (stage: ProjectStageWithTasks) => void;
    onItemUpdate: (itemId: string, updates: Partial<BOQItem>) => Promise<void>;
    onItemDelete: (itemId: string) => Promise<void>;
    onItemAdded: (item: BOQItem) => void;
    onLogPurchase: (item: BOQItem) => void;
    onRecordUsage: (item: BOQItem) => void;
}

/** The bill of quantities, one stage at a time, with that stage's open approvals. */
export default function BoqView({
    projectId,
    items,
    feeItems,
    stages,
    currentStage,
    purchases,
    actualSpentUsd,
    usageByItem,
    usageTrackingEnabled,
    hasLabor,
    activeTab,
    setActiveTab,
    setActiveView,
    complianceWarnings: activeStageComplianceWarnings,
    isComplianceBannerDismissed,
    onDismissComplianceBanner,
    onStageUpdate,
    onItemUpdate,
    onItemDelete,
    onItemAdded,
    onLogPurchase,
    onRecordUsage,
}: BoqViewProps) {
    const stageSwitcherRef = useRef<HTMLElement | null>(null);

    const activeStageItems = useMemo(() => {
        if (STAGE_CATEGORIES.includes(activeTab as BOQCategory)) {
            const category = activeTab as BOQCategory;
            return items.filter(i => i.category === category);
        }
        return items;
    }, [items, activeTab]);

    // Bring the current stage into view in the switcher (it scrolls sideways on phones).
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            stageSwitcherRef.current
                ?.querySelector('[aria-current="step"]')
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activeTab]);
    return (
        <div className="view-panel space-y-6 max-w-full mx-auto">
            <ProjectCostSplit items={items} spentUsd={actualSpentUsd} idSuffix="-boq" />
            <nav ref={stageSwitcherRef} className="stage-switcher" aria-label="Construction stages">
                {STAGE_CATEGORIES.map((category, index) => {
                    const stage = stages.find((candidate) => candidate.boq_category === category);
                    if (!stage) return null;
                    const stageItemCount = items.filter((item) => item.category === category).length;
                    const isActive = activeTab === category;
                    return (
                        <button
                            key={stage.id}
                            type="button"
                            className={`stage-switcher-item${isActive ? ' active' : ''}${!stage.is_applicable ? ' unavailable' : ''}`}
                            aria-current={isActive ? 'step' : undefined}
                            aria-label={`${categoryShortLabels[category]}, ${stageItemCount} ${stageItemCount === 1 ? 'item' : 'items'}`}
                            onClick={() => setActiveTab(category)}
                        >
                            <span className="stage-number">{index + 1}</span>
                            <span className="stage-switcher-copy">
                                <strong>{categoryShortLabels[category]}</strong>
                                <small>{stage.is_applicable ? `${stageItemCount} ${stageItemCount === 1 ? 'item' : 'items'}` : 'Not included'}</small>
                            </span>
                        </button>
                    );
                })}
            </nav>

            {activeStageComplianceWarnings.length > 0 && !isComplianceBannerDismissed && (
                <div className="compliance-warning-banner" role="alert">
                    <div className="compliance-warning-content">
                        <span className="compliance-warning-icon" aria-hidden="true">
                            <WarningCircle size={18} weight="fill" />
                        </span>
                        <div>
                            <h4 className="text-sm font-semibold text-amber-900">
                                {activeStageComplianceWarnings.length} pending {activeStageComplianceWarnings.length === 1 ? 'approval' : 'approvals'}
                            </h4>
                            <p className="text-xs text-amber-800 mt-1">Review these before starting this stage.</p>
                            <details className="compliance-warning-details">
                                <summary>View pending approvals</summary>
                                <ul className="mt-2 list-disc pl-5 text-xs text-amber-800 space-y-1">
                                    {activeStageComplianceWarnings.slice(0, 6).map((issue) => (
                                        <li key={issue}>{issue}</li>
                                    ))}
                                </ul>
                            </details>
                        </div>
                    </div>
                    <div className="compliance-warning-actions">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setActiveView('compliance')}
                        >
                            Open Compliance Tracker
                        </Button>
                        <button
                            type="button"
                            className="compliance-warning-dismiss"
                            onClick={() => onDismissComplianceBanner()}
                            aria-label="Dismiss compliance warning"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
            {currentStage && (
                <StageTab
                    stage={currentStage}
                    projectId={projectId}
                    items={activeStageItems}
                    purchases={purchases}
                    onStageUpdate={(u) => onStageUpdate({ ...currentStage, ...u })}
                    onItemUpdate={onItemUpdate}
                    onItemDelete={onItemDelete}
                    onItemAdded={onItemAdded}
                    onLogPurchase={onLogPurchase}
                    onRecordUsage={onRecordUsage}
                    showLabor={hasLabor}
                    usageByItem={usageByItem}
                    usageTrackingEnabled={usageTrackingEnabled}
                    showTasks={false}
                />
            )}
            <ProjectFeesPanel items={feeItems} onUpdate={onItemUpdate} />
        </div>
    );
}
