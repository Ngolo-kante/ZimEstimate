'use client';

import { useMemo } from 'react';
import { CaretDown, DownloadSimple, ShareNetwork, WarningCircle } from '@phosphor-icons/react';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import { calculateBoqHealth } from '@/lib/boqHealth';

function formatMissingItem(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAmount(amountUsd: number, currency: 'USD' | 'ZWG', exchangeRate: number) {
  if (currency === 'ZWG') {
    return `ZiG ${(amountUsd * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  return `$${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function LiveEstimatePanel() {
  const { currency, setCurrency, exchangeRate } = useCurrency();
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
      <div className="border-b border-slate-100 px-5 py-5">
        <p className="text-xs uppercase tracking-widest wiz-text-muted">Total Estimate</p>
        <p data-testid="live-total" className="mt-1 text-3xl font-semibold wiz-text-primary">
          {formatAmount(totalUsd, currency, exchangeRate)}
        </p>
        <p className="mt-1 text-xs wiz-text-muted">
          {currency === 'USD'
            ? formatAmount(totalUsd, 'ZWG', exchangeRate)
            : formatAmount(totalUsd, 'USD', exchangeRate)}
        </p>

        <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`rounded px-3 py-1 text-xs font-medium ${currency === 'USD' ? 'bg-white wiz-text-primary shadow-sm' : 'text-slate-600'}`}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => setCurrency('ZWG')}
            className={`rounded px-3 py-1 text-xs font-medium ${currency === 'ZWG' ? 'bg-white wiz-text-primary shadow-sm' : 'text-slate-600'}`}
          >
            ZWG
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Estimate Health</span>
            <span data-testid="live-health" className="font-semibold wiz-text-primary">
              {health.weightedScorePct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, health.weightedScorePct))}%`, backgroundColor: 'var(--wiz-jade)' }}
            />
          </div>
          <p className="mt-1 text-xs wiz-text-muted">{health.statusMessage}</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Cost Breakdown</p>
          <div className="space-y-2">
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
        </div>

        {health.missingCriticalItemIds.length > 0 && (
          <div className="wiz-alert wiz-alert--warn">
            <WarningCircle size={16} className="wiz-alert__icon" />
            <div>
              <p className="font-bold">Missing Critical Items</p>
              <p className="mt-0.5 opacity-90">
                {health.missingCriticalItemIds.slice(0, 5).map(formatMissingItem).join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={openReview}
          className="wiz-btn-primary flex justify-center !text-sm !py-2.5"
        >
          View Full BOQ
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={exportEstimate}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <DownloadSimple size={14} /> Export
          </button>
          <button
            type="button"
            onClick={() => void shareEstimate()}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ShareNetwork size={14} /> Share
          </button>
        </div>
      </div>
    </aside>
  );
}
