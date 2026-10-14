// ─── Where a quick estimate's money goes ─────────────────────────────────────
// The groups a quick BOQ already uses, kept apart rather than merged into one
// "admin" slice: a borehole owner wants to see the ZINWA permit separately
// from the survey and the rig's transport. Everything else is materials and
// works (pipes, tanks, panels, drilling).

import type { CostSlice } from '@/components/ui/CostDonut';
import { SERIES_COLORS } from '@/components/ui/CostDonut';

export const QUICK_COST_GROUPS = [
  { id: 'materials', label: 'Materials & works', color: SERIES_COLORS[0] },
  { id: 'labour', label: 'Labour', color: SERIES_COLORS[1] },
  { id: 'permits', label: 'Permits & compliance', color: SERIES_COLORS[2] },
  { id: 'professional', label: 'Professional services', color: SERIES_COLORS[3] },
  { id: 'transport', label: 'Transport & logistics', color: SERIES_COLORS[4] },
  { id: 'contingency', label: 'Contingency', color: SERIES_COLORS[6] },
] as const;

export type QuickCostGroup = (typeof QUICK_COST_GROUPS)[number]['id'];

export function quickCostGroup(category: string | null | undefined): QuickCostGroup {
  const name = (category ?? '').trim().toLowerCase();
  if (name === 'labor' || name === 'labour') return 'labour';
  if (name.startsWith('permit') || name.includes('compliance')) return 'permits';
  if (name.startsWith('professional')) return 'professional';
  if (name.startsWith('transport')) return 'transport';
  if (name === 'contingency') return 'contingency';
  return 'materials';
}

type CostedLine = { category?: string | null; totalCostUsd: number; included?: boolean; owned?: boolean };

/** Lines the total counts, grouped; zero groups are left for the chart to hide. */
export function quickCostSlices(items: CostedLine[]): CostSlice[] {
  const totals = new Map<QuickCostGroup, number>();
  for (const item of items) {
    if (item.included === false || item.owned) continue;
    const group = quickCostGroup(item.category);
    totals.set(group, (totals.get(group) ?? 0) + (Number(item.totalCostUsd) || 0));
  }
  return QUICK_COST_GROUPS.map((group) => ({ label: group.label, value: totals.get(group.id) ?? 0, color: group.color }));
}
