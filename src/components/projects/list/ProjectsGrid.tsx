'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/shadcn/dropdown-menu';
import Link from 'next/link';
import Card, { CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import PriceDisplay from '@/components/projects/PriceDisplay';
import type { Profile, Project } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import { formatScopeLabel, getComplianceChips, STATUS_COLORS as statusColors } from '@/lib/projects/projectList';
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

/** The cards: the one still saving, quick estimates, then full builds. */
export default function ProjectsGrid({
    optimisticProject,
    filteredQuick,
    visibleProjects,
    highlightedProjectId,
    profile,
    actions,
}: {
    optimisticProject: { id: string; name: string; location: string } | null;
    filteredQuick: SavedWorkItem[];
    visibleProjects: Project[];
    highlightedProjectId: string | null;
    profile: Profile | null;
    actions: ReturnType<typeof useCardActions>;
}) {
    const {
        openMenuId, setOpenMenuId, isMobile,
        handleMenuToggle, handleEdit, handleShare, handleInvite, handleArchive, handleDelete, handleDownloadPdf,
        handleQuickEdit, handleQuickShare, handleQuickInvite, handleQuickArchive, handleQuickDelete, handleQuickDownloadPdf,
    } = actions;
    return (
        <div className="projects-grid">
            {/* Optimistic "Creating..." card */}
            {optimisticProject && (
                <div className="project-link">
                    <Card className="project-card creating">
                        <CardHeader>
                            <div className="project-header">
                                <CardTitle>{optimisticProject.name}</CardTitle>
                                <CardBadge variant="default">Creating...</CardBadge>
                            </div>
                        </CardHeader>
                        <div className="project-meta">
                            {optimisticProject.location && (
                                <span className="meta-item">
                                    <MapPin size={14} weight="light" />
                                    {optimisticProject.location}
                                </span>
                            )}
                        </div>
                        <div className="project-budget">
                            <span className="budget-label">Estimate</span>
                            <span className="budget-value">--</span>
                        </div>
                    </Card>
                </div>
            )}
            {filteredQuick.map((item) => (
                <Link key={item.id} href={item.href} className="project-link" data-saved-id={item.id}>
                    <Card className={`project-card${highlightedProjectId === item.id ? ' highlight-new' : ''}`}>
                        <CardHeader>
                            <div className="project-header">
                                <CardTitle>{item.name}</CardTitle>
                                {/* The type chip is the only difference that survives.
                                    Everything structural — meta row, budget block, menu —
                                    matches a full build, because a quick estimate is a
                                    real project and a card that looks like a lesser
                                    object teaches the wrong thing. */}
                                <CardBadge variant="info">{item.typeLabel}</CardBadge>
                                {item.status === 'archived' && <CardBadge variant="default">Archived</CardBadge>}
                            </div>
                            <DropdownMenu open={!isMobile && openMenuId === item.id} onOpenChange={open => { if (!isMobile) setOpenMenuId(open ? item.id : null); }}><div className="menu-container">
                                <DropdownMenuTrigger asChild><button className="menu-btn" aria-label={`Actions for ${item.name}`} aria-haspopup="menu" aria-expanded={openMenuId === item.id} onClick={(e) => { if (isMobile) handleMenuToggle(e, item.id); else { e.preventDefault(); e.stopPropagation(); } }}>
                                    <DotsThreeVertical size={20} weight="bold" />
                                </button></DropdownMenuTrigger>
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
                                {new Date(item.updatedAt).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="project-budget">
                            <span className="budget-label">Estimate</span>
                            <span className="budget-value">
                                <PriceDisplay unwrapped priceUsd={item.totalUsd} priceZwg={item.totalUsd * 30} />
                            </span>
                        </div>
                    </Card>
                </Link>
            ))}
            {visibleProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="project-link" data-saved-id={project.id}>
                    <Card className={`project-card${highlightedProjectId === project.id ? ' highlight-new' : ''}`}>
                        <CardHeader>
                            <div className="project-header">
                                <CardTitle>{project.name}</CardTitle>
                                {/* Someone else's project, shared with this person. */}
                                {profile?.id && project.owner_id !== profile.id && (
                                    <CardBadge variant="default">Shared with you</CardBadge>
                                )}
                                <CardBadge variant={statusColors[project.status] || 'default'}>
                                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                </CardBadge>
                            </div>
                            <DropdownMenu open={!isMobile && openMenuId === project.id} onOpenChange={open => { if (!isMobile) setOpenMenuId(open ? project.id : null); }}><div className="menu-container">
                                <DropdownMenuTrigger asChild><button className="menu-btn" aria-label={`Actions for ${project.name}`} aria-haspopup="menu" aria-expanded={openMenuId === project.id} onClick={(e) => { if (isMobile) handleMenuToggle(e, project.id); else { e.preventDefault(); e.stopPropagation(); } }}>
                                    <DotsThreeVertical size={20} weight="bold" />
                                </button></DropdownMenuTrigger>
                                {!isMobile && (
                                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}><DropdownMenuGroup>
                                        <DropdownMenuItem asChild><button onClick={(e) => handleEdit(e, project.id)}>
                                            <PencilSimple size={16} /> Edit
                                        </button></DropdownMenuItem>
                                        <DropdownMenuItem asChild><button onClick={(e) => handleShare(e, project.id)}>
                                            <ShareNetwork size={16} /> Share a copy
                                        </button></DropdownMenuItem>
                                        {/* Inviting, archiving and deleting stay with the owner. */}
                                        {project.owner_id === profile?.id && (
                                            <DropdownMenuItem asChild><button onClick={(e) => handleInvite(e, project.id)}>
                                                <UserPlus size={16} /> Invite people
                                            </button></DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem asChild><button onClick={(e) => { void handleDownloadPdf(e, project.id); }}>
                                            <FileArrowDown size={16} /> Download BOQ PDF
                                        </button></DropdownMenuItem>
                                        {project.owner_id === profile?.id && (
                                            <>
                                                <DropdownMenuItem asChild><button onClick={(e) => handleArchive(e, project.id)}>
                                                    <Archive size={16} /> {project.status === 'archived' ? 'Restore' : 'Archive'}
                                                </button></DropdownMenuItem>
                                                <DropdownMenuItem variant="destructive" asChild><button className="danger" onClick={(e) => handleDelete(e, project.id)}>
                                                    <Trash size={16} /> Delete
                                                </button></DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuGroup></DropdownMenuContent>
                                )}
                            </div></DropdownMenu>
                        </CardHeader>

                        <div className="project-meta">
                            {project.location && (
                                <span className="meta-item">
                                    <MapPin size={14} weight="light" />
                                    {project.location}
                                </span>
                            )}
                            <span className="meta-item">
                                <Calendar size={14} weight="light" />
                                {new Date(project.updated_at).toLocaleDateString()}
                            </span>
                        </div>

                        <div className="project-budget">
                            <span className="budget-label">Estimate</span>
                            <span className="budget-value">
                                <PriceDisplay
                                    unwrapped
                                    priceUsd={Number(project.total_usd)}
                                    priceZwg={Number(project.total_zwg)}
                                />
                            </span>
                        </div>

                        <div className="project-details">
                            <span className="detail-item">
                                {formatScopeLabel(project)}
                            </span>
                            <span className="detail-item">
                                {project.labor_preference === 'with_labor' ? 'With labour' : 'Materials only'}
                            </span>
                        </div>
                        <div className="compliance-chips">
                            {getComplianceChips(project).map((chip) => (
                                <span key={`${project.id}-${chip.label}`} className={`compliance-chip ${chip.tone}`}>
                                    {chip.label}
                                </span>
                            ))}
                        </div>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
