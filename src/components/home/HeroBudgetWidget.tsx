'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';

/**
 * Live budget-reach calculator for the home hero.
 *
 * Replaces a static dashboard mock (fake project, fake totals) with the
 * product's actual value demo: type a budget and a house literally builds
 * itself stage by stage — foundation, brick walls, roof, windows and doors,
 * then the boundary wall. Each stage's group fades from ghost silhouette to
 * solid as its funding rises; the bars below carry the exact percentages.
 *
 * Assumptions mirror the Budget Studio's defaults exactly — 120m², urban,
 * standard profile (3.0m walls, 42.5 cement) — so the verdict here is the
 * verdict /quick-budget shows after click-through, which also receives the
 * typed budget via ?budget=.
 */

const STAGE_SHORT_LABELS: Record<string, string> = {
  substructure: 'Foundation',
  superstructure: 'Walls & Frame',
  roofing: 'Roofing',
  finishing: 'Finishing',
  exterior: 'External Works',
};

const DEFAULT_BUDGET = '';

/** Ghost-to-solid: 0% funded stays a faint silhouette, 100% is fully built. */
function stageOpacity(pct: number): number {
  return 0.12 + 0.88 * Math.min(100, Math.max(0, pct)) / 100;
}

function BuildingHouse({ coverage }: { coverage: Record<string, number> }) {
  const g = (id: string) => ({
    style: { opacity: stageOpacity(coverage[id] ?? 0), transition: 'opacity 500ms ease' },
    className: 'motion-reduce:transition-none',
  });

  return (
    <svg
      viewBox="0 0 220 132"
      role="img"
      aria-label="Illustration of a house building up stage by stage as the budget increases"
      className="w-full h-28 md:h-32 lg:h-36"
    >
      {/* Ground */}
      <line x1="10" y1="126" x2="210" y2="126" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />

      {/* Substructure — concrete strip foundation */}
      <g {...g('substructure')}>
        <rect x="38" y="116" width="114" height="10" rx="2" fill="#94A3B8" />
      </g>

      {/* Superstructure — brick walls */}
      <g {...g('superstructure')}>
        <rect x="44" y="66" width="102" height="50" fill="#C97B5A" />
        <line x1="44" y1="79" x2="146" y2="79" stroke="#B4663F" strokeWidth="1" />
        <line x1="44" y1="92" x2="146" y2="92" stroke="#B4663F" strokeWidth="1" />
        <line x1="44" y1="105" x2="146" y2="105" stroke="#B4663F" strokeWidth="1" />
      </g>

      {/* Roofing — IBR sheet gable */}
      <g {...g('roofing')}>
        <polygon points="36,66 95,32 154,66" fill="#475569" />
        <rect x="36" y="63" width="118" height="4" rx="2" fill="#334155" />
      </g>

      {/* Finishing — door and windows */}
      <g {...g('finishing')}>
        <rect x="85" y="88" width="20" height="28" rx="1.5" fill="#0B1F3B" />
        <rect x="54" y="76" width="17" height="15" rx="1.5" fill="#BFDBFE" stroke="#0B1F3B" strokeWidth="1.5" />
        <rect x="119" y="76" width="17" height="15" rx="1.5" fill="#BFDBFE" stroke="#0B1F3B" strokeWidth="1.5" />
      </g>

      {/* External works — precast boundary wall and gate */}
      <g {...g('exterior')}>
        <rect x="168" y="102" width="40" height="24" fill="#E2E8F0" />
        <rect x="168" y="100" width="4" height="26" rx="1" fill="#94A3B8" />
        <rect x="186" y="100" width="4" height="26" rx="1" fill="#94A3B8" />
        <rect x="204" y="100" width="4" height="26" rx="1" fill="#94A3B8" />
        <rect x="12" y="102" width="18" height="24" fill="#E2E8F0" />
        <rect x="12" y="100" width="4" height="26" rx="1" fill="#94A3B8" />
      </g>
    </svg>
  );
}

