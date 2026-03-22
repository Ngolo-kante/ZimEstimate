'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Info, CurrencyDollar, Percent, ListChecks } from '@phosphor-icons/react';
import { useBoqWizardStore } from '@/store/boqWizardStore';

type LaborChargeType = 'per_stage' | 'all_inclusive' | 'percentage' | null;

const LABOR_CHARGE_OPTIONS: Array<{
  value: LaborChargeType;
  label: string;
  description: string;
  icon: typeof CurrencyDollar;
}> = [
  {
    value: 'per_stage',
    label: 'Per stage',
    description: 'I know the labour cost for each stage (substructure, superstructure, etc.).',
    icon: ListChecks,
  },
  {
    value: 'all_inclusive',
    label: 'All inclusive',
    description: 'I have a single total labour cost for the entire project.',
    icon: CurrencyDollar,
  },
  {
    value: 'percentage',
    label: 'As a percentage',
    description: 'Add labour as a percentage of the total material cost.',
    icon: Percent,
  },
];

export default function LaborSection() {
  // No preselection
  const [laborChargeType, setLaborChargeType] = useState<LaborChargeType>(null);
  const [laborPercentage, setLaborPercentage] = useState<string>('25');
  const [laborTotal, setLaborTotal] = useState<string>('');
  const { selectedStages } = useBoqWizardStore();

  return (
    <div className="space-y-8">

      {/* ── How to add labour ─────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold wiz-text-primary mb-1">How would you like to calculate labour costs?</h3>
          <p className="text-sm wiz-text-muted">
            Choose how labour charges should be added to your estimate.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {LABOR_CHARGE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = laborChargeType === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setLaborChargeType(opt.value)}
                className={`group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
              >
                {isSelected && <CheckCircle weight="fill" size={15} className="absolute top-3 right-3 text-blue-500" />}
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Icon size={18} weight="regular" />
                </div>
                <div className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>{opt.label}</div>
                <p className={`text-xs ${isSelected ? 'text-slate-600' : 'wiz-text-muted'} leading-relaxed`}>{opt.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Percentage input ──────────────────────────────────── */}
      <AnimatePresence>
        {laborChargeType === 'percentage' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-3"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold wiz-text-primary">Labour percentage of material cost</p>
                <p className="mt-0.5 text-xs wiz-text-muted">
                  Typical range: 20–35% depending on project complexity.
                </p>
              </div>
              <div className="relative w-24">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={laborPercentage}
                  onChange={(e) => setLaborPercentage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-8 text-sm font-semibold wiz-text-primary shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
              </div>
            </div>
            <div className="wiz-alert wiz-alert--info">
              <Info size={14} weight="fill" className="wiz-alert__icon" />
              <p>This percentage will be applied to your total material cost to calculate the labour allowance in your BOQ.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── All inclusive input ────────────────────────────────── */}
      <AnimatePresence>
        {laborChargeType === 'all_inclusive' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-3"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold wiz-text-primary">Total labour cost (USD)</p>
                <p className="mt-0.5 text-xs wiz-text-muted">
                  Enter the total labour charge for the entire project.
                </p>
              </div>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  value={laborTotal}
                  onChange={(e) => setLaborTotal(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-4 text-sm font-semibold wiz-text-primary shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Per stage info ─────────────────────────────────────── */}
      <AnimatePresence>
        {laborChargeType === 'per_stage' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="wiz-alert wiz-alert--info"
          >
            <Info size={14} weight="fill" className="wiz-alert__icon" />
            <p>Labour costs for each of your {selectedStages?.length ?? 0} selected stage{(selectedStages?.length ?? 0) !== 1 ? 's' : ''} will be added as separate line items in your BOQ. You can edit amounts in the review step.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
