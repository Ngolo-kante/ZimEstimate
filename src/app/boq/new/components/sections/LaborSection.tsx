'use client';

import { LABOR_SUBSTAGES, cleanLaborRates, defaultLaborRate, formatLaborRate, hasCustomLaborRates, laborRateFor, laborRateUnit, maxLaborRate, type LaborRates, type LaborSubstageId } from '@/lib/calculations/laborSubstages';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const STAGES = [
  { id: 'substructure', label: 'Substructure' },
  { id: 'superstructure', label: 'Superstructure' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'services', label: 'Plumbing & electrical' },
  { id: 'exterior', label: 'Exterior works' },
] as const;

const dollars = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LaborSection() {
  const { projectScope, selectedStages, milestonesState, projectDetails, updateProjectDetails } = useBoqWizardStore();
  const rates = cleanLaborRates(projectDetails.laborRates);
  const setRate = (trade: LaborSubstageId, value: number) => {
    const next: LaborRates = { ...rates };
    const clamped = Math.min(maxLaborRate(trade), Math.max(0, value));
    if (clamped === defaultLaborRate(trade)) delete next[trade];
    else next[trade] = clamped;
    updateProjectDetails({ laborRates: next });
  };
  const activeStages = STAGES.filter((stage) => projectScope === 'entire' || selectedStages.includes(stage.id));
  const tradeCosts = new Map(milestonesState.flatMap((milestone) => milestone.items)
    .filter((item) => item.materialId.startsWith('labor-'))
    .map((item) => [item.materialId, (item.quantity || 0) * item.actualPriceUsd]));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-base font-bold text-slate-900">Labour by trade</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          Priced the way builders quote: per m² of floor for building, plastering and roofing, per m² tiled, per metre of boundary wall; plumbing, electrical, painting and paving as a share of their materials. Change any trade to match your quote.
        </p>
        {hasCustomLaborRates(rates) && (
          <button type="button" onClick={() => updateProjectDetails({ laborRates: {} })} className="mt-2 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
            Reset all to the recommended rates
          </button>
        )}
      </div>
      {activeStages.map((stage) => {
        const substages = LABOR_SUBSTAGES.filter((substage) => substage.stage === stage.id);
        const stageLabour = substages.reduce((sum, substage) => sum + (tradeCosts.get(`labor-${substage.id}`) || 0), 0);
        return (
          <section key={stage.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
              <h4 className="text-sm font-bold text-slate-900">{stage.label}</h4>
              <span className="text-sm text-slate-600">Labour <strong className="text-slate-900">{dollars(stageLabour)}</strong></span>
            </div>
            <div className="divide-y divide-slate-100">
              {substages.map((substage) => {
                const rate = laborRateFor(substage.id, rates);
                return (
                  <div key={substage.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{substage.label}</p>
                      <p className="text-xs text-slate-500">{substage.includes}</p>
                      <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">Where this rate comes from</summary>{substage.source}</details>
                    </div>
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <label className="flex items-center gap-1">
                        <span className="sr-only">{substage.label} labour rate</span>
                        {substage.basis !== 'percent' && <span>$</span>}
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={maxLaborRate(substage.id)}
                          step={substage.basis === 'percent' ? 1 : 0.1}
                          title={formatLaborRate(substage.id, rate)}
                          value={rate}
                          onChange={(event) => setRate(substage.id, Number(event.target.value) || 0)}
                          className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <span>{laborRateUnit(substage.id)}</span>
                      </label>
                      <strong className="shrink-0 text-right text-sm text-slate-900">{dollars(tradeCosts.get(`labor-${substage.id}`) || 0)}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="text-xs leading-5 text-slate-500">Labour is a planning allowance based on the work and priced materials. Check subcontractor quotations, site conditions and materials with missing prices before relying on the total.</p>
    </div>
  );
}
