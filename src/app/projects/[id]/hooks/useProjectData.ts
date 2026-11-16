'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createPendingDelete, restoreDeletedItem } from '@/lib/projects/pendingDelete';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
    getProjectWithItems,
    getBOQItems,
    getPurchaseRecords,
    getProjectDocuments,
    updateProject,
    updateBOQItem,
    deleteBOQItem,
} from '@/lib/services/projects';
import { getProjectStages } from '@/lib/services/stages';
import { clearCreatedProjectSnapshot, getCreatedProjectSnapshot } from '@/lib/projectCreationCache';
import type { Project, BOQItem, PurchaseRecord, ProjectStageWithTasks } from '@/lib/database.types';
import {
    applyItemUpdate,
    changesItemTotal,
    computePurchaseStats,
    feeItemsOf,
    materialItemsOf,
    sumItemTotals,
} from '@/lib/projects/workspaceStats';
import type { SetActiveTab } from './useProjectUrlState';

const GEOTECH_DOC_TAG = 'geotech_report';

export type GeotechDocumentSummary = { id: string; fileName: string; createdAt: string };

/**
 * The project, its BOQ lines, stages and purchases: loading them (or showing
 * the snapshot saved when the project was just created), refreshing them, and
 * saving edits to them.
 */
export function useProjectData(projectId: string, setActiveTab: SetActiveTab) {
    const { success, error: showError } = useToast();
    const { exchangeRate } = useCurrency();

    const [project, setProject] = useState<Project | null>(null);
    const [items, setItems] = useState<BOQItem[]>([]);
    const [stages, setStages] = useState<ProjectStageWithTasks[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
    const [geotechDocumentSummary, setGeotechDocumentSummary] = useState<GeotechDocumentSummary | null>(null);

    const feeItems = useMemo(() => feeItemsOf(items), [items]);
    const materialItems = useMemo(() => materialItemsOf(items), [items]);
    const purchaseStats = useMemo(() => computePurchaseStats(items, materialItems, purchases), [items, materialItems, purchases]);

    const applyStages = useCallback((nextStages: ProjectStageWithTasks[], forcePrimaryStage = false) => {
        setStages(nextStages);
        const firstApplicable = nextStages.find((stage) => stage.is_applicable);
        if (!firstApplicable) return;

        // A stage named in the link (a refresh, Back, a shared URL) wins over
        // the first stage, as long as that stage is still in the project.
        const stageInUrl = new URLSearchParams(window.location.search).has('stage');
        setActiveTab((currentTab) => {
            if (forcePrimaryStage && !stageInUrl) return firstApplicable.boq_category;
            const stillApplicable = nextStages.some(
                (stage) => stage.is_applicable && stage.boq_category === currentTab
            );
            return stillApplicable ? currentTab : firstApplicable.boq_category;
        }, 'replace');
    }, [setActiveTab]);

    const refreshStages = useCallback(async (forcePrimaryStage = false) => {
        const stagesResult = await getProjectStages(projectId);
        if (!stagesResult.error) {
            applyStages(stagesResult.stages, forcePrimaryStage);
        }
    }, [applyStages, projectId]);

    const loadProjectData = useCallback(async (showLoading = true, forcePrimaryStage = false) => {
        if (showLoading) {
            setIsLoading(true);
            setError(null);
        }

        const [projectResult, stagesResult, purchasesResult, docsResult] = await Promise.all([
            getProjectWithItems(projectId),
            getProjectStages(projectId),
            getPurchaseRecords(projectId),
            getProjectDocuments(projectId, 'permit'),
        ]);

        if (projectResult.error) {
            if (showLoading) setError(projectResult.error.message);
        } else if (projectResult.project) {
            setProject(projectResult.project);
            setItems(projectResult.items);
            clearCreatedProjectSnapshot(projectResult.project.id);
        } else if (showLoading) {
            setError('Project not found');
        }

        if (!stagesResult.error) {
            applyStages(stagesResult.stages, forcePrimaryStage);
        }

        if (purchasesResult.records) {
            setPurchases(purchasesResult.records);
        }

        if (!docsResult.error) {
            const geotechDoc = docsResult.documents.find((document) =>
                (document.description || '').includes(GEOTECH_DOC_TAG)
            );
            if (geotechDoc) {
                setGeotechDocumentSummary({
                    id: geotechDoc.id,
                    fileName: geotechDoc.file_name,
                    createdAt: geotechDoc.created_at,
                });
            } else {
                setGeotechDocumentSummary(null);
            }
        }

        if (showLoading) {
            setIsLoading(false);
        }
    }, [applyStages, projectId]);

    const hydrateFromCreatedSnapshot = useCallback(() => {
        const snapshot = getCreatedProjectSnapshot(projectId);
        if (!snapshot) return false;

        setProject(snapshot.project);
        setItems(snapshot.items);
        setError(null);
        setIsLoading(false);
        return true;
    }, [projectId]);

    // Load project data
    useEffect(() => {
        const hydrated = hydrateFromCreatedSnapshot();
        loadProjectData(!hydrated, true);
    }, [hydrateFromCreatedSnapshot, loadProjectData]);

    const refreshItems = useCallback(async () => {
        // Refresh both items and purchases for instant updates across all views
        const [itemsResult, purchasesResult] = await Promise.all([
            getBOQItems(projectId),
            getPurchaseRecords(projectId),
        ]);
        if (!itemsResult.error) {
            setItems(itemsResult.items);
        }
        if (purchasesResult.records) {
            setPurchases(purchasesResult.records);
        }
    }, [projectId]);

    /** Resolves false when nothing was saved, so callers can roll back. */
    const handleProjectUpdate = async (updates: Partial<Project>, options: { quiet?: boolean } = {}): Promise<boolean> => {
        if (!project) return false;

        const { project: updated, error } = await updateProject(projectId, updates);
        if (error || !updated) {
            showError('Failed to update project');
            return false;
        }
        setProject(updated);
        // The Budget Planner shows its own Saving / Saved next to the field.
        if (!options.quiet) success('Project updated');
        return true;
    };

    const handleItemUpdate = async (itemId: string, updates: Partial<BOQItem>): Promise<void> => {
        const { item, error } = await updateBOQItem(itemId, updates);
        if (error) {
            showError('Failed to update item');
        } else if (item) {
            const updatedItems = applyItemUpdate(items, itemId, updates);

            setItems(updatedItems);

            if (changesItemTotal(updates)) {
                const newTotal = sumItemTotals(updatedItems);
                await updateProject(projectId, {
                    total_usd: newTotal,
                    total_zwg: newTotal * exchangeRate,
                });
                setProject(prev => prev ? { ...prev, total_usd: newTotal, total_zwg: newTotal * exchangeRate } : prev);
            }
        }
    };

    const handleStageUpdate = (updatedStage: ProjectStageWithTasks) => {
        setStages(prev => prev.map(s => s.id === updatedStage.id ? updatedStage : s));
    };

    const pendingDeletes = useRef(new Map<string, { commit: () => Promise<void>; toastId: string | number }>());
    const deletionOrder = useRef<string[]>([]);

    useEffect(() => {
        const pending = pendingDeletes.current;
        const flush = () => {
            for (const entry of [...pending.values()]) {
                void entry.commit();
                toast.dismiss(entry.toastId);
            }
        };
        window.addEventListener('pagehide', flush);
        return () => {
            window.removeEventListener('pagehide', flush);
            flush();
        };
    }, [projectId]);

    const handleDeleteItem = async (itemId: string) => {
        const item = items.find(line => line.id === itemId);
        if (!item || pendingDeletes.current.has(itemId)) return;
        if (pendingDeletes.current.size === 0) deletionOrder.current = items.map(line => line.id);
        const order = [...deletionOrder.current];
        const restore = () => setItems(current => restoreDeletedItem(current, item, order));
        const pending = createPendingDelete(async () => {
            pendingDeletes.current.delete(itemId);
            try {
                const { error } = await deleteBOQItem(itemId);
                if (error) throw error;
            } catch {
                restore();
                showError('Failed to delete item');
            }
        }, () => {
            pendingDeletes.current.delete(itemId);
            restore();
        });
        setItems(current => current.filter(line => line.id !== itemId));
        const toastId = toast('Line removed', {
            duration: 6000,
            action: { label: 'Undo', onClick: () => pending.undo() },
            onAutoClose: () => { void pending.commit(); },
            onDismiss: () => { void pending.commit(); },
        });
        pendingDeletes.current.set(itemId, { commit: pending.commit, toastId });
    };

    const handleAddItem = (item: BOQItem) => {
        setItems([...items, item]);
    };

    return {
        project, setProject,
        items, setItems,
        stages,
        purchases, setPurchases,
        isLoading,
        error,
        geotechDocumentSummary,
        feeItems,
        materialItems,
        purchaseStats,
        loadProjectData,
        refreshStages,
        refreshItems,
        handleProjectUpdate,
        handleItemUpdate,
        handleStageUpdate,
        handleDeleteItem,
        handleAddItem,
    };
}
