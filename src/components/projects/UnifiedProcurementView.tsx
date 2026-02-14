'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  getPurchaseRecords,
  getSuppliers,
  createPurchaseRecord,
  uploadDocument,
  getProjectDocuments,
  getDocumentUrl,
  updateBOQItem,
} from '@/lib/services/projects';
import { supabase } from '@/lib/supabase';
import { getProjectRfqs } from '@/lib/services/rfq';
import type { RfqWithDetails } from '@/lib/services/rfq';
import {
  Project,
  BOQItem,
  PurchaseRecord,
  Supplier,
  ProjectDocument,
} from '@/lib/database.types';
import { useReveal } from '@/hooks/useReveal';
import {
  Plus,
  MagnifyingGlass,
  DownloadSimple,
  ShoppingCart,
  FileText,
  Storefront,
  TrendUp,
  Money,
  CaretDown,
  CaretRight,
  Check,
  Warning,
  Clock,
  Package,
  Receipt,
  X,
} from '@phosphor-icons/react';

type ProcurementStage = 'boq' | 'rfq' | 'history';
type ItemStatus = 'pending' | 'in_progress' | 'purchased' | 'over_purchased';

const toIsoMidday = (dateString: string) => {
  if (!dateString) return new Date().toISOString();
  const [year, month, day] = dateString.split('-').map(Number);
  const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return safeDate.toISOString();
};

interface UnifiedProcurementViewProps {
  project: Project;
  items: BOQItem[];
  onItemsRefresh: () => void;
}

interface ItemWithPurchases extends BOQItem {
  purchaseRecords: PurchaseRecord[];
  totalPurchased: number;
  totalSpent: number;
  status: ItemStatus;
  remainingQty: number;
}

