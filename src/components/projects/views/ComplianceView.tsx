'use client';

import ComplianceTrackerTab from '@/components/projects/ComplianceTrackerTab';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import type { ProjectStageWithTasks } from '@/lib/database.types';

export interface ComplianceViewProps {
    projectId: string;
    projectName: string;
    stages: ProjectStageWithTasks[];
    onStageUpdate: (stage: ProjectStageWithTasks) => void;
    phoneNumber: string | null | undefined;
    onRequestPhone: (payload?: { channel?: NotificationChannel }) => void;
    preferredChannel: NotificationChannel;
    setActiveView: (view: ProjectView) => void;
}

/** Certificates, approvals and their deadlines, stage by stage. */
export default function ComplianceView({
    projectId,
    projectName,
    stages,
    onStageUpdate,
    phoneNumber,
    onRequestPhone,
    preferredChannel,
    setActiveView,
}: ComplianceViewProps) {
    return (
        <div className="view-panel space-y-6">
            <ComplianceTrackerTab
                projectId={projectId}
                projectName={projectName}
                stages={stages}
                onStageUpdate={onStageUpdate}
                phoneNumber={phoneNumber}
                onRequestPhone={(payload) => onRequestPhone({ channel: payload?.channel })}
                preferredChannel={preferredChannel}
                onNavigateToSettings={() => setActiveView('settings')}
            />
        </div>
    );
}
