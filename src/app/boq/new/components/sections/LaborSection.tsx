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
  },
  {
    id: 'materials_labor' as const,
    label: 'Materials + Labour',
    description: 'Include skilled and general labour allowances in your BOQ. Best for full project costing with a contractor.',
    icon: HardHat,
    tag: 'Full cost picture',
  },
];

export default function LaborSection() {
  const { laborType, setLaborType } = useBoqWizardStore();

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Should labour be included in your estimate?</h3>
        <p className="text-sm text-slate-500">
          This controls whether skilled and unskilled labour allowances appear in your BOQ line items.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LABOR_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = laborType === opt.id;
          return (
            <motion.button
              key={opt.id}
              type="button"
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLaborType(opt.id)}
              className={`group relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {isSelected && (
                <CheckCircle weight="fill" size={18} className="absolute top-4 right-4 text-white opacity-70" />
              )}

              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                isSelected ? 'bg-white/15' : 'bg-slate-100 group-hover:bg-slate-200'
              }`}>
                <Icon size={22} weight="regular" className={isSelected ? 'text-white' : 'text-slate-500'} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-base ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {opt.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {opt.tag}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  {opt.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Info size={16} weight="fill" className="shrink-0 mt-0.5 text-slate-400" />
        <p>
          You can generate a materials-only estimate first, then add labour separately when negotiating with contractors.
        </p>
      </div>
    </div>
  );
}
