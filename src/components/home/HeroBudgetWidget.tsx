'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';
import { captureProductEvent, getBudgetBand } from '@/lib/productAnalytics';

/**
 * Live budget-reach calculator for the home hero.
 *
 * Replaces a static dashboard mock (fake project, fake totals) with the
 * product's actual value demo: type a budget and a house literally builds
 * itself stage by stage — foundation, brick walls, roof, windows and doors,
 * then the boundary wall. Each stage's group fades from ghost silhouette to
 * solid as its funding rises; the bars below carry the exact percentages.
 *
 * Motion (all of it off under prefers-reduced-motion):
 * - on first view the amount counts up from $0 to $15,000 and the house
 *   rises in front of the visitor, until they touch the field;
 * - each stage builds in pieces in the order it is built — the foundation
 *   pours left to right, walls go up course by course, the roof drops on,
 *   door then windows, boundary posts one by one — so 60% funded looks 60%
 *   built rather than like a faded whole wall;
 * - the bars fill in building order, the verdict pops when the reached stage
 *   changes, and a check lands over the roof when the build is fully funded.
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

/* The plan the estimate is for. Named once and used by the calculator, the
   spec chips, and the footnote, so the visible size can never drift from the
   size actually being costed. */
const PLAN_AREA_M2 = 120;
const PLAN_BEDROOMS = 3;
const PLAN_LOCATION = 'urban';

/* Where the first-view count-up lands, and what shows straight away when
   motion is reduced. $15,000 lands mid-build — enough stages funded to show
   the thing working, not so many that there is nothing left to discover by
   typing. */
const DEFAULT_BUDGET = '15000';
const INTRO_MS = 1800;

/** How much of piece `index` (of `count`) is built when a stage is `pct`% funded: 0–1. */
function piece(pct: number, index: number, count: number): number {
  return Math.min(1, Math.max(0, (Math.min(100, Math.max(0, pct)) / 100) * count - index));
}

const FADE = { transition: 'opacity 450ms ease, transform 450ms ease' };

