// ─── The projects list ───────────────────────────────────────────────────────
// Searching, filtering, sorting and summing the projects list (/projects),
// moved out of the page unchanged so it can be tested on its own.

import type { Project, ProjectScope, ProjectStatus } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import { slopeLabel, soilLabel } from '@/lib/projects/siteLabels';

export type SortOption = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'budget_desc' | 'budget_asc';

export interface ListFilters {
    searchQuery: string;
    statusFilter: ProjectStatus | 'all';
    scopeFilter: ProjectScope | 'all';
    sortBy: SortOption;
}

/** Full builds matching the search (name or location), status and scope, sorted. */
export function filterProjects(projects: Project[], { searchQuery, statusFilter, scopeFilter, sortBy }: ListFilters): Project[] {
    let result = [...projects];

    // Apply search filter
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.location && p.location.toLowerCase().includes(query))
        );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
        result = result.filter(p => p.status === statusFilter);
    }

    // Apply scope filter
    if (scopeFilter !== 'all') {
        result = result.filter(p =>
            p.scope === scopeFilter ||
            (p.selected_stages && p.selected_stages.includes(scopeFilter))
        );
    }

    // Apply sorting
    result.sort((a, b) => {
        switch (sortBy) {
            case 'updated_desc':
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            case 'updated_asc':
                return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            case 'budget_desc':
                return Number(b.total_usd) - Number(a.total_usd);
            case 'budget_asc':
                return Number(a.total_usd) - Number(b.total_usd);
            default:
                return 0;
        }
    });

    return result;
}

/**
 * Quick estimates answer to the search box (name or type) and the type pills.
 * Scope is a project idea and does not apply. "Archived" shows the archived
 * ones; any other status shows the ones still in use.
 */
export function filterQuickItems(
    quickItems: SavedWorkItem[],
    { searchQuery, statusFilter, sortBy }: Omit<ListFilters, 'scopeFilter'>,
    typeFilter: string,
): SavedWorkItem[] {
    let result = quickItems;
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter((i) => i.name.toLowerCase().includes(q) || i.typeLabel.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') result = result.filter((i) => i.filterKey === typeFilter);
    if (statusFilter === 'archived') result = result.filter((i) => i.status === 'archived');
    else if (statusFilter !== 'all') result = result.filter((i) => i.status !== 'archived');
    // The same sort as full builds.
    return [...result].sort((a, b) => {
        switch (sortBy) {
            case 'updated_asc':
                return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'name_desc':
                return b.name.localeCompare(a.name);
            case 'budget_desc':
                return b.totalUsd - a.totalUsd;
            case 'budget_asc':
                return a.totalUsd - b.totalUsd;
            default:
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
    });
}

/** Choosing a quick-estimate type hides full builds. */
export const visibleProjectsFor = (typeFilter: string, filteredProjects: Project[]): Project[] =>
    (typeFilter === 'all' || typeFilter === 'project' ? filteredProjects : []);

/** The type pills: All, then each kind the person has, most first. */
export function buildTypeFilters(projectCount: number, quickItems: SavedWorkItem[]): Array<{ key: string; label: string; count: number }> {
    const counts = new Map<string, { label: string; count: number }>();
    if (projectCount) counts.set('project', { label: 'Full build', count: projectCount });
    quickItems.forEach((i) => {
        const prev = counts.get(i.filterKey);
        counts.set(i.filterKey, { label: i.typeLabel, count: (prev?.count ?? 0) + 1 });
    });
    return [
        { key: 'all', label: 'All', count: projectCount + quickItems.length },
        ...[...counts.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count),
    ];
}

/** Counts by status and the sum of full-build totals. */
export function portfolioStats(projects: Project[]) {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const draft = projects.filter(p => p.status === 'draft').length;
    const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_usd || 0), 0);
    return { total, active, completed, draft, totalBudget };
}

/** How many of status and scope are narrowed (search and sort do not count). */
export const activeFilterCount = (statusFilter: string, scopeFilter: string): number =>
    [statusFilter !== 'all', scopeFilter !== 'all'].filter(Boolean).length;

const STAGE_LABELS: Record<string, string> = {
    substructure: 'Site Preparation & Foundation',
    superstructure: 'Structural Walls & Frame',
    roofing: 'Roofing',
    finishing: 'Interior & Finishing',
    services: 'Plumbing & Electrical',
    exterior: 'External Work',
    entire_house: 'Full House',
    full_house: 'Full House'
};

/** A stage's name; unknown ones lose their first underscore only. */
export const formatStageLabel = (stage: string) => STAGE_LABELS[stage] || stage.replace('_', ' ');

/** The chosen stages, or the project scope when none are chosen. */
export const formatScopeLabel = (project: Project) => {
    if (project.selected_stages && project.selected_stages.length > 0) {
        return project.selected_stages.map(formatStageLabel).join(', ');
    }
    return formatStageLabel(project.scope);
};

/** Soil, slope and geotech report status for a project card. */
export const getComplianceChips = (project: Project): Array<{ label: string; tone: 'ok' | 'info' | 'warn' }> => {
    const chips: Array<{ label: string; tone: 'ok' | 'info' | 'warn' }> = [];

    if (project.soil_type) {
        chips.push({ label: soilLabel(project.soil_type)!, tone: 'info' });
    }
    if (project.site_slope) {
        chips.push({ label: slopeLabel(project.site_slope)!, tone: 'info' });
    }

    chips.push({
        label: project.geotech_report_uploaded ? 'Geotech Uploaded' : 'Geotech Pending',
        tone: project.geotech_report_uploaded ? 'ok' : 'warn',
    });

    return chips;
};

/** Same meaning, same colour everywhere: blue = in progress, neutral = draft or put away, green = done. */
export const STATUS_COLORS: Record<string, 'success' | 'accent' | 'default'> = {
    active: 'accent',
    draft: 'default',
    completed: 'success',
    archived: 'default',
};
