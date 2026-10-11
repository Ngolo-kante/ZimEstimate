/**
 * The text that goes with a shared copy of a project — in a WhatsApp
 * message, an email, or next to the PDF. A snapshot of the numbers, not
 * access: the person receiving it cannot open or change the project (that
 * is what Invite is for).
 *
 * Totals are summed from each line's total_usd, the same figures the BOQ
 * PDF prints, so the message and the attachment agree.
 */

export interface ShareSummaryProject {
  name: string;
  location: string | null;
}

export interface ShareSummaryItem {
  category: string;
  quantity: number;
  unit_price_usd: number;
  total_usd: number | null;
}

const STAGE_LABELS: Record<string, string> = {
  substructure: 'Foundations',
  superstructure: 'Walls',
  roofing: 'Roofing',
  finishing: 'Finishes',
  exterior: 'Outside works',
  labor: 'Labour',
};
const STAGE_ORDER = Object.keys(STAGE_LABELS);

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const lineTotal = (item: ShareSummaryItem) => {
  const stored = Number(item.total_usd);
  return Number.isFinite(stored) && stored > 0 ? stored : Number(item.quantity) * Number(item.unit_price_usd) || 0;
};

export function projectShareSummary(project: ShareSummaryProject, items: ShareSummaryItem[], siteUrl = 'https://zimestimate.com'): string {
  const byStage = new Map<string, number>();
  for (const item of items) {
    byStage.set(item.category, (byStage.get(item.category) ?? 0) + lineTotal(item));
  }
  const total = [...byStage.values()].reduce((sum, value) => sum + value, 0);

  const stages = [...byStage.entries()]
    .filter(([, value]) => value > 0)
    .sort(([a], [b]) => (STAGE_ORDER.indexOf(a) + 1 || 99) - (STAGE_ORDER.indexOf(b) + 1 || 99))
    .map(([stage, value]) => `• ${STAGE_LABELS[stage] ?? stage}: ${usd(value)}`);

  return [
    `${project.name}${project.location ? ` — ${project.location}` : ''}`,
    items.length > 0
      ? `Estimated cost: ${usd(total)} (${items.length} BOQ item${items.length === 1 ? '' : 's'})`
      : 'No BOQ items yet.',
    ...(stages.length > 1 ? ['', ...stages] : []),
    '',
    `Estimate made with ZimEstimate — prices change, so confirm with suppliers. ${siteUrl}`,
  ].join('\n');
}
