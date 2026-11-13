'use client';

import BudgetPlanner from '@/components/ui/BudgetPlanner';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import type { Project } from '@/lib/database.types';
import type { PurchaseStats } from '@/lib/projects/workspaceStats';
import type { ReminderDraft } from '@/app/projects/[id]/hooks/useSavingsReminder';

export interface BudgetViewProps {
    project: Project;
    purchaseStats: PurchaseStats;
    onTargetDateChange: (date: string) => Promise<boolean>;
    onProjectUpdate: (updates: Partial<Project>, options?: { quiet?: boolean }) => Promise<boolean>;
    setReminderDraft: (draft: ReminderDraft) => void;
    setActiveView: (view: ProjectView) => void;
}

/** The budget position and how much to set aside to reach it. */
export default function BudgetView({
    project,
    purchaseStats,
    onTargetDateChange,
    onProjectUpdate,
    setReminderDraft,
    setActiveView,
}: BudgetViewProps) {
    return (
        <div className="view-panel space-y-6">
            <BudgetPlanner
                estimateUsd={purchaseStats.estimatedTotal}
                limitUsd={project.budget_target_usd}
                amountSpentUsd={purchaseStats.actualSpent}
                targetDate={project.target_purchase_date}
                onTargetDateChange={onTargetDateChange}
                onLimitChange={(limitUsd) => onProjectUpdate({ budget_target_usd: limitUsd }, { quiet: true })}
                savingsMode={project.savings_target_mode ?? 'remaining'}
                savingsCustomUsd={project.savings_target_usd}
                onSavingsTargetChange={(mode, customUsd) => onProjectUpdate({ savings_target_mode: mode, savings_target_usd: customUsd }, { quiet: true })}
                onSetReminder={(plan) => { setReminderDraft(plan); setActiveView('settings'); }}
            />
        </div>
    );
}
