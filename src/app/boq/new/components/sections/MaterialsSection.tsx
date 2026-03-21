'use client';

import { motion } from 'framer-motion';
import { Wall, CheckCircle, Info } from '@phosphor-icons/react';
import { BRICK_INFO, CEMENT_INFO, type BrickType, type CementType } from '@/lib/vision/types';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const BRICK_OPTIONS = Object.entries(BRICK_INFO).map(([key, val]) => ({
  value: key as BrickType,
  label: val.name,
  hint: val.description,
}));

const CEMENT_OPTIONS = Object.entries(CEMENT_INFO).map(([key, val]) => ({
  value: key as CementType,
  label: val.name,
  hint: val.description,
  badge: key === 'pc_32_5' ? 'Standard' : 'High Strength',
}));

export default function MaterialsSection() {
  const { projectDetails, updateProjectDetails } = useBoqWizardStore();

  const toggleBrick = (value: BrickType) => {
    const current = projectDetails.brickTypes || [];
    const next = current.includes(value) ? current.filter((t) => t !== value) : [...current, value];
    updateProjectDetails({ brickTypes: next });
  };

  const toggleCement = (value: CementType) => {
    const current = projectDetails.cementTypes || [];
    const next = current.includes(value) ? current.filter((t) => t !== value) : [...current, value];
    updateProjectDetails({ cementTypes: next });
  };

  // Both cement grades included by default (empty = all selected)
  const activeCement = projectDetails.cementTypes?.length
    ? projectDetails.cementTypes
    : CEMENT_OPTIONS.map((o) => o.value);

  const activeBrick = projectDetails.brickTypes || [];

  return (
    <div className="space-y-10">

      {/* ── Brick / Block ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">What brick or block type are you using?</h3>
          <p className="text-sm wiz-text-muted">
            Select all types that will be used on this project. You can select multiple.
          </p>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {BRICK_OPTIONS.map((opt) => {
            const isSelected = activeBrick.includes(opt.value);
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleBrick(opt.value)}
                className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />}
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isSelected ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  <Wall size={18} weight="regular" className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</div>
                  <div className={`mt-0.5 text-xs ${isSelected ? 'text-blue-700/80' : 'wiz-text-muted'} leading-relaxed`}>{opt.hint}</div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {activeBrick.length === 0 && (
          <div className="wiz-alert wiz-alert--info">
            <Info size={14} weight="fill" className="wiz-alert__icon" />
            <p>No brick type selected — we will default to Standard Commons.</p>
          </div>
        )}
      </div>

      {/* ── Cement Grade ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">Which cement grade are you specifying?</h3>
          <p className="text-sm wiz-text-muted">
            Both grades are included by default. Deselect any that don't apply.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CEMENT_OPTIONS.map((opt) => {
            const isSelected = activeCement.includes(opt.value);
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleCement(opt.value)}
                className={`group relative flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={16} className="absolute top-4 right-4 text-blue-500" />}
                <div className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  isSelected ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                  <Wall size={20} weight="regular" className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 wiz-text-muted'
                    }`}>{opt.badge}</span>
                  </div>
                  <p className={`mt-1 text-xs ${isSelected ? 'text-blue-700/80' : 'wiz-text-muted'}`}>{opt.hint}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="wiz-alert wiz-alert--info">
          <Info size={14} weight="fill" className="wiz-alert__icon" />
          <p>If you are unsure which cement grade to use, keep both selected — your estimator will use the most appropriate grade per structural element.</p>
        </div>
      </div>
    </div>
  );
}
