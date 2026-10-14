'use client';

// ─── Where the money goes ────────────────────────────────────────────────────
// A ring chart and legend for a cost split: materials / labour / fees on a
// BOQ, stages on a budget, categories across all projects. Drawn with a CSS
// conic gradient, so it costs no chart library and prints in the PDF view.

export type CostSlice = { label: string; value: number; color: string; note?: string };

export const COST_COLORS = {
  materials: '#0B1F3B',
  labor: '#2E6CF6',
  fees: '#D97706',
} as const;

/** Distinct, print-safe colours for longer splits (stages, categories). */
export const SERIES_COLORS = ['#0B1F3B', '#2E6CF6', '#D97706', '#059669', '#7C3AED', '#DB2777', '#64748B', '#0891B2'];

const defaultFormat = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export function conicGradient(slices: CostSlice[]): string {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  if (total <= 0) return 'conic-gradient(#E2E8F0 0% 100%)';
  let start = 0;
  const stops = slices.filter((slice) => slice.value > 0).map((slice) => {
    const end = start + (slice.value / total) * 100;
    const stop = `${slice.color} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export default function CostDonut({
  slices,
  centerLabel = 'Total',
  centerValue,
  format = defaultFormat,
  size = 'md',
  hideEmpty = false,
}: {
  slices: CostSlice[];
  centerLabel?: string;
  /** Defaults to the formatted sum of the slices. */
  centerValue?: string;
  format?: (value: number) => string;
  size?: 'sm' | 'md';
  /** Leave zero-value slices out of the legend. */
  hideEmpty?: boolean;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const legend = hideEmpty ? slices.filter((slice) => slice.value > 0) : slices;
  const ring = size === 'sm' ? 'h-32 w-32' : 'h-44 w-44';
  const description = legend.map((slice) => `${slice.label} ${format(slice.value)}`).join(', ');

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <div role="img" aria-label={`Cost split: ${description}`} className={`relative ${ring} shrink-0 rounded-full`} style={{ background: conicGradient(slices) }}>
        <div className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full bg-[var(--color-surface)] text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{centerLabel}</span>
          <strong className={`mt-0.5 ${size === 'sm' ? 'text-sm' : 'text-base'} text-[var(--color-text)]`}>{centerValue ?? format(total)}</strong>
        </div>
      </div>
      <dl className="grid w-full min-w-0 gap-2">
        {legend.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-background)] px-3 py-2">
            <dt className="flex min-w-0 items-center gap-2 text-sm text-[var(--color-text)]">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ background: slice.color }} />
              <span className="min-w-0">
                <span className="block truncate">{slice.label}</span>
                {slice.note && <span className="block text-xs text-[var(--color-text-secondary)]">{slice.note}</span>}
              </span>
            </dt>
            <dd className="shrink-0 text-right text-sm font-semibold text-[var(--color-text)]">
              {format(slice.value)}
              <span className="block text-xs font-normal text-[var(--color-text-secondary)]">{total > 0 ? `${(Math.max(0, slice.value) / total * 100).toFixed(1)}%` : '0%'}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
