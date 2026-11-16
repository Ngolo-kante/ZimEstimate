'use client';

import type { ProjectScope, ProjectStatus } from '@/lib/database.types';
import type { SortOption } from '@/lib/projects/projectList';
import type { useListFilters } from '@/app/projects/hooks/useListFilters';
import Button from '@/components/ui/Button';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
    DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/shadcn/dropdown-menu';
import { Drawer, DrawerTrigger, DrawerContent, DrawerTitle, DrawerClose } from '@/components/shadcn/drawer';
import { Funnel, MagnifyingGlass, X } from '@phosphor-icons/react';

/** One filter entry point; native controls in the phone drawer, menu radios on desktop. */
export default function ProjectsFilters({ filters, isMobile }: {
    filters: ReturnType<typeof useListFilters>;
    isMobile: boolean;
}) {
    const {
        searchQuery, setSearchQuery, typeFilter, setTypeFilter, typeFilters,
        showFilters, setShowFilters, statusFilter, setStatusFilter,
        scopeFilter, setScopeFilter, sortBy, setSortBy, clearFilters,
    } = filters;
    const activeCount = filters.activeFilterCount + (typeFilter !== 'all' ? 1 : 0) + (sortBy !== 'updated_desc' ? 1 : 0);
    const groups = [
        {
            label: 'Type', aria: 'Filter by type', value: typeFilter, change: setTypeFilter,
            options: typeFilters.map(f => ({ value: f.key, label: `${f.label} (${f.count})` })),
        },
        {
            label: 'Status', aria: 'Filter by status', value: statusFilter,
            change: (value: string) => setStatusFilter(value as ProjectStatus | 'all'),
            options: [
                { value: 'all', label: 'All status' }, { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
            ],
        },
        {
            label: 'Scope', aria: 'Filter by scope', value: scopeFilter,
            change: (value: string) => setScopeFilter(value as ProjectScope | 'all'),
            options: [
                { value: 'all', label: 'All scopes' }, { value: 'entire_house', label: 'Full house' },
                { value: 'substructure', label: 'Site preparation & foundation' },
                { value: 'superstructure', label: 'Structural walls & frame' },
                { value: 'roofing', label: 'Roofing' }, { value: 'finishing', label: 'Interior & finishing' },
                { value: 'exterior', label: 'External work' },
            ],
        },
        {
            label: 'Sort', aria: 'Sort by', value: sortBy,
            change: (value: string) => setSortBy(value as SortOption),
            options: [
                { value: 'updated_desc', label: 'Recently updated' }, { value: 'updated_asc', label: 'Oldest first' },
                { value: 'name_asc', label: 'Name A-Z' }, { value: 'name_desc', label: 'Name Z-A' },
                { value: 'budget_desc', label: 'Estimate high-low' }, { value: 'budget_asc', label: 'Estimate low-high' },
            ],
        },
    ];
    const trigger = <Button variant="secondary" icon={<Funnel size={18} />}>Filter{activeCount ? ` (${activeCount})` : ''}</Button>;
    return <div className="filters-bar">
        <div className="search-box">
            <MagnifyingGlass size={18} />
            <input aria-label="Search projects" placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && <Button variant="secondary" aria-label="Clear search" onClick={() => setSearchQuery('')}><X size={14} /></Button>}
        </div>
        {isMobile ? (
            <Drawer open={showFilters} onOpenChange={setShowFilters}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent aria-describedby={undefined}>
                    <DrawerTitle className="px-5 pt-4">Filter projects</DrawerTitle>
                    <div className="filter-group">
                        {groups.map(group => <label key={group.label} className="filter-select">{group.label}
                            <select aria-label={group.aria} value={group.value} onChange={e => group.change(e.target.value)}>
                                {group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>)}
                        {activeCount > 0 && <Button variant="secondary" onClick={clearFilters}>Clear filters ({activeCount})</Button>}
                        <DrawerClose asChild><Button variant="secondary">Done</Button></DrawerClose>
                    </div>
                </DrawerContent>
            </Drawer>
        ) : (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {groups.map(group => <DropdownMenuSub key={group.label}>
                        <DropdownMenuSubTrigger aria-label={group.aria}>{group.label}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup value={group.value} onValueChange={group.change} aria-label={group.aria}>
                                {group.options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>)}
                    {activeCount > 0 && <DropdownMenuItem onSelect={clearFilters}>Clear filters ({activeCount})</DropdownMenuItem>}
                </DropdownMenuContent>
            </DropdownMenu>
        )}
    </div>;
}
