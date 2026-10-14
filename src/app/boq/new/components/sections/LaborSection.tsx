'use client';

import { LABOR_SUBSTAGES, DEFAULT_LABOR_PERCENTAGE, effectiveLaborPercentage, laborSubstageFor } from '@/lib/calculations/laborSubstages';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const STAGES = [
  { id: 'substructure', label: 'Substructure' },
  { id: 'superstructure', label: 'Superstructure' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'exterior', label: 'Exterior works' },
] as const;

export default function LaborSection() {
  const { projectScope, selectedStages, laborPercentages, setLaborPercentage, milestonesState } = useBoqWizardStore();
  const activeStages = STAGES.filter((stage) => projectScope === 'entire' || selectedStages.includes(stage.id));
  const materialsBySubstage = new Map<string, number>();

  for (const milestone of milestonesState) {
    if (milestone.id === 'labor') continue;
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
        <h3 className="text-base font-bold text-slate-900">Labour by work sub-stage</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">Each allowance is a percentage of that sub-stage&apos;s material cost. {DEFAULT_LABOR_PERCENTAGE}% is a Zimbabwe planning starting point, not a contractor quote. Adjust any row to match your local rates.</p>
      </div>
      {activeStages.map((stage) => (
        <section key={stage.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h4 className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 sm:px-5">{stage.label}</h4>
          <div className="divide-y divide-slate-100">
            {LABOR_SUBSTAGES.filter((substage) => substage.stage === stage.id).map((substage) => {
              const rate = effectiveLaborPercentage(laborPercentages, substage.id);
              const materialCost = materialsBySubstage.get(substage.id) || 0;
              return (
                <div key={substage.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:px-5">
                  <div className="min-w-0">
                    <label htmlFor={`labor-${substage.id}`} className="block text-sm font-semibold text-slate-800">{substage.label}</label>
                    <p className="text-xs text-slate-500">Materials ${materialCost.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input id={`labor-${substage.id}`} type="number" min="0" max="100" step="0.5" value={rate}
                      onChange={(event) => setLaborPercentage(substage.id, Number(event.target.value) || 0)}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-right text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  <strong className="col-span-2 text-right text-sm text-slate-900 sm:col-span-1 sm:w-24">${(materialCost * rate / 100).toFixed(2)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-xs leading-5 text-slate-500">Labour is a planning allowance based on priced materials. Check subcontractor quotations, site conditions and materials with missing prices before relying on the total.</p>
    </div>
  );
}
