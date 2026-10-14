'use client';

import { LABOR_SUBSTAGES, STAGE_LABOR_PERCENTAGES, laborSubstageFor } from '@/lib/calculations/laborSubstages';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const STAGES = [
  { id: 'substructure', label: 'Substructure' },
  { id: 'superstructure', label: 'Superstructure' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'exterior', label: 'Exterior works' },
] as const;

const dollars = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LaborSection() {
  const { projectScope, selectedStages, milestonesState } = useBoqWizardStore();
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
        <h3 className="text-base font-bold text-slate-900">Labour by stage</h3>
        <p className="mt-1 text-sm leading-6 text-slate-700">Labour is a fixed percentage of each stage&apos;s material cost, a Zimbabwe planning rule of thumb rather than a contractor quote. To use your builder&apos;s price, edit the labour lines in the BOQ review.</p>
      </div>
      {activeStages.map((stage) => {
        const rate = STAGE_LABOR_PERCENTAGES[stage.id];
        const substages = LABOR_SUBSTAGES.filter((substage) => substage.stage === stage.id);
        const stageMaterials = substages.reduce((sum, substage) => sum + (materialsBySubstage.get(substage.id) || 0), 0);
        return (
          <section key={stage.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
              <h4 className="text-sm font-bold text-slate-900">{stage.label}</h4>
              <span className="text-sm text-slate-600"><strong className="text-slate-900">{rate}%</strong> of materials · {dollars(stageMaterials * rate / 100)}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {substages.map((substage) => {
                const materialCost = materialsBySubstage.get(substage.id) || 0;
                return (
                  <div key={substage.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{substage.label}</p>
                      <p className="text-xs text-slate-500">Materials {dollars(materialCost)}</p>
                    </div>
                    <strong className="shrink-0 text-sm text-slate-900">{dollars(materialCost * rate / 100)}</strong>
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
