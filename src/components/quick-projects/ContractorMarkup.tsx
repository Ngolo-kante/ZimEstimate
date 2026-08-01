'use client';

interface ContractorMarkupProps {
  markupPct: number;
  subtotalUsd: number;
  currency: 'USD' | 'ZWG';
  zwgRate: number;
  onChange: (pct: number) => void;
}

/**
 * Contractor markup on a quick-project BOQ.
 *
 * Was written against class names — markup-section, markup-row, markup-input,
 * markup-value — with no stylesheet anywhere in the project, so it rendered as
 * unstyled HTML beneath a Tailwind-styled table, exactly as LaborSection did.
 * Rebuilt in the same vocabulary as the surrounding BOQ.
 */

function fmt(amount: number, currency: 'USD' | 'ZWG', zwgRate: number): string {
  const val = currency === 'ZWG' ? amount * zwgRate : amount;
  const sym = currency === 'ZWG' ? 'ZiG' : '$';
  return `${sym} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContractorMarkup({
  markupPct,
  subtotalUsd,
  currency,
  zwgRate,
  onChange,
}: ContractorMarkupProps) {
  const markupUsd = subtotalUsd * (markupPct / 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Your markup</p>
          <p className="text-xs text-slate-500 mt-0.5">Only you see this — client view hides it</p>
        </div>
        <span className="flex-shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          Contractor
        </span>
      </div>

      <div className="px-4 py-4">
        <label htmlFor="markup-pct" className="block text-xs font-semibold text-slate-600 mb-1.5">
          Markup on the estimate
        </label>
        <div className="flex items-center gap-3">
          <div className="relative w-28">
            <input
              id="markup-pct"
              type="number"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-7 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={markupPct}
              min={0}
              max={100}
              step={1}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              %
            </span>
          </div>
          <span className="text-sm text-slate-500">
            {markupPct > 0 ? (
              <>
                adds <strong className="text-slate-900">{fmt(markupUsd, currency, zwgRate)}</strong>
              </>
            ) : (
              'no markup applied'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
