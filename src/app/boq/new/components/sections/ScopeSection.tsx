'use client';

import { Check } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import { MANUAL_BUILDER_STAGES } from '@/app/boq/new/projectTypes';

/**
 * ScopeSection — now a read-only summary of stages chosen in Step 1.
 * Since the user already chose scope on Step 1 (Full House / Building in Stages),
 * this shows a concise pill summary and lets them jump back if needed.
 */
export default function ScopeSection() {
  const { selectedStages } = useBoqWizardStore();

  const stageLabels = MANUAL_BUILDER_STAGES.filter((s) => (selectedStages ?? []).includes(s.id));
  const totalStages = MANUAL_BUILDER_STAGES.length;
  const selectedCount = stageLabels.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Stages in your estimate</h3>
        <p className="text-sm text-slate-500">
          These are the stages you selected in step 1. You can go back to change them anytime.
        </p>
      </div>

      {/* Count indicator */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${(selectedCount / totalStages) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
          {selectedCount} / {totalStages} stages
        </span>
      </div>

      {/* Stage pills */}
      <div className="flex flex-wrap gap-2">
        {MANUAL_BUILDER_STAGES.map((stage) => {
          const isIncluded = (selectedStages ?? []).includes(stage.id);
          return (
            <div
              key={stage.id}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                isIncluded
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 line-through'
              }`}
            >
              {isIncluded && <Check size={11} weight="bold" className="text-emerald-600" />}
              {stage.label}
            </div>
          );
        })}
      </div>

      {selectedCount === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⚠️ No stages selected. Please go back to Step 1 and select at least one stage.
        </div>
      )}
    </div>
  );
}
