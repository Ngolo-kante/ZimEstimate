'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/shadcn/dropdown-menu';
import Link from 'next/link';
import ProjectActionsMenu from './ProjectActionsMenu';
import StageBadge from './StageBadge';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/shadcn/badge';
import Button from '@/components/ui/Button';
import { formatUsd } from '@/lib/format';
import { shortLocation, updatedLabel } from '@/lib/projects/listPresentation';
import type { Profile, Project, ProjectStage } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import { formatScopeLabel } from '@/lib/projects/projectList';
import type { useCardActions } from '@/app/projects/hooks/useCardActions';
import {
    Archive,
    Calendar,
    DotsThreeVertical,
    FileArrowDown,
    MapPin,
    PencilSimple,
    ShareNetwork,
    Trash,
    UserPlus,
} from '@phosphor-icons/react';

/** Build and quick-estimate card surfaces, with the existing action set. */
export default function ProjectsGrid({
    stages,
    filteredQuick,
    visibleProjects,
    highlightedProjectId,
    profile,
    actions,
}: {
    stages: ProjectStage[];
    filteredQuick: SavedWorkItem[];
    visibleProjects: Project[];
    highlightedProjectId: string | null;
    profile: Profile | null;
    actions: ReturnType<typeof useCardActions>;
}) {
    const {
        openMenuId, setOpenMenuId, isMobile,
        handleMenuToggle,
        handleQuickEdit, handleQuickShare, handleQuickInvite, handleQuickArchive, handleQuickDelete, handleQuickDownloadPdf,
    } = actions;
    return (
        <div className="projects-grid">
            {filteredQuick.map((item) => (
                <div key={item.id} className="project-card-wrap" data-saved-id={item.id}>
                    <Card className={`project-card${highlightedProjectId === item.id ? ' highlight-new' : ''}`}>
                        <CardHeader>
                            <div className="project-header">
                                <CardTitle><Link href={item.href} className="project-link">{item.name}</Link></CardTitle>
                                <Badge variant="secondary">{item.typeLabel}</Badge>
                                {item.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
                            </div>
                            <DropdownMenu open={!isMobile && openMenuId === item.id} onOpenChange={open => { if (!isMobile) setOpenMenuId(open ? item.id : null); }}><div className="menu-container">
                                <DropdownMenuTrigger asChild><Button variant="ghost" className="menu-btn" aria-label={`Actions for ${item.name}`} aria-haspopup="menu" aria-expanded={openMenuId === item.id} onClick={(e) => { if (isMobile) handleMenuToggle(e, item.id); else { e.preventDefault(); e.stopPropagation(); } }}>
                                    <DotsThreeVertical size={20} weight="bold" />
                                </Button></DropdownMenuTrigger>
                                {!isMobile && (
                                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}><DropdownMenuGroup>
                                        <DropdownMenuItem asChild><button onClick={(e) => handleQuickEdit(e, item)}>
                                            <PencilSimple size={16} /> Edit
                                        </button></DropdownMenuItem>
                                        <DropdownMenuItem asChild><button onClick={(e) => handleQuickShare(e, item)}>
                                            <ShareNetwork size={16} /> Share a copy
                                        </button></DropdownMenuItem>
                                        <DropdownMenuItem asChild><button onClick={(e) => handleQuickInvite(e, item)}>
                                            <UserPlus size={16} /> Invite people
                                        </button></DropdownMenuItem>
                                        <DropdownMenuItem asChild><button onClick={(e) => { void handleQuickDownloadPdf(e, item); }}>
                                            <FileArrowDown size={16} /> Download BOQ PDF
                                        </button></DropdownMenuItem>
                                        <DropdownMenuItem asChild><button onClick={(e) => { void handleQuickArchive(e, item); }}>
                                            <Archive size={16} /> {item.status === 'archived' ? 'Restore' : 'Archive'}
                                        </button></DropdownMenuItem>
                                        <DropdownMenuItem variant="destructive" asChild><button className="danger" onClick={(e) => handleQuickDelete(e, item)}>
                                            <Trash size={16} /> Delete
                                        </button></DropdownMenuItem>
                                    </DropdownMenuGroup></DropdownMenuContent>
                                )}
                            </div></DropdownMenu>
                        </CardHeader>

                        <div className="project-meta">
                            <span className="meta-item">
                                <Calendar size={14} weight="light" />
                                {updatedLabel(item.updatedAt)}
                            </span>
                        </div>

                        <div className="project-budget">
                            <span className="budget-label">Estimate</span>
                            <span className="budget-value">
                                {item.totalUsd > 0 ? formatUsd(item.totalUsd, { wholeDollars: true }) : <span className="muted">No estimate yet</span>}
                            </span>
                        </div>
                    </Card>
                </div>
            ))}
            {visibleProjects.map((project) => (
                <div key={project.id} className="project-card-wrap" data-saved-id={project.id}>
                    <Card className={`project-card${highlightedProjectId === project.id ? ' highlight-new' : ''}`}>
                        <CardHeader>
                            <div className="project-header">
                                <CardTitle><Link href={`/projects/${project.id}`} className="project-link">{project.name}</Link></CardTitle>
                                {project.scope !== 'entire_house' && <span className="build-type">{formatScopeLabel(project)}</span>}
                                <StageBadge project={project} stages={stages} />
                            </div>
                            <ProjectActionsMenu project={project} profile={profile} actions={actions} />
                        </CardHeader>

                        <div className="project-meta">
                            {project.location && (
                                <span className="meta-item">
                                    <MapPin size={14} weight="light" />
                                    {shortLocation(project.location)}
                                </span>
                            )}
                            <span className="meta-item">
                                <Calendar size={14} weight="light" />
                                {updatedLabel(project.updated_at)}
                            </span>
                        </div>

                        <div className="project-budget">
                            <span className="budget-label">Estimate</span>
                            <span className="budget-value">
                                {Number(project.total_usd) > 0 ? formatUsd(Number(project.total_usd), { wholeDollars: true }) : <span className="muted">No estimate yet</span>}
                            </span>
                        </div>

                    </Card>
                </div>
            ))}
        </div>
    );
}
