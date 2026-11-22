'use client';

import { isLaborCategory } from '@/lib/calculations/laborSubstages';
import { useMemo } from 'react';
import { ChartPieSlice } from '@phosphor-icons/react';
import { COST_COLORS } from '@/components/ui/CostDonut';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem } from '@/lib/database.types';
import { isExtrasLabourLine } from '@/lib/projectFees';

/** The saved estimate split into materials, labour and fees — the same split the BOQ review shows. */
export function splitProjectCosts(items: Pick<BOQItem, 'category' | 'quantity' | 'unit_price_usd' | 'material_id'>[]) {
  const split = { materials: 0, labor: 0, fees: 0 };
  for (const item of items) {
    const amount = (Number(item.quantity) || 0) * (Number(item.unit_price_usd) || 0);
    if (isLaborCategory(item.category) || isExtrasLabourLine(item.material_id)) split.labor += amount;
    else if (item.category === 'project_fees') split.fees += amount;
    else split.materials += amount;
  }
  return split;
}

export default function ProjectCostSplit({ items, spentUsd, idSuffix = '' }: { items: BOQItem[]; spentUsd: number; /** Keeps heading ids unique when shown on two tabs. */ idSuffix?: string }) {
  const { formatPrice, exchangeRate } = useCurrency();
  const split = useMemo(() => splitProjectCosts(items), [items]);
  const total = split.materials + split.labor + split.fees;
  if (total <= 0) return null;
  const format = (usd: number) => formatPrice(usd, usd * exchangeRate);
  const slices = [
    { label: 'Materials & works', value: split.materials, color: COST_COLORS.materials },
    { label: 'Labour', value: split.labor, color: COST_COLORS.labor },
    { label: 'Professional & council fees', value: split.fees, color: COST_COLORS.fees },
  ].filter(slice => slice.value > 0);

  return (
    // One stacked bar and a row per cost type: reads faster on a phone than a donut.
    <section className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 sm:p-6 shadow-[0_2px_6px_rgb(11_25_46/5%)]" aria-labelledby={`project-cost-split-title${idSuffix}`}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#f1f5f9] text-[var(--color-primary)]">
          <ChartPieSlice size={22} weight="duotone" />
        </div>
        <div className="min-w-0">
          <h3 id={`project-cost-split-title${idSuffix}`} className="font-heading text-lg font-bold text-primary">Where the budget goes</h3>
          <p className="text-sm text-secondary tabular-nums">{spentUsd > 0 ? `${format(spentUsd)} spent so far of ${format(total)}` : 'Your estimate by type of cost'}</p>
        </div>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-border-light)]" role="img"
        aria-label={slices.map(slice => `${slice.label} ${Math.round((slice.value / total) * 100)}%`).join(', ')}>
        {slices.map(slice => (
          <div key={slice.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(slice.value / total) * 100}%`, background: slice.color }} />
        ))}
      </div>
      <dl className="mt-4 divide-y divide-[var(--color-border-light)]">
        {slices.map(slice => (
          <div key={slice.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <dt className="flex min-w-0 items-center gap-2 text-secondary">
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: slice.color }} aria-hidden="true" />
              {slice.label} <span className="tabular-nums">({Math.round((slice.value / total) * 100)}%)</span>
            </dt>
            <dd className="font-semibold text-primary tabular-nums">{format(slice.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
