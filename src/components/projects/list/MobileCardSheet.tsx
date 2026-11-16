'use client';

import type { Profile, Project } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import type { useCardActions } from '@/app/projects/hooks/useCardActions';
import { Archive, FileArrowDown, PencilSimple, ShareNetwork, Trash, UserPlus } from '@phosphor-icons/react';

/**
 * The card menu on phones. The same button opens this sheet for both kinds,
 * so it has to know which it is holding — Edit and Archive would otherwise
 * call project services with a quick_boqs id and fail silently.
 */
export default function MobileCardSheet({
    mobileMenuProjectId,
    open,
    projects,
    quickItems,
    profile,
    actions,
}: {
    mobileMenuProjectId: string;
    open: boolean;
    projects: Project[];
    quickItems: SavedWorkItem[];
    profile: Profile | null;
    actions: ReturnType<typeof useCardActions>;
}) {
    const {
        setMobileMenuProjectId,
        handleEdit, handleShare, handleInvite, handleArchive, handleDelete, handleDownloadPdf,
        handleQuickEdit, handleQuickShare, handleQuickInvite, handleQuickArchive, handleQuickDelete, handleQuickDownloadPdf,
    } = actions;
    const quickTarget = quickItems.find(i => i.id === mobileMenuProjectId);
    return (
    <>
        <div className="projects-list mobile-menu-backdrop" data-open={open} data-keyboard={actions.menuKeyboard} aria-hidden="true" onClick={() => setMobileMenuProjectId(null)} />
        <div className="projects-list mobile-bottom-sheet" data-open={open} data-keyboard={actions.menuKeyboard} inert={!open}>
            <div className="bottom-sheet-handle" />
            {quickTarget ? (
                <>
                    <button className="bottom-sheet-item" onClick={(e) => { handleQuickEdit(e, quickTarget); setMobileMenuProjectId(null); }}>
                        <PencilSimple size={20} /> Edit
                    </button>
                    <button className="bottom-sheet-item" onClick={(e) => { handleQuickShare(e, quickTarget); setMobileMenuProjectId(null); }}>
                        <ShareNetwork size={20} /> Share a copy
                    </button>
                    <button className="bottom-sheet-item" onClick={(e) => { handleQuickInvite(e, quickTarget); setMobileMenuProjectId(null); }}>
                        <UserPlus size={20} /> Invite people
                    </button>
                    <button className="bottom-sheet-item" onClick={(e) => { void handleQuickDownloadPdf(e, quickTarget); setMobileMenuProjectId(null); }}>
                        <FileArrowDown size={20} /> Download BOQ PDF
                    </button>
                    <button className="bottom-sheet-item" onClick={(e) => { void handleQuickArchive(e, quickTarget); setMobileMenuProjectId(null); }}>
                        <Archive size={20} /> {quickTarget.status === 'archived' ? 'Restore' : 'Archive'}
                    </button>
                    <button className="bottom-sheet-item danger" onClick={(e) => { handleQuickDelete(e, quickTarget); setMobileMenuProjectId(null); }}>
                        <Trash size={20} /> Delete
                    </button>
                </>
            ) : (
                <>
                    <button className="bottom-sheet-item" onClick={(e) => { handleEdit(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                        <PencilSimple size={20} /> Edit
                    </button>
                    <button className="bottom-sheet-item" onClick={(e) => { handleShare(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                        <ShareNetwork size={20} /> Share a copy
                    </button>
                    {projects.find((p) => p.id === mobileMenuProjectId)?.owner_id === profile?.id && (
                        <button className="bottom-sheet-item" onClick={(e) => { handleInvite(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                            <UserPlus size={20} /> Invite people
                        </button>
                    )}
                    <button className="bottom-sheet-item" onClick={(e) => { void handleDownloadPdf(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                        <FileArrowDown size={20} /> Download BOQ PDF
                    </button>
                    {/* Archiving and deleting stay with the owner. */}
                    {projects.find((p) => p.id === mobileMenuProjectId)?.owner_id === profile?.id && (
                        <>
                            <button className="bottom-sheet-item" onClick={(e) => { handleArchive(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                                <Archive size={20} /> {projects.find((p) => p.id === mobileMenuProjectId)?.status === 'archived' ? 'Restore' : 'Archive'}
                            </button>
                            <button className="bottom-sheet-item danger" onClick={(e) => { handleDelete(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                                <Trash size={20} /> Delete
                            </button>
                        </>
                    )}
                </>
            )}
        </div>
    </>
);
}
