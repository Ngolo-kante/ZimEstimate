import type { Answers, BOQItem, LaborConfig, ProjectType } from './engine/types';
import type { SharedEstimateSummary } from '@/lib/og/sharedEstimate';
// The one list of type labels; re-declaring it is how it drifted before.
import { QUICK_TYPE_LABELS } from '@/lib/quick-projects/typeLabels';

/**
 * A saved quick estimate as anyone with its share link sees it.
 *
 * Only what get_shared_quick_boq returns (migration 053): the estimate itself.
 * Not the owner, the linked project, the money they have put aside, their
 * target date or their compliance progress — those stay private even when
 * the estimate is shared.
 */

export interface SharedQuickEstimate {
  projectType: ProjectType;
  answers: Answers;
  boqItems: BOQItem[];
  labor: LaborConfig;
  markupPct: number;
  currency: 'USD' | 'ZWG';
  updatedAt: string;
}

/** The owner's own name for it, or a plain one. Used on the page and the preview. */
export function estimateName(projectType: string, answers: Answers | Record<string, unknown> | null | undefined): string {
  const named = (answers as Record<string, unknown> | null | undefined)?.project_name;
  if (typeof named === 'string' && named.trim()) return named.trim();
  return `${QUICK_TYPE_LABELS[projectType] ?? 'Quick'} estimate`;
}

/**
 * What the saved estimate page shows as its total: included items the owner
 * does not already have. The shared page uses the same rule, so the two cannot
 * show different totals for the same estimate.
 */
export function quickEstimateTotal(items: BOQItem[]): number {
  return items
    .filter((item) => item.included !== false && !item.owned)
    .reduce((sum, item) => sum + (Number(item.totalCostUsd) || 0), 0);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checked before the database is asked, so a mangled link is "not found", not an error. */
export function isShareToken(value: string): boolean {
  return UUID.test(value);
}

type SharedRow = {
  project_type: ProjectType;
  answers: Answers | null;
  boq_items: BOQItem[] | null;
  labor_enabled: boolean | null;
  labor_method: string | null;
  labor_value: number | null;
  labor_days: number | null;
  labor_workers: number | null;
  markup_pct: number | null;
  currency: 'USD' | 'ZWG' | null;
  updated_at: string;
};

/** The function's JSON, in the shape the app uses. Null for anything malformed. */
export function toSharedQuickEstimate(raw: unknown): SharedQuickEstimate | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as SharedRow;
  if (!row.project_type) return null;

  return {
    projectType: row.project_type,
    answers: row.answers ?? ({} as Answers),
    boqItems: Array.isArray(row.boq_items) ? row.boq_items : [],
    labor: {
      enabled: Boolean(row.labor_enabled),
      method: (row.labor_method as LaborConfig['method']) ?? 'percentage',
      percentage: row.labor_method === 'percentage' ? (row.labor_value ?? 25) : undefined,
      dailyRateUsd: row.labor_method === 'daily_rate' ? (row.labor_value ?? 35) : undefined,
      days: row.labor_days ?? undefined,
      workerCount: row.labor_workers ?? undefined,
    },
    markupPct: Number(row.markup_pct) || 0,
    currency: row.currency ?? 'USD',
    updatedAt: row.updated_at,
  };
}

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/** For the WhatsApp preview card of a shared saved estimate. */
export function summariseSavedEstimate(estimate: SharedQuickEstimate): SharedEstimateSummary {
  const total = quickEstimateTotal(estimate.boqItems);
  const lines = estimate.boqItems.filter((item) => item.included !== false && !item.owned).length;
  const label = QUICK_TYPE_LABELS[estimate.projectType] ?? 'Quick';
  const name = estimateName(estimate.projectType, estimate.answers);

  return {
    kicker: label.toUpperCase(),
    headline: name,
    lines: [`Materials: ${usd(total)}`, `${lines} item${lines === 1 ? '' : 's'} · priced for Zimbabwe`],
    description: `${label} estimate — ${usd(total)} in materials across ${lines} item${lines === 1 ? '' : 's'}. Open it to see every line.`,
    // Read-only for whoever opens it, so not "Open and adjust".
    cta: 'See every line',
  };
}
