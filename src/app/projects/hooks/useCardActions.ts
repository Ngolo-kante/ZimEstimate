'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@/components/ui/Toast';
import { deleteProject, archiveProject, unarchiveProject, getBOQItems } from '@/lib/services/projects';
import { QUICK_TYPE_LABELS, type SavedWorkItem, type SavedWorkKind } from '@/lib/services/savedWork';
import { deleteQuickBOQ, getQuickBOQ, setQuickBOQArchived } from '@/lib/services/quickBoq';
import { loadPdfExport, PDF_LOAD_ERROR } from '@/lib/loadPdfExport';
import type { Project } from '@/lib/database.types';

type Router = { push: (href: string) => void };

/**
 * The menu on each card (a dropdown, or a bottom sheet on phones) and what
 * its items do: open, share, invite, download the PDF, archive or restore,
 * and delete after a confirmation.
 */
export function useCardActions({
    router,
    projects,
    setProjects,
    quickItems,
    setQuickItems,
}: {
    router: Router;
    projects: Project[];
    setProjects: Dispatch<SetStateAction<Project[]>>;
    quickItems: SavedWorkItem[];
    setQuickItems: Dispatch<SetStateAction<SavedWorkItem[]>>;
}) {
    const { success, error: showError } = useToast();
    const [menuKeyboard, setMenuKeyboard] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    // Carries the kind because the two live in different tables and delete
    // through different services, while sharing one confirmation dialog.
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; kind: SavedWorkKind } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuProjectId, setMobileMenuProjectId] = useState<string | null>(null);

    const [mobileMenuTargetId, setMobileMenuTargetId] = useState<string | null>(null);

    // Mobile detection
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleMenuToggle = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuKeyboard(e.detail === 0);
        if (isMobile) {
            setMobileMenuTargetId(projectId);
            setMobileMenuProjectId(projectId);
        } else {
            setOpenMenuId(openMenuId === projectId ? null : projectId);
        }
    };

    const handleEdit = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        router.push(`/projects/${projectId}`);
    };

    // Share sends a copy; Invite gives access. "Share" used to open the
    // project with ?share=true, which nothing read, so it did nothing.
    const [shareProjectId, setShareProjectId] = useState<string | null>(null);
    const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
    const handleShare = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        setShareProjectId(projectId);
    };
    const handleInvite = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        setInviteProjectId(projectId);
    };

    const handleArchive = async (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);

        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        // Archive, or Restore when it is already archived — the same for
        // full builds and quick estimates.
        const restoring = project.status === 'archived';
        const { project: updated, error } = restoring ? await unarchiveProject(projectId) : await archiveProject(projectId);

        if (error) {
            showError(restoring ? 'Could not restore the project. Please try again.' : 'Failed to archive project. Please try again.');
        } else {
            // Update local state to reflect the change
            setProjects(projects.map(p =>
                p.id === projectId ? { ...p, status: updated?.status ?? (restoring ? 'draft' : 'archived') } : p
            ));
            success(restoring ? `"${project.name}" is back in your projects` : `"${project.name}" has been archived`);
        }
    };

    const handleQuickArchive = async (e: React.MouseEvent, item: SavedWorkItem) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        const restoring = item.status === 'archived';
        const { error } = await setQuickBOQArchived(item.id, !restoring);
        if (error) {
            showError(restoring ? 'Could not restore the estimate. Please try again.' : 'Could not archive the estimate. Please try again.');
            return;
        }
        setQuickItems((current) => current.map((i) => (i.id === item.id ? { ...i, status: restoring ? null : 'archived' } : i)));
        success(restoring ? `"${item.name}" is back in your projects` : `"${item.name}" has been archived`);
    };

    const handleQuickEdit = (e: React.MouseEvent, item: SavedWorkItem) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        router.push(item.href);
    };

    const handleDelete = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setDeleteTarget({ id: projectId, name: project.name, kind: 'project' });
        }
    };

    // The BOQ is the thing that gets forwarded to a builder or a lender, so it
    // should be reachable from the card rather than only from inside the
    // project. Items are fetched on demand — the list query deliberately does
    // not carry every line item for every project.
    const handleDownloadPdf = async (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);

        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const { items, error } = await getBOQItems(projectId);
        if (error) {
            showError('Could not load the BOQ for this project.');
            return;
        }
        if (items.length === 0) {
            showError(`"${project.name}" has no BOQ items to download yet.`);
            return;
        }
        const pdf = await loadPdfExport('projects_list');
        if (!pdf) {
            showError(PDF_LOAD_ERROR);
            return;
        }
        pdf.downloadBOQPDF(project, items);
    };

    // ── Quick estimate card actions ──────────────────────────────────────────
    // Same menu affordance as a full build, including archive and restore;
    // quick estimates use a different table underneath.
    // Opens the same share sheet as a full build. "Copy link" used to copy
    // the owner's own page address, which showed "not found" to anyone else;
    // the sheet's view-only link is the one that opens for them.
    const [quickShareTarget, setQuickShareTarget] = useState<SavedWorkItem | null>(null);
    const handleQuickShare = (e: React.MouseEvent, item: SavedWorkItem) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        setQuickShareTarget(item);
    };
    // Invite gives an installer access to report progress on the job.
    const [quickInviteTarget, setQuickInviteTarget] = useState<SavedWorkItem | null>(null);
    const handleQuickInvite = (e: React.MouseEvent, item: SavedWorkItem) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        setQuickInviteTarget(item);
    };

    // The list view only carries totals, not line items — fetched on demand,
    // same reasoning as the full-project version above. Shares the actual PDF
    // generation with the estimate's own page via downloadQuickEstimatePDF, so
    // the file this produces is identical to the one "Download BOQ PDF" on the
    // estimate itself produces, not a second implementation that can drift.
    const handleQuickDownloadPdf = async (e: React.MouseEvent, item: SavedWorkItem) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);

        const { boq, error } = await getQuickBOQ(item.id);
        if (error || !boq) {
            showError('Could not load this estimate.');
            return;
        }

        const pdf = await loadPdfExport('projects_list');
        if (!pdf) {
            showError(PDF_LOAD_ERROR);
            return;
        }
        const { error: pdfError } = pdf.downloadQuickEstimatePDF({
            name: item.name,
            typeLabel: QUICK_TYPE_LABELS[boq.projectType] ?? item.typeLabel,
            location: (boq.answers?.project_location as string) || null,
            boqItems: boq.boqItems,
            labor: boq.labor,
        });
        if (pdfError) showError(pdfError);
    };

    const handleQuickDelete = (e: React.MouseEvent, item: SavedWorkItem) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        setDeleteTarget({ id: item.id, name: item.name, kind: 'quick' });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        const isQuick = deleteTarget.kind === 'quick';
        const { error } = isQuick
            ? await deleteQuickBOQ(deleteTarget.id)
            : await deleteProject(deleteTarget.id);

        if (error) {
            showError(`Failed to delete ${isQuick ? 'estimate' : 'project'}. Please try again.`);
        } else {
            if (isQuick) {
                setQuickItems(quickItems.filter(i => i.id !== deleteTarget.id));
            } else {
                setProjects(projects.filter(p => p.id !== deleteTarget.id));
            }
            success(`"${deleteTarget.name}" has been deleted`);
        }

        setIsDeleting(false);
        setDeleteTarget(null);
    };

    return {
        mobileMenuTargetId,
        menuKeyboard,
        openMenuId, setOpenMenuId, isMobile,
        mobileMenuProjectId, setMobileMenuProjectId,
        deleteTarget, setDeleteTarget, isDeleting, confirmDelete,
        shareProjectId, setShareProjectId,
        inviteProjectId, setInviteProjectId,
        quickShareTarget, setQuickShareTarget,
        quickInviteTarget, setQuickInviteTarget,
        handleMenuToggle, handleEdit, handleShare, handleInvite, handleArchive, handleDelete, handleDownloadPdf,
        handleQuickEdit, handleQuickShare, handleQuickInvite, handleQuickArchive, handleQuickDelete, handleQuickDownloadPdf,
    };
}
