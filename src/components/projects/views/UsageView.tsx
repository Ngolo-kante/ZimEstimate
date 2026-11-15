'use client';

import Button from '@/components/ui/Button';
import ProjectUsageView from '@/components/projects/ProjectUsageView';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import type { BOQItem, Project } from '@/lib/database.types';

export interface UsageViewProps {
    project: Project;
    materialItems: BOQItem[];
    usageByItem: Record<string, number>;
    onUsageRecorded: () => Promise<void>;
    selectedItemForUsage: BOQItem | null;
    setSelectedItemForUsage: (item: BOQItem | null) => void;
    preferredChannel: NotificationChannel;
    setActiveView: (view: ProjectView) => void;
    onEnableUsageTracking: (enabled: boolean) => void;
}

/** Material used on site, or the switch to start tracking it. */
export default function UsageView({
    project,
    materialItems,
    usageByItem,
    onUsageRecorded,
    selectedItemForUsage,
    setSelectedItemForUsage,
    preferredChannel,
    setActiveView,
    onEnableUsageTracking,
}: UsageViewProps) {
    return (
        <div className="view-panel space-y-6">
            {project.usage_tracking_enabled ? (
                <ProjectUsageView
                    project={project}
                    items={materialItems}
                    usageByItem={usageByItem}
                    onUsageRecorded={onUsageRecorded}
                    selectedItemForUsage={selectedItemForUsage}
                    onClearSelectedItem={() => setSelectedItemForUsage(null)}
                    preferredChannel={preferredChannel}
                    onNavigateToSettings={() => setActiveView('settings')}
                />
            ) : (
                <div className="bg-surface border border-border rounded-xl p-6 shadow-card">
                    <h3 className="text-lg font-semibold text-primary mb-2">Enable usage tracking</h3>
                    <p className="text-secondary mb-4">
                        Turn on usage tracking to log materials used by builders.
                    </p>
                    <Button
                        variant="primary"
                        onClick={() => onEnableUsageTracking(true)}
                    >
                        Enable usage tracking
                    </Button>
                </div>
            )}
        </div>
    );
}
