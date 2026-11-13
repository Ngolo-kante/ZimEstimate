'use client';

import ProjectSettings from '@/components/projects/ProjectSettings';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import type { Project, ProjectRecurringReminder } from '@/lib/database.types';
import type { PurchaseStats } from '@/lib/projects/workspaceStats';
import type { ReminderDraft } from '@/app/projects/[id]/hooks/useSavingsReminder';

type Frequency = 'daily' | 'weekly' | 'monthly';

export interface SettingsViewProps {
    project: Project;
    setProject: (project: Project) => void;
    onSetReminder: (frequency: Frequency, amount: number, channel: NotificationChannel, phoneOverride?: string) => Promise<void>;
    phoneNumber: string | null | undefined;
    defaultReminderChannel: NotificationChannel;
    onRequestPhone: (payload?: { channel?: NotificationChannel; pendingReminder?: { frequency: Frequency; amount: number } }) => void;
    savingsReminder: ProjectRecurringReminder | null;
    onToggleReminder: (active: boolean) => Promise<void>;
    purchaseStats: PurchaseStats;
    reminderDraft: ReminderDraft | null;
    setReminderDraft: (draft: ReminderDraft | null) => void;
    onReminderChannelChange: (channel: NotificationChannel) => void;
}

/** Project details, stages, alerts and the savings reminder. */
export default function SettingsView({
    project,
    setProject,
    onSetReminder,
    phoneNumber,
    defaultReminderChannel,
    onRequestPhone,
    savingsReminder,
    onToggleReminder,
    purchaseStats,
    reminderDraft,
    setReminderDraft,
    onReminderChannelChange,
}: SettingsViewProps) {
    return (
        <div className="view-panel">
            <ProjectSettings
                project={project}
                // Settings has already saved; this only takes the result.
                // It used to save the whole project a second time.
                onUpdate={setProject}
                onSetReminder={onSetReminder}
                canUseMobileReminders={Boolean(phoneNumber)}
                defaultReminderChannel={defaultReminderChannel}
                onRequestPhone={onRequestPhone}
                reminderActive={Boolean(savingsReminder?.is_active)}
                reminderFrequency={(savingsReminder?.frequency as 'daily' | 'weekly' | 'monthly' | null) ?? null}
                onToggleReminder={onToggleReminder}
                defaultReminderAmountUsd={Math.max(purchaseStats.estimatedTotal - purchaseStats.actualSpent, 0)}
                reminderDraft={reminderDraft}
                onReminderDraftUsed={() => setReminderDraft(null)}
                onReminderChannelChange={onReminderChannelChange}
            />
        </div>
    );
}
