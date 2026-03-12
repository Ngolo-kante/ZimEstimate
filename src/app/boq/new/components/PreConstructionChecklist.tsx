'use client';

import { LOCATION_PROCEDURE_RULES } from '@/lib/buildFlowRules';
import { useBoqWizardStore } from '@/store/boqWizardStore';

export default function PreConstructionChecklist() {
  const { projectDetails, preConstructionChecks, togglePreConstructionCheck } = useBoqWizardStore();

  const locationType = projectDetails.locationType as 'urban' | 'peri-urban' | 'rural' | '';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Pre-Construction Checklist</h3>
      <p className="mt-1 text-xs text-slate-500">Track key procedures before procurement and site mobilization.</p>

      <div className="mt-4 space-y-2">
        {LOCATION_PROCEDURE_RULES.map((rule) => {
          const status = locationType ? rule.statusByLocation[locationType] : 'recommended';
          return (
            <label key={rule.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="checkbox"
                checked={Boolean(preConstructionChecks[rule.id])}
                onChange={() => togglePreConstructionCheck(rule.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{rule.label}</span>
                <span className="block text-xs text-slate-500">{rule.description}</span>
                <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
                  {status.replace('_', ' ')}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
