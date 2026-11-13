'use client';

import { useCurrency } from '@/components/ui/CurrencyToggle';
import { spendingBarColor as barColorFor, type ProcurementStage, type ProcurementStats, type StatusFilter } from '@/lib/projects/procurement';
import { Check, Clock, FileText } from '@phosphor-icons/react';

export interface ProcurementSummaryProps {
  stats: ProcurementStats;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  setActiveStage: (stage: ProcurementStage) => void;
}

/** Spend against the BOQ estimate, and what is still to buy. */
export default function ProcurementSummary({ stats, statusFilter, setStatusFilter, setActiveStage }: ProcurementSummaryProps) {
  const { formatPrice, exchangeRate } = useCurrency();
  const spendingBarColor = barColorFor(stats.spendingProgress);
  return (
    <section
      className="reveal overflow-hidden rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)]"
      data-delay="2"
      aria-label="Procurement overview"
    >
      <div className="grid grid-cols-2 divide-x divide-[var(--color-border-light)] border-b border-[var(--color-border-light)] lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setActiveStage('boq');
            setStatusFilter(statusFilter === 'outstanding' ? 'all' : 'outstanding');
          }}
          aria-pressed={statusFilter === 'outstanding'}
          className="min-h-24 p-3 text-left transition-colors hover:bg-[var(--color-mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] sm:p-4"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            <Clock size={17} weight="bold" className="text-[var(--color-amber)]" /> Pending items
          </span>
          <strong className="mt-2 block text-2xl font-bold text-[var(--color-text)]">{stats.outstandingItems}</strong>
          <span className="text-xs text-[var(--color-text-muted)]">still need purchasing</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveStage('boq');
            setStatusFilter(statusFilter === 'fulfilled' ? 'all' : 'fulfilled');
          }}
          aria-pressed={statusFilter === 'fulfilled'}
          className="min-h-24 p-3 text-left transition-colors hover:bg-[var(--color-mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] sm:p-4"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            <Check size={17} weight="bold" className="text-[var(--color-success)]" /> Purchased
          </span>
          <strong className="mt-2 block text-2xl font-bold text-[var(--color-text)]">
            {stats.fulfilledItems}<span className="text-sm font-medium text-[var(--color-text-muted)]">/{stats.totalItems}</span>
          </strong>
          <span className="text-xs text-[var(--color-text-muted)]">{stats.purchaseProgress.toFixed(0)}% fulfilled</span>
        </button>

        <div className="col-span-2 border-t border-[var(--color-border-light)] p-3 sm:p-4 lg:border-t-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Actual spend</span>
              <strong className="mt-1 block break-words text-lg font-bold text-[var(--color-text)] sm:text-xl">
                {formatPrice(stats.totalSpent, stats.totalSpent * exchangeRate)}
              </strong>
            </div>
            <div className="min-w-0 text-right">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">BOQ estimate</span>
              <strong className="mt-1 block break-words text-sm font-bold text-[var(--color-text)] sm:text-base">
                {formatPrice(stats.totalBudget, stats.totalBudget * exchangeRate)}
              </strong>
            </div>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-mist)]"
            role="progressbar"
            aria-label="Actual spend against BOQ estimate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(stats.spendingProgress))}
          >
            <div
              className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${Math.min(stats.spendingProgress, 100)}%`, background: spendingBarColor }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--color-text-muted)]">{stats.spendingProgress.toFixed(0)}% used</span>
            <span className={stats.variance > 0 ? 'font-semibold text-[var(--color-danger)]' : 'font-semibold text-[var(--color-success)]'}>
              {stats.variance > 0 ? 'Over by ' : 'Available '}
              {formatPrice(Math.abs(stats.remainingBudget), Math.abs(stats.remainingBudget) * exchangeRate)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setActiveStage('rfq')}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] sm:px-4"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <FileText size={18} weight="duotone" className="shrink-0 text-[var(--color-accent)]" />
          <span className="truncate">Request and compare supplier quotes</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-[var(--color-accent)]">
          {stats.pendingRfqs > 0 ? `${stats.pendingRfqs} active` : 'Start RFQ'}
        </span>
      </button>
    </section>
  );
}
