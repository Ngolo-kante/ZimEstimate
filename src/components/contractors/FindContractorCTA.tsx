'use client';

import Link from 'next/link';
import { ArrowRight, UsersThree } from '@phosphor-icons/react';
import { CONTRACTOR_TRADES, ZIMBABWE_SERVICE_AREAS } from './constants';

/**
 * The step after "here is what it costs" is "who builds it". Before this the
 * contractor directory was reachable only from the top nav, so the moment a
 * user most needs a builder — the estimate they just finished — offered them
 * nothing, and being listed in the directory was worth correspondingly little.
 *
 * Trades come from CONTRACTOR_TRADES so the link lands on a filter the
 * directory can actually apply; anything unmapped just opens it unfiltered.
 */
const TRADE_BY_PROJECT_TYPE: Record<string, string> = {
  solar: 'Solar installation',
  borehole: 'Borehole installation',
  paving: 'Paving',
  fencing: 'Brickwork',
  water: 'Plumbing',
  septic: 'General contractor',
  house: 'General contractor',
};

export function contractorSearchHref(projectType?: string, area?: string): string {
  const params = new URLSearchParams();

  const trade = projectType ? TRADE_BY_PROJECT_TYPE[projectType] : undefined;
  if (trade && CONTRACTOR_TRADES.includes(trade)) params.set('trade', trade);

  // Estimates carry loose location strings ("Harare", "urban"). Only pass one
  // through when it matches a real service area, or the directory filters the
  // list down to nothing.
  if (area) {
    const matched = ZIMBABWE_SERVICE_AREAS.find(
      (serviceArea) => serviceArea.toLowerCase() === area.trim().toLowerCase()
    );
    if (matched) params.set('area', matched);
  }

  const query = params.toString();
  return query ? `/contractors?${query}` : '/contractors';
}

interface FindContractorCTAProps {
  /** ProjectType, or 'house' for the whole-build estimator. */
  projectType?: string;
  /** Free-text location from the estimate; ignored unless it names a service area. */
  area?: string;
  className?: string;
}

export default function FindContractorCTA({ projectType, area, className = '' }: FindContractorCTAProps) {
  const tradeLabel = projectType ? TRADE_BY_PROJECT_TYPE[projectType] : undefined;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <UsersThree size={20} weight="duotone" className="mt-0.5 flex-shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-bold text-slate-900">Ready to build this?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            {tradeLabel
              ? `Browse listed ${tradeLabel.toLowerCase()} contractors and send them these quantities.`
              : 'Browse listed contractors and send them these quantities.'}
          </p>
        </div>
      </div>
      <Link
        href={contractorSearchHref(projectType, area)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Find a contractor
        <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  );
}
