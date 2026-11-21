'use client';

import HeightCollapse from '@/components/ui/HeightCollapse';
import { useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { BOQItem } from '@/lib/database.types';
import { groupStats as getStageStats, type BOQStage, type GroupByOption, type ItemWithPurchases, type StatusFilter } from '@/lib/projects/procurement';
import { STAGE_CONFIG } from './procurementConfig';
import ProcurementItemCard from './ProcurementItemCard';
import { CaretDown, CaretUp, Package, ShoppingCart } from '@phosphor-icons/react';

export interface ProcurementItemsTabProps {
  filteredItems: ItemWithPurchases[];
  groupedItems: Record<string, ItemWithPurchases[]>;
  groupBy: GroupByOption;
  searchQuery: string;
  statusFilter: StatusFilter;
  collapsedGroups: Set<string>;
  toggleGroupCollapsed: (groupKey: string) => void;
  expandedItems: Set<string>;
  savingItemId: string | null;
  toggleItemExpanded: (itemId: string) => void;
  openPurchaseModal: (item: BOQItem) => void;
  onOpenReceipt: (documentId: string | null) => void;
}

/** The BOQ lines to buy, grouped. */
export default function ProcurementItemsTab({
  filteredItems,
  groupedItems,
  groupBy,
  searchQuery,
  statusFilter,
  collapsedGroups,
  toggleGroupCollapsed,
  expandedItems,
  savingItemId,
  toggleItemExpanded,
  openPurchaseModal,
  onOpenReceipt,
}: ProcurementItemsTabProps) {
  const { formatPrice, exchangeRate } = useCurrency();
  const [animateCollapse, setAnimateCollapse] = useState(true);
    if (filteredItems.length === 0) {
      return (
        <EmptyState
          icon={<ShoppingCart size={48} weight="light" />}
          title="No items found"
          description={searchQuery || statusFilter !== 'all'
            ? "Try adjusting your filters"
            : "Add items to your BOQ to start tracking procurement"}
        />
      );
    }

    return (
      <div className="boq-groups">
        {Object.entries(groupedItems).map(([groupKey, groupItems]) => {
          const isCollapsed = collapsedGroups.has(groupKey);
          const stageConfig = STAGE_CONFIG[groupKey as BOQStage];
          const stageStats = getStageStats(groupItems);
          const StageIcon = stageConfig?.icon || Package;

          return (
            <div key={groupKey} className="boq-group">
              {groupBy !== 'none' && (
                <button
                  type="button"
                  className="group-header"
                  onClick={(event) => { setAnimateCollapse(event.detail !== 0); toggleGroupCollapsed(groupKey); }}
                  aria-expanded={!isCollapsed}
                  aria-label={`${stageConfig?.label || groupKey}: ${isCollapsed ? 'expand' : 'collapse'} ${stageStats.total} items`}
                >
                  <div className="group-header-left">
                    <div className="group-icon" style={{ background: 'var(--color-primary-bg)', color: stageConfig?.color || 'var(--color-text-muted)' }}>
                      <StageIcon size={18} weight="duotone" />
                    </div>
                    <div className="group-title">
                      <h3>{stageConfig?.label || groupKey}</h3>
                      <span className="group-count">{stageStats.total} item{stageStats.total !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="group-header-right">
                    <div className="group-stats">
                      <span className="stat purchased">{stageStats.purchased} purchased</span>
                      {stageStats.inProgress > 0 && <span className="stat progress">{stageStats.inProgress} in progress</span>}
                      <span className="stat spent">{formatPrice(stageStats.totalSpent, stageStats.totalSpent * exchangeRate)}</span>
                    </div>
                    <div className="group-toggle-icon">
                      {isCollapsed ? <CaretDown size={16} /> : <CaretUp size={16} />}
                    </div>
                  </div>
                </button>
              )}

              <HeightCollapse open={!isCollapsed} animate={animateCollapse}>
                <div className="group-items">
                  {groupItems.map((item) => (
                    <ProcurementItemCard
                      key={item.id}
                      item={item}
                      isExpanded={expandedItems.has(item.id)}
                      isSaving={savingItemId === item.id}
                      toggleItemExpanded={toggleItemExpanded}
                      openPurchaseModal={openPurchaseModal}
                      onOpenReceipt={onOpenReceipt}
                    />
                  ))}
                </div>
              </HeightCollapse>
            </div>
          );
        })}
      </div>
    );
}
