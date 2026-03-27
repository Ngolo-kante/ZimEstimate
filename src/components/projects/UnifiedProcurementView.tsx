'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  CaretUp,
  Check,
  Warning,
  Clock,
  Package,
  Receipt,
  X,
  Funnel,
  Paperclip,
  Cube,
  Wall,
  House,
  PaintBrush,
  Tree,
} from '@phosphor-icons/react';

type ProcurementStage = 'boq' | 'rfq' | 'history';
type ItemStatus = 'pending' | 'in_progress' | 'purchased' | 'over_purchased';
type GroupByOption = 'stage' | 'category' | 'none';
type BOQStage = 'substructure' | 'superstructure' | 'roofing' | 'finishing' | 'exterior';

// Consistent naming with BOQ wizard milestones
const STAGE_CONFIG: Record<BOQStage, { label: string; icon: typeof Cube; color: string; description: string }> = {
  substructure: {
    label: 'Site Preparation & Foundation',
    icon: Cube,
    color: '#8b5cf6',
    description: 'Foundation, DPC, floor slab'
  },
  superstructure: {
    label: 'Structural Walls & Frame',
    icon: Wall,
    color: '#3b82f6',
    description: 'Walls, lintels, ring beam'
  },
  roofing: {
    label: 'Roofing',
    icon: House,
    color: '#f59e0b',
    description: 'Timber, sheets, gutters'
  },
  finishing: {
    label: 'Interior & Finishing',
    icon: PaintBrush,
    color: '#10b981',
    description: 'Plastering, painting, fittings'
  },
  exterior: {
    label: 'External Work',
    icon: Tree,
    color: '#06b6d4',
    description: 'Boundary, gates, driveway'
  },
};

const toIsoMidday = (dateString: string) => {
  if (!dateString) return new Date().toISOString();
  const [year, month, day] = dateString.split('-').map(Number);
  const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return safeDate.toISOString();
};

interface UnifiedProcurementViewProps {
  project: Project;
  items: BOQItem[];
  onItemsRefresh: () => Promise<void>;
  selectedItemForPurchase?: BOQItem | null;
  onClearSelectedItem?: () => void;
}

interface ItemWithPurchases extends BOQItem {
  purchaseRecords: PurchaseRecord[];
  totalPurchased: number;
  totalSpent: number;
  status: ItemStatus;
  remainingQty: number;
}

interface FormErrors {
  supplierName?: string;
  quantity?: string;
  unitPrice?: string;
  purchasedAt?: string;
}

