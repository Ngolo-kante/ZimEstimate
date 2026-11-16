import { describe, expect, it } from 'vitest';
import type { BOQItem, Project, ProjectStage, PurchaseRecord } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import { currentStageLabel, pendingItemsOf, pickContinueProject, shortLocation, updatedLabel } from './listPresentation';

const build = (id: string, updated_at: string, overrides: Partial<Project> = {}) => ({
    id, updated_at, owner_id: 'me', status: 'active', ...overrides,
}) as Project;

describe('Continue build selection', () => {
    const older = build('older', '2026-11-01T00:00:00Z');
    const newer = build('newer', '2026-11-15T00:00:00Z');
    it('uses a recorded open ahead of a newer update', () => {
        expect(pickContinueProject([newer, older], [{ project_id: 'older', opened_at: '2026-11-02T00:00:00Z' }], 'me')?.id).toBe('older');
    });
    it('uses the latest open when both builds have one', () => {
        expect(pickContinueProject([older, newer], [
            { project_id: 'older', opened_at: '2026-11-16T10:00:00Z' },
            { project_id: 'newer', opened_at: '2026-11-16T09:00:00Z' },
        ], 'me')?.id).toBe('older');
    });
    it('falls back to the most recently updated active build without opens', () => {
        expect(pickContinueProject([older, newer], [], 'me')?.id).toBe('newer');
    });
    it('excludes drafts, completed, archived, quick estimates and shared projects even when opened last', () => {
        const excluded = [
            build('draft', newer.updated_at, { status: 'draft' }),
            build('completed', newer.updated_at, { status: 'completed' }),
            build('archived', newer.updated_at, { status: 'archived' }),
            build('shared', newer.updated_at, { owner_id: 'someone-else' }),
            { id: 'quick', kind: 'quick', status: 'active', owner_id: 'me' } as unknown as SavedWorkItem,
        ];
        const opens = excluded.map(p => ({ project_id: p.id, opened_at: '2026-11-16T20:00:00Z' }));
        expect(pickContinueProject([...excluded, older], opens, 'me')?.id).toBe('older');
        expect(pickContinueProject(excluded, opens, 'me')).toBeUndefined();
        expect(pickContinueProject([], [], 'me')).toBeUndefined();
        expect(pickContinueProject([older], [], undefined)).toBeUndefined();
    });
});

describe('list presentation', () => {
    it.each([
        ['Urban — Stand 12345, Acacia Road, Borrowdale, Harare', 'Borrowdale, Harare'],
        ['Stand 12345, Borrowdale, Harare, Zimbabwe', 'Borrowdale, Harare'],
        ['Borrowdale, Harare', 'Borrowdale, Harare'],
        ['Peri-Urban — Ruwa', 'Ruwa'],
        ['12345 Acacia Road, Harare', 'Harare'],
        ['Stand 12345 Acacia Road', 'No location set'],
        [null, 'No location set'], ['', 'No location set'],
    ])('shortens %s to suburb and city', (input, expected) => expect(shortLocation(input)).toBe(expected));
    it('labels dates with the year only outside the current year', () => {
        const now = new Date('2026-11-16T12:00:00Z');
        expect(updatedLabel('2026-11-06T00:00:00Z', now)).toBe('Updated 6 Nov');
        expect(updatedLabel('2025-11-06T00:00:00Z', now)).toBe('Updated 6 Nov 2025');
        expect(updatedLabel('invalid', now)).toBe('Updated date unavailable');
    });
    it('uses the first applicable in-progress stage, ahead of later stages', () => {
        const stage = (boq_category: string, status: string, sort_order: number, is_applicable = true) => ({ boq_category, status, sort_order, is_applicable }) as ProjectStage;
        const stages = [stage('roofing', 'planning', 3), stage('substructure', 'completed', 1), stage('superstructure', 'in_progress', 2), stage('exterior', 'in_progress', 0, false)];
        expect(currentStageLabel(build('p', ''), stages)).toBe('Walls · in progress');
        expect(currentStageLabel(build('p', '', { status: 'draft' }), stages)).toBe('Draft');
        expect(currentStageLabel(build('p', '', { status: 'completed' }), stages)).toBe('Completed');
    });
    it('preserves Overview next-step ordering and accounts for purchase records', () => {
        const line = (id: string) => ({ id, quantity: 10, is_purchased: false }) as BOQItem;
        const items = [line('a'), line('b'), line('c')];
        const purchases = [{ boq_item_id: 'b', quantity: 10 }] as PurchaseRecord[];
        expect(pendingItemsOf(items, purchases).map(i => i.id)).toEqual(['a', 'c']);
    });
});
