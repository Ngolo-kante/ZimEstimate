'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wall, CheckCircle, Info, Truck, Question, HardHat, Package } from '@phosphor-icons/react';
import { BRICK_INFO, CEMENT_INFO, type BrickType, type CementType } from '@/lib/vision/types';
import type { FinishLevel } from '@/lib/calculations';
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
  badge: key === 'cement_325' ? 'Standard' : 'High Strength',
}));

type MaterialKnowledge = 'single' | 'mix' | 'not_sure' | null;

const BRICK_KNOWLEDGE_OPTIONS: Array<{ value: MaterialKnowledge; label: string; description: string }> = [
  { value: 'not_sure', label: 'Not sure yet', description: 'We\'ll estimate using standard red common bricks.' },
  { value: 'single', label: 'Yes — one type', description: 'I know the specific brick/block type I\'ll use.' },
  { value: 'mix', label: 'Yes — a mix', description: 'I\'ll be using a combination of brick/block types.' },
];

const CEMENT_KNOWLEDGE_OPTIONS: Array<{ value: MaterialKnowledge; label: string; description: string }> = [
  { value: 'not_sure', label: 'Not sure yet', description: 'We\'ll use Standard Cement 32.5N for estimates.' },
  { value: 'single', label: 'Yes — one grade', description: 'I know the specific cement grade I need.' },
  { value: 'mix', label: 'Yes — both grades', description: 'I\'ll be using both standard and rapid cement.' },
];

const TRANSPORT_SUGGESTIONS: Record<string, { percentage: number; label: string }> = {
  urban: { percentage: 5, label: 'Urban — short distances, lower transport costs' },
  'peri-urban': { percentage: 10, label: 'Peri-urban — moderate distances' },
  rural: { percentage: 15, label: 'Rural — longer distances, higher transport costs' },
};

const FINISH_LEVEL_CHOICES: {
  value: FinishLevel | 'not_sure';
  label: string;
  description: string;
}[] = [
  { value: 'economy', label: 'Economy', description: 'Wet areas tiled, rest screeded. 1–2 coats of paint.' },
  { value: 'standard', label: 'Standard', description: 'Full floor tiling and 2 coats of paint throughout.' },
  { value: 'premium', label: 'Premium', description: 'Full tiling, taller wet-area tiling, 3 coats of paint.' },
  // Priced as standard, but recorded as an assumption rather than a decision —
  // most people costing a house have not settled the finish yet, and forcing a
  // guess produces a number they do not trust.
  { value: 'not_sure', label: 'Not sure yet', description: 'We will assume standard. You can change this later.' },
];

