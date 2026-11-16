'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { getProjects } from '@/lib/services/projects';
import { listSavedWork, type SavedWorkItem } from '@/lib/services/savedWork';
import { clearOptimisticProjectCard, getOptimisticProjectCard } from '@/lib/projectCreationCache';
import { projectListDb } from '@/lib/projects/listData';
import { supabase } from '@/lib/supabase';
import { pickContinueProject, type ProjectOpen } from '@/lib/projects/listPresentation';
import type { BOQItem, ProjectStage, PurchaseRecord, Project } from '@/lib/database.types';

type Router = { replace: (href: string) => void };

/**
 * Everything the person has saved: full builds and quick estimates, kept
 * fresh on focus, realtime changes and visible-page polling. A pending creation
 * keeps the page skeleton visible until the real project can be placed in its list.
 */
export function useProjectList({
    searchParams,
    router,
    profileId,
}: {
    searchParams: ReadonlyURLSearchParams;
    router: Router;
    profileId: string | undefined;
}) {
    const readOptimisticProject = () => getOptimisticProjectCard();
    const [projects, setProjects] = useState<Project[]>([]);
    // Quick estimates are loaded separately and rendered in their own section.
    const [quickItems, setQuickItems] = useState<SavedWorkItem[]>([]);
    const [optimisticProject, setOptimisticProject] = useState<{ id: string; name: string; location: string } | null>(() => readOptimisticProject());
    const [isLoading, setIsLoading] = useState(true);
    const [opens, setOpens] = useState<ProjectOpen[]>([]);
    const [stages, setStages] = useState<ProjectStage[]>([]);
    const [continueItems, setContinueItems] = useState<BOQItem[]>([]);
    const [continuePurchases, setContinuePurchases] = useState<PurchaseRecord[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
    const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const lastRefreshAt = useRef(0);
    const refreshInFlight = useRef(false);

    // Coalesce overlapping focus, polling and realtime refreshes.
    const loadProjects = useCallback(async (showLoadingState = true) => {
        if (refreshInFlight.current) return;
        refreshInFlight.current = true;
        try {
            if (showLoadingState) {
                setIsLoading(true);
            }
            setError(null);

            const [{ projects: loadedProjects, error: loadError }, saved] = await Promise.all([
                getProjects(),
                listSavedWork(),
            ]);

            if (loadError) {
                setError(loadError.message);
            } else {
                const ownProjects = loadedProjects.filter(p => p.owner_id === profileId);
                const opensResult = profileId ? await projectListDb.from('project_opens').select('project_id, opened_at').eq('user_id', profileId).then(r => r.error ? [] : r.data ?? [], () => []) : [];
                const candidate = pickContinueProject(ownProjects, opensResult, profileId);
                const [stageResult, itemResult, purchaseResult] = await Promise.all([
                    ownProjects.length ? projectListDb.from('project_stages').select('*').in('project_id', ownProjects.map(p => p.id)).order('sort_order').then(r => r.data ?? []) : [],
                    candidate ? projectListDb.from('boq_items').select('*').eq('project_id', candidate.id).order('sort_order').then(r => r.data ?? []) : [],
                    candidate ? projectListDb.from('purchase_records').select('*').eq('project_id', candidate.id).then(r => r.data ?? []) : [],
                ]);
                setOpens(opensResult);
                setStages(stageResult);
                setContinueItems(itemResult);
                setContinuePurchases(purchaseResult);
                setProjects(ownProjects);
            }

            // listSavedWork returns both kinds; the projects half is already loaded
            // above with the fields this page needs, so only the quick estimates are
            // taken from it.
            setQuickItems(saved.items.filter((i) => i.kind === 'quick'));
            if (loadError) setOptimisticProject(null);

        } catch {
            setError('Projects could not be loaded. Please try again.');
        } finally {
            lastRefreshAt.current = Date.now();
            refreshInFlight.current = false;
            if (showLoadingState) setIsLoading(false);
        }
    }, [profileId]);

    // Initial load
    useEffect(() => {
        if (profileId) void loadProjects(true);
    }, [profileId, loadProjects]);

    // Handle optimistic project creation
    useEffect(() => {
        if (searchParams.get('created') === '1') {
            const optimistic = getOptimisticProjectCard();
            if (optimistic) {
                setOptimisticProject({
                    id: optimistic.id,
                    name: optimistic.name,
                    location: optimistic.location || '',
                });
                setIsLoading(true);
            }
            router.replace('/projects');
        }
    }, [searchParams, router]);

    // When real projects load and we have an optimistic card, transition to highlight
    useEffect(() => {
        if (!optimisticProject || isLoading) return;
        const found = projects.find(p => p.id === optimisticProject.id);
        if (found) {
            setOptimisticProject(null);
            setHighlightedProjectId(found.id);
            clearOptimisticProjectCard(found.id);
        }
    }, [projects, optimisticProject, isLoading]);

    // A save may still be in flight when navigation lands here. Keep the
    // skeleton instead of inventing a card outside the real sorted sections.
    useEffect(() => {
        if (!optimisticProject || isLoading || error) return;
        const poll = setInterval(() => { void loadProjects(false); }, 1000);
        const timeout = setTimeout(() => {
            setError('Your new project is still saving. Please retry in a moment.');
        }, 15000);
        return () => { clearInterval(poll); clearTimeout(timeout); };
    }, [optimisticProject, isLoading, error, loadProjects]);

    useEffect(() => {
        if (!highlightedProjectId) return;
        const timeout = setTimeout(() => setHighlightedProjectId(null), 3000);
        return () => clearTimeout(timeout);
    }, [highlightedProjectId]);

    // ── Landing here straight after a save ───────────────────────────────────
    // Every builder used to finish somewhere different: the manual builder sat
    // on the BOQ with only a toast, quick projects went to their estimate page,
    // the budget estimator went to the workspace, and three others came here.
    // They all pass ?saved=<id> now, which works for a project or a quick
    // estimate because the id is all this needs.
    //
    // Separate from ?created=1, which depends on an optimistic card cached
    // before navigation and so could never cover the paths that did not write
    // one.
    const [justSavedId, setJustSavedId] = useState<string | null>(null);
    useEffect(() => {
        const saved = searchParams.get('saved');
        if (!saved) return;
        setJustSavedId(saved);
        setHighlightedProjectId(saved);
        // Cleared from the URL immediately so a refresh, or a back-navigation
        // later, does not re-announce a save that happened ten minutes ago.
        router.replace('/projects');
    }, [searchParams, router]);

    // Resolved against both tables, because ?saved= carries only an id and it
    // may belong to either. A quick estimate opens its estimate page; a project
    // opens its workspace.
    const justSaved = useMemo(() => {
        if (!justSavedId) return null;
        const project = projects.find((p) => p.id === justSavedId);
        if (project) return { name: project.name, href: `/projects/${project.id}` };
        const quick = quickItems.find((q) => q.id === justSavedId);
        if (quick) return { name: quick.name, href: quick.href };
        // Still loading, or saved then deleted elsewhere — say nothing rather
        // than announce a save with no subject.
        return null;
    }, [justSavedId, projects, quickItems]);

    // Scrolled to once the row it refers to actually exists. Doing this on the
    // same tick as the highlight would target a card that has not rendered —
    // the list is still loading when the redirect lands.
    useEffect(() => {
        if (!justSavedId || isLoading || optimisticProject) return;
        const card = document.querySelector(`[data-saved-id="${justSavedId}"]`);
        card?.scrollIntoView({ block: 'center' });
    }, [justSavedId, isLoading, optimisticProject, projects, quickItems]);

    // Refresh when coming from create/delete flows
    useEffect(() => {
        if (searchParams.get('refresh') === '1') {
            loadProjects(false);
            router.replace('/projects');
        }
    }, [searchParams, loadProjects, router]);

    // Auto-refresh when window gains focus (useful after creating a project)
    useEffect(() => {
        const handleFocus = () => {
            if (Date.now() - lastRefreshAt.current >= 5000) void loadProjects(false);
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [loadProjects]);

    // Keep quick estimates current even where realtime is unavailable. A
    // recent focus/realtime refresh replaces this poll; hidden tabs do no work.
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden && Date.now() - lastRefreshAt.current >= 30000) {
                void loadProjects(false);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [loadProjects]);

    // Realtime sync: refresh dashboard when project records change
    useEffect(() => {
        if (!profileId) return;

        const scheduleRefresh = () => {
            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current);
            }
            realtimeRefreshTimeoutRef.current = setTimeout(() => {
                loadProjects(false);
            }, 250);
        };

        const channel = supabase
            .channel(`projects-dashboard-${profileId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'projects',
                    filter: `owner_id=eq.${profileId}`,
                },
                () => {
                    scheduleRefresh();
                }
            )
            .subscribe();

        return () => {
            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current);
                realtimeRefreshTimeoutRef.current = null;
            }
            void supabase.removeChannel(channel);
        };
    }, [profileId, loadProjects]);

    /** The notice's close button. */
    const dismissJustSaved = () => { setJustSavedId(null); setHighlightedProjectId(null); };

    return {
        dismissJustSaved,
        projects, setProjects,
        quickItems, setQuickItems,
        optimisticProject,
        isLoading: isLoading || Boolean(optimisticProject && !error),
        stages, continueItems, continuePurchases,
        continueProject: pickContinueProject(projects, opens, profileId),
        error,
        highlightedProjectId,
        justSaved,
    };
}
