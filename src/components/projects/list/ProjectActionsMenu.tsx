'use client';

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/shadcn/dropdown-menu';
import Button from '@/components/ui/Button';
import type { Profile, Project } from '@/lib/database.types';
import type { useCardActions } from '@/app/projects/hooks/useCardActions';
import { Archive, DotsThreeVertical, FileArrowDown, PencilSimple, ShareNetwork, Trash, UserPlus } from '@phosphor-icons/react';

/** Shared by Builds and Continue; phones open the page's MobileCardSheet. */
export default function ProjectActionsMenu({ project, profile, actions, menuId = project.id }: {
    project: Project; profile: Profile | null; actions: ReturnType<typeof useCardActions>; menuId?: string;
}) {
    const { openMenuId, setOpenMenuId, isMobile, handleMenuToggle, handleEdit, handleShare, handleInvite, handleArchive, handleDelete, handleDownloadPdf } = actions;
    return (
        <DropdownMenu open={!isMobile && openMenuId === menuId} onOpenChange={open => { if (!isMobile) setOpenMenuId(open ? menuId : null); }}><div className="menu-container">
        <DropdownMenuTrigger asChild><Button variant="ghost" className="menu-btn" aria-label={`Actions for ${project.name}`} aria-haspopup="menu" aria-expanded={isMobile ? actions.mobileMenuProjectId === project.id : openMenuId === menuId} onClick={(e) => { if (isMobile) handleMenuToggle(e, project.id); else { e.preventDefault(); e.stopPropagation(); } }}>
            <DotsThreeVertical size={20} weight="bold" />
        </Button></DropdownMenuTrigger>
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
    );
}
