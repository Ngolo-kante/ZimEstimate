'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import StageMetadataHeader from './StageMetadataHeader';
import StageTaskList from './StageTaskList';
import StageBOQSection from './StageBOQSection';
import { useToast } from '@/components/ui/Toast';
import { materials } from '@/lib/materials';
import {
    ProjectStageWithTasks,
    StageTask,
    BOQItem,
    BOQCategory,
    ProjectStageUpdate,
} from '@/lib/database.types';
import {
    updateStage,
    createStageTask,
    updateStageTask,
    toggleStageTask,
    deleteStageTask,
    getStageBudgetStats,
    StageBudgetStats,
} from '@/lib/services/stages';
import { deleteBOQItem } from '@/lib/services/projects';
import { Warning } from '@phosphor-icons/react';

interface StageTabProps {
    stage: ProjectStageWithTasks;
    projectId: string;
    items: BOQItem[];
    onStageUpdate: (stage: ProjectStageWithTasks) => void;
    onItemUpdate: (itemId: string, updates: Partial<BOQItem>) => Promise<void>;
    onItemDelete?: (itemId: string) => void;
    onItemAdded?: (item: BOQItem) => void;
    showLabor?: boolean;
    primaryStageCategory?: BOQCategory;
    usageByItem?: Record<string, number>;
    usageTrackingEnabled?: boolean;
}

const categoryLabels: Record<BOQCategory, string> = {
    substructure: 'Substructure',
    superstructure: 'Superstructure',
    roofing: 'Roofing',
    finishing: 'Finishing',
    exterior: 'Exterior & Security',
};

