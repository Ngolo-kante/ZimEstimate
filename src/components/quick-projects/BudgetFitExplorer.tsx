'use client';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import CostDonut, { SERIES_COLORS } from '@/components/ui/CostDonut';
import { useMemo, useState } from 'react';
import { ArrowLeft, Warning, CheckCircle } from '@phosphor-icons/react';
import { fitQuantityToBudget, totalOf } from '@/lib/quick-projects/fitQuantityToBudget';
import type { Answers, BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';

/**
 * "What does my budget buy?" for the quick projects whose size is a choice
 * rather than a requirement.
 *
 * Fencing and paving are the two where the question is natural — a boundary
 * wall is whatever length you can pay for. Septic and water are deliberately
 * not here: a septic tank is sized by how many people live in the house, so
 * asking what your budget buys would invite someone to under-size the one part
 * of the build that fails slowly and expensively.
 *
 * Every figure comes from the project's own BOQ generator via
 * fitQuantityToBudget, so this page cannot drift from what the full wizard
 * would quote for the same job.
 */

export interface BudgetFitVariant {
  value: string;
  label: string;
  description: string;
}

export interface BudgetFitConfig {
  id: string;
  /** "fencing", "paving" — used in prose, so lower case. */
  noun: string;
  /** What the quantity is measured in, e.g. "m" or "m²". */
  unit: string;
  /** How a quantity reads in a sentence, e.g. "metres of fencing". */
  quantityLabel: (quantity: number) => string;
  variants: BudgetFitVariant[];
  variantLabel: string;
  min: number;
  max: number;
  step?: number;
  answersFor: (variant: string, quantity: number) => Answers;
  generate: (answers: Answers) => BOQItem[];
}

interface BudgetFitExplorerProps {
  config: BudgetFitConfig;
  initialBudget?: string;
  /** Omitted where the page already shows how to get elsewhere (the budget page's tabs). */
  onBack?: () => void;
  backLabel?: string;
  onSave?: (items: BOQItem[], answers: Answers, labor: LaborConfig) => void;
}

const money = (value: number) =>
  `$${Math.round(value).toLocaleString('en-US')}`;

export default function BudgetFitExplorer({
  config,
  initialBudget = '2000',
  onBack,
  backLabel = 'Back',
  onSave,
}: BudgetFitExplorerProps) {
  const [budgetInput, setBudgetInput] = useState(initialBudget);
  const [variant, setVariant] = useState(config.variants[0]?.value ?? '');

  const budgetUsd = Number(budgetInput.replace(/[^0-9]/g, '')) || 0;

  /* Cheap enough to run on every keystroke: the search is a few dozen calls to
     a pure function, which is why there is no debounce here. */
  const fit = useMemo(
    () =>
      fitQuantityToBudget({
        budgetUsd,
        answersFor: (quantity) => config.answersFor(variant, quantity),
        generate: config.generate,
        min: config.min,
        max: config.max,
        step: config.step,
      }),
    [budgetUsd, variant, config],
  );

  const costedItems = fit.items.filter((item) => item.included !== false && !item.owned);

  const handleSave = () => {
    onSave?.(fit.items, config.answersFor(variant, fit.quantity), {
      enabled: false,
      method: 'percentage',
      percentage: 25,
    });
  };

  return (
    <div className="budget-fit-explorer min-w-0 space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>
      )}

      <div className="rounded-[14px] border border-slate-400/20 bg-slate-50/85 p-3">
        <h2 className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-primary)] mb-3">Your budget</h2>
        <Input
          label="AVAILABLE BUDGET (USD)"
          icon={<span>$</span>}
          type="text"
          inputMode="numeric"
          value={budgetUsd ? budgetUsd.toLocaleString('en-US') : ''}
          onChange={(event) => setBudgetInput(event.target.value)}
          placeholder="Enter amount"
        />
        {budgetUsd > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="rounded-xl border border-slate-200 bg-white p-3"><strong className="block text-base text-[var(--color-primary)]">{money(fit.totalUsd)}</strong>Allocated</div>
            <div className="rounded-xl border border-slate-200 bg-white p-3"><strong className="block text-base text-[var(--color-primary)]">{money(Math.abs(fit.remainingUsd))}</strong>{fit.remainingUsd >= 0 ? 'Remaining' : 'Over budget'}</div>
          </div>
        )}
      </div>
      <div className="rounded-[14px] border border-slate-400/20 bg-slate-50/85 p-3">
        <fieldset>
          <legend className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-primary)]">{config.variantLabel}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {config.variants.map((option) => {
              const active = option.value === variant;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVariant(option.value)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* ── The answer ─────────────────────────────────────────────────── */}
      <div className="rounded-[14px] border border-slate-400/20 bg-slate-50/85 p-3">
        {fit.belowMinimum ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                {money(budgetUsd)} does not cover the smallest job
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
                The smallest {config.noun} we cost is {config.quantityLabel(fit.quantity)}, at{' '}
                {money(fit.totalUsd)}. You are {money(Math.abs(fit.remainingUsd))} short.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-500">Your budget covers</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">
              {config.quantityLabel(fit.quantity)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Materials come to <strong>{money(fit.totalUsd)}</strong>
              {fit.remainingUsd >= 1 && <> — {money(fit.remainingUsd)} left over</>}.
            </p>

            {fit.atMaximum && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                That is the largest {config.noun} job this estimator covers. For anything bigger,
                the full wizard will take exact dimensions.
              </p>
            )}

            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Materials only, at current Zimbabwe prices. Labour and transport are priced
              separately in the full {config.noun} wizard.
            </p>
          </>
        )}
      </div>

      {/* A split needs at least two parts; paving is often one. */}
      {new Set(costedItems.map((item) => item.category)).size > 1 && (
        <div className="rounded-[14px] border border-slate-400/20 bg-slate-50/85 p-3">
          <h2 className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-primary)] mb-4">Where the money goes</h2>
          <CostDonut slices={Array.from(new Set(costedItems.map((item) => item.category))).map((category, index) => ({
            label: category,
            value: costedItems.filter((item) => item.category === category).reduce((sum, item) => sum + item.totalCostUsd, 0),
            color: SERIES_COLORS[index % SERIES_COLORS.length],
          }))} />
        </div>
      )}

      {/* ── What it buys ───────────────────────────────────────────────── */}
      {costedItems.length > 0 && (
        <div className="overflow-hidden rounded-[14px] border border-slate-400/20 bg-slate-50/85 p-3">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-primary)]">What that includes</h3>
            <span className="text-xs text-slate-500">{costedItems.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-5 py-2 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {costedItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-800">{item.description}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {money(item.totalCostUsd)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-5 py-2.5 font-bold text-slate-900" colSpan={2}>
                    Total
                  </td>
                  <td className="px-5 py-2.5 text-right font-extrabold tabular-nums text-slate-900">
                    {money(totalOf(fit.items))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onSave && !fit.belowMinimum && (
        <Button
          variant="primary"
          onClick={handleSave}
          className="w-full sm:w-auto"
        >
          <CheckCircle size={16} weight="fill" />
          Save this estimate
        </Button>
      )}
      <style jsx global>{`
        .budget-fit-explorer .input-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
        .budget-fit-explorer button { min-height: 40px; }
        .budget-fit-explorer td, .budget-fit-explorer th { padding-left: 8px; padding-right: 8px; }
      `}</style>
    </div>
  );
}
