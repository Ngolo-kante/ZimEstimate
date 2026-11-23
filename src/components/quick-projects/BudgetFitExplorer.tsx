'use client';

import { formatUsd } from '@/lib/format';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import CostDonut, { SERIES_COLORS } from '@/components/ui/CostDonut';
import '@/styles/budget-explorer.css';
import { useMemo, useState } from 'react';
import { CaretLeft, Warning, CheckCircle } from '@phosphor-icons/react';
import { fitQuantityToBudget, totalOf } from '@/lib/quick-projects/fitQuantityToBudget';
import type { Answers, BOQItem, LaborConfig } from '@/lib/quick-projects/engine/types';

const estimateSeriesColors = ['var(--color-settings-heading)', ...SERIES_COLORS.slice(1)];

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
  `${formatUsd(value, { wholeDollars: true })}`;

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
          className="explorer-back"
        >
          <CaretLeft size={16} weight="bold" aria-hidden="true" />
          {backLabel}
        </button>
      )}

      <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
        <h2 className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-heading)] mb-3">Your budget</h2>
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
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--color-worksheet-caption)]">
            <div className="rounded-xl border border-[var(--color-worksheet-track)] bg-[var(--color-surface-raised)] p-3"><strong className="block text-base text-[var(--color-heading)]">{money(fit.totalUsd)}</strong>Allocated</div>
            <div className="rounded-xl border border-[var(--color-worksheet-track)] bg-[var(--color-surface-raised)] p-3"><strong className="block text-base text-[var(--color-heading)]">{money(Math.abs(fit.remainingUsd))}</strong>{fit.remainingUsd >= 0 ? 'Remaining' : 'Over budget'}</div>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
        <fieldset>
          <legend className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-heading)]">{config.variantLabel}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {config.variants.map((option) => {
              const active = option.value === variant;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setVariant(option.value)}
                  className={`rounded-xl border p-3 text-left transition-none ${
                    active
                      ? 'border-[var(--color-choice-ring)] bg-[var(--color-choice-wash)]/60 ring-1 ring-[var(--color-choice-ring)]'
                      : 'border-[var(--color-worksheet-track)] bg-[var(--color-surface-raised)] hover:border-[var(--color-worksheet-field-border)]'
                  }`}
                >
                  <span className="block text-sm font-bold text-[var(--color-worksheet-title)]">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-worksheet-caption)]">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* ── The answer ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
        {fit.belowMinimum ? (
          <div className="flex items-start gap-3 rounded-xl border border-[var(--color-allowance-border)] bg-[var(--color-allowance-bg)] p-4">
            <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--color-allowance-value)]" />
            <div>
              <p className="text-sm font-bold text-[var(--color-allowance-heading)]">
                {money(budgetUsd)} does not cover the smallest job
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-allowance-heading)]/90">
                The smallest {config.noun} we cost is {config.quantityLabel(fit.quantity)}, at{' '}
                {money(fit.totalUsd)}. You are {money(Math.abs(fit.remainingUsd))} short.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--color-worksheet-caption)]">Your budget covers</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-[var(--color-worksheet-title)]">
              {config.quantityLabel(fit.quantity)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-worksheet-detail)]">
              Materials come to <strong>{money(fit.totalUsd)}</strong>
              {fit.remainingUsd >= 1 && <> — {money(fit.remainingUsd)} left over</>}.
            </p>

            {fit.atMaximum && (
              <p className="mt-3 rounded-lg bg-[var(--color-worksheet-row)] p-3 text-xs leading-relaxed text-[var(--color-worksheet-detail)]">
                That is the largest {config.noun} job this estimator covers. For anything bigger,
                the full wizard will take exact dimensions.
              </p>
            )}

            <p className="mt-3 text-xs leading-relaxed text-[var(--color-worksheet-caption)]">
              Materials only, at current Zimbabwe prices. Labour and transport are priced
              separately in the full {config.noun} wizard.
            </p>
          </>
        )}
      </div>

      {/* A split needs at least two parts; paving is often one. */}
      {new Set(costedItems.map((item) => item.category)).size > 1 && (
        <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
          <h2 className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-heading)] mb-4">Where the money goes</h2>
          <CostDonut slices={Array.from(new Set(costedItems.map((item) => item.category))).map((category, index) => ({
            label: category,
            value: costedItems.filter((item) => item.category === category).reduce((sum, item) => sum + item.totalCostUsd, 0),
            color: estimateSeriesColors[index % estimateSeriesColors.length],
          }))} />
        </div>
      )}

      {/* ── What it buys ───────────────────────────────────────────────── */}
      {costedItems.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
          <div className="flex items-center justify-between border-b border-[var(--color-worksheet-track)] px-5 py-3">
            <h3 className="text-[0.88rem] font-extrabold uppercase tracking-[0.08em] text-[var(--color-heading)]">What that includes</h3>
            <span className="text-xs text-[var(--color-worksheet-caption)]">{costedItems.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-worksheet-rule-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-worksheet-caption)]">
                  <th className="px-5 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-5 py-2 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {costedItems.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-worksheet-rule-faint)] last:border-0">
                    <td className="px-5 py-2.5 text-[var(--color-worksheet-strong)]">{item.description}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-worksheet-detail)]">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-[var(--color-worksheet-title)]">
                      {money(item.totalCostUsd)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[var(--color-worksheet-row)]">
                  <td className="px-5 py-2.5 font-bold text-[var(--color-worksheet-title)]" colSpan={2}>
                    Total
                  </td>
                  <td className="px-5 py-2.5 text-right font-extrabold tabular-nums text-[var(--color-worksheet-title)]">
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
    </div>
  );
}
