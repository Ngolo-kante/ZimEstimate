'use client';

import { useEffect, useState } from 'react';
import { ChartLineUp } from '@phosphor-icons/react';
import { getDemandStats, type DemandStats } from '@/lib/services/demandStats';

/**
 * Real activity figures above a registration form, so the effort being asked
 * for has something on the other side of it.
 *
 * Deliberate rule: never invent or round up, and show nothing at all when the
 * numbers are too small to be worth showing. A quiet marketplace advertising
 * "0 quote requests this month" is worse than a page that says nothing, and a
 * padded number is worse than both — a supplier who signs up on the strength of
 * an inflated figure churns immediately and tells other suppliers why.
 */
const MIN_TO_SHOW = 3;

interface DemandProofProps {
  audience: 'supplier' | 'contractor';
  className?: string;
}

export default function DemandProof({ audience, className = '' }: DemandProofProps) {
  const [stats, setStats] = useState<DemandStats | null>(null);

  useEffect(() => {
    let active = true;
    getDemandStats().then((result) => {
      if (active) setStats(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!stats) return null;

  // Suppliers are chosen through quote and contact requests; contractors are
  // found by people planning a build, so each sees the demand that reaches it.
  const headline =
    audience === 'supplier'
      ? stats.quoteRequests30d + stats.contactRequests30d
      : stats.projects30d;

  if (headline < MIN_TO_SHOW) return null;

  const noun = audience === 'supplier' ? 'quote and contact requests' : 'projects estimated';
  const peers =
    audience === 'supplier'
      ? `${stats.activeSuppliers} supplier${stats.activeSuppliers === 1 ? '' : 's'}`
      : `${stats.listedContractors} contractor${stats.listedContractors === 1 ? '' : 's'}`;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 ${className}`}
    >
      <ChartLineUp size={18} weight="duotone" className="mt-0.5 flex-shrink-0 text-emerald-600" />
      <p className="text-xs leading-relaxed text-emerald-900">
        <strong className="font-bold">
          {headline} {noun}
        </strong>{' '}
        on ZimEstimate in the last 30 days
        {stats.listedContractors + stats.activeSuppliers > 0 && <>, across {peers} listed</>}.
      </p>
    </div>
  );
}
