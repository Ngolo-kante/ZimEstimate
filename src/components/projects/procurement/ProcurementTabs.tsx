'use client';

import type { ProcurementStage, ProcurementStats } from '@/lib/projects/procurement';
import { FileText, Package, Receipt } from '@phosphor-icons/react';

export interface ProcurementTabsProps {
  activeStage: ProcurementStage;
  setActiveStage: (stage: ProcurementStage) => void;
  itemCount: number;
  purchaseCount: number;
  stats: ProcurementStats;
}

/** Items, Quotes and Purchases. */
export default function ProcurementTabs({ activeStage, setActiveStage, itemCount, purchaseCount, stats }: ProcurementTabsProps) {
  return (
    <nav className="stage-tabs reveal" data-delay="1" aria-label="Procurement sections">
      <button
        type="button"
        aria-current={activeStage === 'boq' ? 'page' : undefined}
        onClick={() => setActiveStage('boq')}
        className={`stage-tab-btn min-h-11 ${activeStage === 'boq' ? 'active' : ''}`}
      >
        <Package size={16} weight="duotone" />
        <span>Items</span>
        <span className="tab-count">{itemCount}</span>
      </button>
      <button
        type="button"
        aria-current={activeStage === 'rfq' ? 'page' : undefined}
        onClick={() => setActiveStage('rfq')}
        className={`stage-tab-btn min-h-11 ${activeStage === 'rfq' ? 'active' : ''}`}
      >
        <FileText size={16} weight="duotone" />
        <span>Quotes</span>
        {stats.pendingRfqs > 0 && <span className="tab-count">{stats.pendingRfqs}</span>}
      </button>
      <button
        type="button"
        aria-current={activeStage === 'history' ? 'page' : undefined}
        onClick={() => setActiveStage('history')}
        className={`stage-tab-btn min-h-11 ${activeStage === 'history' ? 'active' : ''}`}
      >
        <Receipt size={16} weight="duotone" />
        <span>Purchases</span>
        {purchaseCount > 0 && <span className="tab-count">{purchaseCount}</span>}
      </button>
    </nav>
  );
}