function BuildingHouse({ coverage, complete }: { coverage: Record<string, number>; complete: boolean }) {
  const sub = coverage.substructure ?? 0;
  const walls = coverage.superstructure ?? 0;
  const roof = coverage.roofing ?? 0;
  const finish = coverage.finishing ?? 0;
  const ext = coverage.exterior ?? 0;
  const roofIn = piece(roof, 0, 1);

  return (
    <svg
      viewBox="0 0 220 132"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Illustration of a house building up stage by stage as the budget increases"
      className="block h-[116px] w-full sm:h-28 md:h-32 lg:h-36"
    >
      {/* Ground */}
      <line x1="10" y1="126" x2="210" y2="126" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />

      {/* The whole house as a faint outline, so what is not yet funded is
          still visible as what the money is for. */}
      <g opacity="0.12">
        <rect x="38" y="116" width="114" height="10" rx="2" fill="#94A3B8" />
        <rect x="44" y="66" width="102" height="50" fill="#C97B5A" />
        <polygon points="36,66 95,32 154,66" fill="#475569" />
        <rect x="85" y="88" width="20" height="28" rx="1.5" fill="#0B1F3B" />
        <rect x="54" y="76" width="17" height="15" rx="1.5" fill="#0B1F3B" />
        <rect x="119" y="76" width="17" height="15" rx="1.5" fill="#0B1F3B" />
        <rect x="168" y="102" width="40" height="24" fill="#94A3B8" />
        <rect x="12" y="102" width="18" height="24" fill="#94A3B8" />
      </g>

      {/* Substructure — the strip foundation pours left to right. */}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={`f${i}`} x={38 + i * 19} y="116" width="19" height="10" fill="#94A3B8"
          style={{ ...FADE, opacity: piece(sub, i, 6) }} className="motion-reduce:transition-none" />
      ))}

      {/* Superstructure — brick walls, course by course from the ground up. */}
      {Array.from({ length: 4 }, (_, i) => {
        const y = 116 - (i + 1) * 12.5;
        return (
          <g key={`w${i}`} style={{ ...FADE, opacity: piece(walls, i, 4) }} className="motion-reduce:transition-none">
            <rect x="44" y={y} width="102" height="12.5" fill="#C97B5A" />
            <line x1="44" y1={y} x2="146" y2={y} stroke="#B4663F" strokeWidth="1" />
          </g>
        );
      })}

      {/* Roofing — IBR sheets drop on once the walls are up. */}
      <g style={{ ...FADE, opacity: roofIn, transform: `translateY(${(1 - roofIn) * -10}px)` }} className="motion-reduce:transition-none">
        <polygon points="36,66 95,32 154,66" fill="#475569" />
        <rect x="36" y="63" width="118" height="4" rx="2" fill="#334155" />
      </g>

      {/* Finishing — the door, then each window. */}
      <rect x="85" y="88" width="20" height="28" rx="1.5" fill="#0B1F3B"
        style={{ ...FADE, opacity: piece(finish, 0, 3) }} className="motion-reduce:transition-none" />
      <rect x="54" y="76" width="17" height="15" rx="1.5" fill="#BFDBFE" stroke="#0B1F3B" strokeWidth="1.5"
        style={{ ...FADE, opacity: piece(finish, 1, 3) }} className="motion-reduce:transition-none" />
      <rect x="119" y="76" width="17" height="15" rx="1.5" fill="#BFDBFE" stroke="#0B1F3B" strokeWidth="1.5"
        style={{ ...FADE, opacity: piece(finish, 2, 3) }} className="motion-reduce:transition-none" />

      {/* External works — the precast boundary wall, piece by piece. */}
      {[
        <rect key="lp" x="12" y="100" width="4" height="26" rx="1" fill="#94A3B8" />,
        <rect key="ln" x="16" y="102" width="14" height="24" fill="#E2E8F0" />,
        <rect key="r1" x="168" y="100" width="4" height="26" rx="1" fill="#94A3B8" />,
        <rect key="rn1" x="172" y="102" width="14" height="24" fill="#E2E8F0" />,
        <rect key="r2" x="186" y="100" width="4" height="26" rx="1" fill="#94A3B8" />,
        <rect key="rn2" x="190" y="102" width="14" height="24" fill="#E2E8F0" />,
        <rect key="r3" x="204" y="100" width="4" height="26" rx="1" fill="#94A3B8" />,
      ].map((el, i, all) => (
        <g key={el.key} style={{ ...FADE, opacity: piece(ext, i, all.length) }} className="motion-reduce:transition-none">{el}</g>
      ))}

      {/* Fully funded: a check lands over the roof. */}
      <g
        style={{
          transition: 'opacity 300ms ease, transform 400ms cubic-bezier(.34,1.56,.64,1)',
          opacity: complete ? 1 : 0,
          transform: complete ? 'scale(1)' : 'scale(0.4)',
          transformOrigin: '95px 18px',
        }}
        className="motion-reduce:transition-none"
        aria-hidden="true"
      >
        <circle cx="95" cy="18" r="9" fill="#16A34A" />
        <path d="M90.5 18.2l3 3 6-6.4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export default function HeroBudgetWidget() {
  // Empty until the first-view count-up (or, with reduced motion, straight
  // to the default), so the house can be seen building from nothing.
  const [budgetInput, setBudgetInput] = useState('');
  const tookOver = useRef(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Straight to the default, no count-up.
      const show = window.setTimeout(() => { if (!tookOver.current) setBudgetInput(DEFAULT_BUDGET); }, 0);
      return () => window.clearTimeout(show);
    }
    const target = Number(DEFAULT_BUDGET);
    let start: number | null = null;
    const step = (now: number) => {
      if (tookOver.current) return;
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / INTRO_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setBudgetInput(String(Math.round((target * eased) / 250) * 250));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    // A beat after the card has slid in.
    const timer = window.setTimeout(() => { frame.current = requestAnimationFrame(step); }, 650);
    // A tab in the background never runs frames; land on the default anyway.
    const fallback = window.setTimeout(() => {
      if (!tookOver.current && document.visibilityState === 'hidden') setBudgetInput(DEFAULT_BUDGET);
    }, 650 + INTRO_MS + 200);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const takeOver = () => {
    tookOver.current = true;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  };

  const parsedBudget = Number(budgetInput.replace(/[^0-9]/g, ''));
  const hasValidBudget = Number.isFinite(parsedBudget) && parsedBudget > 0;

  // Synchronous and cheap (~ms), so it can track every keystroke. Inputs match
  // the Budget Studio's defaults so hero and Studio agree.
  const estimate = useMemo(() => {
    if (!hasValidBudget) return null;
    return estimateStageReach({
      budgetUsd: parsedBudget,
      floorAreaM2: PLAN_AREA_M2,
      locationType: PLAN_LOCATION,
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
    takeOver();
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
          <span className="text-xs font-bold tracking-normal text-blue-600 uppercase">
            Budget reality check
          </span>
          <span className="text-xs font-semibold text-[var(--color-success-fg)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-full px-2 py-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
            Interactive estimate
          </span>
        </div>

        <div>
          <h3 className="text-sm md:text-base font-bold text-slate-900 leading-tight">
            How far will your money go?
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Type an amount — watch the house build itself.
          </p>

          {/* The size being costed was previously only in 9.5px grey type at the
              very bottom of the card. It is the single most important
              assumption behind every number above it, so it reads as a spec
              here instead of a disclaimer down there. */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[var(--color-info-fg)] bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded px-1.5 py-0.5 tabular-nums">
              {PLAN_AREA_M2}m²
            </span>
            <span className="text-xs font-semibold text-[var(--color-info-fg)] bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded px-1.5 py-0.5">
              {PLAN_BEDROOMS}-bed
            </span>
            <span className="text-xs font-semibold text-[var(--color-info-fg)] bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded px-1.5 py-0.5 capitalize">
              {PLAN_LOCATION}
            </span>
          </div>
        </div>

        {/* Keep the preview before the input visually and in the accessibility
            tree, so it remains visible when the mobile keyboard opens. */}
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="flex min-h-[116px] flex-shrink-0 items-center justify-center overflow-visible sm:min-h-28">
            <BuildingHouse coverage={coverage} complete={fullyFunded} />
          </div>

          <label className="block">
            <span className="sr-only">Your budget in US dollars</span>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-md px-3.5 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-400/20 transition">
              <span className="text-lg md:text-xl font-extrabold text-slate-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={(e) => handleInput(e.target.value)}
                onFocus={takeOver}
                onBlur={() => {
                  if (!hasValidBudget) return;
                  captureProductEvent('budget_entered', {
                    source: 'home_budget_widget',
                    budget_band: getBudgetBand(parsedBudget),
                    floor_area_m2: PLAN_AREA_M2,
                    location_category: PLAN_LOCATION,
                  });
                }}
                placeholder="Enter amount"
                className="w-full bg-transparent text-lg md:text-xl font-extrabold text-slate-900 outline-none placeholder:text-slate-300 tabular-nums"
              />
              <span className="text-xs font-bold uppercase tracking-normal text-slate-400 flex-shrink-0">USD</span>
            </div>
          </label>
        </div>

        {/* Stage coverage bars */}
        <div className="hidden sm:flex flex-1 flex-col justify-center gap-1.5 min-h-0">
          {(estimate?.rows ?? []).map((row, index) => {
            const pct = Math.round(row.coveragePercent);
            return (
              <div key={row.id} className="flex items-center gap-2.5">
                <span className="w-[92px] md:w-[104px] flex-shrink-0 text-xs font-semibold text-slate-600 truncate">
                  {STAGE_SHORT_LABELS[row.id]}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-success)] transition-all duration-500 motion-reduce:transition-none"
                    // In building order: each stage starts a moment after the one before.
                    style={{ width: `${pct}%`, transitionDelay: `${index * 70}ms` }}
                  />
                </div>
                <span className={`w-9 flex-shrink-0 text-right text-xs font-bold tabular-nums ${pct > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
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
              <CheckCircle size={16} weight="fill" className="text-[var(--color-success)] flex-shrink-0" aria-hidden="true" />
            )}
            <p
              // A new key when the reached stage changes replays the pop.
              key={fullyFunded ? 'full' : estimate?.reachableStageId ?? 'none'}
              className="hero-verdict text-sm font-semibold text-slate-800 leading-snug"
              aria-live="polite"
              aria-atomic="true"
            >
              {verdict}
            </p>
          </div>
          <Link
            href={hasValidBudget ? `/quick-budget?budget=${parsedBudget}` : '/quick-budget'}
            onClick={() => captureProductEvent('calculator_customized', {
              source: 'home_budget_widget',
              budget_band: hasValidBudget ? getBudgetBand(parsedBudget) : 'not_entered',
              floor_area_m2: PLAN_AREA_M2,
              location_category: PLAN_LOCATION,
            })}
            className="flex-shrink-0 inline-flex items-center gap-1 text-xs md:text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
          >
            Customize <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        {/* The spec itself now sits under the heading, so this is only the
            caveat and the way out of it. */}
        <p className="hidden sm:block text-xs text-slate-400 leading-snug">
          Materials only, standard finish. Adjust size, location and finish in the Budget Studio.
        </p>
      </div>
      <style>{`
        .hero-verdict { animation: hero-verdict-pop 320ms ease-out; }
        @keyframes hero-verdict-pop {
          from { opacity: 0.2; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) { .hero-verdict { animation: none; } }
      `}</style>
    </div>
  );
}
