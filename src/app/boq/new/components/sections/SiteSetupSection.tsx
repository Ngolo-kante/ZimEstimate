'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, MinusCircle, Plus, Minus } from '@phosphor-icons/react';
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

      {/* Guided prompt */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Any site setup or temporary works?</h3>
        <p className="text-sm text-slate-500">
          Optional items like site toilets, security fencing, and scaffolding can be added here. Skip if you're after a quick materials-only estimate.
        </p>
      </div>

      {/* Yes / No toggle */}
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setWantsSiteSetup(true)}
          className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
            wantsSiteSetup
              ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400/20'
              : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
          }`}
        >
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
            wantsSiteSetup ? 'bg-blue-600' : 'bg-slate-100'
          }`}>
            🏗️
          </div>
          <div>
            <div className={`font-bold text-sm ${wantsSiteSetup ? 'text-blue-900' : 'text-slate-800'}`}>Yes, add site setup</div>
            <div className={`mt-1 text-xs ${wantsSiteSetup ? 'text-blue-600' : 'text-slate-500'}`}>
              Select individual items — only what applies to your project.
            </div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setWantsSiteSetup(false)}
          className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
            !wantsSiteSetup
              ? 'border-slate-400 bg-slate-50 ring-2 ring-slate-400/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
            !wantsSiteSetup ? 'bg-slate-600' : 'bg-slate-100'
          }`}>
            ⏭️
          </div>
          <div>
            <div className={`font-bold text-sm ${!wantsSiteSetup ? 'text-slate-900' : 'text-slate-600'}`}>Skip for now</div>
            <div className="mt-1 text-xs text-slate-500">
              Materials estimate only — site setup can be added later.
            </div>
          </div>
        </motion.button>
      </div>

      {/* Temporary works list */}
      <AnimatePresence>
        {wantsSiteSetup && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-6"
          >
            {/* Items counter */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Site items</p>
              {enabledCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
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
                    selection.enabled
                      ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Card header — clickable to toggle */}
                  <button
                    type="button"
                    onClick={() => updateTemporaryWorkSelection(selection.id, { enabled: !selection.enabled })}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                      selection.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {selection.enabled
                        ? <CheckCircle size={16} weight="bold" />
                        : <MinusCircle size={16} weight="regular" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${selection.enabled ? 'text-emerald-900' : 'text-slate-700'}`}>
                        {selection.label}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{selection.description}</div>
                    </div>
                  </button>

                  {/* Inline qty/price inputs when enabled */}
                  <AnimatePresence>
                    {selection.enabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-emerald-200 px-4 pb-4 pt-3"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              Qty ({selection.unit})
                            </label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const prev = Math.max(0, Number(selection.quantity) - 1);
                                  updateTemporaryWorkSelection(selection.id, { quantity: String(prev) });
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              >
                                <Minus size={12} weight="bold" />
                              </button>
                              <input
                                type="number"
                                value={selection.quantity}
                                onChange={(e) => updateTemporaryWorkSelection(selection.id, { quantity: e.target.value })}
                                className="w-12 rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-900 outline-none focus:border-emerald-400"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = Number(selection.quantity) + 1;
                                  updateTemporaryWorkSelection(selection.id, { quantity: String(next) });
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              >
                                <Plus size={12} weight="bold" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              Unit Price (USD)
                            </label>
                            <input
                              type="number"
                              value={selection.unitPriceUsd}
                              onChange={(e) => updateTemporaryWorkSelection(selection.id, { unitPriceUsd: e.target.value })}
                              placeholder="Optional"
                              className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-400 placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Septic tank toggle */}
            <motion.div
              layout
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                includeSepticTank ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setIncludeSepticTank(!includeSepticTank)}
                className="flex w-full items-center gap-3 p-5 text-left"
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg ${
                  includeSepticTank ? 'bg-indigo-600' : 'bg-slate-100'
                }`}>
                  🚿
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${includeSepticTank ? 'text-indigo-900' : 'text-slate-800'}`}>
                    Include custom septic tank
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">Add a custom-dimensioned septic system to your BOQ.</div>
                </div>
                <div className={`ml-auto flex h-6 w-11 items-center rounded-full transition-colors ${
                  includeSepticTank ? 'bg-indigo-600' : 'bg-slate-200'
                }`}>
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    includeSepticTank ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
              </button>

              <AnimatePresence>
                {includeSepticTank && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-indigo-200 px-5 pb-5 pt-4"
                  >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-600">Septic dimensions</p>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                      {(['length', 'width', 'height'] as const).map((dim) => (
                        <div key={dim}>
                          <label className="mb-1 block text-xs font-medium capitalize text-indigo-700">{dim} (m)</label>
                          <input
                            type="number"
                            value={septicDimensions[dim]}
                            onChange={(e) => updateSepticDimensions({ [dim]: e.target.value })}
                            className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-indigo-700">Unit Price (USD/m³)</label>
                        <input
                          type="number"
                          value={septicDimensions.unitPriceUsd}
                          onChange={(e) => updateSepticDimensions({ unitPriceUsd: e.target.value })}
                          placeholder="e.g. 120"
                          className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 placeholder:text-slate-400"
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
