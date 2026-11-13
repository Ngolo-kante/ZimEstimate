'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import { updateProject } from '@/lib/services/projects';
import { getStageUsageData } from '@/lib/services/stages';
import type { Project, ProjectStageWithTasks } from '@/lib/database.types';
import { sumUsageByItem, type UsageByStage } from '@/lib/projects/workspaceStats';

/**
 * Material used on site, per stage and per BOQ line, and keeping it and the
 * BOQ lines fresh while a material view is open.
 */
export function useUsageData({
    projectId,
    project,
    setProject,
    stages,
    activeView,
    refreshItems,
}: {
    projectId: string;
    project: Project | null;
    setProject: (project: Project) => void;
    stages: ProjectStageWithTasks[];
    activeView: ProjectView;
    refreshItems: () => Promise<void>;
}) {
    const { error: showError } = useToast();
    const [usageByStage, setUsageByStage] = useState<UsageByStage>({});
    const usageByItem = useMemo(() => sumUsageByItem(usageByStage), [usageByStage]);

    const loadUsageData = useCallback(async () => {
        const stagesToLoad = stages.filter(s => s.is_applicable);
        const results = await Promise.all(
            stagesToLoad.map(stage => getStageUsageData(projectId, stage.boq_category))
        );

        const nextUsage: UsageByStage = {};
        results.forEach((result, index) => {
            const stage = stagesToLoad[index];
            if (!stage) return;
            if (!result.error) {
                nextUsage[stage.boq_category] = {
                    items: result.items,
                    usageByItem: result.usageByItem,
                };
            }
        });

        setUsageByStage(nextUsage);
    }, [projectId, stages]);

    const refreshProjectMaterialState = useCallback(async () => {
        await refreshItems();
        if (project?.usage_tracking_enabled) {
            await loadUsageData();
        }
    }, [loadUsageData, project?.usage_tracking_enabled, refreshItems]);

    useEffect(() => {
        if (!project?.usage_tracking_enabled) return;
        if (activeView !== 'procurement' && activeView !== 'boq' && activeView !== 'usage') return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when a material view opens
        loadUsageData();
    }, [activeView, project?.usage_tracking_enabled, loadUsageData]);

    const handleUsageTrackingToggle = async (enabled: boolean) => {
        const { project: updated, error: updateError } = await updateProject(projectId, {
            usage_tracking_enabled: enabled,
        });
        if (updateError) {
            showError('Failed to update usage tracking');
            return;
        }
        if (updated) {
            setProject(updated);
        }
    };

    return { usageByItem, loadUsageData, refreshProjectMaterialState, handleUsageTrackingToggle };
}
