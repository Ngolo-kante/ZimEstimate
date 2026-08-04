// ─── Saved work ───────────────────────────────────────────────────────────────
// One list of everything a user has saved, whichever table it lives in.
//
// Projects and quick estimates were presented as two tabs, which asked the user
// to remember which kind of thing they had made in order to find it again.
// Nobody thinks "I have projects and I also have quick BOQs" — they think "I
// have estimates". The split also caused a real bug: the dashboard counted only
// the projects table, so someone whose saved work was all quick estimates was
// shown an empty state telling them to create their first project.

import { getProjects } from './projects';
import { listQuickBOQs } from './quickBoq';
import type { BOQItem, ProjectType } from '../quick-projects/engine/types';

export type SavedWorkKind = 'project' | 'quick';

export interface SavedWorkItem {
  id: string;
  kind: SavedWorkKind;
  name: string;
  /** Short label for the type chip — "Full build", "Solar", "Borehole". */
  typeLabel: string;
  /** Filter key. 'project' for full builds, otherwise the quick project type. */
  filterKey: string;
  totalUsd: number;
  updatedAt: string;
  location: string | null;
  status: string | null;
  href: string;
}

const QUICK_TYPE_LABELS: Record<string, string> = {
  solar: 'Solar',
  borehole: 'Borehole',
  septic: 'Septic',
  water: 'Water',
  fencing: 'Fencing',
  paving: 'Paving',
};

function quickTotal(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, raw) => {
    const item = raw as Partial<BOQItem>;
    if (item.included === false || item.owned) return sum;
    return sum + (Number(item.totalCostUsd) || 0);
  }, 0);
}

/**
 * Both sources in one list, newest first.
 *
 * A failure in either source is not fatal — showing the half we could read
 * beats showing nothing, because the alternative is a user concluding their
 * work is gone.
 */
export async function listSavedWork(): Promise<{ items: SavedWorkItem[]; partial: boolean }> {
  const [projectsResult, quickResult] = await Promise.all([getProjects(), listQuickBOQs()]);

  const projectItems: SavedWorkItem[] = (projectsResult.projects ?? []).map((p) => ({
    id: p.id,
    kind: 'project',
    name: p.name || 'Untitled project',
    typeLabel: 'Full build',
    filterKey: 'project',
    totalUsd: Number(p.total_usd) || 0,
    updatedAt: p.updated_at || p.created_at,
    location: p.location ?? null,
    status: p.status ?? null,
    href: `/projects/${p.id}`,
  }));

  const quickItems: SavedWorkItem[] = (quickResult.boqs ?? []).map((q) => {
    const type = q.projectType as ProjectType;
    return {
      id: q.id,
      kind: 'quick',
      name: QUICK_TYPE_LABELS[type] ? `${QUICK_TYPE_LABELS[type]} estimate` : 'Quick estimate',
      typeLabel: QUICK_TYPE_LABELS[type] ?? 'Quick',
      filterKey: type,
      totalUsd: quickTotal(q.boqItems),
      updatedAt: q.updatedAt || q.createdAt,
      location: null,
      status: null,
      // Quick estimates open their BOQ rather than the project workspace. The
      // type chip on the row is what makes that difference visible — rows that
      // look identical but behave differently are worse than two honest tabs.
      href: `/projects/quick?id=${q.id}`,
    };
  });

  const items = [...projectItems, ...quickItems].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return { items, partial: Boolean(projectsResult.error) || Boolean(quickResult.error) };
}

/** Filter pills, built from what the user actually has rather than a fixed list. */
export function buildFilters(items: SavedWorkItem[]): Array<{ key: string; label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  items.forEach((item) => {
    const existing = counts.get(item.filterKey);
    counts.set(item.filterKey, { label: item.typeLabel, count: (existing?.count ?? 0) + 1 });
  });

  return [
    { key: 'all', label: 'All', count: items.length },
    ...[...counts.entries()]
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count),
  ];
}
