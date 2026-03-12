'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Circle, Plus, Minus, ToggleLeft, ToggleRight } from '@phosphor-icons/react';
import { TEMPORARY_WORKS_SUGGESTIONS } from '@/lib/buildFlowRules';
import { useBoqWizardStore } from '@/store/boqWizardStore';

export default function SiteSetupSection() {
  const {
    temporaryWorksSelections,
    setTemporaryWorksSelections,
    updateTemporaryWorkSelection,
    includeSepticTank,
    setIncludeSepticTank,
    septicDimensions,
    updateSepticDimensions,
  } = useBoqWizardStore();

  const [wantsSiteSetup, setWantsSiteSetup] = useState(() =>
    temporaryWorksSelections.some((s) => s.enabled) || includeSepticTank
  );

  useEffect(() => {
    if (temporaryWorksSelections.length > 0) return;
    const defaults = TEMPORARY_WORKS_SUGGESTIONS.map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      unit: entry.unit,
      enabled: false,
      quantity: String(entry.defaultQty),
      unitPriceUsd: '',
    }));
    setTemporaryWorksSelections(defaults);
  }, [temporaryWorksSelections, setTemporaryWorksSelections]);

  const enabledCount = temporaryWorksSelections.filter((s) => s.enabled).length;

  return (
    <div className="space-y-8">

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Any site setup or temporary works?</h3>
        <p className="text-sm text-slate-500">
          Optional items like site toilets, fencing, and scaffolding. Skip if you only need a materials estimate.
        </p>
      </div>

      {/* Yes / Skip */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            key: true,
            label: 'Yes, add site setup',
            desc: 'Select individual items that apply to your project.',
            icon: CheckCircle,
          },
          {
            key: false,
            label: 'Skip for now',
            desc: 'Materials estimate only — site setup can be added later.',
            icon: Circle,
          },
        ].map(({ key, label, desc, icon: Icon }) => {
          const isSelected = wantsSiteSetup === key;
          return (
            <motion.button
              key={String(key)}
              type="button"
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setWantsSiteSetup(key)}
              className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                isSelected ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                <Icon size={18} weight="regular" className={isSelected ? 'text-white' : 'text-slate-400'} />
              </div>
              <div>
                <div className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-slate-800'}`}>{label}</div>
                <div className={`mt-0.5 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{desc}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Temporary works list */}
      <AnimatePresence>
        {wantsSiteSetup && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Site items</p>
              {enabledCount > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {enabledCount} selected
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {temporaryWorksSelections.map((selection) => (
                <motion.div
                  key={selection.id}
                  layout
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    selection.enabled ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateTemporaryWorkSelection(selection.id, { enabled: !selection.enabled })}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                      selection.enabled ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {selection.enabled
                        ? <CheckCircle size={15} weight="bold" />
                        : <Circle size={15} weight="regular" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${selection.enabled ? 'text-slate-900' : 'text-slate-600'}`}>
                        {selection.label}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{selection.description}</div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {selection.enabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="border-t border-slate-200 px-4 pb-4 pt-3"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Qty ({selection.unit})
                            </label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateTemporaryWorkSelection(selection.id, { quantity: String(Math.max(0, Number(selection.quantity) - 1)) })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                              >
                                <Minus size={12} weight="bold" />
                              </button>
                              <input
                                type="number"
                                value={selection.quantity}
                                onChange={(e) => updateTemporaryWorkSelection(selection.id, { quantity: e.target.value })}
                                className="w-12 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium outline-none focus:border-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => updateTemporaryWorkSelection(selection.id, { quantity: String(Number(selection.quantity) + 1) })}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                              >
                                <Plus size={12} weight="bold" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Unit Price (USD)
                            </label>
                            <input
                              type="number"
                              value={selection.unitPriceUsd}
                              onChange={(e) => updateTemporaryWorkSelection(selection.id, { unitPriceUsd: e.target.value })}
                              placeholder="Optional"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400 placeholder:text-slate-300"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Septic tank */}
            <motion.div
              layout
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                includeSepticTank ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setIncludeSepticTank(!includeSepticTank)}
                className="flex w-full items-center gap-3 p-5 text-left"
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  includeSepticTank ? 'bg-slate-900' : 'bg-slate-100'
                }`}>
                  <CheckCircle size={18} weight="regular" className={includeSepticTank ? 'text-white' : 'text-slate-400'} />
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${includeSepticTank ? 'text-slate-900' : 'text-slate-700'}`}>
                    Include custom septic tank
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">Add a custom-dimensioned septic system to your BOQ.</div>
                </div>
                {includeSepticTank
                  ? <ToggleRight size={24} className="text-slate-900 flex-shrink-0" weight="fill" />
                  : <ToggleLeft size={24} className="text-slate-300 flex-shrink-0" weight="regular" />}
              </button>

              <AnimatePresence>
                {includeSepticTank && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-200 px-5 pb-5 pt-4"
                  >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Septic dimensions</p>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                      {(['length', 'width', 'height'] as const).map((dim) => (
                        <div key={dim}>
                          <label className="mb-1 block text-xs font-medium capitalize text-slate-600">{dim} (m)</label>
                          <input
                            type="number"
                            value={septicDimensions[dim]}
                            onChange={(e) => updateSepticDimensions({ [dim]: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Unit Price (USD/m³)</label>
                        <input
                          type="number"
                          value={septicDimensions.unitPriceUsd}
                          onChange={(e) => updateSepticDimensions({ unitPriceUsd: e.target.value })}
                          placeholder="e.g. 120"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 placeholder:text-slate-300"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
