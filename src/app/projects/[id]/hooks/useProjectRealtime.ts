'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import type { Project, ProjectStageWithTasks } from '@/lib/database.types';

/**
 * Reloads the workspace when the project, its lines, stages, tasks,
 * documents, purchases or usage change elsewhere (another tab, a builder on
 * site). Bursts of changes are folded into one reload.
 */
export function useProjectRealtime({
    projectId,
    project,
    stages,
    activeView,
    loadProjectData,
    loadUsageData,
    refreshStages,
}: {
    projectId: string;
    project: Project | null;
    stages: ProjectStageWithTasks[];
    activeView: ProjectView;
    loadProjectData: (showLoading?: boolean, forcePrimaryStage?: boolean) => Promise<void>;
    loadUsageData: () => Promise<void>;
    refreshStages: (forcePrimaryStage?: boolean) => Promise<void>;
}) {
    const projectRealtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stagesRealtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const materialRealtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const shouldRefreshUsage =
            project?.usage_tracking_enabled &&
            (activeView === 'procurement' || activeView === 'boq' || activeView === 'usage');

        const scheduleProjectRefresh = () => {
            if (projectRealtimeTimeoutRef.current) {
                clearTimeout(projectRealtimeTimeoutRef.current);
            }
            projectRealtimeTimeoutRef.current = setTimeout(() => {
                void loadProjectData(false, false);
                if (shouldRefreshUsage) {
                    void loadUsageData();
                }
            }, 250);
        };

        const scheduleStageRefresh = () => {
            if (stagesRealtimeTimeoutRef.current) {
                clearTimeout(stagesRealtimeTimeoutRef.current);
            }
            stagesRealtimeTimeoutRef.current = setTimeout(() => {
                void refreshStages(false);
                if (shouldRefreshUsage) {
                    void loadUsageData();
                }
            }, 250);
        };

        const scheduleUsageRefresh = () => {
            if (materialRealtimeTimeoutRef.current) {
                clearTimeout(materialRealtimeTimeoutRef.current);
            }
            materialRealtimeTimeoutRef.current = setTimeout(() => {
                if (shouldRefreshUsage) {
                    void loadUsageData();
                }
            }, 200);
        };

        const stageIds = new Set(stages.map((stage) => stage.id));

        const channel = supabase
            .channel(`project-detail-${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'projects',
                    filter: `id=eq.${projectId}`,
                },
                () => {
                    scheduleProjectRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'boq_items',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleProjectRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_stages',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleStageRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'stage_tasks',
                },
                (payload) => {
                    const candidate = (payload.new as { stage_id?: string } | null)?.stage_id
                        || (payload.old as { stage_id?: string } | null)?.stage_id;
                    if (candidate && stageIds.size > 0 && !stageIds.has(candidate)) return;
                    scheduleStageRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_documents',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleProjectRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'purchase_records',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleProjectRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'material_usage',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleUsageRefresh();
                }
            )
            .subscribe();

        return () => {
            if (projectRealtimeTimeoutRef.current) {
                clearTimeout(projectRealtimeTimeoutRef.current);
                projectRealtimeTimeoutRef.current = null;
            }
            if (stagesRealtimeTimeoutRef.current) {
                clearTimeout(stagesRealtimeTimeoutRef.current);
                stagesRealtimeTimeoutRef.current = null;
            }
            if (materialRealtimeTimeoutRef.current) {
                clearTimeout(materialRealtimeTimeoutRef.current);
                materialRealtimeTimeoutRef.current = null;
            }
            void supabase.removeChannel(channel);
        };
    }, [activeView, loadProjectData, loadUsageData, project?.usage_tracking_enabled, projectId, refreshStages, stages]);
}
