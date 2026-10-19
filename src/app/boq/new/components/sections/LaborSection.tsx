'use client';

import { LABOR_SUBSTAGES, MAX_LABOR_PERCENTAGE, STAGE_LABOR_PERCENTAGES, defaultLaborPercentage, hasCustomLaborRates, laborPercentageFor, laborSubstageFor, type LaborRates, type LaborSubstageId } from '@/lib/calculations/laborSubstages';
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
  const rates = projectDetails.laborRates;
  // Each trade has its own rate. A stage-wide rate from an older project is
  // folded into its trades the first time one of them is changed.
  const setRate = (trade: LaborSubstageId, value: number) => {
    const next: LaborRates = { ...(rates ?? {}) };
    const substage = LABOR_SUBSTAGES.find((entry) => entry.id === trade)!;
    const stageRate = next[substage.stage];
    if (stageRate !== undefined) {
      for (const sibling of LABOR_SUBSTAGES) if (sibling.stage === substage.stage && next[sibling.id] === undefined) next[sibling.id] = stageRate;
      delete next[substage.stage];
    }
    const clamped = Math.min(MAX_LABOR_PERCENTAGE, Math.max(0, value));
    if (clamped === defaultLaborPercentage(trade)) delete next[trade];
    else next[trade] = clamped;
    updateProjectDetails({ laborRates: next });
  };
  const activeStages = STAGES.filter((stage) => projectScope === 'entire' || selectedStages.includes(stage.id));
  const materialsBySubstage = new Map<string, number>();

  for (const milestone of milestonesState) {
    if (milestone.id === 'labor' || milestone.id === 'project_fees') continue;
    for (const item of milestone.items) {
      const substage = laborSubstageFor({
        category: milestone.id,
        materialId: item.materialId,
        materialName: item.materialName,
        calculationNote: item.description,
      });
      if (substage) materialsBySubstage.set(substage, (materialsBySubstage.get(substage) || 0) + (item.quantity || 0) * item.actualPriceUsd);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h3 className="text-base font-bold text-slate-900">Labour by trade</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          Labour is a percentage of each trade&apos;s material cost. Most trades start at {STAGE_LABOR_PERCENTAGES.substructure}%, a Zimbabwe rule of thumb.
          From builders&apos; rates, plastering starts at {defaultLaborPercentage('plaster')}% and boundary walls at {defaultLaborPercentage('boundary')}% (cheap materials, a lot of work),
          and roofing at {defaultLaborPercentage('roof_cover')}%. Change any trade to match your quote.
        </p>
        {hasCustomLaborRates(rates) && (
          <button type="button" onClick={() => updateProjectDetails({ laborRates: {} })} className="mt-2 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
            Reset all to the recommended rates
          </button>
        )}
      </div>
      {activeStages.map((stage) => {
        const substages = LABOR_SUBSTAGES.filter((substage) => substage.stage === stage.id);
        const stageLabour = substages.reduce((sum, substage) => sum + (materialsBySubstage.get(substage.id) || 0) * laborPercentageFor(substage.id, rates) / 100, 0);
        return (
          <section key={stage.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
              <h4 className="text-sm font-bold text-slate-900">{stage.label}</h4>
              <span className="text-sm text-slate-600">Labour <strong className="text-slate-900">{dollars(stageLabour)}</strong></span>
            </div>
            <div className="divide-y divide-slate-100">
              {substages.map((substage) => {
                const materialCost = materialsBySubstage.get(substage.id) || 0;
                const rate = laborPercentageFor(substage.id, rates);
                return (
                  <div key={substage.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{substage.label}</p>
                      <p className="text-xs text-slate-500">Materials {dollars(materialCost)}</p>
                    </div>
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      <label className="flex items-center gap-1">
                        <span className="sr-only">{substage.label} labour percentage</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={MAX_LABOR_PERCENTAGE}
                          step={1}
                          value={rate}
                          onChange={(event) => setRate(substage.id, Number(event.target.value) || 0)}
                          className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <span>%</span>
                      </label>
                      <strong className="w-20 shrink-0 text-right text-sm text-slate-900">{dollars(materialCost * rate / 100)}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="text-xs leading-5 text-slate-500">Labour is a planning allowance based on priced materials. Check subcontractor quotations, site conditions and materials with missing prices before relying on the total.</p>
    </div>
  );
}
