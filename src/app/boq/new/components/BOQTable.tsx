'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkle,
  Plus,
  CaretDown,
  CaretUp,
  Trash,
  ArrowCounterClockwise,
  MagnifyingGlass,
  CheckCircle,
  PencilSimple,
  ArrowsOut,
  ArrowsIn,
  Minus,
} from '@phosphor-icons/react';
import { useBoqWizardStore, type BOQItem } from '@/store/boqWizardStore';

const MILESTONE_LABELS: Record<string, string> = {
  substructure: 'Substructure & Foundation',
  superstructure: 'Superstructure & Masonry',
  roofing: 'Roofing & Truss Work',
  finishing: 'Finishing & Internal Works',
  exterior: 'Exterior & Site Works',
  labor: 'Labor & Construction Crew',
};

function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BOQTable() {
  const milestonesState = useBoqWizardStore((state) => state.milestonesState);
  const projectScope = useBoqWizardStore((state) => state.projectScope);
  const selectedStages = useBoqWizardStore((state) => state.selectedStages);
  const laborType = useBoqWizardStore((state) => state.laborType);
  const {
    toggleMilestoneExpanded,
    updateMilestoneItemQuantity,
    updateMilestoneItem,
    removeMilestoneItem,
    addMilestoneItem,
  } = useBoqWizardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterModifiedOnly, setFilterModifiedOnly] = useState(false);
  const [addingToMilestone, setAddingToMilestone] = useState<string | null>(null);

  // New Custom Item Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('each');
  const [newItemPrice, setNewItemPrice] = useState('0');

  // Filter visible milestones based on scope and labor options
  const visibleMilestones = useMemo(() => {
    return milestonesState.filter((milestone) => {
      if (milestone.id === 'labor') {
        return laborType === 'materials_labor';
      }
      if (projectScope === 'stage') {
        return selectedStages.includes(milestone.id);
      }
      return true;
    });
  }, [milestonesState, projectScope, selectedStages, laborType]);

  // Overall totals and statistics
  const { grandTotal, totalItemsCount, modifiedItemsCount, milestoneTotals } = useMemo(() => {
    let grandTotalSum = 0;
    let totalItems = 0;
    let modifiedItems = 0;
    const milestoneTotalsMap: Record<string, number> = {};

    visibleMilestones.forEach((m) => {
      let mSum = 0;
      m.items.forEach((item) => {
        const qty = item.quantity || 0;
        const lineVal = qty * item.actualPriceUsd;
        mSum += lineVal;
        totalItems += 1;
        const isModified =
          item.isOverridden ||
          (item.calculatedQuantity !== undefined && item.quantity !== item.calculatedQuantity);
        if (isModified) {
          modifiedItems += 1;
        }
      });
      milestoneTotalsMap[m.id] = mSum;
      grandTotalSum += mSum;
    });

    return {
      grandTotal: grandTotalSum,
      totalItemsCount: totalItems,
      modifiedItemsCount: modifiedItems,
      milestoneTotals: milestoneTotalsMap,
    };
  }, [visibleMilestones]);

  const allExpanded = useMemo(() => {
    return visibleMilestones.length > 0 && visibleMilestones.every((m) => m.expanded);
  }, [visibleMilestones]);

  const toggleExpandAll = () => {
    const nextState = !allExpanded;
    visibleMilestones.forEach((m) => {
      if (m.expanded !== nextState) {
        toggleMilestoneExpanded(m.id);
      }
    });
  };

  const handleAddCustomSubmit = (milestoneId: string) => {
    if (!newItemName.trim()) return;
    const id = `custom-${milestoneId}-${Date.now()}`;
    const qty = Math.max(0, parseFloat(newItemQty) || 1);
    const price = Math.max(0, parseFloat(newItemPrice) || 0);

    addMilestoneItem(milestoneId, {
      id,
      materialId: id,
      materialName: newItemName.trim(),
      quantity: qty,
      calculatedQuantity: qty,
      unit: newItemUnit.trim() || 'each',
      averagePriceUsd: price,
      averagePriceZwg: price * 30,
      actualPriceUsd: price,
      actualPriceZwg: price * 30,
      category: milestoneId,
      isOverridden: true,
    });

    setNewItemName('');
    setNewItemQty('1');
    setNewItemUnit('each');
    setNewItemPrice('0');
    setAddingToMilestone(null);
  };

  const addAiSuggestion = (milestoneId: string) => {
    const id = `ai-${milestoneId}-${Date.now()}`;
    addMilestoneItem(milestoneId, {
      id,
      materialId: `${milestoneId}-allowance`,
      materialName: `${MILESTONE_LABELS[milestoneId] || milestoneId} Contingency Allowance`,
      quantity: 1,
      calculatedQuantity: 1,
      unit: 'lot',
      averagePriceUsd: 150,
      averagePriceZwg: 4500,
      actualPriceUsd: 150,
      actualPriceZwg: 4500,
      description: 'AI recommended contingency allowance line item',
      category: milestoneId,
      isOverridden: true,
    });
  };

  const handleRevertItem = (milestoneId: string, item: BOQItem) => {
    const targetQty = item.calculatedQuantity !== undefined ? item.calculatedQuantity : (item.quantity || 0);
    updateMilestoneItemQuantity(milestoneId, item.id, targetQty);
    updateMilestoneItem(milestoneId, item.id, { isOverridden: false });
  };

  return (
    <div className="space-y-6">
      {/* ── Summary & Control Dashboard Header ───────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--color-text)]">Bill of Quantities Review</h2>
              <span className="rounded-full bg-[var(--color-accent-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                {totalItemsCount} Line Items
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Inspect generated materials, adjust quantities inline, and manage your project cost baseline.
            </p>
          </div>

          {/* Grand Total Hero Display */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-primary)] p-4 text-[var(--color-surface)] lg:min-w-[280px]">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-medium">Grand Total Baseline</p>
              <p className="text-2xl font-black tracking-tight text-[var(--color-surface)]">{formatUSD(grandTotal)}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary-light)] px-2 py-1 text-xs font-medium text-[var(--color-accent)]">
                <CheckCircle size={14} className="text-[var(--color-success)]" /> Calculated
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Cost Distribution Progress Bar */}
        {grandTotal > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium">
              <span>Cost Allocation Breakdown</span>
              <span>{visibleMilestones.length} Active Milestones</span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-background)] border border-[var(--color-border-light)]">
              {visibleMilestones.map((m) => {
                const sub = milestoneTotals[m.id] || 0;
                const pct = (sub / grandTotal) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={m.id}
                    style={{ width: `${pct}%` }}
                    className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full bg-[var(--color-accent)] opacity-85 hover:opacity-100"
                    title={`${MILESTONE_LABELS[m.id] || m.id}: ${formatUSD(sub)} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Search, Filter & Batch Controls */}
        <div className="mt-5 flex flex-col gap-3 pt-4 border-t border-[var(--color-border-light)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <input
                type="text"
                placeholder="Search material or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter line items by material name"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-2 pl-9 pr-3 text-xs sm:text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] outline-none transition focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)]"
              />
            </div>

            {/* Filter Modified Items Toggle */}
            <button
              type="button"
              onClick={() => setFilterModifiedOnly(!filterModifiedOnly)}
              aria-pressed={filterModifiedOnly}
              aria-label="Toggle filter for edited line items only"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                filterModifiedOnly
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              <PencilSimple size={14} />
              <span>Overridden Only ({modifiedItemsCount})</span>
            </button>
          </div>

          {/* Expand/Collapse All */}
          <button
            type="button"
            onClick={toggleExpandAll}
            aria-label={allExpanded ? 'Collapse all milestones' : 'Expand all milestones'}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
          >
            {allExpanded ? <ArrowsIn size={14} /> : <ArrowsOut size={14} />}
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </button>
        </div>
      </section>

      {/* ── Milestones List ─────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {visibleMilestones.map((milestone) => {
          const subtotal = milestoneTotals[milestone.id] || 0;

          // Apply search and override filters
          const filteredItems = milestone.items.filter((item) => {
            const matchesSearch =
              !searchQuery.trim() ||
              item.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (item.unit && item.unit.toLowerCase().includes(searchQuery.toLowerCase()));

            const isModified =
              item.isOverridden || (item.calculatedQuantity !== undefined && item.quantity !== item.calculatedQuantity);

            const matchesModified = !filterModifiedOnly || isModified;

            return matchesSearch && matchesModified;
          });

          return (
            <section
              key={milestone.id}
              className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm transition hover:border-[var(--color-border)]"
            >
              {/* Milestone Accordion Header */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-light)] bg-[var(--color-background)] px-4 py-3.5 sm:px-6">
                <button
                  type="button"
                  onClick={() => toggleMilestoneExpanded(milestone.id)}
                  aria-expanded={milestone.expanded}
                  aria-controls={`milestone-panel-${milestone.id}`}
                  className="flex items-center gap-3 text-left font-bold text-[var(--color-text)] outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-lg p-1"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-2xs">
                    {milestone.expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-bold text-[var(--color-text)]">
                        {MILESTONE_LABELS[milestone.id] || milestone.id}
                      </span>
                      <span className="rounded-full bg-[var(--color-border-light)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                        {milestone.items.length} items
                      </span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Subtotal</p>
                    <p className="text-sm sm:text-base font-extrabold text-[var(--color-text)]">{formatUSD(subtotal)}</p>
                  </div>
                </div>
              </header>

              {/* Milestone Content Panel */}
              <AnimatePresence initial={false}>
                {milestone.expanded && (
                  <motion.div
                    id={`milestone-panel-${milestone.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    {filteredItems.length === 0 ? (
                      <div className="p-8 text-center text-xs sm:text-sm text-[var(--color-text-secondary)]">
                        {milestone.items.length === 0
                          ? 'No items generated for this milestone yet.'
                          : 'No items match your active search or filter criteria.'}
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table View (md and up) */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm border-collapse" aria-label={`${MILESTONE_LABELS[milestone.id] || milestone.id} Table`}>
                            <thead>
                              <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-background)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                <th scope="col" className="px-5 py-3">Material / Description</th>
                                <th scope="col" className="px-4 py-3 text-center">Quantity</th>
                                <th scope="col" className="px-4 py-3 text-left">Unit</th>
                                <th scope="col" className="px-4 py-3 text-right">Unit Price (USD)</th>
                                <th scope="col" className="px-5 py-3 text-right">Line Total (USD)</th>
                                <th scope="col" className="px-4 py-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-light)]">
                              {filteredItems.map((item) => {
                                const qty = item.quantity || 0;
                                const lineTotal = qty * item.actualPriceUsd;
                                const isModified =
                                  item.isOverridden ||
                                  (item.calculatedQuantity !== undefined && item.quantity !== item.calculatedQuantity);

                                return (
                                  <tr
                                    key={item.id}
                                    className={`transition hover:bg-[var(--color-background)] ${
                                      isModified ? 'bg-[var(--color-accent-bg)]/30' : ''
                                    }`}
                                  >
                                    {/* Material Name */}
                                    <td className="px-5 py-3 align-middle font-medium text-[var(--color-text)]">
                                      <input
                                        type="text"
                                        value={item.materialName}
                                        onChange={(e) =>
                                          updateMilestoneItem(milestone.id, item.id, {
                                            materialName: e.target.value,
                                            isOverridden: true,
                                          })
                                        }
                                        aria-label={`Material name for ${item.materialName}`}
                                        className="w-full rounded-md border border-transparent bg-transparent py-1 px-1.5 text-xs sm:text-sm font-semibold text-[var(--color-text)] outline-none hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)]"
                                      />
                                      {isModified && (
                                        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] font-bold text-[var(--color-accent)]">
                                          <span>Edited</span>
                                          {item.calculatedQuantity !== undefined && (
                                            <span className="text-[var(--color-text-secondary)] font-normal">
                                              (Calc: {item.calculatedQuantity})
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Inline Quantity Controls */}
                                    <td className="px-4 py-3 align-middle">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateMilestoneItemQuantity(
                                              milestone.id,
                                              item.id,
                                              Math.max(0, Number((qty - 1).toFixed(2)))
                                            )
                                          }
                                          aria-label={`Decrease quantity of ${item.materialName}`}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition hover:bg-[var(--color-background)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                                        >
                                          <Minus size={12} />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={item.quantity ?? ''}
                                          onChange={(e) =>
                                            updateMilestoneItemQuantity(
                                              milestone.id,
                                              item.id,
                                              Math.max(0, parseFloat(e.target.value) || 0)
                                            )
                                          }
                                          aria-label={`Quantity of ${item.materialName}`}
                                          className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 text-center text-xs sm:text-sm font-bold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateMilestoneItemQuantity(
                                              milestone.id,
                                              item.id,
                                              Number((qty + 1).toFixed(2))
                                            )
                                          }
                                          aria-label={`Increase quantity of ${item.materialName}`}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition hover:bg-[var(--color-background)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                                        >
                                          <Plus size={12} />
                                        </button>
                                      </div>
                                    </td>

                                    {/* Unit */}
                                    <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-secondary)] font-medium">
                                      {item.unit}
                                    </td>

                                    {/* Unit Price */}
                                    <td className="px-4 py-3 align-middle text-right font-medium text-[var(--color-text)]">
                                      <div className="inline-flex items-center gap-1 justify-end">
                                        <span className="text-xs text-[var(--color-text-secondary)]">$</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={item.actualPriceUsd}
                                          onChange={(e) =>
                                            updateMilestoneItem(milestone.id, item.id, {
                                              actualPriceUsd: Math.max(0, parseFloat(e.target.value) || 0),
                                              isOverridden: true,
                                            })
                                          }
                                          aria-label={`Unit price USD for ${item.materialName}`}
                                          className="w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 px-1.5 text-right text-xs sm:text-sm font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                                        />
                                      </div>
                                    </td>

                                    {/* Line Total */}
                                    <td className="px-5 py-3 align-middle text-right font-bold text-[var(--color-text)]">
                                      {formatUSD(lineTotal)}
                                    </td>

                                    {/* Action Buttons: Revert & Delete */}
                                    <td className="px-4 py-3 align-middle text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {isModified && (
                                          <button
                                            type="button"
                                            onClick={() => handleRevertItem(milestone.id, item)}
                                            title="Revert to calculated quantity"
                                            aria-label={`Revert ${item.materialName} to calculated quantity`}
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] transition"
                                          >
                                            <ArrowCounterClockwise size={14} />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => removeMilestoneItem(milestone.id, item.id)}
                                          title="Delete line item"
                                          aria-label={`Delete ${item.materialName}`}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition"
                                        >
                                          <Trash size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card List View (< md / 375px display) */}
                        <div className="block md:hidden divide-y divide-[var(--color-border-light)]">
                          {filteredItems.map((item) => {
                            const qty = item.quantity || 0;
                            const lineTotal = qty * item.actualPriceUsd;
                            const isModified =
                              item.isOverridden ||
                              (item.calculatedQuantity !== undefined && item.quantity !== item.calculatedQuantity);

                            return (
                              <div key={item.id} className="p-4 space-y-3 bg-[var(--color-surface)]">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      value={item.materialName}
                                      onChange={(e) =>
                                        updateMilestoneItem(milestone.id, item.id, {
                                          materialName: e.target.value,
                                          isOverridden: true,
                                        })
                                      }
                                      aria-label={`Material name for ${item.materialName}`}
                                      className="w-full rounded-md border border-transparent bg-transparent py-0.5 text-xs font-bold text-[var(--color-text)] outline-none focus:border-[var(--color-border)]"
                                    />
                                    {isModified && (
                                      <p className="mt-0.5 text-[10px] font-bold text-[var(--color-accent)]">
                                        Edited {item.calculatedQuantity !== undefined && `(Calc: ${item.calculatedQuantity})`}
                                      </p>
                                    )}
                                  </div>

                                  <div className="text-right">
                                    <p className="text-xs font-extrabold text-[var(--color-text)]">{formatUSD(lineTotal)}</p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)] font-medium">${item.actualPriceUsd} / {item.unit}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateMilestoneItemQuantity(
                                          milestone.id,
                                          item.id,
                                          Math.max(0, Number((qty - 1).toFixed(2)))
                                        )
                                      }
                                      aria-label={`Decrease quantity of ${item.materialName}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={item.quantity ?? ''}
                                      onChange={(e) =>
                                        updateMilestoneItemQuantity(
                                          milestone.id,
                                          item.id,
                                          Math.max(0, parseFloat(e.target.value) || 0)
                                        )
                                      }
                                      aria-label={`Quantity of ${item.materialName}`}
                                      className="w-16 rounded-lg border border-[var(--color-border)] py-1 text-center text-xs font-bold text-[var(--color-text)] outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateMilestoneItemQuantity(
                                          milestone.id,
                                          item.id,
                                          Number((qty + 1).toFixed(2))
                                        )
                                      }
                                      aria-label={`Increase quantity of ${item.materialName}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                                    >
                                      <Plus size={12} />
                                    </button>
                                    <span className="ml-1 text-[11px] text-[var(--color-text-secondary)] font-semibold">{item.unit}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {isModified && (
                                      <button
                                        type="button"
                                        onClick={() => handleRevertItem(milestone.id, item)}
                                        aria-label={`Revert ${item.materialName}`}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-accent)]"
                                      >
                                        <ArrowCounterClockwise size={14} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => removeMilestoneItem(milestone.id, item.id)}
                                      aria-label={`Delete ${item.materialName}`}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border-light)] text-[var(--color-error)]"
                                    >
                                      <Trash size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Milestone Footer Actions (Add Material & AI Suggestion) */}
                    <div className="border-t border-[var(--color-border-light)] bg-[var(--color-background)] p-3.5 sm:px-6">
                      {addingToMilestone === milestone.id ? (
                        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
                          <p className="text-xs font-bold text-[var(--color-text)]">Add Custom Line Item to {MILESTONE_LABELS[milestone.id] || milestone.id}</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                            <input
                              type="text"
                              placeholder="Material name..."
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              aria-label="Custom item material name"
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-xs text-[var(--color-text)] outline-none sm:col-span-2"
                            />
                            <input
                              type="number"
                              placeholder="Qty"
                              value={newItemQty}
                              onChange={(e) => setNewItemQty(e.target.value)}
                              aria-label="Custom item quantity"
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-xs text-[var(--color-text)] outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Unit (e.g. m³, bags)"
                              value={newItemUnit}
                              onChange={(e) => setNewItemUnit(e.target.value)}
                              aria-label="Custom item unit"
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-xs text-[var(--color-text)] outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-[var(--color-text-secondary)] font-medium">Unit Price (USD):</span>
                              <input
                                type="number"
                                placeholder="Price USD"
                                value={newItemPrice}
                                onChange={(e) => setNewItemPrice(e.target.value)}
                                aria-label="Custom item unit price USD"
                                className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-1.5 text-xs text-[var(--color-text)] outline-none font-bold"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setAddingToMilestone(null)}
                                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddCustomSubmit(milestone.id)}
                                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-surface)] hover:opacity-90"
                              >
                                Add Line Item
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setAddingToMilestone(milestone.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-background)] transition shadow-2xs"
                            >
                              <Plus size={14} className="text-[var(--color-accent)]" /> Add Item
                            </button>
                            <button
                              type="button"
                              onClick={() => addAiSuggestion(milestone.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] hover:opacity-90 transition shadow-2xs"
                            >
                              <Sparkle size={14} /> AI Allowance
                            </button>
                          </div>
                          <span className="text-[11px] text-[var(--color-text-secondary)] font-semibold">
                            Subtotal: {formatUSD(subtotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>

      {/* ── Footer Grand Total Banner ───────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary)] p-5 text-[var(--color-surface)] shadow-md">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">Finalized BOQ Total</p>
          <p className="text-2xl sm:text-3xl font-black text-[var(--color-surface)]">{formatUSD(grandTotal)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Includes all materials, quantities, and active scope milestones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleExpandAll}
            className="rounded-xl border border-[var(--color-primary-light)] bg-[var(--color-primary-dark)] px-4 py-2.5 text-xs font-bold text-[var(--color-surface)] hover:bg-[var(--color-primary-light)] transition"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </section>
    </div>
  );
}
