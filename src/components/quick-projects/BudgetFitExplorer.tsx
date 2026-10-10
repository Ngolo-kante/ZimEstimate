'use client';

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
  onBack: () => void;
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
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
      >
        <ArrowLeft size={16} />
        {backLabel}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <label className="block">
          <span className="text-sm font-bold text-slate-900">What can you spend?</span>
          <div className="mt-2 flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-400/20">
            <span className="text-xl font-extrabold text-slate-400">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={budgetUsd ? budgetUsd.toLocaleString('en-US') : ''}
              onChange={(event) => setBudgetInput(event.target.value)}
              placeholder="Enter amount"
              aria-label="Your budget in US dollars"
              className="w-full bg-transparent text-xl font-extrabold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
            />
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">USD</span>
          </div>
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold text-slate-900">{config.variantLabel}</legend>
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
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
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
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
              Materials only, at current Zimbabwe prices. Labour, transport and gates are priced
              separately in the full {config.noun} wizard.
            </p>
          </>
        )}
      </div>

      {/* ── What it buys ───────────────────────────────────────────────── */}
      {costedItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-bold text-slate-900">What that includes</h3>
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
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 sm:w-auto"
        >
          <CheckCircle size={16} weight="fill" />
          Save this estimate
        </button>
      )}
    </div>
  );
}