export default function HeroBudgetWidget() {
  const [budgetInput, setBudgetInput] = useState(DEFAULT_BUDGET);

  const parsedBudget = Number(budgetInput.replace(/[^0-9]/g, ''));
  const hasValidBudget = Number.isFinite(parsedBudget) && parsedBudget > 0;

  // Synchronous and cheap (~ms), so it can track every keystroke. Inputs match
  // the Budget Studio's defaults so hero and Studio agree.
  const estimate = useMemo(() => {
    if (!hasValidBudget) return null;
    return estimateStageReach({
      budgetUsd: parsedBudget,
      floorAreaM2: 120,
      locationType: 'urban',
      wallHeightM: 3.0,
      cementTypes: ['cement_425'],
    });
  }, [hasValidBudget, parsedBudget]);

  const coverage = useMemo(() => {
    const map: Record<string, number> = {};
    estimate?.rows.forEach((row) => {
      map[row.id] = row.coveragePercent;
    });
    return map;
  }, [estimate]);

  const fullyFunded = estimate ? estimate.coveragePercent >= 100 : false;

  const verdict = !estimate
    ? 'Enter a budget to see your reach.'
    : fullyFunded
      ? 'Fully funds the build — materials covered.'
      : estimate.reachableStageId
        ? `Reaches ${STAGE_SHORT_LABELS[estimate.reachableStageId]} on a standard 3-bed build.`
        : 'Covers part of the foundation stage.';

  const handleInput = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 9);
    setBudgetInput(digits);
  };

  const displayValue = budgetInput
    ? Number(budgetInput).toLocaleString('en-US')
    : '';

  return (
    <div className="hero-preview relative w-full overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.09)]">
      <div className="relative h-full w-full p-3 sm:p-5 md:p-6 flex flex-col gap-2 sm:gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-normal text-blue-600 uppercase">
            Budget reality check
          </span>
          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
            Live
          </span>
        </div>

        <div>
          <h3 className="text-sm md:text-base font-bold text-slate-900 leading-tight">
            How far will your money go?
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Type an amount — watch the house build itself.
          </p>
        </div>

        {/* Budget input */}
        <label className="block">
          <span className="sr-only">Your budget in US dollars</span>
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-md px-3.5 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-400/20 transition">
            <span className="text-lg md:text-xl font-extrabold text-slate-400">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-transparent text-lg md:text-xl font-extrabold text-slate-900 outline-none placeholder:text-slate-300 tabular-nums"
            />
            <span className="text-[10px] font-bold uppercase tracking-normal text-slate-400 flex-shrink-0">USD</span>
          </div>
        </label>

        {/* The house that builds itself */}
        <div className="hidden sm:block flex-shrink-0">
          <BuildingHouse coverage={coverage} />
        </div>

        {/* Stage coverage bars */}
        <div className="hidden sm:flex flex-1 flex-col justify-center gap-1.5 min-h-0" aria-live="polite">
          {(estimate?.rows ?? []).map((row) => {
            const pct = Math.round(row.coveragePercent);
            return (
              <div key={row.id} className="flex items-center gap-2.5">
                <span className="w-[92px] md:w-[104px] flex-shrink-0 text-[11px] font-semibold text-slate-600 truncate">
                  {STAGE_SHORT_LABELS[row.id]}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`w-9 flex-shrink-0 text-right text-[11px] font-bold tabular-nums ${pct > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                  {pct}%
                </span>
              </div>
            );
          })}

          {!estimate && (
            <p className="text-[12px] text-slate-400 text-center py-3">
              Enter a budget above to see stage-by-stage coverage.
            </p>
          )}
        </div>

        {/* Verdict + CTA */}
        <div className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {fullyFunded && (
              <CheckCircle size={16} weight="fill" className="text-blue-600 flex-shrink-0" aria-hidden="true" />
            )}
            <p className="text-[11px] md:text-[12px] font-semibold text-slate-700 leading-snug">
              {verdict}
            </p>
          </div>
          <Link
            href={hasValidBudget ? `/quick-budget?budget=${parsedBudget}` : '/quick-budget'}
            className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] md:text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
          >
            Customize <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        <p className="hidden sm:block text-[9.5px] text-slate-400 leading-snug">
          Materials estimate for a 120m² 3-bed urban standard build. Adjust size, location and finish in the Budget Studio.
        </p>
      </div>
    </div>
  );
}
