'use client';

import { useState, useMemo, useEffect, type Dispatch, type SetStateAction } from 'react';
import RfqPanel from './RfqPanel';
import { useToast } from '@/components/ui/Toast';
import { getDocumentUrl } from '@/lib/services/projects';
import type { Project, BOQItem, ProjectDocument, PurchaseRecord } from '@/lib/database.types';
import {
  filterProcurementItems,
  groupProcurementItems,
  procurementStats,
  purchasesCsv,
  withPurchases,
  type GroupByOption,
  type ItemWithPurchases,
  type ProcurementStage,
  type StatusFilter,
} from '@/lib/projects/procurement';
import { ArrowClockwise, Warning } from '@phosphor-icons/react';
import { useProcurementData } from './procurement/useProcurementData';
import { usePurchaseForm } from './procurement/usePurchaseForm';
import ProcurementSummary from './procurement/ProcurementSummary';
import ProcurementTabs from './procurement/ProcurementTabs';
import ProcurementToolbar from './procurement/ProcurementToolbar';
import ProcurementItemsTab from './procurement/ProcurementItemsTab';
import ProcurementPurchasesTab from './procurement/ProcurementPurchasesTab';
import PurchaseDialog from './procurement/PurchaseDialog';

interface UnifiedProcurementViewProps {
  project: Project;
  purchases: PurchaseRecord[];
  setPurchases: Dispatch<SetStateAction<PurchaseRecord[]>>;
  items: BOQItem[];
  onItemsRefresh: () => Promise<void>;
  selectedItemForPurchase?: BOQItem | null;
  onClearSelectedItem?: () => void;
}

export default function UnifiedProcurementView({
  project,
  purchases,
  setPurchases,
  items,
  onItemsRefresh,
  selectedItemForPurchase: externalSelectedItem,
  onClearSelectedItem,
}: UnifiedProcurementViewProps) {
  const { success, error: showError } = useToast();

  // Which section, and how the items are searched, filtered and grouped
  const [activeStage, setActiveStage] = useState<ProcurementStage>('boq');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupByOption>('stage');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const {
    isLoading, loadError, loadData, rfqs, suppliers, receiptDocs, setReceiptDocs,
  } = useProcurementData(project.id);


  const receiptById = useMemo(() => {
    const map = new Map<string, ProjectDocument>();
    receiptDocs.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [receiptDocs]);

  const itemsWithPurchases: ItemWithPurchases[] = useMemo(() => withPurchases(items, purchases), [items, purchases]);

  const filteredItems = useMemo(
    () => filterProcurementItems(itemsWithPurchases, searchQuery, statusFilter),
    [itemsWithPurchases, searchQuery, statusFilter]
  );

  const groupedItems = useMemo(() => groupProcurementItems(filteredItems, groupBy), [filteredItems, groupBy]);

  const stats = useMemo(
    () => procurementStats(items, itemsWithPurchases, rfqs, project.total_usd),
    [project.total_usd, items, itemsWithPurchases, rfqs]
  );

  const purchase = usePurchaseForm({
    projectId: project.id,
    suppliers,
    itemsWithPurchases,
    setPurchases,
    setReceiptDocs,
    setExpandedItems,
    onItemsRefresh,
  });
  const { openPurchaseModal, savingItemId } = purchase;

  // Handle external item selection (from BOQ quick action)
  useEffect(() => {
    if (externalSelectedItem) {
      openPurchaseModal(externalSelectedItem);
      onClearSelectedItem?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- as before the split: runs when a new item arrives, not when the opener is recreated
  }, [externalSelectedItem, onClearSelectedItem]);

  const handleOpenReceipt = async (documentId: string | null) => {
    if (!documentId) return;
    const document = receiptById.get(documentId);
    if (!document) {
      showError('Receipt not found.');
      return;
    }
    const url = await getDocumentUrl(document.storage_path);
    if (!url) {
      showError('Unable to open receipt.');
      return;
    }
    window.open(url, '_blank');
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const handleExportCSV = () => {
    if (purchases.length === 0) {
      showError('No purchase records to export');
      return;
    }

    const csv = purchasesCsv(purchases, items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}_purchases_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('Purchases exported to CSV');
  };

  return (
    <div className="procurement-view">
      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading procurement data">
          <span className="sr-only">Loading procurement data</span>
          <div className="h-36 animate-pulse rounded-lg bg-[var(--color-mist)] motion-reduce:animate-none" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--color-mist)] motion-reduce:animate-none sm:w-80" />
          <div className="h-48 animate-pulse rounded-lg bg-[var(--color-mist)] motion-reduce:animate-none" />
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="flex min-h-48 flex-col items-start justify-center rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-5"
        >
          <Warning size={28} weight="duotone" className="text-[var(--color-danger-fg)]" />
          <h3 className="mt-3 text-base font-bold text-[var(--color-text)]">Procurement data unavailable</h3>
          <p className="mt-1 max-w-lg text-sm text-[var(--color-text-secondary)]">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <ArrowClockwise size={18} weight="bold" /> Try again
          </button>
        </div>
      ) : (
        <>
          <ProcurementSummary
            stats={stats}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            setActiveStage={setActiveStage}
          />
          <ProcurementTabs
            activeStage={activeStage}
            setActiveStage={setActiveStage}
            itemCount={items.length}
            purchaseCount={purchases.length}
            stats={stats}
          />

          <div className="content-area">
            {activeStage !== 'rfq' && (
              <ProcurementToolbar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                onExportCsv={handleExportCSV}
              />
            )}
            {activeStage === 'boq' && (
              <ProcurementItemsTab
                filteredItems={filteredItems}
                groupedItems={groupedItems}
                groupBy={groupBy}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                collapsedGroups={collapsedGroups}
                toggleGroupCollapsed={toggleGroupCollapsed}
                expandedItems={expandedItems}
                savingItemId={savingItemId}
                toggleItemExpanded={toggleItemExpanded}
                openPurchaseModal={openPurchaseModal}
                onOpenReceipt={handleOpenReceipt}
              />
            )}
            {activeStage === 'history' && (
              <ProcurementPurchasesTab purchases={purchases} items={items} stats={stats} onOpenReceipt={handleOpenReceipt} />
            )}
            {/* Was an EmptyState reading "RFQ management coming soon". The RFQ backend
                worked the whole time — only the Marketplace ever called it, one material
                at a time — so a builder could not raise a request from their own BOQ. */}
            {activeStage === 'rfq' && (
              <RfqPanel
                project={project}
                items={items}
                rfqs={rfqs}
                onRefresh={loadData}
              />
            )}
          </div>
        </>
      )}

      {/* Purchase Modal */}
      {purchase.showPurchaseModal && purchase.selectedItemForPurchase && (
        <PurchaseDialog
          purchaseDialog={purchase.purchaseDialog}
          cameraInput={purchase.cameraInput}
          selectedItemForPurchase={purchase.selectedItemForPurchase}
          itemsWithPurchases={itemsWithPurchases}
          suppliers={suppliers}
          purchaseForm={purchase.purchaseForm}
          setPurchaseForm={purchase.setPurchaseForm}
          formErrors={purchase.formErrors}
          setFormErrors={purchase.setFormErrors}
          purchaseError={purchase.purchaseError}
          purchaseStatus={purchase.purchaseStatus}
          isSavingPurchase={purchase.isSavingPurchase}
          closePurchase={purchase.closePurchase}
          selectReceipt={purchase.selectReceipt}
          onSavePurchase={purchase.handleSavePurchase}
        />
      )}
    </div>
  );
}
