'use client';

import { useMemo } from 'react';
import { ChartPieSlice } from '@phosphor-icons/react';
import CostDonut, { COST_COLORS } from '@/components/ui/CostDonut';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem } from '@/lib/database.types';

/** The saved estimate split into materials, labour and fees — the same split the BOQ review shows. */
export function splitProjectCosts(items: Pick<BOQItem, 'category' | 'quantity' | 'unit_price_usd'>[]) {
  const split = { materials: 0, labor: 0, fees: 0 };
  for (const item of items) {
    const amount = (Number(item.quantity) || 0) * (Number(item.unit_price_usd) || 0);
    if (item.category === 'labor') split.labor += amount;
    else if (item.category === 'project_fees') split.fees += amount;
    else split.materials += amount;
  }
  return split;
}

export default function ProjectCostSplit({ items, spentUsd }: { items: BOQItem[]; spentUsd: number }) {
  const { formatPrice, exchangeRate } = useCurrency();
  const split = useMemo(() => splitProjectCosts(items), [items]);
  const total = split.materials + split.labor + split.fees;
  if (total <= 0) return null;
  const format = (usd: number) => formatPrice(usd, usd * exchangeRate);

  return (
    <section className="overview-card reveal" data-delay="4" aria-labelledby="project-cost-split-title">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <ChartPieSlice size={24} weight="duotone" />
        </div>
        <div>
          <h3 id="project-cost-split-title" className="font-heading text-lg font-bold text-primary">Where the budget goes</h3>
          <p className="text-sm text-secondary">{spentUsd > 0 ? `${format(spentUsd)} spent so far of ${format(total)}` : 'Your estimate by type of cost'}</p>
        </div>
      </div>
      <CostDonut
        format={format}
        centerLabel="Estimate"
        slices={[
          { label: 'Materials & works', value: split.materials, color: COST_COLORS.materials },
          { label: 'Labour', value: split.labor, color: COST_COLORS.labor },
          { label: 'Professional & council fees', value: split.fees, color: COST_COLORS.fees },
        ]}
        hideEmpty
      />
    </section>
  );
}
