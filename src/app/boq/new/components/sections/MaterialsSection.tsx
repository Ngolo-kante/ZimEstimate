'use client';

import { motion } from 'framer-motion';
import { Wall, CheckCircle, Question } from '@phosphor-icons/react';
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

  const isDefaultBrick = !projectDetails.brickTypes?.length || (projectDetails.brickTypes.length === 1 && projectDetails.brickTypes[0] === 'common');

  return (
    <div className="space-y-10">

      {/* ── Brick / Block ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">What brick or block type are you using?</h3>
          <p className="text-sm text-slate-500">This drives material quantities and unit rates in your BOQ. You can select multiple.</p>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {/* Not sure / default */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => updateProjectDetails({ brickTypes: ['common'] })}
            className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
              isDefaultBrick
                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20'
                : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            {isDefaultBrick && <CheckCircle weight="fill" size={16} className="absolute top-3 right-3 text-blue-500" />}
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isDefaultBrick ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Question size={18} weight="bold" />
            </div>
            <div>
              <div className={`text-sm font-semibold ${isDefaultBrick ? 'text-blue-900' : 'text-slate-800'}`}>Not Sure</div>
              <div className="mt-0.5 text-xs text-slate-500">Standard Commons — safe default</div>
            </div>
          </motion.button>

          {BRICK_OPTIONS.map((opt) => {
            const isSelected = (projectDetails.brickTypes || []).includes(opt.value);
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleBrick(opt.value)}
                className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={16} className="absolute top-3 right-3 text-blue-500" />}
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <Wall size={18} weight={isSelected ? 'fill' : 'regular'} />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{opt.hint}</div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Cement Grade ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Which cement grade are you specifying?</h3>
          <p className="text-sm text-slate-500">Cement grade affects structural strength ratings and batching ratios.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CEMENT_OPTIONS.map((opt) => {
            const isSelected = (projectDetails.cementTypes || []).includes(opt.value);
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleCement(opt.value)}
                className={`group relative flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={18} className="absolute top-4 right-4 text-blue-500" />}
                <div className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg ${
                  isSelected ? 'bg-blue-600' : 'bg-slate-100'
                }`}>
                  🏗️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{opt.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>{opt.badge}</span>
                  </div>
                  <p className={`mt-1 text-xs ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>{opt.hint}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {!projectDetails.cementTypes?.length && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
            No cement selected — we'll default to PC 32.5 (Standard) in your estimate.
          </p>
        )}
      </div>
    </div>
  );
}
