'use client';

import { useMemo } from 'react';
import { CaretDown, DownloadSimple, ShareNetwork, WarningCircle } from '@phosphor-icons/react';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import { calculateBoqHealth } from '@/lib/boqHealth';

function formatAmount(amountUsd: number, currency: 'USD' | 'ZWG', exchangeRate: number) {
  if (currency === 'ZWG') {
    return `ZiG ${(amountUsd * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  return `$${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function LiveEstimatePanel() {
  const { currency, exchangeRate } = useCurrency();
  const milestonesState = useBoqWizardStore((state) => state.milestonesState);
  const projectScope = useBoqWizardStore((state) => state.projectScope);
  const selectedStages = useBoqWizardStore((state) => state.selectedStages);
  const laborType = useBoqWizardStore((state) => state.laborType);
  const toggleMilestoneExpanded = useBoqWizardStore((state) => state.toggleMilestoneExpanded);

  const visibleMilestones = useMemo(() => {
    return milestonesState.filter((milestone) => {
      if (milestone.id === 'labor') {
        return laborType === 'materials_labor';
      }

      if (projectScope === 'stage') {
        return selectedStages.includes(milestone.id);
      }

      return true;
    });
  }, [milestonesState, projectScope, selectedStages, laborType]);

  const totalUsd = useMemo(() => {
    return visibleMilestones.reduce((total, milestone) => {
      return total + milestone.items.reduce((sum, item) => sum + ((item.quantity || 0) * item.actualPriceUsd), 0);
    }, 0);
  }, [visibleMilestones]);

  const health = useMemo(() => {
    const healthMilestones = visibleMilestones.filter(
      (milestone): milestone is typeof milestone & { id: 'substructure' | 'superstructure' | 'roofing' | 'finishing' | 'exterior' } =>
        milestone.id !== 'labor'
    );

    const inputs = healthMilestones
      .map((milestone) => ({
        category: milestone.id,
        itemIdsWithQty: milestone.items
          .filter((item) => (item.quantity || 0) > 0)
          .map((item) => item.materialId),
      }));

    return calculateBoqHealth(inputs);
  }, [visibleMilestones]);

  const breakdown = useMemo(() => {
    return visibleMilestones.map((milestone) => {
      const total = milestone.items.reduce((sum, item) => sum + ((item.quantity || 0) * item.actualPriceUsd), 0);
      return {
        id: milestone.id,
        label: milestone.label || milestone.id,
        total,
        expanded: milestone.expanded,
        items: milestone.items,
      };
    });
  }, [visibleMilestones]);

  const openReview = () => {
    const review = document.getElementById('boq-review');
    if (review) {
      review.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const exportEstimate = () => {
    window.print();
  };

  const shareEstimate = async () => {
    const shareText = `Live BOQ estimate: ${formatAmount(totalUsd, currency, exchangeRate)}`;

    if (navigator.share) {
      await navigator.share({
        title: 'ZimEstimate BOQ',
        text: shareText,
        url: window.location.href,
      });
      return;
    }

    await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
  };

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ── Header: Total + Export/Share buttons ─────────────────── */}
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest wiz-text-muted">Total Estimate</p>
            <p data-testid="live-total" className="mt-1 text-3xl font-semibold wiz-text-primary">
              {formatAmount(totalUsd, currency, exchangeRate)}
            </p>
          </div>

          {/* Export & Share — top right */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={exportEstimate}
              title="Export estimate"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <DownloadSimple size={16} />
            </button>
            <button
              type="button"
              onClick={() => void shareEstimate()}
              title="Share estimate"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <ShareNetwork size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* ── Compact health bar ──────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-slate-500">Estimate Health</span>
          <span data-testid="live-health" className="font-semibold wiz-text-primary">
            {health.weightedScorePct.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, health.weightedScorePct))}%`,
              backgroundColor: health.weightedScorePct >= 70 ? '#3B82F6' : health.weightedScorePct >= 40 ? '#F59E0B' : '#EF4444',
            }}
          />
        </div>
        {health.missingCriticalItemIds.length > 0 && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-600">
            <WarningCircle size={12} className="mt-0.5 flex-shrink-0" />
            <span>{health.missingCriticalItemIds.length} critical items missing</span>
          </div>
        )}
      </div>

      {/* ── Cost Breakdown ──────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Cost Breakdown</p>
        {breakdown.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => toggleMilestoneExpanded(row.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left"
            >
              <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                <CaretDown className={`h-3 w-3 transition-transform ${row.expanded ? 'rotate-180' : ''}`} />
                {row.label}
              </span>
              <span className="text-sm font-semibold wiz-text-primary">{formatAmount(row.total, currency, exchangeRate)}</span>
            </button>
            {row.expanded && (
              <div className="space-y-1 border-t border-slate-200 px-3 py-2">
                {row.items.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="truncate pr-3">{item.materialName}</span>
                    <span>{formatAmount((item.quantity || 0) * item.actualPriceUsd, currency, exchangeRate)}</span>
                  </div>
                ))}
                {row.items.length > 5 && (
                  <p className="text-[11px] wiz-text-muted">+{row.items.length - 5} more items</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── View Full BOQ button ─────────────────────────────────── */}
      <div className="border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={openReview}
          className="wiz-btn-primary flex w-full justify-center !text-sm !py-2.5"
        >
          View Full BOQ
        </button>
      </div>
    </aside>
  );
}
