'use client';

import type { ProjectScope, ProjectStatus } from '@/lib/database.types';
import type { SortOption } from '@/lib/projects/projectList';
import type { useListFilters } from '@/app/projects/hooks/useListFilters';
import { CaretDown, Funnel, MagnifyingGlass, SortAscending, X } from '@phosphor-icons/react';

/** Search, type pills, and the status, scope and sort controls. */
export default function ProjectsFilters({
    filters,
    isMobile,
}: {
    filters: ReturnType<typeof useListFilters>;
    isMobile: boolean;
}) {
    const {
        searchQuery, setSearchQuery,
        typeFilter, setTypeFilter, typeFilters,
        showFilters, setShowFilters,
        statusFilter, setStatusFilter,
        scopeFilter, setScopeFilter,
        sortBy, setSortBy,
        activeFilterCount, clearFilters,
    } = filters;
    return (
        <div className="filters-bar">
            <div className="filters-top-row">
                <div className="search-box">
                    <MagnifyingGlass size={18} weight="light" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                {isMobile && (
                    <button className="filter-toggle-btn" onClick={() => setShowFilters(prev => !prev)}>
                        <Funnel size={18} weight="light" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="filter-badge">{activeFilterCount}</span>
                        )}
                    </button>
                )}
            </div>

            {/* Built from what the user actually has, so someone with no
                solar estimate is never offered a Solar filter. */}
            {typeFilters.length > 2 && (!isMobile || showFilters) && (
                <div className="type-pills">
                    {typeFilters.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={`type-pill${typeFilter === f.key ? ' active' : ''}`}
                            onClick={() => setTypeFilter(f.key)}
                            aria-pressed={typeFilter === f.key}
                        >
                            {f.label}
                            <span className="type-pill-count">{f.count}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className={`filter-group${isMobile ? ' mobile-filters' : ''}${isMobile && !showFilters ? ' hidden' : ''}`}>
                <div className="filter-select">
                    <Funnel size={16} weight="light" />
                    <select
                        aria-label="Filter by status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                    >
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                    </select>
                    <CaretDown size={14} />
                </div>

                <div className="filter-select">
                    <select
                        aria-label="Filter by scope"
                        value={scopeFilter}
                        onChange={(e) => setScopeFilter(e.target.value as ProjectScope | 'all')}
                    >
                        <option value="all">All Scopes</option>
                        <option value="entire_house">Full House</option>
                        <option value="substructure">Site Preparation & Foundation</option>
                        <option value="superstructure">Structural Walls & Frame</option>
                        <option value="roofing">Roofing</option>
                        <option value="finishing">Interior & Finishing</option>
                        <option value="exterior">External Work</option>
                    </select>
                    <CaretDown size={14} />
                </div>

                <div className="filter-select">
                    <SortAscending size={16} weight="light" />
                    <select
                        aria-label="Sort by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                    >
                        <option value="updated_desc">Recently Updated</option>
                        <option value="updated_asc">Oldest First</option>
                        <option value="name_asc">Name A-Z</option>
                        <option value="name_desc">Name Z-A</option>
                        <option value="budget_desc">Estimate High-Low</option>
                        <option value="budget_asc">Estimate Low-High</option>
                    </select>
                    <CaretDown size={14} />
                </div>

                {activeFilterCount > 0 && (
                    <button className="clear-filters" onClick={clearFilters}>
                        Clear filters ({activeFilterCount})
                    </button>
                )}
            </div>
        </div>
    );
}
