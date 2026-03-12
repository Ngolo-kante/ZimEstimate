'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, Package, HardHat } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const LABOR_OPTIONS = [
  {
    id: 'materials_only',
    label: 'Materials Only',
    hint: 'Exclude labor rates from estimate totals.',
    icon: Package
  },
  {
    id: 'materials_labor',
    label: 'Materials + Labor',
    hint: 'Include labor and supervision allowances.',
    icon: HardHat
  },
] as const;

interface LaborSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function LaborSection({ isCollapsed, onToggle }: LaborSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));
  const { laborType, setLaborType } = useBoqWizardStore();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Labor</h2>
          <p className="mt-1 text-sm text-slate-500">Control whether labor costs are included in live totals.</p>
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
        <div className="grid gap-3 p-6 md:grid-cols-2">
          {LABOR_OPTIONS.map((option) => {
            const selected = laborType === option.id;
            const Icon = option.icon;
            return (
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                key={option.id}
                type="button"
                onClick={() => setLaborType(option.id)}
                className={`flex items-start gap-4 rounded-xl border p-5 text-left transition-colors shadow-sm ${selected
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-md'
                  }`}
              >
                <Icon size={28} className={`shrink-0 ${selected ? 'text-blue-600' : 'text-slate-400'}`} weight={selected ? "duotone" : "regular"} />
                <div>
                  <div className="text-base font-semibold">{option.label}</div>
                  <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
