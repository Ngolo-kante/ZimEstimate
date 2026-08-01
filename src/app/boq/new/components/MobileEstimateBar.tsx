'use client';

import { ReactNode, useMemo, useState } from 'react';
import { CaretUp, X } from '@phosphor-icons/react';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import { calculateBoqHealth } from '@/lib/boqHealth';

interface MobileEstimateBarProps {
  children: ReactNode;
  className?: string;
}

export default function MobileEstimateBar({ children, className = '' }: MobileEstimateBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { currency, exchangeRate } = useCurrency();

  const milestonesState = useBoqWizardStore((state) => state.milestonesState);
  const projectScope = useBoqWizardStore((state) => state.projectScope);
  const selectedStages = useBoqWizardStore((state) => state.selectedStages);
  const laborType = useBoqWizardStore((state) => state.laborType);

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

  const totalLabel = useMemo(() => {
    if (currency === 'ZWG') {
      return `ZiG ${(totalUsd * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }

    return `$${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [currency, exchangeRate, totalUsd]);

  return (
    <>
      {/* Sits above the wizard's navigation footer rather than on top of it.
          Both were fixed to bottom-0, and at z-110 against the footer's
          z-50 this bar covered Back and Continue completely on a phone —
          the wizard looked like it had no way forward. 68px is the
          footer's height. */}
      <div className={`fixed inset-x-0 bottom-[68px] z-[110] border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur ${className}`}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Live Estimate</p>
            <p className="text-lg font-semibold text-slate-900">{totalLabel}</p>
            <p className="text-xs text-slate-500">Health {health.weightedScorePct.toFixed(0)}%</p>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            View Details
            <CaretUp size={14} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Estimate Breakdown</p>
                <p className="text-xs text-slate-500">Total {totalLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500"
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[calc(85vh-60px)] overflow-y-auto p-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
