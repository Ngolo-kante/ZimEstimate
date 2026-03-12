'use client';

import { motion } from 'framer-motion';
import { Package, HardHat, CheckCircle, Info } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';

const LABOR_OPTIONS = [
  {
    id: 'materials_only' as const,
    label: 'Materials Only',
    description: 'Exclude labour rates from estimate totals. Best if you have your own crew or want to price labour separately.',
    icon: Package,
    tag: 'Lower estimate',
    emoji: '📦',
  },
  {
    id: 'materials_labor' as const,
    label: 'Materials + Labour',
    description: 'Include skilled and general labour allowances in your BOQ. Best for full project costing with a contractor.',
    icon: HardHat,
    tag: 'Full cost picture',
    emoji: '👷',
  },
];

export default function LaborSection() {
  const { laborType, setLaborType } = useBoqWizardStore();

  return (
    <div className="space-y-8">

      {/* Guided prompt */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Should labour be included in your estimate?</h3>
        <p className="text-sm text-slate-500">
          This affects whether skilled and unskilled labour allowances appear in your BOQ line items.
        </p>
      </div>

      {/* Option cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {LABOR_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = laborType === opt.id;
          return (
            <motion.button
              key={opt.id}
              type="button"
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLaborType(opt.id)}
              className={`group relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20 shadow-blue-100 shadow-md'
                  : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
              }`}
            >
              {isSelected && (
                <CheckCircle weight="fill" size={20} className="absolute top-4 right-4 text-blue-500" />
              )}

              {/* Icon */}
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${
                isSelected ? 'bg-blue-600' : 'bg-slate-100 group-hover:bg-blue-50'
              }`}>
                {opt.emoji}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-base ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                    {opt.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {opt.tag}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                  {opt.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Helper callout */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800">
        <Info size={17} weight="fill" className="shrink-0 mt-0.5 text-blue-400" />
        <p>
          You can always generate a materials-only estimate first, then add labour separately when negotiating with contractors.
        </p>
      </div>
    </div>
  );
}
