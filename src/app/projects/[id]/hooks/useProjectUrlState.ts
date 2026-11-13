'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PROJECT_NAV_ITEMS, type ProjectView } from '@/components/projects/SidebarSpine';
import type { BOQCategory } from '@/lib/database.types';
import { STAGE_CATEGORIES } from '@/lib/projects/workspaceStages';

/**
 * The workspace view and BOQ stage, kept in the URL (?view=budget&stage=roofing)
 * so refresh, Back and a shared link land on the same section. Next keeps
 * useSearchParams in step with history.pushState, so switching needs no
 * server round trip.
 */
export function useProjectUrlState() {
    const searchParams = useSearchParams();
    const viewParam = searchParams.get('view');
    const activeView: ProjectView = PROJECT_NAV_ITEMS.some((item) => item.id === viewParam) ? (viewParam as ProjectView) : 'overview';
    const stageParam = searchParams.get('stage');
    const activeTab: BOQCategory = STAGE_CATEGORIES.includes(stageParam as BOQCategory) ? (stageParam as BOQCategory) : 'substructure';

    const writeUrl = useCallback((patch: Record<string, string | null>, mode: 'push' | 'replace') => {
        const params = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(patch)) {
            if (value === null) params.delete(key); else params.set(key, value);
        }
        const query = params.toString();
        const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
        if (next === `${window.location.pathname}${window.location.search}`) return;
        if (mode === 'push') window.history.pushState(null, '', next);
        else window.history.replaceState(null, '', next);
    }, []);

    const setActiveView = useCallback((view: ProjectView) => {
        writeUrl({ view: view === 'overview' ? null : view }, 'push');
        // A new section starts at its top, not wherever the last one was scrolled.
        window.scrollTo({ top: 0 });
    }, [writeUrl]);

    /** A person picking a stage adds a history entry; a correction does not. */
    const setActiveTab = useCallback((
        next: BOQCategory | ((current: BOQCategory) => BOQCategory),
        mode: 'push' | 'replace' = 'push',
    ) => {
        const fromUrl = new URLSearchParams(window.location.search).get('stage');
        const current: BOQCategory = STAGE_CATEGORIES.includes(fromUrl as BOQCategory) ? (fromUrl as BOQCategory) : 'substructure';
        const value = typeof next === 'function' ? next(current) : next;
        writeUrl({ stage: value === 'substructure' ? null : value }, mode);
    }, [writeUrl]);

    return { activeView, activeTab, writeUrl, setActiveView, setActiveTab };
}

export type SetActiveTab = ReturnType<typeof useProjectUrlState>['setActiveTab'];
