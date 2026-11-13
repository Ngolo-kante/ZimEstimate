'use client';

import { useMemo, useState } from 'react';
import type { Project, ProjectScope, ProjectStatus } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import {
    activeFilterCount as countActiveFilters,
    buildTypeFilters,
    filterProjects,
    filterQuickItems,
    portfolioStats,
    visibleProjectsFor,
    type SortOption,
} from '@/lib/projects/projectList';

/** Search, status, scope, sort and type for the projects list, and what they leave showing. */
export function useListFilters(projects: Project[], quickItems: SavedWorkItem[]) {
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
    const [scopeFilter, setScopeFilter] = useState<ProjectScope | 'all'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('updated_desc');

    const filteredProjects = useMemo(
        () => filterProjects(projects, { searchQuery, statusFilter, scopeFilter, sortBy }),
        [projects, searchQuery, statusFilter, scopeFilter, sortBy]
    );

    const filteredQuick = useMemo(
        () => filterQuickItems(quickItems, { searchQuery, statusFilter, sortBy }, typeFilter),
        [quickItems, searchQuery, typeFilter, statusFilter, sortBy]
    );

    // Selecting a quick type hides full builds, and vice versa.
    const visibleProjects = useMemo(
        () => visibleProjectsFor(typeFilter, filteredProjects),
        [filteredProjects, typeFilter]
    );

    const typeFilters = useMemo(() => buildTypeFilters(projects.length, quickItems), [projects.length, quickItems]);

    const projectStats = useMemo(() => portfolioStats(projects), [projects]);

    const activeFilterCount = countActiveFilters(statusFilter, scopeFilter);

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setScopeFilter('all');
        setSortBy('updated_desc');
    };

    return {
        typeFilter, setTypeFilter,
        showFilters, setShowFilters,
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        scopeFilter, setScopeFilter,
        sortBy, setSortBy,
        filteredProjects,
        filteredQuick,
        visibleProjects,
        typeFilters,
        projectStats,
        activeFilterCount,
        clearFilters,
    };
}