export default function StageTab({
    stage,
    projectId,
    items,
    onStageUpdate,
    onItemUpdate,
    onItemDelete,
    onItemAdded,
    showLabor = false,
    primaryStageCategory,
    usageByItem,
    usageTrackingEnabled = false,
}: StageTabProps) {
    const { success, error: showError } = useToast();
    const [budgetStats, setBudgetStats] = useState<StageBudgetStats>({
        totalBudget: 0,
        totalSpent: 0,
        remaining: 0,
        itemCount: 0,
        purchasedCount: 0,
        usagePercent: 0,
    });
    // Filter items for this stage's category
    const stageItems = items.filter(item => item.category === stage.boq_category);
    const stageLaborItems = useMemo(() => {
        if (!showLabor) return [];
        return items.filter(item => {
            const stageLaborKey = `labor_${stage.boq_category}`;
            const isLegacyLabor = item.category === 'labor';
            const isStageLabor = item.category === stageLaborKey;

            if (isStageLabor) return true;
            if (!isLegacyLabor) return false;
            if (primaryStageCategory && stage.boq_category !== primaryStageCategory) {
                return false;
            }

            const material = materials.find(m => m.id === item.material_id);
            if (!material) return true;
            return material.milestones.includes(stage.boq_category);
        });
    }, [items, stage.boq_category, showLabor, primaryStageCategory]);

    const laborStats: StageBudgetStats = useMemo(() => {
        const totalBudget = stageLaborItems.reduce((sum: number, item: BOQItem) =>
            sum + (Number(item.quantity) * Number(item.unit_price_usd)), 0);
        const totalSpent = stageLaborItems
            .filter(item => item.is_purchased)
            .reduce((sum: number, item: BOQItem) => {
                const qty = item.actual_quantity ?? item.quantity;
                const price = item.actual_price_usd ?? item.unit_price_usd;
                return sum + (Number(qty) * Number(price));
            }, 0);
        const purchasedCount = stageLaborItems.filter(i => i.is_purchased).length;
        const remaining = totalBudget - totalSpent;
        const usagePercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        return {
            totalBudget,
            totalSpent,
            remaining,
            itemCount: stageLaborItems.length,
            purchasedCount,
            usagePercent,
        };
    }, [stageLaborItems]);

    // Load budget stats
    const loadData = useCallback(async () => {
        const statsResult = await getStageBudgetStats(projectId, stage.boq_category);

        if (!statsResult.error) {
            setBudgetStats(statsResult.stats);
        }
    }, [projectId, stage.boq_category]);

    useEffect(() => {
        // eslint-disable-next-line
        loadData();
    }, [loadData, stageItems.length]);

    // Stage handlers
    const handleStageUpdate = async (updates: Partial<ProjectStageUpdate>) => {
        const { stage: updated, error } = await updateStage(stage.id, updates);
        if (error) {
            showError('Failed to update stage');
        } else if (updated) {
            onStageUpdate({ ...stage, ...updated });
            success('Stage updated');
        }
    };

    // Task handlers
    const handleAddTask = async (data: { title: string; description?: string }) => {
        const { task, error } = await createStageTask(stage.id, data);
        if (error) {
            showError('Failed to add task');
        } else if (task) {
            onStageUpdate({ ...stage, tasks: [...stage.tasks, task] });
            success('Task added');
        }
    };

    const handleToggleTask = async (taskId: string, completed: boolean) => {
        const { task, error } = await toggleStageTask(taskId, completed);
        if (error) {
            showError('Failed to update task');
        } else if (task) {
            onStageUpdate({
                ...stage,
                tasks: stage.tasks.map(t => t.id === taskId ? task : t),
            });
        }
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<StageTask>) => {
        const { task, error } = await updateStageTask(taskId, updates);
        if (error) {
            showError('Failed to update task');
        } else if (task) {
            onStageUpdate({
                ...stage,
                tasks: stage.tasks.map(t => t.id === taskId ? task : t),
            });
            success('Task updated');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        const { error } = await deleteStageTask(taskId);
        if (error) {
            showError('Failed to delete task');
        } else {
            onStageUpdate({
                ...stage,
                tasks: stage.tasks.filter(t => t.id !== taskId),
            });
            success('Task deleted');
        }
    };

    // BOQ item handlers
    const handleItemUpdate = async (itemId: string, updates: Partial<BOQItem>) => {
        await onItemUpdate(itemId, updates);
        loadData();
    };

    const handleItemDelete = async (itemId: string) => {
        if (!confirm('Delete this item?')) return;

        const { error } = await deleteBOQItem(itemId);
        if (error) {
            showError('Failed to delete item');
        } else {
            onItemDelete?.(itemId);
            success('Item deleted');
            loadData();
        }
    };

    const handleItemAdded = (item: BOQItem) => {
        onItemAdded?.(item);
        loadData();
    };

    // Check if stage is not applicable
    if (!stage.is_applicable) {
        return (
            <div className="stage-not-applicable">
                <Warning size={48} weight="light" />
                <h4>Stage Not Applicable</h4>
                <p>This stage is not included in your project scope.</p>

                <style jsx>{`
                    .stage-not-applicable {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: var(--spacing-2xl);
                        text-align: center;
                        color: var(--color-text-muted);
                        background: var(--color-background);
                        border-radius: var(--radius-lg);
                        border: 1px dashed var(--color-border);
                        min-height: 300px;
                    }

                    .stage-not-applicable h4 {
                        margin: var(--spacing-md) 0 var(--spacing-xs) 0;
                        color: var(--color-text);
                    }

                    .stage-not-applicable p {
                        margin: 0;
                        font-size: 0.875rem;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <>
            <div className="stage-tab">
                {/* Stage Header with Status and Dates */}
                <StageMetadataHeader
                    stage={stage}
                    onUpdate={handleStageUpdate}
                />

                {/* Admin & Compliance Tasks */}
                <div className="tasks-section">
                    <StageTaskList
                        tasks={stage.tasks}
                        onAddTask={handleAddTask}
                        onToggleTask={handleToggleTask}
                        onUpdateTask={handleUpdateTask}
                        onDeleteTask={handleDeleteTask}
                    />
                </div>

                {/* Bill of Quantities for this stage */}
                <div className="boq-section">
                    <StageBOQSection
                        projectId={projectId}
                        category={stage.boq_category}
                        categoryLabel={categoryLabels[stage.boq_category]}
                        items={stageItems}
                        stats={budgetStats}
                        onItemUpdate={handleItemUpdate}
                        onItemDelete={onItemDelete ? handleItemDelete : undefined}
                        onItemAdded={handleItemAdded}
                        usageByItem={usageByItem}
                        usageTrackingEnabled={usageTrackingEnabled}
                    />
                </div>

                {showLabor && (
                    <div className="boq-section">
                        <StageBOQSection
                            projectId={projectId}
                            category="labor"
                            categoryLabel="Labor & Services"
                            items={stageLaborItems}
                            stats={laborStats}
                            onItemUpdate={handleItemUpdate}
                            onItemDelete={onItemDelete ? handleItemDelete : undefined}
                            onItemAdded={handleItemAdded}
                            stageScope={stage.boq_category}
                            usageByItem={usageByItem}
                            usageTrackingEnabled={usageTrackingEnabled}
                        />
                    </div>
                )}
            </div>

            <style jsx>{`
                .stage-tab {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .tasks-section,
                .boq-section {
                    /* Sections stack vertically */
                }
            `}</style>
        </>
    );
}
