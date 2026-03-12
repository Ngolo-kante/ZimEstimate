'use client';

import { useMemo } from 'react';
import { Sparkle, Plus, CaretDown } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import { useCurrency } from '@/components/ui/CurrencyToggle';

const LABELS: Record<string, string> = {
  substructure: 'Substructure',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  finishing: 'Finishing',
  exterior: 'Exterior',
  labor: 'Labor',
};

function toCurrency(amount: number, currency: 'USD' | 'ZWG', exchangeRate: number) {
  if (currency === 'ZWG') {
    return `ZiG ${(amount * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function BOQTable() {
  const milestonesState = useBoqWizardStore((state) => state.milestonesState);
  const projectScope = useBoqWizardStore((state) => state.projectScope);
  const selectedStages = useBoqWizardStore((state) => state.selectedStages);
  const laborType = useBoqWizardStore((state) => state.laborType);
  const {
    toggleMilestoneExpanded,
    updateMilestoneItemQuantity,
    updateMilestoneItem,
    addMilestoneItem,
  } = useBoqWizardStore();

  const milestones = useMemo(() => {
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

  const { currency, exchangeRate } = useCurrency();

  const totals = useMemo(() => {
    return milestones.reduce((sum, milestone) => {
      return sum + milestone.items.reduce((rowSum, item) => rowSum + ((item.quantity || 0) * item.actualPriceUsd), 0);
    }, 0);
  }, [milestones]);

  const addCustomItem = (milestoneId: string) => {
    const id = `custom-${milestoneId}-${Date.now()}`;
    addMilestoneItem(milestoneId, {
      id,
      materialId: id,
      materialName: 'Custom Material',
      quantity: 1,
      calculatedQuantity: 1,
      unit: 'each',
      averagePriceUsd: 0,
      averagePriceZwg: 0,
      actualPriceUsd: 0,
      actualPriceZwg: 0,
      category: milestoneId,
      isOverridden: true,
    });
  };

  const addAiSuggestion = (milestoneId: string) => {
    const id = `ai-${milestoneId}-${Date.now()}`;
    addMilestoneItem(milestoneId, {
      id,
      materialId: `${milestoneId}-allowance`,
      materialName: `${LABELS[milestoneId] || milestoneId} Allowance`,
      quantity: 1,
      calculatedQuantity: 1,
      unit: 'lot',
      averagePriceUsd: 150,
      averagePriceZwg: 4500,
      actualPriceUsd: 150,
      actualPriceZwg: 4500,
      description: 'AI suggested placeholder line item',
      category: milestoneId,
      isOverridden: true,
    });
  };

  return (
    <div className="space-y-4">
      {milestones.map((milestone) => {
        const milestoneTotal = milestone.items.reduce((sum, item) => sum + ((item.quantity || 0) * item.actualPriceUsd), 0);

        return (
          <section key={milestone.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => toggleMilestoneExpanded(milestone.id)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
              >
                <CaretDown className={`h-4 w-4 transition-transform ${milestone.expanded ? 'rotate-180' : ''}`} />
                {LABELS[milestone.id] || milestone.id}
                <span className="text-xs font-normal text-slate-500">({milestone.items.length})</span>
              </button>

              <div className="text-right">
                <p className="text-xs text-slate-500">Milestone Total</p>
                <p className="text-sm font-semibold text-slate-900">{toCurrency(milestoneTotal, currency, exchangeRate)}</p>
              </div>
            </header>

            {milestone.expanded && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Material</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                      <th className="px-4 py-2 text-left">Unit</th>
                      <th className="px-4 py-2 text-left">Unit Price</th>
                      <th className="px-4 py-2 text-left">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestone.items.map((item) => {
                      const lineTotal = (item.quantity || 0) * item.actualPriceUsd;
                      const isOverridden = Boolean(item.isOverridden) || item.quantity !== item.calculatedQuantity;

                      return (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.materialName}
                              onChange={(event) =>
                                updateMilestoneItem(milestone.id, item.id, {
                                  materialName: event.target.value,
                                  isOverridden: true,
                                })
                              }
                              className="w-full rounded border border-transparent px-2 py-1 text-sm outline-none focus:border-slate-300"
                            />
                            {isOverridden && (
                              <p className="text-[11px] text-amber-600">Manual override</p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.quantity ?? ''}
                              onChange={(event) => updateMilestoneItemQuantity(milestone.id, item.id, Number(event.target.value) || 0)}
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2 text-slate-600">{item.unit}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.actualPriceUsd}
                              onChange={(event) =>
                                updateMilestoneItem(milestone.id, item.id, {
                                  actualPriceUsd: Number(event.target.value) || 0,
                                  isOverridden: true,
                                })
                              }
                              className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2 font-medium text-slate-800">{toCurrency(lineTotal, currency, exchangeRate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
                  <button
                    type="button"
                    onClick={() => addCustomItem(milestone.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={12} /> Add Material
                  </button>
                  <button
                    type="button"
                    onClick={() => addAiSuggestion(milestone.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <Sparkle size={12} /> AI Generate
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      <div className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <p className="text-xs uppercase tracking-wider text-slate-300">Grand Total</p>
        <p className="text-xl font-semibold">{toCurrency(totals, currency, exchangeRate)}</p>
      </div>
    </div>
  );
}
