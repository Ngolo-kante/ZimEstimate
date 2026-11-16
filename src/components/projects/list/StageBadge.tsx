import { Badge } from '@/components/shadcn/badge';
import type { Project, ProjectStage } from '@/lib/database.types';
import { currentStageLabel } from '@/lib/projects/listPresentation';

/** Keep stage wording and status colour tied to the same selected stage. */
export default function StageBadge({ project, stages }: { project: Project; stages: ProjectStage[] }) {
    const label = currentStageLabel(project, stages.filter(stage => stage.project_id === project.id));
    const status = /(?:^| · )complete(?:d)?$/i.test(label) ? 'complete' : / · in progress$/i.test(label) ? 'in-progress' : 'neutral';
    return <Badge variant="secondary" className="stage-badge" data-status={status}><span className="stage-dot" aria-hidden="true" />{label}</Badge>;
}
