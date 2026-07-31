'use client';

import type { LaborConfig } from '@/lib/quick-projects/engine/types';

interface LaborSectionProps {
  labor: LaborConfig;
  /** Basis for the labour percentage — excludes optional extras like plant hire. */
  materialsTotal: number;
  /** Everything the grand total counts, so the breakdown below reconciles with it. */
  materialsSubtotal?: number;
  currency: 'USD' | 'ZWG';
  zwgRate: number;
  onChange: (l: LaborConfig) => void;
}

/**
 * Labour block at the foot of a quick-project BOQ.
 *
 * Previously written against class names — labor-section, labor-tab,
 * labor-calc, labor-input — that had no stylesheet anywhere in the project, so
 * it rendered as unstyled HTML directly beneath a Tailwind-styled table.
 * Rebuilt with the same Tailwind vocabulary as QuickBOQTable, and given the
 * materials + labour = total breakdown that was missing.
 */

function fmt(amount: number, currency: 'USD' | 'ZWG', zwgRate: number): string {
  const val = currency === 'ZWG' ? amount * zwgRate : amount;
  const sym = currency === 'ZWG' ? 'ZiG' : '$';
  return `${sym} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const NUMBER_INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export default function LaborSection({ labor, materialsTotal, materialsSubtotal, currency, zwgRate, onChange }: LaborSectionProps) {
  const pct = labor.percentage ?? 25;
  const rate = labor.dailyRateUsd ?? 35;
  const days = labor.days ?? 5;
  const workers = labor.workerCount ?? 2;

  const laborCostUsd = labor.method === 'percentage'
    ? materialsTotal * (pct / 100)
    : rate * days * workers;

  const shownMaterials = materialsSubtotal ?? materialsTotal;
  const total = shownMaterials + (labor.enabled ? laborCostUsd : 0);
  // Optional extras sit in the materials figure but not in the labour basis, so
  // say which number the percentage was taken from rather than leaving the sum
  // looking wrong.
  const basisDiffers = shownMaterials - materialsTotal > 0.005;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header — include / exclude */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Labour</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {labor.enabled
              ? 'Included in the total below'
              : 'Materials only — labour is not costed'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={labor.enabled}
          onClick={() => onChange({ ...labor, enabled: !labor.enabled })}
          className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
            labor.enabled
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${labor.enabled ? 'bg-white' : 'bg-slate-400'}`}
          />
          {labor.enabled ? 'Included' : 'Excluded'}
        </button>
      </div>

      {labor.enabled && (
        <div className="px-4 py-4 space-y-4">
          {/* Method */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist">
            {([
              ['percentage', '% of materials'],
              ['daily_rate', 'Daily rate'],
            ] as const).map(([method, label]) => (
              <button
                key={method}
                type="button"
                role="tab"
                aria-selected={labor.method === method}
                onClick={() => onChange({ ...labor, method })}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  labor.method === method
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {labor.method === 'percentage' ? (
            <div>
              <label htmlFor="labour-pct" className="block text-xs font-semibold text-slate-600 mb-1.5">
                Labour as % of materials
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-28">
                  <input
                    id="labour-pct"
                    type="number"
                    inputMode="numeric"
                    className={`${NUMBER_INPUT} pr-7`}
                    value={pct}
                    min={1}
                    max={100}
                    onChange={(e) => onChange({ ...labor, percentage: parseInt(e.target.value) || 25 })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                </div>
                <span className="text-sm text-slate-500">
                  = <strong className="text-slate-900">{fmt(laborCostUsd, currency, zwgRate)}</strong>
                </span>
              </div>
              {/* Anchors the figure to something real rather than leaving the
                  user to guess a percentage out of the air. */}
              <p className="mt-2 text-xs text-slate-500">
                Labour typically runs 25–30% of materials on Zimbabwe builds.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="labour-rate" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Daily rate (USD)
                </label>
                <input
                  id="labour-rate"
                  type="number"
                  inputMode="decimal"
                  className={NUMBER_INPUT}
                  value={rate}
                  min={1}
                  onChange={(e) => onChange({ ...labor, dailyRateUsd: parseFloat(e.target.value) || 35 })}
                />
              </div>
              <div>
                <label htmlFor="labour-workers" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Builders
                </label>
                <input
                  id="labour-workers"
                  type="number"
                  inputMode="numeric"
                  className={NUMBER_INPUT}
                  value={workers}
                  min={1}
                  max={20}
                  onChange={(e) => onChange({ ...labor, workerCount: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div>
                <label htmlFor="labour-days" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Working days
                </label>
                <input
                  id="labour-days"
                  type="number"
                  inputMode="numeric"
                  className={NUMBER_INPUT}
                  value={days}
                  min={1}
                  max={365}
                  onChange={(e) => onChange({ ...labor, days: parseInt(e.target.value) || 5 })}
                />
              </div>
              <p className="sm:col-span-3 text-xs text-slate-500">
                {workers} {workers === 1 ? 'builder' : 'builders'} × {days} {days === 1 ? 'day' : 'days'} ×{' '}
                {fmt(rate, 'USD', zwgRate)}/day ={' '}
                <strong className="text-slate-900">{fmt(laborCostUsd, currency, zwgRate)}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* The sum the user is actually after: what the materials cost, what the
          labour adds, and what that comes to. */}
      <dl className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <dt className="text-slate-600">Materials</dt>
          <dd className="font-semibold text-slate-900 tabular-nums">{fmt(shownMaterials, currency, zwgRate)}</dd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <dt className="text-slate-600">
            Labour
            {labor.enabled && labor.method === 'percentage' && (
              <span className="text-slate-400">
                {' '}({pct}%{basisDiffers ? ` of ${fmt(materialsTotal, currency, zwgRate)}` : ''})
              </span>
            )}
          </dt>
          <dd className={`font-semibold tabular-nums ${labor.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
            {labor.enabled ? fmt(laborCostUsd, currency, zwgRate) : 'Excluded'}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm">
          <dt className="font-bold text-slate-900">Materials + labour</dt>
          <dd className="font-bold text-slate-900 tabular-nums">{fmt(total, currency, zwgRate)}</dd>
        </div>
      </dl>
    </div>
  );
}
