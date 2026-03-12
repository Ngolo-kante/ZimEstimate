'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CaretDown } from '@phosphor-icons/react';
import { TEMPORARY_WORKS_SUGGESTIONS } from '@/lib/buildFlowRules';
import { useBoqWizardStore } from '@/store/boqWizardStore';

interface SiteSetupSectionProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function SiteSetupSection({ isCollapsed, onToggle }: SiteSetupSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = onToggle || (() => setInternalCollapsed((prev) => !prev));
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
    temporaryWorksSelections.some(s => s.enabled) || includeSepticTank
  );

  useEffect(() => {
    if (temporaryWorksSelections.length > 0) {
      return;
    }

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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Site Setup</h2>
          <p className="mt-1 text-sm text-slate-500">Optional temporary works and septic setup can be costed here.</p>
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
        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-slate-200 p-5 bg-slate-50">
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Do you want to add temporary site setup items to your BOQ?</h3>
            <p className="mb-4 text-xs text-slate-500">Temporary works like site toilets, fencing, or tool sheds are useful for accurate total project costing. If you&apos;re just getting a quick ballpark for materials, you can safely skip this for now.</p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setWantsSiteSetup(true)}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors shadow-sm ${wantsSiteSetup ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-md'}`}
              >
                Yes, add site setup
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setWantsSiteSetup(false)}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors shadow-sm ${!wantsSiteSetup ? 'border-slate-500 bg-slate-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-md'}`}
              >
                No, skip this
              </motion.button>
            </div>
          </div>

          {wantsSiteSetup && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {temporaryWorksSelections.map((selection) => (
                  <div
                    key={selection.id}
                    className={`rounded-xl border p-4 transition ${selection.enabled ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                      }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selection.enabled}
                        onChange={(event) => updateTemporaryWorkSelection(selection.id, { enabled: event.target.checked })}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{selection.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{selection.description}</span>
                      </span>
                    </label>

                    {selection.enabled && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Qty</label>
                          <input
                            type="number"
                            value={selection.quantity}
                            onChange={(event) => updateTemporaryWorkSelection(selection.id, { quantity: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Unit Price USD</label>
                          <input
                            type="number"
                            value={selection.unitPriceUsd}
                            onChange={(event) => updateTemporaryWorkSelection(selection.id, { unitPriceUsd: event.target.value })}
                            placeholder="Optional override"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-indigo-900">
                  <input
                    type="checkbox"
                    checked={includeSepticTank}
                    onChange={(event) => setIncludeSepticTank(event.target.checked)}
                  />
                  Include Custom Septic Tank
                </label>

                {includeSepticTank && (
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-indigo-700">Length (m)</label>
                      <input
                        type="number"
                        value={septicDimensions.length}
                        onChange={(event) => updateSepticDimensions({ length: event.target.value })}
                        className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-indigo-700">Width (m)</label>
                      <input
                        type="number"
                        value={septicDimensions.width}
                        onChange={(event) => updateSepticDimensions({ width: event.target.value })}
                        className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-indigo-700">Height (m)</label>
                      <input
                        type="number"
                        value={septicDimensions.height}
                        onChange={(event) => updateSepticDimensions({ height: event.target.value })}
                        className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-indigo-700">Unit Price USD / m3</label>
                      <input
                        type="number"
                        value={septicDimensions.unitPriceUsd}
                        onChange={(event) => updateSepticDimensions({ unitPriceUsd: event.target.value })}
                        className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
