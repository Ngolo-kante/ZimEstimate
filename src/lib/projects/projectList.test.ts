import { describe, expect, it } from 'vitest';
import type { Project } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import {
    activeFilterCount,
    buildTypeFilters,
    filterProjects,
    filterQuickItems,
    formatScopeLabel,
    formatStageLabel,
    getComplianceChips,
    portfolioStats,
    visibleProjectsFor,
} from './projectList';

const project = (overrides: Partial<Project>): Project => ({
    id: 'p', owner_id: 'u', name: 'House', location: null, description: null, scope: 'entire_house', labor_preference: 'materials_only',
    status: 'draft', selected_stages: null, usage_tracking_enabled: false, usage_low_stock_alert_enabled: false, usage_low_stock_threshold: 20,
    total_usd: 0, total_zwg: 0, target_date: null, budget_target_usd: null, start_date: null, target_completion_date: null,
    target_purchase_date: null, savings_frequency: 'monthly', savings_target_mode: 'remaining', savings_target_usd: null,
    soil_type: null, site_slope: null, geotech_report_uploaded: false, geotech_report_uploaded_at: null, geotech_report_document_id: null,
    geotech_analysis_mode: 'manual', house_extras: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

const quick = (overrides: Partial<SavedWorkItem>): SavedWorkItem => ({
    id: 'q', kind: 'quick', name: 'Solar estimate', typeLabel: 'Solar', filterKey: 'solar', totalUsd: 0,
    updatedAt: '2026-01-01T00:00:00.000Z', location: null, status: null, href: '/projects/quick/q', ...overrides,
});

const all = { searchQuery: '', statusFilter: 'all' as const, scopeFilter: 'all' as const, sortBy: 'updated_desc' as const };

describe('filtering full builds', () => {
    const projects = [
        project({ id: 'a', name: 'Borrowdale House', location: 'Harare', status: 'active', total_usd: 300, updated_at: '2026-03-01T00:00:00Z' }),
        project({ id: 'b', name: 'Cottage', location: 'Ruwa', status: 'draft', scope: 'roofing', total_usd: 100, updated_at: '2026-05-01T00:00:00Z' }),
        project({ id: 'c', name: 'Annex', location: null, status: 'archived', selected_stages: ['roofing', 'finishing'], total_usd: 200, updated_at: '2026-04-01T00:00:00Z' }),
    ];
    const ids = (list: Project[]) => list.map((p) => p.id);

    it('searches name and location, ignoring case and surrounding spaces only when blank', () => {
        expect(ids(filterProjects(projects, { ...all, searchQuery: 'HARARE' }))).toEqual(['a']);
        expect(ids(filterProjects(projects, { ...all, searchQuery: 'cott' }))).toEqual(['b']);
        expect(ids(filterProjects(projects, { ...all, searchQuery: '   ' }))).toEqual(['b', 'c', 'a']);
    });

    it('filters by status, and by scope or chosen stages', () => {
        expect(ids(filterProjects(projects, { ...all, statusFilter: 'archived' }))).toEqual(['c']);
        expect(ids(filterProjects(projects, { ...all, scopeFilter: 'roofing' }))).toEqual(['b', 'c']);
    });

    it('sorts every way the menu offers', () => {
        expect(ids(filterProjects(projects, { ...all, sortBy: 'updated_asc' }))).toEqual(['a', 'c', 'b']);
        expect(ids(filterProjects(projects, { ...all, sortBy: 'name_asc' }))).toEqual(['c', 'a', 'b']);
        expect(ids(filterProjects(projects, { ...all, sortBy: 'name_desc' }))).toEqual(['b', 'a', 'c']);
        expect(ids(filterProjects(projects, { ...all, sortBy: 'budget_desc' }))).toEqual(['a', 'c', 'b']);
        expect(ids(filterProjects(projects, { ...all, sortBy: 'budget_asc' }))).toEqual(['b', 'c', 'a']);
    });

    it('leaves the input list alone', () => {
        filterProjects(projects, { ...all, sortBy: 'name_asc' });
        expect(ids(projects)).toEqual(['a', 'b', 'c']);
    });

    it('hides full builds when a quick-estimate type is chosen', () => {
        expect(visibleProjectsFor('all', projects)).toBe(projects);
        expect(visibleProjectsFor('project', projects)).toBe(projects);
        expect(visibleProjectsFor('solar', projects)).toEqual([]);
    });
});

describe('filtering quick estimates', () => {
    const items = [
        quick({ id: 's', name: 'Solar backup', typeLabel: 'Solar', filterKey: 'solar', totalUsd: 4000, updatedAt: '2026-02-01T00:00:00Z' }),
        quick({ id: 'w', name: 'Borehole', typeLabel: 'Borehole', filterKey: 'borehole', totalUsd: 2500, updatedAt: '2026-03-01T00:00:00Z', status: 'archived' }),
    ];
    const ids = (list: SavedWorkItem[]) => list.map((p) => p.id);
    const q = { searchQuery: '', statusFilter: 'all' as const, sortBy: 'updated_desc' as const };

    it('searches name and type, and filters by type', () => {
        expect(ids(filterQuickItems(items, { ...q, searchQuery: 'SOLAR' }, 'all'))).toEqual(['s']);
        expect(ids(filterQuickItems(items, q, 'borehole'))).toEqual(['w']);
    });

    it('shows archived ones under Archived and in-use ones under any other status', () => {
        expect(ids(filterQuickItems(items, { ...q, statusFilter: 'archived' }, 'all'))).toEqual(['w']);
        expect(ids(filterQuickItems(items, { ...q, statusFilter: 'draft' }, 'all'))).toEqual(['s']);
    });

    it('sorts like full builds, newest first by default', () => {
        expect(ids(filterQuickItems(items, q, 'all'))).toEqual(['w', 's']);
        expect(ids(filterQuickItems(items, { ...q, sortBy: 'budget_asc' }, 'all'))).toEqual(['w', 's']);
        expect(ids(filterQuickItems(items, { ...q, sortBy: 'name_asc' }, 'all'))).toEqual(['w', 's']);
    });
});

describe('type pills and summary', () => {
    it('lists All, then each kind with its count, most first', () => {
        expect(buildTypeFilters(1, [quick({ filterKey: 'solar', typeLabel: 'Solar' }), quick({ filterKey: 'solar', typeLabel: 'Solar' })])).toEqual([
            { key: 'all', label: 'All', count: 3 },
            { key: 'solar', label: 'Solar', count: 2 },
            { key: 'project', label: 'Full build', count: 1 },
        ]);
        expect(buildTypeFilters(0, [])).toEqual([{ key: 'all', label: 'All', count: 0 }]);
    });

    it('counts statuses and sums totals', () => {
        expect(portfolioStats([
            project({ status: 'active', total_usd: 100 }),
            project({ status: 'draft', total_usd: '50.5' as unknown as number }),
            project({ status: 'completed', total_usd: null as unknown as number }),
        ])).toEqual({ total: 3, active: 1, completed: 1, draft: 1, totalBudget: 150.5 });
    });

    it('counts only status and scope as active filters', () => {
        expect(activeFilterCount('all', 'all')).toBe(0);
        expect(activeFilterCount('draft', 'roofing')).toBe(2);
    });
});

describe('card labels', () => {
    it('names stages, and tidies unknown ones only at the first underscore', () => {
        expect(formatStageLabel('roofing')).toBe('Roofing');
        expect(formatStageLabel('entire_house')).toBe('Full House');
        expect(formatStageLabel('some_new_stage')).toBe('some new_stage');
    });

    it('prefers the chosen stages over the scope', () => {
        expect(formatScopeLabel(project({ selected_stages: ['roofing', 'finishing'] }))).toBe('Roofing, Interior & Finishing');
        expect(formatScopeLabel(project({ selected_stages: [], scope: 'entire_house' }))).toBe('Full House');
    });

    it('shows soil, slope and the geotech report', () => {
        expect(getComplianceChips(project({}))).toEqual([{ label: 'Geotech Pending', tone: 'warn' }]);
        const chips = getComplianceChips(project({ soil_type: 'loam', site_slope: 'gentle', geotech_report_uploaded: true }));
        expect(chips.map((c) => c.tone)).toEqual(['info', 'info', 'ok']);
        expect(chips[2].label).toBe('Geotech Uploaded');
    });
});