export default function MaterialsSection() {
  const { projectDetails, updateProjectDetails, laborType, setLaborType } = useBoqWizardStore();

  // No preselection — user must explicitly choose
  const [brickKnowledge, setBrickKnowledge] = useState<MaterialKnowledge>(null);
  const [cementKnowledge, setCementKnowledge] = useState<MaterialKnowledge>(null);

  // Transport markup state — stored as part of project details
  const [includeTransport, setIncludeTransport] = useState<boolean | null>(null);
  const locationType = projectDetails.locationType || '';
  const suggestedTransport = TRANSPORT_SUGGESTIONS[locationType] || TRANSPORT_SUGGESTIONS['urban'];
  const [transportPercentage, setTransportPercentage] = useState<string>(
    String(suggestedTransport?.percentage ?? 5)
  );

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

  const handleBrickKnowledge = (knowledge: MaterialKnowledge) => {
    setBrickKnowledge(knowledge);
    if (knowledge === 'not_sure') {
      updateProjectDetails({ brickTypes: [] }); // Will default to common
    } else if (knowledge === 'single') {
      // Keep existing or clear for fresh selection
      if ((projectDetails.brickTypes || []).length > 1) {
        updateProjectDetails({ brickTypes: [] });
      }
    }
  };

  const handleCementKnowledge = (knowledge: MaterialKnowledge) => {
    setCementKnowledge(knowledge);
    if (knowledge === 'not_sure') {
      updateProjectDetails({ cementTypes: [] }); // Will default to 32.5N
    } else if (knowledge === 'mix') {
      // Select both grades
      updateProjectDetails({ cementTypes: CEMENT_OPTIONS.map((o) => o.value) });
    } else if (knowledge === 'single') {
      if ((projectDetails.cementTypes || []).length > 1) {
        updateProjectDetails({ cementTypes: [] });
      }
    }
  };

  const activeBrick = projectDetails.brickTypes || [];
  const activeCement = projectDetails.cementTypes || [];
  const showBrickSelector = brickKnowledge === 'single' || brickKnowledge === 'mix';
  const showCementSelector = cementKnowledge === 'single' || cementKnowledge === 'mix';

  return (
    <div className="space-y-10">

      {/* ── Materials Only vs Materials + Labour ─────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">What should this estimate include?</h3>
          <p className="text-sm wiz-text-muted">
            Choose whether to include labour costs alongside materials.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLaborType('materials_only')}
            className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ${
              laborType === 'materials_only'
                ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            {laborType === 'materials_only' && <CheckCircle weight="fill" size={16} className="absolute top-4 right-4 text-blue-500" />}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              laborType === 'materials_only' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <Package size={20} weight="regular" />
            </div>
            <div>
              <div className={`font-bold text-sm ${laborType === 'materials_only' ? 'text-slate-900' : 'text-slate-800'}`}>Materials only</div>
              <p className={`mt-1 text-xs leading-relaxed ${laborType === 'materials_only' ? 'text-slate-600' : 'wiz-text-muted'}`}>
                Exclude labour — I have my own crew or will price labour separately.
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              laborType === 'materials_only' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 wiz-text-muted'
            }`}>Lower estimate</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLaborType('materials_labor')}
            className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-200 ${
              laborType === 'materials_labor'
                ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            {laborType === 'materials_labor' && <CheckCircle weight="fill" size={16} className="absolute top-4 right-4 text-blue-500" />}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              laborType === 'materials_labor' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <HardHat size={20} weight="regular" />
            </div>
            <div>
              <div className={`font-bold text-sm ${laborType === 'materials_labor' ? 'text-slate-900' : 'text-slate-800'}`}>Materials + Labour</div>
              <p className={`mt-1 text-xs leading-relaxed ${laborType === 'materials_labor' ? 'text-slate-600' : 'wiz-text-muted'}`}>
                Include skilled and unskilled labour allowances in your estimate.
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              laborType === 'materials_labor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 wiz-text-muted'
            }`}>Full cost picture</span>
          </motion.button>
        </div>
      </div>

      {/* ── Brick / Block Knowledge Question ─────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">Do you know which bricks or blocks you&apos;ll be using?</h3>
          <p className="text-sm wiz-text-muted">
            This helps us estimate masonry costs more accurately.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {BRICK_KNOWLEDGE_OPTIONS.map((opt) => {
            const isSelected = brickKnowledge === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleBrickKnowledge(opt.value)}
                className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />}
                <div className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{opt.label}</div>
                <p className={`text-xs ${isSelected ? 'text-slate-600' : 'wiz-text-muted'} leading-relaxed`}>{opt.description}</p>
              </motion.button>
            );
          })}
        </div>

        {/* Not sure info */}
        <AnimatePresence>
          {brickKnowledge === 'not_sure' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="wiz-alert wiz-alert--info"
            >
              <Info size={14} weight="fill" className="wiz-alert__icon" />
              <p>Your estimate will be based on <strong>Red Common Bricks</strong> — the most widely used brick type in Zimbabwe. You can change this later.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Brick type selector — shown for single or mix */}
        <AnimatePresence>
          {showBrickSelector && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="space-y-3"
            >
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                {brickKnowledge === 'single' ? 'Select your brick/block type' : 'Select all brick/block types you\'ll use'}
              </p>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {BRICK_OPTIONS.map((opt) => {
                  const isSelected = activeBrick.includes(opt.value);
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (brickKnowledge === 'single') {
                          // Single select — replace
                          updateProjectDetails({ brickTypes: [opt.value] });
                        } else {
                          toggleBrick(opt.value);
                        }
                      }}
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
                        <div className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{opt.label}</div>
                        <div className={`mt-0.5 text-xs ${isSelected ? 'text-slate-600' : 'wiz-text-muted'} leading-relaxed`}>{opt.hint}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Cement Grade Knowledge Question ────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">Do you know which cement grade you&apos;ll be using?</h3>
          <p className="text-sm wiz-text-muted">
            Different grades are used for different structural elements.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {CEMENT_KNOWLEDGE_OPTIONS.map((opt) => {
            const isSelected = cementKnowledge === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCementKnowledge(opt.value)}
                className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />}
                <div className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{opt.label}</div>
                <p className={`text-xs ${isSelected ? 'text-slate-600' : 'wiz-text-muted'} leading-relaxed`}>{opt.description}</p>
              </motion.button>
            );
          })}
        </div>

        {/* Not sure info */}
        <AnimatePresence>
          {cementKnowledge === 'not_sure' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="wiz-alert wiz-alert--info"
            >
              <Info size={14} weight="fill" className="wiz-alert__icon" />
              <p>Your estimate will be based on <strong>Standard Cement 32.5N</strong> — the most common grade for general building in Zimbabwe.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cement type selector */}
        <AnimatePresence>
          {showCementSelector && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="space-y-3"
            >
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                {cementKnowledge === 'single' ? 'Select your cement grade' : 'Both grades selected'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {CEMENT_OPTIONS.map((opt) => {
                  const isSelected = activeCement.includes(opt.value);
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (cementKnowledge === 'single') {
                          updateProjectDetails({ cementTypes: [opt.value] });
                        } else {
                          toggleCement(opt.value);
                        }
                      }}
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
                          <span className={`font-semibold text-sm ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{opt.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 wiz-text-muted'
                          }`}>{opt.badge}</span>
                        </div>
                        <p className={`mt-1 text-xs ${isSelected ? 'text-slate-600' : 'wiz-text-muted'}`}>{opt.hint}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Transport Markup ──────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">Should we add a transport markup?</h3>
          <p className="text-sm wiz-text-muted">
            Material prices typically exclude delivery. Add a percentage markup to account for transportation costs to your site.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIncludeTransport(true)}
            className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
              includeTransport === true
                ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            {includeTransport === true && <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />}
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${includeTransport === true ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <Truck size={18} weight="regular" className={includeTransport === true ? 'text-blue-600' : 'text-slate-400'} />
            </div>
            <div className={`text-sm font-semibold ${includeTransport === true ? 'text-slate-900' : 'text-slate-800'}`}>Yes, add transport</div>
            <p className={`text-xs ${includeTransport === true ? 'text-slate-600' : 'wiz-text-muted'}`}>
              Add a percentage to material costs for delivery.
            </p>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIncludeTransport(false)}
            className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
              includeTransport === false
                ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            {includeTransport === false && <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />}
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${includeTransport === false ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <Question size={18} weight="regular" className={includeTransport === false ? 'text-blue-600' : 'text-slate-400'} />
            </div>
            <div className={`text-sm font-semibold ${includeTransport === false ? 'text-slate-900' : 'text-slate-800'}`}>No, skip for now</div>
            <p className={`text-xs ${includeTransport === false ? 'text-slate-600' : 'wiz-text-muted'}`}>
              I&apos;ll arrange my own transport or add this later.
            </p>
          </motion.button>
        </div>

        {/* Transport percentage input */}
        <AnimatePresence>
          {includeTransport === true && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-5"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-bold wiz-text-primary">Transport markup percentage</p>
                  {locationType && (
                    <p className="mt-0.5 text-xs wiz-text-muted">
                      Suggested for {suggestedTransport.label}
                    </p>
                  )}
                </div>
                <div className="relative w-24">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={transportPercentage}
                    onChange={(e) => setTransportPercentage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-8 text-sm font-semibold wiz-text-primary shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                </div>
              </div>

              <div className="wiz-alert wiz-alert--info">
                <Info size={14} weight="fill" className="wiz-alert__icon" />
                <p>This markup will be applied across all material line items in your BOQ. You can adjust individual items in the review step.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Finish level */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold wiz-text-primary">Finish level</h3>
          <p className="mt-1 text-sm text-slate-500">
            Sets how much of the floor is tiled, how many coats of paint, and the extent of wet-area tiling.
          </p>
        </div>

        {/* Nothing is preselected. Standard used to be chosen for the user, so
            the estimate carried a finish they had never picked — and neither
            they nor we could tell a deliberate "standard" from a question that
            was skipped. "Not sure" is a real answer: it prices as standard and
            says so, rather than pretending to be a choice. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FINISH_LEVEL_CHOICES.map((opt) => {
            const isSelected = projectDetails.finishLevel === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateProjectDetails({ finishLevel: opt.value })}
                className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                <span className="text-sm font-bold wiz-text-primary">{opt.label}</span>
                <span className="text-xs text-slate-500">{opt.description}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
