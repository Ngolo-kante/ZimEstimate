'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, Wall, Nut, Hexagon, Question, Factory, Strategy } from '@phosphor-icons/react';
import { BRICK_INFO, CEMENT_INFO, type BrickType, type CementType } from '@/lib/vision/types';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const BRICK_OPTIONS = Object.entries(BRICK_INFO).map(([key, val]) => ({
  value: key as BrickType,
  label: val.name,
  hint: val.description,
  icon: key === 'common' ? Wall : key === 'face_brick' ? Wall : key === 'blocks_6inch' || key === 'blocks_8inch' ? Nut : Hexagon
}));

const CEMENT_OPTIONS = Object.entries(CEMENT_INFO).map(([key, val]) => ({
  value: key as CementType,
  label: val.name,
  hint: val.description,
  icon: key === 'pc_32_5' ? Factory : Strategy
}));

interface MaterialsSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function MaterialsSection({ isCollapsed, onToggle }: MaterialsSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));
  const { projectDetails, updateProjectDetails } = useBoqWizardStore();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Materials Profile</h2>
          <p className="mt-1 text-sm text-slate-500">Material selections drive quantity and pricing assumptions instantly.</p>
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
        <div className="grid gap-8 p-6">
          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">Brick / Block Type</label>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {BRICK_OPTIONS.map((option) => {
                const selected = projectDetails.brickTypes?.includes(option.value) || (!projectDetails.brickTypes?.length && option.value === 'common');
                const Icon = option.icon;
                return (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const current = projectDetails.brickTypes || [];
                      const newTypes = current.includes(option.value)
                        ? current.filter(t => t !== option.value)
                        : [...current, option.value];
                      updateProjectDetails({ brickTypes: newTypes });
                    }}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors shadow-sm ${selected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                      }`}
                  >
                    <Icon size={24} className={selected ? 'text-blue-600' : 'text-slate-400'} weight={selected ? "duotone" : "regular"} />
                    <div>
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className="mt-0.5 text-xs text-slate-500 hidden sm:block">{option.hint}</div>
                    </div>
                  </motion.button>
                );
              })}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => updateProjectDetails({ brickTypes: ['common'] })}
                className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors shadow-sm ${!projectDetails.brickTypes?.length || (projectDetails.brickTypes?.length === 1 && projectDetails.brickTypes[0] === 'common')
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                  }`}
              >
                <Question size={24} className={!projectDetails.brickTypes?.length ? 'text-blue-600' : 'text-slate-400'} weight={!projectDetails.brickTypes?.length ? "duotone" : "regular"} />
                <div>
                  <div className="text-sm font-semibold">Not Sure</div>
                  <div className="mt-0.5 text-xs text-slate-500 hidden sm:block">We&apos;ll use Standard Commons</div>
                </div>
              </motion.button>
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">Cement Grade (PPC/Lafarge)</label>
            <div className="grid gap-3 md:grid-cols-2">
              {CEMENT_OPTIONS.map((option) => {
                const selected = projectDetails.cementTypes?.includes(option.value);
                const Icon = option.icon;
                return (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const current = projectDetails.cementTypes || [];
                      const newTypes = current.includes(option.value)
                        ? current.filter(t => t !== option.value)
                        : [...current, option.value];
                      updateProjectDetails({ cementTypes: newTypes });
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors shadow-sm ${selected
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                      }`}
                  >
                    <Icon size={24} className={`shrink-0 ${selected ? 'text-blue-600' : 'text-slate-400'}`} weight={selected ? "duotone" : "regular"} />
                    <div>
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{option.hint}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