export default function UnifiedProcurementView({
  project,
  items,
  onItemsRefresh,
}: UnifiedProcurementViewProps) {
  const { success, error: showError } = useToast();
  const { formatPrice, exchangeRate } = useCurrency();

  // State
  const [activeStage, setActiveStage] = useState<ProcurementStage>('boq');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Data State
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [rfqs, setRfqs] = useState<RfqWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receiptDocs, setReceiptDocs] = useState<ProjectDocument[]>([]);

  // Modal States
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<BOQItem | null>(null);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierName: '',
    quantity: '',
    unitPrice: '',
    purchasedAt: new Date().toISOString().split('T')[0],
    notes: '',
    receiptFile: null as File | null,
  });

  useReveal({ deps: [activeStage, purchases.length, items.length] });

  const receiptById = useMemo(() => {
    const map = new Map<string, ProjectDocument>();
    receiptDocs.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [receiptDocs]);

  // Calculate item status based on purchases
  const getItemStatus = (estimatedQty: number, purchasedQty: number): ItemStatus => {
    const epsilon = 0.01;
    if (purchasedQty < epsilon) return 'pending';
    if (purchasedQty >= estimatedQty - epsilon && purchasedQty <= estimatedQty + epsilon) return 'purchased';
    if (purchasedQty > estimatedQty + epsilon) return 'over_purchased';
    return 'in_progress';
  };

  // Group purchases by BOQ item
  const itemsWithPurchases: ItemWithPurchases[] = useMemo(() => {
    const purchasesByItem = new Map<string, PurchaseRecord[]>();
    purchases.forEach((p) => {
      const list = purchasesByItem.get(p.boq_item_id) || [];
      list.push(p);
      purchasesByItem.set(p.boq_item_id, list);
    });

    return items.map((item) => {
      const itemPurchases = purchasesByItem.get(item.id) || [];
      const totalPurchased = itemPurchases.reduce((sum, p) => sum + Number(p.quantity), 0);
      const totalSpent = itemPurchases.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price_usd), 0);
      const estimatedQty = Number(item.quantity) || 0;
      const status = getItemStatus(estimatedQty, totalPurchased);
      const remainingQty = Math.max(0, estimatedQty - totalPurchased);

      return {
        ...item,
        purchaseRecords: itemPurchases.sort((a, b) =>
          new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
        ),
        totalPurchased,
        totalSpent,
        status,
        remainingQty,
      };
    });
  }, [items, purchases]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = itemsWithPurchases;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.material_name.toLowerCase().includes(lowerQuery) ||
        item.category?.toLowerCase().includes(lowerQuery)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    return result;
  }, [itemsWithPurchases, searchQuery, statusFilter]);

  // Computed Stats
  const stats = useMemo(() => {
    const totalBudget = project.total_usd || 0;
    const totalSpent = itemsWithPurchases.reduce((sum, item) => sum + item.totalSpent, 0);
    const pendingRfqs = rfqs.filter(r => r.status === 'open' || r.status === 'draft').length;

    const statusCounts = {
      pending: itemsWithPurchases.filter(i => i.status === 'pending').length,
      in_progress: itemsWithPurchases.filter(i => i.status === 'in_progress').length,
      purchased: itemsWithPurchases.filter(i => i.status === 'purchased').length,
      over_purchased: itemsWithPurchases.filter(i => i.status === 'over_purchased').length,
    };

    return {
      totalBudget,
      totalSpent,
      remainingBudget: totalBudget - totalSpent,
      pendingRfqs,
      statusCounts,
      spendingProgress: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      totalItems: items.length,
    };
  }, [project.total_usd, itemsWithPurchases, rfqs, items.length]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [purchasesData, rfqsData, suppliersData, receiptsData] = await Promise.all([
        getPurchaseRecords(project.id),
        getProjectRfqs(project.id),
        getSuppliers(),
        getProjectDocuments(project.id, 'receipt'),
      ]);

      if (purchasesData.records) setPurchases(purchasesData.records);
      if (rfqsData.rfqs) setRfqs(rfqsData.rfqs);
      if (suppliersData.suppliers) setSuppliers(suppliersData.suppliers);
      if (receiptsData.documents) setReceiptDocs(receiptsData.documents);
    } catch (err) {
      console.error('Failed to load procurement data:', err);
      showError('Failed to load procurement data');
    } finally {
      setIsLoading(false);
    }
  }, [project.id, showError]);

  // Load initial data
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Realtime sync for procurement data
  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadData();
        onItemsRefresh(); // Sync BOQ tab
      }, 250);
    };

    const channel = supabase
      .channel(`procurement-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_records',
          filter: `project_id=eq.${project.id}`,
        },
        () => scheduleRefresh()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boq_items',
          filter: `project_id=eq.${project.id}`,
        },
        () => scheduleRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadData, project.id, onItemsRefresh]);

  const resetPurchaseForm = () => {
    setPurchaseForm({
      supplierName: '',
      quantity: '',
      unitPrice: '',
      purchasedAt: new Date().toISOString().split('T')[0],
      notes: '',
      receiptFile: null,
    });
  };

  const openPurchaseModal = (item: BOQItem) => {
    setSelectedItemForPurchase(item);
    // Pre-fill unit price from BOQ if available
    setPurchaseForm({
      ...purchaseForm,
      unitPrice: item.unit_price_usd ? String(item.unit_price_usd) : '',
    });
    setShowPurchaseModal(true);
  };

  const handleSavePurchase = async () => {
    if (!selectedItemForPurchase) {
      showError('No item selected.');
      return;
    }
    const supplierName = purchaseForm.supplierName.trim();
    if (!supplierName) {
      showError('Supplier name is required.');
      return;
    }
    const quantity = Number(purchaseForm.quantity);
    if (!quantity || quantity <= 0) {
      showError('Enter a valid quantity.');
      return;
    }
    const unitPrice = Number(purchaseForm.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      showError('Enter a valid unit price.');
      return;
    }

    const matchedSupplier = suppliers.find(
      (supplier) => supplier.name.toLowerCase() === supplierName.toLowerCase()
    );

    setIsSavingPurchase(true);
    let receiptDocumentId: string | null = null;

    if (purchaseForm.receiptFile) {
      const { document, error } = await uploadDocument(
        project.id,
        purchaseForm.receiptFile,
        'receipt',
        `Receipt for ${selectedItemForPurchase.material_name}`
      );
      if (error) {
        showError(error.message || 'Failed to upload receipt');
        setIsSavingPurchase(false);
        return;
      }
      if (document) {
        receiptDocumentId = document.id;
        setReceiptDocs((prev) => [document, ...prev]);
      }
    }

    const { error } = await createPurchaseRecord({
      project_id: project.id,
      boq_item_id: selectedItemForPurchase.id,
      supplier_name: supplierName,
      supplier_id: matchedSupplier?.id || null,
      quantity,
      unit_price_usd: unitPrice,
      purchased_at: toIsoMidday(purchaseForm.purchasedAt),
      notes: purchaseForm.notes || null,
      receipt_document_id: receiptDocumentId,
      rfq_quote_id: null,
    });

    if (error) {
      showError(error.message || 'Failed to record purchase');
    } else {
      // Update BOQ item's actual_quantity and is_purchased status
      const currentItem = itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id);
      const newTotalPurchased = (currentItem?.totalPurchased || 0) + quantity;
      const estimatedQty = Number(selectedItemForPurchase.quantity) || 0;

      await updateBOQItem(selectedItemForPurchase.id, {
        actual_quantity: newTotalPurchased,
        actual_price_usd: unitPrice,
        is_purchased: newTotalPurchased >= estimatedQty,
        purchased_date: new Date().toISOString(),
      });

      success('Purchase recorded');
      setShowPurchaseModal(false);
      setSelectedItemForPurchase(null);
      resetPurchaseForm();
      onItemsRefresh();
    }

    setIsSavingPurchase(false);
  };

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

  const getStatusConfig = (status: ItemStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: 'gray', icon: Clock, bgClass: 'status-pending' };
      case 'in_progress':
        return { label: 'In Progress', color: 'blue', icon: Package, bgClass: 'status-progress' };
      case 'purchased':
        return { label: 'Purchased', color: 'green', icon: Check, bgClass: 'status-purchased' };
      case 'over_purchased':
        return { label: 'Over Purchased', color: 'red', icon: Warning, bgClass: 'status-over' };
    }
  };

  const spendingBarColor = stats.spendingProgress > 100
    ? 'var(--color-danger)'
    : stats.spendingProgress > 75
      ? 'var(--color-amber)'
      : 'var(--color-accent)';

  const renderStageTabs = () => (
    <div className="stage-tabs reveal" data-delay="1">
      <button
        onClick={() => setActiveStage('boq')}
        className={`stage-tab-btn ${activeStage === 'boq' ? 'active' : ''}`}
      >
        <Package size={16} weight="duotone" />
        <span>BOQ Items</span>
        <span className="tab-count">{items.length}</span>
      </button>
      <button
        onClick={() => setActiveStage('rfq')}
        className={`stage-tab-btn ${activeStage === 'rfq' ? 'active' : ''}`}
      >
        <FileText size={16} weight="duotone" />
        <span>RFQs &amp; Quotes</span>
        {stats.pendingRfqs > 0 && <span className="tab-count">{stats.pendingRfqs}</span>}
      </button>
      <button
        onClick={() => setActiveStage('history')}
        className={`stage-tab-btn ${activeStage === 'history' ? 'active' : ''}`}
      >
        <Receipt size={16} weight="duotone" />
        <span>Purchase History</span>
        {purchases.length > 0 && <span className="tab-count">{purchases.length}</span>}
      </button>
    </div>
  );

  const renderSummaryCards = () => (
    <div className="summary-grid reveal" data-delay="2">
      <Card className="summary-card">
        <div className="summary-icon summary-icon-blue">
          <Money size={24} weight="duotone" />
        </div>
        <div className="summary-body">
          <div className="summary-label">Total Spent</div>
          <div className="summary-value">
            {formatPrice(stats.totalSpent, stats.totalSpent * exchangeRate)}
          </div>
        </div>
      </Card>

      <Card className="summary-card">
        <div className="summary-icon summary-icon-green">
          <TrendUp size={24} weight="duotone" />
        </div>
        <div className="summary-body">
          <div className="summary-label">Remaining Budget</div>
          <div className="summary-value">
            {formatPrice(stats.remainingBudget, stats.remainingBudget * exchangeRate)}
          </div>
        </div>
      </Card>

      <Card className="summary-card clickable" onClick={() => setStatusFilter(statusFilter === 'purchased' ? 'all' : 'purchased')}>
        <div className="summary-icon summary-icon-teal">
          <Check size={24} weight="duotone" />
        </div>
        <div className="summary-body">
          <div className="summary-label">Purchased</div>
          <div className="summary-value">{stats.statusCounts.purchased} <span className="summary-sub">/ {stats.totalItems}</span></div>
        </div>
      </Card>

      <Card className="summary-card clickable" onClick={() => setStatusFilter(statusFilter === 'over_purchased' ? 'all' : 'over_purchased')}>
        <div className="summary-icon summary-icon-red">
          <Warning size={24} weight="duotone" />
        </div>
        <div className="summary-body">
          <div className="summary-label">Over Purchased</div>
          <div className="summary-value">{stats.statusCounts.over_purchased}</div>
        </div>
      </Card>
    </div>
  );

  const renderToolbar = () => (
    <div className="procurement-toolbar reveal" data-delay="3">
      <div className="toolbar-left">
        <div className="search-box">
          <MagnifyingGlass className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Search materials or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ItemStatus | 'all')}
          className="status-filter"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="purchased">Purchased</option>
          <option value="over_purchased">Over Purchased</option>
        </select>
      </div>

      <div className="toolbar-actions">
        <Button variant="ghost" icon={<DownloadSimple size={16} />}>
          Export
        </Button>
      </div>
    </div>
  );

  const renderBOQContent = () => {
    if (isLoading) {
      return (
        <div className="loading-state">
          <div className="loading-skeleton" />
          <div className="loading-skeleton short" />
          <div className="loading-skeleton" />
        </div>
      );
    }

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
      <div className="boq-list reveal" data-delay="4">
        {filteredItems.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          const statusConfig = getStatusConfig(item.status);
          const StatusIcon = statusConfig.icon;
          const progressPercent = item.quantity > 0
            ? Math.min(100, (item.totalPurchased / Number(item.quantity)) * 100)
            : 0;

          return (
            <Fragment key={item.id}>
              <div className={`boq-item-card ${statusConfig.bgClass}`}>
                <div className="item-main" onClick={() => item.purchaseRecords.length > 0 && toggleItemExpanded(item.id)}>
                  <div className="item-expand">
                    {item.purchaseRecords.length > 0 ? (
                      isExpanded ? <CaretDown size={16} /> : <CaretRight size={16} />
                    ) : (
                      <span className="expand-placeholder" />
                    )}
                  </div>

                  <div className="item-info">
                    <div className="item-name">{item.material_name}</div>
                    <div className="item-meta">
                      {item.category && <span className="item-category">{item.category}</span>}
                      <span className="item-unit">{item.unit}</span>
                    </div>
                  </div>

                  <div className="item-quantities">
                    <div className="qty-group">
                      <span className="qty-label">BOQ Qty</span>
                      <span className="qty-value">{Number(item.quantity).toFixed(1)}</span>
                    </div>
                    <div className="qty-group">
                      <span className="qty-label">Purchased</span>
                      <span className="qty-value purchased">{item.totalPurchased.toFixed(1)}</span>
                    </div>
                    <div className="qty-group">
                      <span className="qty-label">Remaining</span>
                      <span className={`qty-value ${item.remainingQty <= 0 ? 'complete' : ''}`}>
                        {item.remainingQty.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="item-progress">
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${statusConfig.bgClass}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="progress-text">{progressPercent.toFixed(0)}%</span>
                  </div>

                  <div className="item-spent">
                    <span className="spent-label">Total Spent</span>
                    <span className="spent-value">
                      {formatPrice(item.totalSpent, item.totalSpent * exchangeRate)}
                    </span>
                  </div>

                  <div className={`item-status ${statusConfig.bgClass}`}>
                    <StatusIcon size={14} weight="bold" />
                    <span>{statusConfig.label}</span>
                  </div>

                  <div className="item-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPurchaseModal(item);
                      }}
                    >
                      Log Purchase
                    </Button>
                  </div>
                </div>

                {isExpanded && item.purchaseRecords.length > 0 && (
                  <div className="item-history">
                    <div className="history-header">
                      <span>Purchase History ({item.purchaseRecords.length})</span>
                    </div>
                    <div className="table-scroll">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Supplier</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Unit Price</th>
                            <th className="text-right">Total</th>
                            <th>Receipt</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.purchaseRecords.map((record) => (
                            <tr key={record.id}>
                              <td>{new Date(record.purchased_at).toLocaleDateString()}</td>
                              <td className="supplier-cell">
                                <Storefront size={14} />
                                {record.supplier_name}
                              </td>
                              <td className="text-right mono">{Number(record.quantity).toFixed(2)}</td>
                              <td className="text-right mono">
                                {formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}
                              </td>
                              <td className="text-right mono bold">
                                {formatPrice(
                                  Number(record.quantity) * Number(record.unit_price_usd),
                                  Number(record.quantity) * Number(record.unit_price_usd) * exchangeRate
                                )}
                              </td>
                              <td>
                                {record.receipt_document_id ? (
                                  <button
                                    className="receipt-link"
                                    onClick={() => handleOpenReceipt(record.receipt_document_id)}
                                  >
                                    View
                                  </button>
                                ) : (
                                  <span className="no-receipt">&mdash;</span>
                                )}
                              </td>
                              <td className="notes-cell">{record.notes || '\u2014'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    );
  };

  const renderHistoryContent = () => {
    const allPurchases = purchases.sort((a, b) =>
      new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
    );

    if (allPurchases.length === 0) {
      return (
        <EmptyState
          icon={<Receipt size={48} weight="light" />}
          title="No purchases recorded"
          description="Log purchases against BOQ items to see history here"
        />
      );
    }

    const itemMap = new Map(items.map(i => [i.id, i]));

    return (
      <div className="history-content reveal" data-delay="4">
        <div className="table-scroll">
          <table className="full-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Supplier</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {allPurchases.map((record) => {
                const item = itemMap.get(record.boq_item_id);
                return (
                  <tr key={record.id}>
                    <td>{new Date(record.purchased_at).toLocaleDateString()}</td>
                    <td className="item-cell">{item?.material_name || 'Unknown'}</td>
                    <td className="supplier-cell">
                      <Storefront size={14} />
                      {record.supplier_name}
                    </td>
                    <td className="text-right mono">{Number(record.quantity).toFixed(2)}</td>
                    <td className="text-right mono">
                      {formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}
                    </td>
                    <td className="text-right mono bold">
                      {formatPrice(
                        Number(record.quantity) * Number(record.unit_price_usd),
                        Number(record.quantity) * Number(record.unit_price_usd) * exchangeRate
                      )}
                    </td>
                    <td>
                      {record.receipt_document_id ? (
                        <button
                          className="receipt-link"
                          onClick={() => handleOpenReceipt(record.receipt_document_id)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="no-receipt">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRFQContent = () => (
    <EmptyState
      icon={<FileText size={48} weight="light" />}
      title="RFQ management coming soon"
      description="Use the Supplier dashboard for RFQ workflows while this feature is being built"
    />
  );

  return (
    <div className="procurement-view">
      {/* Hero Section */}
      <div className="procurement-hero reveal">
        <div className="hero-text">
          <h2>Procurement Hub</h2>
          <p>Track purchases, manage quantities, and monitor spending against your BOQ.</p>
        </div>
        <div className="hero-spending">
          <div className="spending-labels">
            <span className="spending-spent">
              {formatPrice(stats.totalSpent, stats.totalSpent * exchangeRate)} spent
            </span>
            <span className="spending-budget">
              of {formatPrice(stats.totalBudget, stats.totalBudget * exchangeRate)}
            </span>
          </div>
          <div className="spending-track">
            <div
              className="spending-fill"
              style={{
                width: `${Math.min(stats.spendingProgress, 100)}%`,
                background: spendingBarColor,
              }}
            />
          </div>
          <span className="spending-percent">{stats.spendingProgress.toFixed(0)}% of budget used</span>
        </div>
      </div>

      {renderSummaryCards()}
      {renderStageTabs()}

      <div className="content-area">
        {renderToolbar()}
        {activeStage === 'boq' && renderBOQContent()}
        {activeStage === 'history' && renderHistoryContent()}
        {activeStage === 'rfq' && renderRFQContent()}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedItemForPurchase && (
        <div className="modal-overlay" onClick={() => { setShowPurchaseModal(false); resetPurchaseForm(); setSelectedItemForPurchase(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Log Purchase</h3>
                <p className="modal-item-name">{selectedItemForPurchase.material_name}</p>
              </div>
              <button className="modal-close" onClick={() => { setShowPurchaseModal(false); resetPurchaseForm(); setSelectedItemForPurchase(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-item-info">
                <div className="info-row">
                  <span>BOQ Quantity:</span>
                  <strong>{Number(selectedItemForPurchase.quantity).toFixed(1)} {selectedItemForPurchase.unit}</strong>
                </div>
                <div className="info-row">
                  <span>Already Purchased:</span>
                  <strong>{itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.totalPurchased.toFixed(1) || '0'} {selectedItemForPurchase.unit}</strong>
                </div>
              </div>

              <div className="field">
                <label>Supplier Name *</label>
                <input
                  type="text"
                  list="supplier-list"
                  value={purchaseForm.supplierName}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })}
                  placeholder="e.g. PPC Zimbabwe"
                />
                <datalist id="supplier-list">
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.name} />
                  ))}
                </datalist>
              </div>

              <div className="field-grid">
                <div className="field">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseForm.quantity}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                    placeholder={`Max: ${itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.remainingQty.toFixed(1) || ''}`}
                  />
                </div>
                <div className="field">
                  <label>Unit Price (USD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseForm.unitPrice}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, unitPrice: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseForm.purchasedAt}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, purchasedAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label>Notes (optional)</label>
                <input
                  type="text"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  placeholder="Invoice reference or delivery notes"
                />
              </div>

              <div className="field">
                <label>Attach Receipt (optional)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      receiptFile: e.target.files?.[0] || null,
                    })
                  }
                />
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => { setShowPurchaseModal(false); resetPurchaseForm(); setSelectedItemForPurchase(null); }}>
                Cancel
              </Button>
              <Button onClick={handleSavePurchase} loading={isSavingPurchase}>
                Save Purchase
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* =============================================
         * PROCUREMENT VIEW — Layout
         * ============================================= */
        .procurement-view {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
          padding-bottom: var(--space-20);
        }

        /* =============================================
         * HERO SECTION
         * ============================================= */
        .procurement-hero {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .procurement-hero h2 {
          font-family: var(--font-heading);
          font-size: var(--text-h2);
          font-weight: var(--font-bold);
          margin: 0 0 var(--space-2);
          color: var(--color-text);
          letter-spacing: -0.02em;
        }

        .procurement-hero p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: var(--text-base);
          line-height: var(--leading-relaxed);
        }

        .hero-spending {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--space-4) var(--space-5);
        }

        .spending-labels {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .spending-spent {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: var(--color-text);
        }

        .spending-budget {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .spending-track {
          height: 8px;
          width: 100%;
          background: var(--color-border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .spending-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width var(--duration-slow) var(--ease-out);
        }

        .spending-percent {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          font-weight: var(--font-medium);
        }

        /* =============================================
         * SUMMARY CARDS
         * ============================================= */
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-4);
        }

        .summary-card {
          background: var(--color-surface) !important;
          border: 1px solid var(--color-border-light) !important;
          border-radius: var(--radius-lg) !important;
          padding: var(--space-5) !important;
          display: flex !important;
          align-items: center !important;
          gap: var(--space-4) !important;
          box-shadow: var(--shadow-sm) !important;
          transition: transform var(--duration-fast) var(--ease-default),
                      box-shadow var(--duration-fast) var(--ease-default),
                      border-color var(--duration-fast) var(--ease-default) !important;
        }

        .summary-card.clickable {
          cursor: pointer;
        }

        .summary-card.clickable:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md) !important;
          border-color: var(--color-accent-muted) !important;
        }

        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .summary-icon-blue { background: rgba(46, 108, 246, 0.1); color: var(--color-accent); }
        .summary-icon-green { background: rgba(22, 163, 74, 0.1); color: var(--color-emerald); }
        .summary-icon-teal { background: rgba(8, 145, 178, 0.1); color: #0891b2; }
        .summary-icon-red { background: rgba(220, 38, 38, 0.08); color: var(--color-danger); }

        .summary-body {
          min-width: 0;
        }

        .summary-label {
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: var(--font-semibold);
          color: var(--color-text-secondary);
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: var(--text-h4);
          font-weight: var(--font-bold);
          color: var(--color-text);
          font-family: var(--font-mono);
          line-height: var(--leading-tight);
        }

        .summary-sub {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-weight: var(--font-normal);
        }

        /* =============================================
         * STAGE TABS
         * ============================================= */
        .stage-tabs {
          display: flex;
          gap: var(--space-1);
          padding: var(--space-1);
          background: var(--color-mist);
          border-radius: var(--radius-md);
          width: fit-content;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .stage-tab-btn {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-default);
        }

        .stage-tab-btn:hover {
          color: var(--color-text);
          background: rgba(255, 255, 255, 0.5);
        }

        .stage-tab-btn.active {
          background: var(--color-surface);
          color: var(--color-text);
          box-shadow: var(--shadow-sm);
        }

        .tab-count {
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          background: var(--color-border);
          color: var(--color-text-secondary);
          padding: 1px 7px;
          border-radius: var(--radius-full);
          line-height: 1.5;
        }

        .stage-tab-btn.active .tab-count {
          background: var(--color-accent-muted);
          color: var(--color-accent);
        }

        /* =============================================
         * CONTENT AREA & TOOLBAR
         * ============================================= */
        .content-area {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .procurement-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
        }

        .search-box {
          position: relative;
          flex: 1;
          max-width: 340px;
        }

        .search-icon {
          position: absolute;
          left: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: var(--input-height);
          padding: 0 var(--space-3) 0 36px;
          border: var(--input-border);
          border-radius: var(--input-radius);
          font-size: var(--text-sm);
          background: var(--input-bg);
          color: var(--color-text);
          transition: border-color var(--duration-fast) var(--ease-default),
                      box-shadow var(--duration-fast) var(--ease-default);
        }

        .search-input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-accent-muted);
        }

        .status-filter {
          height: var(--input-height);
          padding: 0 var(--space-3);
          border: var(--input-border);
          border-radius: var(--input-radius);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: var(--input-bg);
          cursor: pointer;
        }

        .status-filter:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-accent-muted);
        }

        /* =============================================
         * LOADING STATE
         * ============================================= */
        .loading-state {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding: var(--space-6) 0;
        }

        .loading-skeleton {
          height: 64px;
          background: linear-gradient(90deg, var(--color-mist) 25%, var(--color-border) 50%, var(--color-mist) 75%);
          background-size: 200% 100%;
          border-radius: var(--radius-md);
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }

        .loading-skeleton.short {
          width: 75%;
        }

        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* =============================================
         * BOQ ITEM CARDS
         * ============================================= */
        .boq-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .boq-item-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color var(--duration-fast) var(--ease-default),
                      box-shadow var(--duration-fast) var(--ease-default);
        }

        .boq-item-card:hover {
          border-color: rgba(46, 108, 246, 0.25);
          box-shadow: var(--shadow-sm);
        }

        /* Status left-border highlights */
        .boq-item-card.status-purchased { border-left: 4px solid var(--color-emerald); }
        .boq-item-card.status-progress { border-left: 4px solid var(--color-accent); }
        .boq-item-card.status-over { border-left: 4px solid var(--color-danger); }
        .boq-item-card.status-pending { border-left: 4px solid var(--color-border-dark); }

        .item-main {
          padding: var(--space-4) var(--space-5);
          display: grid;
          grid-template-columns: 24px 2fr 2fr 1.5fr 1fr 120px 140px;
          align-items: center;
          gap: var(--space-4);
          cursor: pointer;
        }

        .item-expand {
          display: flex;
          align-items: center;
          color: var(--color-text-muted);
        }

        .expand-placeholder {
          display: inline-block;
          width: 16px;
          height: 16px;
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .item-name {
          font-weight: var(--font-semibold);
          color: var(--color-text);
          font-size: var(--text-sm);
          line-height: var(--leading-tight);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .item-category {
          background: var(--color-mist);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
          font-weight: var(--font-semibold);
          letter-spacing: 0.05em;
        }

        .item-quantities {
          display: flex;
          gap: var(--space-4);
        }

        .qty-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .qty-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--color-text-muted);
          font-weight: var(--font-semibold);
          letter-spacing: 0.04em;
        }

        .qty-value {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--color-text);
        }

        .qty-value.purchased { color: var(--color-accent); font-weight: var(--font-semibold); }
        .qty-value.complete { color: var(--color-emerald); }

        .item-progress {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .progress-bar {
          height: 6px;
          width: 100%;
          background: var(--color-border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--color-border-dark);
          border-radius: var(--radius-full);
          transition: width var(--duration-slow) var(--ease-out);
        }

        .progress-fill.status-purchased { background: var(--color-emerald); }
        .progress-fill.status-progress { background: var(--color-accent); }
        .progress-fill.status-over { background: var(--color-danger); }

        .progress-text {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          font-weight: var(--font-medium);
          text-align: right;
        }

        .item-spent {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .spent-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--color-text-muted);
          font-weight: var(--font-semibold);
          letter-spacing: 0.04em;
        }

        .spent-value {
          font-family: var(--font-mono);
          font-weight: var(--font-semibold);
          font-size: var(--text-sm);
          color: var(--color-text);
        }

        .item-status {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 4px 10px;
          border-radius: var(--badge-radius);
          white-space: nowrap;
        }

        .item-status.status-purchased { background: rgba(22, 163, 74, 0.1); color: var(--color-emerald); }
        .item-status.status-progress { background: var(--color-accent-muted); color: var(--color-accent); }
        .item-status.status-over { background: rgba(220, 38, 38, 0.08); color: var(--color-danger); }
        .item-status.status-pending { background: var(--color-mist); color: var(--color-text-muted); }

        .item-actions {
          display: flex;
          justify-content: flex-end;
        }

        /* =============================================
         * PURCHASE HISTORY (inline per-item)
         * ============================================= */
        .item-history {
          border-top: 1px solid var(--color-border-light);
          background: var(--color-background);
          padding: var(--space-5);
        }

        .history-header {
          margin-bottom: var(--space-3);
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-sm);
        }

        .history-table th {
          text-align: left;
          padding: var(--table-cell-padding);
          font-weight: var(--font-semibold);
          color: var(--color-text-muted);
          border-bottom: 1px solid var(--color-border-light);
          white-space: nowrap;
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .history-table td {
          padding: var(--table-cell-padding);
          border-bottom: 1px solid var(--color-border-light);
          color: var(--color-text);
        }

        .history-table tbody tr:hover {
          background: var(--table-row-hover);
        }

        .history-table tbody tr:nth-child(even) {
          background: var(--table-zebra-bg);
        }

        .history-table tbody tr:nth-child(even):hover {
          background: var(--table-row-hover);
        }

        .history-table .supplier-cell {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .history-table .mono { font-family: var(--font-mono); }
        .history-table .text-right { text-align: right; }
        .history-table .bold { font-weight: var(--font-semibold); }

        .notes-cell {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--color-text-secondary);
          font-size: var(--text-xs);
        }

        .receipt-link {
          background: none;
          border: none;
          color: var(--color-accent);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          cursor: pointer;
          padding: 2px 0;
          transition: color var(--duration-fast) var(--ease-default);
        }

        .receipt-link:hover { color: var(--color-accent-dark); text-decoration: underline; }
        .no-receipt { color: var(--color-text-muted); font-size: var(--text-xs); }

        /* =============================================
         * FULL HISTORY TABLE
         * ============================================= */
        .history-content {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .full-history-table {
          width: 100%;
          border-collapse: collapse;
        }

        .full-history-table th {
          text-align: left;
          padding: var(--space-4);
          background: var(--table-header-bg);
          border-bottom: 1px solid var(--color-border-light);
          font-weight: var(--font-semibold);
          color: var(--color-text-secondary);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .full-history-table td {
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border-light);
          color: var(--color-text);
          font-size: var(--text-sm);
        }

        .full-history-table tbody tr:hover {
          background: var(--table-row-hover);
        }

        .full-history-table tbody tr:nth-child(even) {
          background: var(--table-zebra-bg);
        }

        .full-history-table tbody tr:nth-child(even):hover {
          background: var(--table-row-hover);
        }

        .full-history-table .item-cell {
          font-weight: var(--font-semibold);
          color: var(--color-text);
        }

        .full-history-table .supplier-cell {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .full-history-table .mono { font-family: var(--font-mono); }
        .full-history-table .text-right { text-align: right; }
        .full-history-table .bold { font-weight: var(--font-semibold); }

        /* =============================================
         * MODAL
         * ============================================= */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: var(--color-surface-overlay);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal);
          backdrop-filter: blur(6px);
          padding: var(--space-4);
        }

        .modal-card {
          background: var(--color-surface);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-xl);
          animation: modal-in var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-header {
          padding: var(--space-6);
          border-bottom: 1px solid var(--color-border-light);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: var(--color-background);
        }

        .modal-header h3 {
          margin: 0;
          font-family: var(--font-heading);
          font-size: var(--text-h4);
          font-weight: var(--font-bold);
          color: var(--color-text);
        }

        .modal-item-name {
          margin: var(--space-1) 0 0;
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: var(--space-1);
          border-radius: var(--radius-sm);
          transition: background var(--duration-fast) var(--ease-default),
                      color var(--duration-fast) var(--ease-default);
        }

        .modal-close:hover {
          background: var(--color-mist);
          color: var(--color-text);
        }

        .modal-body {
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .modal-item-info {
          background: var(--color-mist);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--text-sm);
        }

        .info-row span {
          color: var(--color-text-secondary);
        }

        .info-row strong {
          font-family: var(--font-mono);
          color: var(--color-text);
          font-weight: var(--font-semibold);
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .field label {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-text-secondary);
        }

        .field input {
          height: var(--input-height);
          padding: var(--input-padding);
          border-radius: var(--input-radius);
          border: var(--input-border);
          font-size: var(--text-sm);
          background: var(--input-bg);
          color: var(--color-text);
          transition: border-color var(--duration-fast) var(--ease-default),
                      box-shadow var(--duration-fast) var(--ease-default);
        }

        .field input[type="file"] {
          height: auto;
          padding: var(--space-3);
          font-size: var(--text-xs);
        }

        .field input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-accent-muted);
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: var(--space-4);
        }

        .modal-actions {
          padding: var(--space-5) var(--space-6);
          background: var(--color-background);
          border-top: 1px solid var(--color-border-light);
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
        }

        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* =============================================
         * RESPONSIVE — Tablet
         * ============================================= */
        @media (max-width: 1024px) {
          .summary-grid { grid-template-columns: repeat(2, 1fr); }
          .item-main {
            grid-template-columns: 24px 2fr 1.5fr 1fr 120px;
            gap: var(--space-3);
          }
          .item-spent,
          .item-actions { display: none; }
          .field-grid { grid-template-columns: 1fr 1fr; }
        }

        /* =============================================
         * RESPONSIVE — Mobile
         * ============================================= */
        @media (max-width: 640px) {
          .procurement-view {
            gap: var(--space-6);
          }

          .procurement-hero h2 {
            font-size: var(--text-h3);
          }

          .summary-grid { grid-template-columns: 1fr 1fr; }

          .stage-tabs {
            width: 100%;
          }

          .procurement-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .toolbar-left {
            flex-direction: column;
          }

          .search-box {
            max-width: 100%;
          }

          .item-main {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-3);
            padding: var(--space-4);
          }

          .item-expand { display: none; }

          .item-quantities {
            width: 100%;
            justify-content: space-between;
          }

          .item-progress { width: 100%; }
          .item-spent { width: 100%; align-items: flex-start; }
          .item-actions { width: 100%; justify-content: stretch; }

          .field-grid {
            grid-template-columns: 1fr;
          }

          .modal-card {
            max-width: 100%;
            border-radius: var(--radius-lg);
          }

          .modal-header,
          .modal-body,
          .modal-actions {
            padding-left: var(--space-4);
            padding-right: var(--space-4);
          }
        }

        /* =============================================
         * REDUCED MOTION
         * ============================================= */
        @media (prefers-reduced-motion: reduce) {
          .spending-fill,
          .progress-fill,
          .summary-card,
          .boq-item-card,
          .loading-skeleton {
            transition: none;
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