export default function UnifiedProcurementView({
  project,
  items,
  onItemsRefresh,
  selectedItemForPurchase: externalSelectedItem,
  onClearSelectedItem,
}: UnifiedProcurementViewProps) {
  const { success, error: showError } = useToast();
  const { formatPrice, exchangeRate } = useCurrency();

  // State
  const [activeStage, setActiveStage] = useState<ProcurementStage>('boq');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [groupBy, setGroupBy] = useState<GroupByOption>('stage');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Data State
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [rfqs, setRfqs] = useState<RfqWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receiptDocs, setReceiptDocs] = useState<ProjectDocument[]>([]);

  // Modal States
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<BOQItem | null>(null);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [optimisticPurchase, setOptimisticPurchase] = useState<PurchaseRecord | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
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

  const getItemStatus = (estimatedQty: number, purchasedQty: number): ItemStatus => {
    const epsilon = 0.01;
    if (purchasedQty < epsilon) return 'pending';
    if (purchasedQty >= estimatedQty - epsilon && purchasedQty <= estimatedQty + epsilon) return 'purchased';
    if (purchasedQty > estimatedQty + epsilon) return 'over_purchased';
    return 'in_progress';
  };

  const itemsWithPurchases: ItemWithPurchases[] = useMemo(() => {
    const purchasesByItem = new Map<string, PurchaseRecord[]>();

    // Include optimistic purchase if present
    const allPurchases = optimisticPurchase
      ? [...purchases, optimisticPurchase]
      : purchases;

    allPurchases.forEach((p) => {
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
  }, [items, purchases, optimisticPurchase]);

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

  const groupedItems = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Items': filteredItems };
    }

    const groups: Record<string, ItemWithPurchases[]> = {};

    filteredItems.forEach((item) => {
      const key = groupBy === 'stage'
        ? (item.category?.toLowerCase() as BOQStage) || 'other'
        : item.category || 'Uncategorized';

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    if (groupBy === 'stage') {
      const stageOrder: BOQStage[] = ['substructure', 'superstructure', 'roofing', 'finishing', 'exterior'];
      const sortedGroups: Record<string, ItemWithPurchases[]> = {};

      stageOrder.forEach((stage) => {
        if (groups[stage]) {
          sortedGroups[stage] = groups[stage];
        }
      });

      Object.keys(groups).forEach((key) => {
        if (!sortedGroups[key]) {
          sortedGroups[key] = groups[key];
        }
      });

      return sortedGroups;
    }

    return groups;
  }, [filteredItems, groupBy]);

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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle external item selection (from BOQ quick action)
  useEffect(() => {
    if (externalSelectedItem) {
      openPurchaseModal(externalSelectedItem);
      onClearSelectedItem?.();
    }
  }, [externalSelectedItem, onClearSelectedItem]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadData();
        void onItemsRefresh();
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
    setFormErrors({});
  };

  const openPurchaseModal = (item: BOQItem) => {
    setSelectedItemForPurchase(item);
    setPurchaseForm({
      supplierName: '',
      quantity: '',
      unitPrice: item.unit_price_usd ? String(item.unit_price_usd) : '',
      purchasedAt: new Date().toISOString().split('T')[0],
      notes: '',
      receiptFile: null,
    });
    setFormErrors({});
    setShowPurchaseModal(true);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!purchaseForm.supplierName.trim()) {
      errors.supplierName = 'Supplier name is required';
    }

    const quantity = Number(purchaseForm.quantity);
    if (!purchaseForm.quantity || isNaN(quantity) || quantity <= 0) {
      errors.quantity = 'Enter a valid quantity greater than 0';
    }

    const unitPrice = Number(purchaseForm.unitPrice);
    if (!purchaseForm.unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
      errors.unitPrice = 'Enter a valid unit price greater than 0';
    }

    if (!purchaseForm.purchasedAt) {
      errors.purchasedAt = 'Purchase date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePurchase = async () => {
    if (!selectedItemForPurchase) {
      showError('No item selected.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    const supplierName = purchaseForm.supplierName.trim();
    const quantity = Number(purchaseForm.quantity);
    const unitPrice = Number(purchaseForm.unitPrice);
    const itemId = selectedItemForPurchase.id;

    const matchedSupplier = suppliers.find(
      (supplier) => supplier.name.toLowerCase() === supplierName.toLowerCase()
    );

    // Create optimistic purchase record for instant UI feedback
    const optimisticRecord: PurchaseRecord = {
      id: `optimistic-${Date.now()}`,
      project_id: project.id,
      boq_item_id: itemId,
      supplier_id: matchedSupplier?.id || null,
      supplier_name: supplierName,
      quantity,
      unit_price_usd: unitPrice,
      purchased_at: toIsoMidday(purchaseForm.purchasedAt),
      notes: purchaseForm.notes || null,
      receipt_document_id: null,
      created_by: 'optimistic', // Placeholder for optimistic UI update
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Apply optimistic update immediately
    setOptimisticPurchase(optimisticRecord);
    setSavingItemId(itemId);
    setExpandedItems((prev) => new Set(prev).add(itemId)); // Auto-expand to show new purchase
    setShowPurchaseModal(false);
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
        // Rollback optimistic update
        setOptimisticPurchase(null);
        setSavingItemId(null);
        setIsSavingPurchase(false);
        setShowPurchaseModal(true);
        return;
      }
      if (document) {
        receiptDocumentId = document.id;
        setReceiptDocs((prev) => [document, ...prev]);
      }
    }

    const purchasePayload: Record<string, unknown> = {
      project_id: project.id,
      boq_item_id: itemId,
      supplier_name: supplierName,
      supplier_id: matchedSupplier?.id || null,
      quantity,
      unit_price_usd: unitPrice,
      purchased_at: toIsoMidday(purchaseForm.purchasedAt),
      notes: purchaseForm.notes || null,
    };
    if (receiptDocumentId) {
      purchasePayload.receipt_document_id = receiptDocumentId;
    }

    const { record, error } = await createPurchaseRecord(purchasePayload as Parameters<typeof createPurchaseRecord>[0]);

    if (error) {
      showError(error.message || 'Failed to record purchase');
      // Rollback optimistic update
      setOptimisticPurchase(null);
      setSavingItemId(null);
    } else {
      const currentItem = itemsWithPurchases.find(i => i.id === itemId);
      const newTotalPurchased = (currentItem?.totalPurchased || 0) + quantity;
      const estimatedQty = Number(selectedItemForPurchase.quantity) || 0;

      const { error: boqUpdateError } = await updateBOQItem(itemId, {
        actual_quantity: newTotalPurchased,
        actual_price_usd: unitPrice,
        is_purchased: newTotalPurchased >= estimatedQty,
        purchased_date: new Date().toISOString(),
      });

      if (boqUpdateError) {
        showError(boqUpdateError.message || 'Purchase was saved, but BOQ item sync failed');
      }

      // Replace optimistic record with real record
      if (record) {
        setPurchases((prev) => [record, ...prev]);
      }
      setOptimisticPurchase(null);
      setSavingItemId(null);

      await onItemsRefresh();
      success('Purchase recorded successfully');
      setSelectedItemForPurchase(null);
      resetPurchaseForm();
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

    const itemMap = new Map(items.map(i => [i.id, i]));
    const headers = ['Date', 'Material', 'Category', 'Supplier', 'Quantity', 'Unit', 'Unit Price (USD)', 'Total (USD)', 'Notes'];
    const rows = purchases.map(record => {
      const item = itemMap.get(record.boq_item_id);
      const qty = Number(record.quantity);
      const price = Number(record.unit_price_usd);
      return [
        new Date(record.purchased_at).toLocaleDateString(),
        item?.material_name || 'Unknown',
        item?.category || '',
        record.supplier_name,
        qty.toFixed(2),
        item?.unit || '',
        price.toFixed(2),
        (qty * price).toFixed(2),
        (record.notes || '').replace(/,/g, ';'),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
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

  const getStatusConfig = (status: ItemStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', icon: Clock, bgClass: 'status-pending' };
      case 'in_progress':
        return { label: 'In Progress', icon: Package, bgClass: 'status-progress' };
      case 'purchased':
        return { label: 'Purchased', icon: Check, bgClass: 'status-purchased' };
      case 'over_purchased':
        return { label: 'Over Purchased', icon: Warning, bgClass: 'status-over' };
    }
  };

  const getStageStats = (stageItems: ItemWithPurchases[]) => {
    const total = stageItems.length;
    const purchased = stageItems.filter(i => i.status === 'purchased').length;
    const inProgress = stageItems.filter(i => i.status === 'in_progress').length;
    const totalSpent = stageItems.reduce((sum, i) => sum + i.totalSpent, 0);
    return { total, purchased, inProgress, totalSpent };
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
        <span>Purchase Ledger</span>
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
            placeholder="Search materials..."
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

      <div className="toolbar-right">
        <div className="group-toggle">
          <Funnel size={14} />
          <span className="group-label">Group:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="group-select"
          >
            <option value="stage">By Stage</option>
            <option value="category">By Category</option>
            <option value="none">No Grouping</option>
          </select>
        </div>
        <Button variant="ghost" icon={<DownloadSimple size={16} />} onClick={handleExportCSV}>
          <span className="btn-text-desktop">Export CSV</span>
        </Button>
      </div>
    </div>
  );

  const renderItemCard = (item: ItemWithPurchases) => {
    const isExpanded = expandedItems.has(item.id);
    const isSaving = savingItemId === item.id;
    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;
    const progressPercent = item.quantity > 0
      ? Math.min(100, (item.totalPurchased / Number(item.quantity)) * 100)
      : 0;

    return (
      <div key={item.id} className={`boq-item-card ${statusConfig.bgClass} ${isSaving ? 'is-saving' : ''}`}>
        <div
          className="item-main"
          onClick={() => item.purchaseRecords.length > 0 && toggleItemExpanded(item.id)}
          role={item.purchaseRecords.length > 0 ? 'button' : undefined}
          tabIndex={item.purchaseRecords.length > 0 ? 0 : undefined}
        >
          <div className="item-expand">
            {item.purchaseRecords.length > 0 ? (
              isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />
            ) : (
              <span className="expand-placeholder" />
            )}
          </div>

          <div className="item-info">
            <div className="item-name">{item.material_name}</div>
            <div className="item-meta">
              {item.category && <span className="item-category">{item.category}</span>}
              <span className="item-unit">{item.unit}</span>
              {item.purchaseRecords.length > 0 && (
                <span className="purchase-count">{item.purchaseRecords.length} purchase{item.purchaseRecords.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          <div className="item-quantities">
            <div className="qty-group">
              <span className="qty-label">BOQ</span>
              <span className="qty-value">{Number(item.quantity).toFixed(1)}</span>
            </div>
            <div className="qty-group">
              <span className="qty-label">Bought</span>
              <span className="qty-value purchased">{item.totalPurchased.toFixed(1)}</span>
            </div>
            <div className="qty-group">
              <span className="qty-label">Left</span>
              <span className={`qty-value ${item.remainingQty <= 0 ? 'complete' : 'remaining'}`}>
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
            <span className="spent-label">Spent</span>
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
              variant="primary"
              icon={<Plus size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                openPurchaseModal(item);
              }}
            >
              <span className="btn-text">Log</span>
            </Button>
          </div>
        </div>

        {/* Expanded Purchase Ledger */}
        {isExpanded && item.purchaseRecords.length > 0 && (
          <div className="item-history">
            <div className="history-header">
              <Receipt size={14} weight="duotone" />
              <span>Purchase Ledger ({item.purchaseRecords.length} entries)</span>
            </div>
            <div className="ledger-table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th className="col-date">Date</th>
                    <th className="col-supplier">Supplier</th>
                    <th className="col-qty">Qty</th>
                    <th className="col-price">Unit Price</th>
                    <th className="col-total">Total</th>
                    <th className="col-receipt">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {item.purchaseRecords.map((record) => {
                    const recordTotal = Number(record.quantity) * Number(record.unit_price_usd);
                    const isOptimistic = record.id.startsWith('optimistic-');
                    return (
                      <tr key={record.id} className={isOptimistic ? 'optimistic-row' : ''}>
                        <td className="col-date">
                          <span className="date-text">{new Date(record.purchased_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </td>
                        <td className="col-supplier">
                          <div className="supplier-name">
                            <Storefront size={14} weight="duotone" />
                            <span>{record.supplier_name}</span>
                          </div>
                          {record.notes && <div className="supplier-notes">{record.notes}</div>}
                        </td>
                        <td className="col-qty mono">{Number(record.quantity).toFixed(2)}</td>
                        <td className="col-price mono">{formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}</td>
                        <td className="col-total mono bold">{formatPrice(recordTotal, recordTotal * exchangeRate)}</td>
                        <td className="col-receipt">
                          {record.receipt_document_id ? (
                            <button
                              className="receipt-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReceipt(record.receipt_document_id);
                              }}
                            >
                              <Paperclip size={12} />
                              View
                            </button>
                          ) : (
                            <span className="no-receipt">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="footer-label">Total Purchased</td>
                    <td className="col-qty mono bold">{item.totalPurchased.toFixed(2)}</td>
                    <td></td>
                    <td className="col-total mono bold">{formatPrice(item.totalSpent, item.totalSpent * exchangeRate)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

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
      <div className="boq-groups">
        {Object.entries(groupedItems).map(([groupKey, groupItems]) => {
          const isCollapsed = collapsedGroups.has(groupKey);
          const stageConfig = STAGE_CONFIG[groupKey as BOQStage];
          const stageStats = getStageStats(groupItems);
          const StageIcon = stageConfig?.icon || Package;

          return (
            <div key={groupKey} className="boq-group">
              {groupBy !== 'none' && (
                <div
                  className="group-header"
                  onClick={() => toggleGroupCollapsed(groupKey)}
                  style={{ '--stage-color': stageConfig?.color || '#64748b' } as React.CSSProperties}
                >
                  <div className="group-header-left">
                    <div className="group-icon" style={{ background: `${stageConfig?.color || '#64748b'}15`, color: stageConfig?.color || '#64748b' }}>
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
                </div>
              )}

              {!isCollapsed && (
                <div className="group-items">
                  {groupItems.map((item) => renderItemCard(item))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Ledger-style purchase history grouped by date
  const renderHistoryContent = () => {
    const allPurchases = [...purchases].sort((a, b) =>
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

    // Group purchases by date
    const purchasesByDate: Record<string, PurchaseRecord[]> = {};
    allPurchases.forEach((record) => {
      const dateKey = new Date(record.purchased_at).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      if (!purchasesByDate[dateKey]) {
        purchasesByDate[dateKey] = [];
      }
      purchasesByDate[dateKey].push(record);
    });

    return (
      <div className="ledger-content">
        <div className="ledger-header-bar">
          <h3>Purchase Ledger</h3>
          <span className="ledger-total">{purchases.length} transactions • Total: {formatPrice(stats.totalSpent, stats.totalSpent * exchangeRate)}</span>
        </div>

        <div className="ledger-container">
          {Object.entries(purchasesByDate).map(([dateKey, dateRecords]) => {
            const dayTotal = dateRecords.reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unit_price_usd)), 0);
            return (
              <div key={dateKey} className="ledger-date-group">
                <div className="ledger-date-header">
                  <span className="ledger-date">{dateKey}</span>
                  <span className="ledger-date-total">{formatPrice(dayTotal, dayTotal * exchangeRate)}</span>
                </div>
                <table className="ledger-table full-ledger">
                  <thead>
                    <tr>
                      <th className="col-item">Material</th>
                      <th className="col-supplier">Supplier</th>
                      <th className="col-qty">Qty</th>
                      <th className="col-unit">Unit</th>
                      <th className="col-price">Unit Price</th>
                      <th className="col-total">Total</th>
                      <th className="col-receipt">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateRecords.map((record) => {
                      const item = itemMap.get(record.boq_item_id);
                      const recordTotal = Number(record.quantity) * Number(record.unit_price_usd);
                      return (
                        <tr key={record.id}>
                          <td className="col-item">
                            <span className="item-name">{item?.material_name || 'Unknown'}</span>
                            {item?.category && <span className="item-cat">{item.category}</span>}
                          </td>
                          <td className="col-supplier">{record.supplier_name}</td>
                          <td className="col-qty mono">{Number(record.quantity).toFixed(2)}</td>
                          <td className="col-unit">{item?.unit || '—'}</td>
                          <td className="col-price mono">{formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}</td>
                          <td className="col-total mono bold">{formatPrice(recordTotal, recordTotal * exchangeRate)}</td>
                          <td className="col-receipt">
                            {record.receipt_document_id ? (
                              <button
                                className="receipt-link"
                                onClick={() => handleOpenReceipt(record.receipt_document_id)}
                              >
                                <Paperclip size={12} />
                              </button>
                            ) : (
                              <span className="no-receipt">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
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
              <div className="modal-title-group">
                <h3>Log Purchase</h3>
                <p className="modal-item-name">{selectedItemForPurchase.material_name}</p>
              </div>
              <button className="modal-close" onClick={() => { setShowPurchaseModal(false); resetPurchaseForm(); setSelectedItemForPurchase(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-item-info">
                <div className="info-cell">
                  <span className="info-label">BOQ Qty</span>
                  <span className="info-value">{Number(selectedItemForPurchase.quantity).toFixed(1)} {selectedItemForPurchase.unit}</span>
                </div>
                <div className="info-cell">
                  <span className="info-label">Purchased</span>
                  <span className="info-value">{itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.totalPurchased.toFixed(1) || '0'} {selectedItemForPurchase.unit}</span>
                </div>
                <div className="info-cell highlight">
                  <span className="info-label">Remaining</span>
                  <span className="info-value">{itemsWithPurchases.find(i => i.id === selectedItemForPurchase.id)?.remainingQty.toFixed(1) || selectedItemForPurchase.quantity} {selectedItemForPurchase.unit}</span>
                </div>
              </div>

              <div className="form-section">
                <div className={`form-field ${formErrors.supplierName ? 'has-error' : ''}`}>
                  <label htmlFor="supplier-input">
                    Supplier Name <span className="required">*</span>
                  </label>
                  <input
                    id="supplier-input"
                    type="text"
                    list="supplier-list"
                    value={purchaseForm.supplierName}
                    onChange={(e) => {
                      setPurchaseForm({ ...purchaseForm, supplierName: e.target.value });
                      if (formErrors.supplierName) setFormErrors({ ...formErrors, supplierName: undefined });
                    }}
                    placeholder="e.g. PPC Zimbabwe"
                    className={formErrors.supplierName ? 'error' : ''}
                  />
                  <datalist id="supplier-list">
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name} />
                    ))}
                  </datalist>
                  {formErrors.supplierName && <span className="field-error">{formErrors.supplierName}</span>}
                </div>

                <div className="form-row three-col">
                  <div className={`form-field ${formErrors.quantity ? 'has-error' : ''}`}>
                    <label htmlFor="qty-input">
                      Quantity <span className="required">*</span>
                    </label>
                    <input
                      id="qty-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={purchaseForm.quantity}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, quantity: e.target.value });
                        if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: undefined });
                      }}
                      placeholder="0.00"
                      className={formErrors.quantity ? 'error' : ''}
                    />
                    {formErrors.quantity && <span className="field-error">{formErrors.quantity}</span>}
                  </div>
                  <div className={`form-field ${formErrors.unitPrice ? 'has-error' : ''}`}>
                    <label htmlFor="price-input">
                      Unit Price (USD) <span className="required">*</span>
                    </label>
                    <input
                      id="price-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={purchaseForm.unitPrice}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, unitPrice: e.target.value });
                        if (formErrors.unitPrice) setFormErrors({ ...formErrors, unitPrice: undefined });
                      }}
                      placeholder="0.00"
                      className={formErrors.unitPrice ? 'error' : ''}
                    />
                    {formErrors.unitPrice && <span className="field-error">{formErrors.unitPrice}</span>}
                  </div>
                  <div className={`form-field ${formErrors.purchasedAt ? 'has-error' : ''}`}>
                    <label htmlFor="date-input">
                      Date <span className="required">*</span>
                    </label>
                    <input
                      id="date-input"
                      type="date"
                      value={purchaseForm.purchasedAt}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, purchasedAt: e.target.value });
                        if (formErrors.purchasedAt) setFormErrors({ ...formErrors, purchasedAt: undefined });
                      }}
                      className={formErrors.purchasedAt ? 'error' : ''}
                    />
                    {formErrors.purchasedAt && <span className="field-error">{formErrors.purchasedAt}</span>}
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="notes-input">Notes <span className="optional">(optional)</span></label>
                  <input
                    id="notes-input"
                    type="text"
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    placeholder="Invoice reference, delivery notes..."
                  />
                </div>

                <div className="form-field">
                  <label>Receipt <span className="optional">(optional)</span></label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="receipt-file-input"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setPurchaseForm({
                          ...purchaseForm,
                          receiptFile: e.target.files?.[0] || null,
                        })
                      }
                    />
                    <label htmlFor="receipt-file-input" className="file-upload-label">
                      <Paperclip size={18} />
                      {purchaseForm.receiptFile ? (
                        <span className="file-name">{purchaseForm.receiptFile.name}</span>
                      ) : (
                        <span className="file-placeholder">Attach receipt (image or PDF)</span>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
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
    </div>
  );
}
