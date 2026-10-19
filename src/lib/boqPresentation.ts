import { isLaborCategory, stageOfLaborCategory } from '@/lib/calculations/laborSubstages';

/** Resolve display grouping without changing the category saved on a line. */
export function boqStage(category: string | null | undefined): string {
  return stageOfLaborCategory(category ?? '') ?? (category || 'other');
}

/** Materials first, labour below them; neither input arrays nor categories are mutated. */
export function materialsBeforeLabor<T extends { category?: string | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(isLaborCategory(a.category)) - Number(isLaborCategory(b.category)));
}

export function groupBoqByStage<T extends { category?: string | null }>(items: readonly T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const stage = boqStage(item.category);
    (groups[stage] ??= []).push(item);
  }
  const order = ['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior', 'labor', 'project_fees'];
  return Object.fromEntries(Object.entries(groups)
    .sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)))
    .map(([stage, lines]) => [stage, materialsBeforeLabor(lines)]));
}
