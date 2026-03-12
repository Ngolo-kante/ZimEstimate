'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import {
  CaretDown,
  HouseLine,
  Cube,
  Sun,
  Drop,
  HouseSimple,
  PaintRoller,
  Tree,
  Pipe,
  GridFour,
  WindowsLogo,
} from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';
import { PROJECT_TYPE_CONFIG, PROJECT_TYPE_LIST, type ProjectTypeId } from '@/app/boq/new/projectTypes';

interface ProjectTypeSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const ICONS: Record<ProjectTypeId, ComponentType<{ size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; className?: string }>> = {
  full_house: HouseLine,
  house_substructure: Cube,
  solar: Sun,
  water_tank: Drop,
  roofing: HouseSimple,
  interior: PaintRoller,
  exterior: Tree,
  septic_tank: Pipe,
  patio: GridFour,
  window_frames: WindowsLogo,
};

export default function ProjectTypeSection({ isCollapsed, onToggle }: ProjectTypeSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));

  const {
    projectDetails,
    updateProjectDetails,
    setProjectScope,
    setSelectedStages,
    setIncludeSepticTank,
  } = useBoqWizardStore();

  const selectedType = projectDetails.projectType as ProjectTypeId | '';

  const cards = useMemo(() => PROJECT_TYPE_LIST, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Project Type</h2>
          <p className="mt-1 text-sm text-slate-500">What project would you like to create a BOQ for today?</p>
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
        <div className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const Icon = ICONS[card.id];
              const selected = selectedType === card.id;

              return (
                <motion.button
                  key={card.id}
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    updateProjectDetails({ projectType: card.id });
                    setProjectScope(card.scope);
                    setSelectedStages(card.stages);
                    setIncludeSepticTank(Boolean(card.includeSeptic));
                  }}
                  className={`flex h-full flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-colors shadow-sm ${selected
                    ? 'border-blue-500 bg-blue-50/60 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                    }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={20} weight={selected ? 'duotone' : 'regular'} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{card.label}</div>
                    <p className="mt-1 text-xs text-slate-500">{card.description}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {!selectedType && (
            <p className="text-xs text-amber-600">Select a project type to continue.</p>
          )}

          {selectedType && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Selected:</span> {PROJECT_TYPE_CONFIG[selectedType].label}. We will prefill your scope for this choice. You can still adjust it later.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
