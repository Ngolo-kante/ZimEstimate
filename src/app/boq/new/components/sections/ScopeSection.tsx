'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, HouseLine, SquaresFour } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const STAGES = [
  { id: 'substructure', label: 'Substructure' },
  { id: 'superstructure', label: 'Superstructure' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'exterior', label: 'Exterior' },
];

interface ScopeSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function ScopeSection({ isCollapsed, onToggle }: ScopeSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));
  const { projectScope, setProjectScope, selectedStages, toggleStage } = useBoqWizardStore();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Project Scope</h2>
          <p className="mt-1 text-sm text-slate-500">Estimate the whole build or specific construction stages.</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          aria-label="Toggle section"
        >
          <CaretDown className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </header>

      {!collapsed && (
        <div className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setProjectScope('stage')}
              className={`flex items-start gap-3 rounded-xl border p-5 text-left transition-colors shadow-sm ${projectScope === 'stage'
                ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                }`}
            >
              <SquaresFour size={28} className={`shrink-0 ${projectScope === 'stage' ? 'text-blue-600' : 'text-slate-400'}`} weight={projectScope === 'stage' ? "duotone" : "regular"} />
              <div>
                <div className="text-base font-semibold">Selected Stages</div>
                <p className="mt-1 text-xs text-slate-500">Focus estimate on specific immediate phases only.</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setProjectScope('entire')}
              className={`flex items-start gap-3 rounded-xl border p-5 text-left transition-colors shadow-sm ${projectScope === 'entire'
                ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                }`}
            >
              <HouseLine size={28} className={`shrink-0 ${projectScope === 'entire' ? 'text-blue-600' : 'text-slate-400'}`} weight={projectScope === 'entire' ? "duotone" : "regular"} />
              <div>
                <div className="text-base font-semibold">Entire Build</div>
                <p className="mt-1 text-xs text-slate-500">Foundation to exterior handover across all major stages.</p>
              </div>
            </motion.button>
          </div>

          {projectScope === 'stage' && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Pick one or more stages</p>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((stage) => {
                  const selected = selectedStages.includes(stage.id);
                  return (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      key={stage.id}
                      type="button"
                      onClick={() => toggleStage(stage.id, !selected)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected
                        ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                    >
                      {stage.label}
                    </motion.button>
                  );
                })}
              </div>
              {selectedStages.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">Select at least one stage for a stage-specific estimate.</p>
              )}
            </div>
          )}
        </div>
      )
      }
    </section >
  );
}
