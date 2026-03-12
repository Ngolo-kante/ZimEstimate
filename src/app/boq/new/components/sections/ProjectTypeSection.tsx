'use client';

import { type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HouseLine,
  Wrench,
  Cube,
  Columns,
  HouseSimple,
  PaintRoller,
  Tree,
  Hammer,
  CheckCircle,
  Check,
  Info,
} from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import type { BoqMilestoneId } from '@/store/boqWizardStore';
import {
  MANUAL_BUILDER_PROJECT_TYPES,
  MANUAL_BUILDER_STAGES,
  FULL_HOUSE_STAGES,
  type ProjectTypeId,
} from '@/app/boq/new/projectTypes';

// ── Icon maps ──────────────────────────────────────────────────────────────
const PROJECT_TYPE_ICONS: Record<string, ComponentType<{ size?: number; className?: string; weight?: 'regular' | 'fill' | 'duotone' | 'bold' }>> = {
  full_house: HouseLine,
  building_in_stages: Wrench,
};

const STAGE_ICONS: Record<string, ComponentType<{ size?: number; className?: string; weight?: 'regular' | 'fill' | 'duotone' | 'bold' }>> = {
  cube: Cube,
  buildings: Columns,
  'house-simple': HouseSimple,
  'paint-roller': PaintRoller,
  tree: Tree,
  hammer: Hammer,
};

// ── Component ──────────────────────────────────────────────────────────────
export default function ProjectTypeSection() {
  const {
    projectDetails,
    updateProjectDetails,
    setProjectScope,
    setSelectedStages,
    selectedStages,
  } = useBoqWizardStore();

  const selectedType = projectDetails.projectType as ProjectTypeId | '';

  const handleSelectType = (typeId: ProjectTypeId) => {
    updateProjectDetails({ projectType: typeId });
    setProjectScope(typeId === 'full_house' ? 'entire' : 'stage');
    setSelectedStages([...FULL_HOUSE_STAGES]);
  };

  const handleToggleStage = (stageId: BoqMilestoneId) => {
    const current = selectedStages ?? [];
    const isSelected = current.includes(stageId);
    if (isSelected && current.length === 1) return;
    const next = isSelected
      ? current.filter((s) => s !== stageId)
      : [...current, stageId];
    setSelectedStages(next);
  };

  const hasType = Boolean(selectedType);

  return (
    <div className="space-y-8">

      {/* ── Project Type Cards ───────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 mb-4">
          Choose your project scope
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {MANUAL_BUILDER_PROJECT_TYPES.map((type) => {
            const Icon = PROJECT_TYPE_ICONS[type.id];
            const isSelected = selectedType === type.id;
            return (
              <motion.button
                key={type.id}
                type="button"
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectType(type.id as ProjectTypeId)}
                className={`group relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all duration-200 shadow-sm ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-transparent shadow-lg shadow-blue-200'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
                }`}
              >
                {/* Selected indicator */}
                <div className={`absolute top-4 right-4 transition-all duration-200 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                  <CheckCircle weight="fill" size={20} className="text-white opacity-80" />
                </div>

                <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}>
                  {Icon && <Icon size={22} weight={isSelected ? 'fill' : 'regular'} />}
                </div>

                <div>
                  <div className={`font-bold text-base mb-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {type.label}
                  </div>
                  <p className={`text-sm leading-relaxed ${isSelected ? 'text-white/75' : 'text-slate-500'}`}>
                    {type.description}
                  </p>
                </div>

                {/* Scope badge */}
                <div className={`self-start px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {type.id === 'full_house' ? 'All Stages' : 'Select Stages'}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Stage Toggles ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasType && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                Stages included in this BOQ
              </p>
              <span className="text-xs font-medium text-slate-500">
                {selectedStages?.length ?? 0} of {MANUAL_BUILDER_STAGES.length} selected
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MANUAL_BUILDER_STAGES.map((stage) => {
                const StageIcon = STAGE_ICONS[stage.iconKey] ?? Cube;
                const isSelected = (selectedStages ?? []).includes(stage.id);

                return (
                  <motion.button
                    key={stage.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleToggleStage(stage.id)}
                    className={`group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-transparent shadow-md'
                        : 'border-slate-200 bg-white opacity-60 hover:opacity-90 hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <StageIcon size={16} weight={isSelected ? 'fill' : 'regular'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                        {stage.label}
                      </div>
                      <p className={`mt-0.5 text-xs leading-relaxed ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                        {stage.description}
                      </p>
                    </div>
                    <div className={`flex-shrink-0 mt-0.5 transition-all duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                      <Check weight="bold" size={14} className="text-white" />
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {selectedType === 'building_in_stages' && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2.5">
                <Info size={14} weight="fill" className="mt-0.5 flex-shrink-0 text-indigo-500" />
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Click any stage to deselect it. At least one stage must remain selected.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
