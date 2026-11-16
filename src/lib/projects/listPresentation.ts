import type { BOQItem, Project, ProjectStage, PurchaseRecord } from '@/lib/database.types';
import type { SavedWorkItem } from '@/lib/services/savedWork';
import { isLinePurchased } from './itemStatus';

export const stageLabels = {
    substructure: { short: 'Foundation', full: 'Site & foundation' },
    superstructure: { short: 'Walls', full: 'Structural walls' },
    roofing: { short: 'Roof', full: 'Roofing' },
    finishing: { short: 'Interior', full: 'Interior finishing' },
    services: { short: 'Services', full: 'Plumbing & electrical' },
    exterior: { short: 'Exterior', full: 'External work' },
};
export const stageStatusLabels = { planning: 'Planning', pending_approval: 'Pending', in_progress: 'In progress', on_hold: 'On hold', completed: 'Complete' };

export function currentStageLabel(project: Project, stages: ProjectStage[]): string {
    if (project.status !== 'active') return project.status.charAt(0).toUpperCase() + project.status.slice(1);
    const applicable = stages.filter(s => s.is_applicable).sort((a, b) => a.sort_order - b.sort_order);
    const stage = applicable.find(s => s.status === 'in_progress') ?? applicable.find(s => s.status !== 'completed') ?? applicable.at(-1);
    return stage ? `${stageLabels[stage.boq_category].short} · ${stageStatusLabels[stage.status].toLowerCase()}` : 'Active';
}

/** The same material lines, in the same order, as Overview's Next steps. */
export const pendingItemsOf = (materialItems: BOQItem[], purchases: PurchaseRecord[]) => materialItems.filter(item => !isLinePurchased(item, purchases));

export type ProjectOpen = { project_id: string; opened_at: string };
/** Only owned active full builds qualify; a recorded open outranks an update. */
export function pickContinueProject(projects: (Project | SavedWorkItem)[], opens: ProjectOpen[], ownerId: string | undefined): Project | undefined {
    const opened = new Map(opens.map(row => [row.project_id, Date.parse(row.opened_at)]));
    return projects.filter((p): p is Project => !('kind' in p) && p.owner_id === ownerId && p.status === 'active').sort((a, b) => {
        const aOpen = opened.get(a.id), bOpen = opened.get(b.id);
        if (aOpen !== undefined || bOpen !== undefined) return (bOpen ?? -Infinity) - (aOpen ?? -Infinity);
        return Date.parse(b.updated_at) - Date.parse(a.updated_at);
    })[0];
}

/** Locations are saved as free text, sometimes prefixed with the location type. */
export function shortLocation(location: string | null | undefined): string {
    if (!location?.trim()) return 'No location set';
    const clean = location.replace(/^(Urban|Peri-Urban|Rural)\s*[—–-]\s*/i, '').trim();
    const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
    if (/^(Zimbabwe|ZW)$/i.test(parts.at(-1) ?? '')) parts.pop();
    // With no suburb/city delimiter, do not expose a stand address as a location.
    const places = parts.filter(p => !/^(?:(stand|plot|lot|house|no\.?)\b|\d)/i.test(p));
    return places.slice(-2).join(', ') || 'No location set';
}

export function updatedLabel(value: string, now = new Date()): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Updated date unavailable';
    return `Updated ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(date.getUTCFullYear() !== now.getUTCFullYear() ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date)}`;
}
