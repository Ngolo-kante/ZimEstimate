'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { suppliers as staticSuppliers, Supplier as StaticSupplier } from '@/lib/materials';
import {
  createPurchaseRecord,
  createSupplier,
  deletePurchaseRecord,
  deleteSupplier,
  getPurchaseRecords,
  getSuppliers,
  updatePurchaseRecord,
  updateSupplier,
} from '@/lib/services/projects';
import {
  acceptRfqQuote,
  createRfqRequest,
  getProjectRfqs,
  matchSuppliersForItems,
  type RfqWithDetails,
  type SupplierMatch,
} from '@/lib/services/rfq';
import { BOQItem, Project, PurchaseRecord, Supplier as DbSupplier, SupplierInsert } from '@/lib/database.types';
import {
  CaretDown,
  CaretUp,
  CaretRight,
  Plus,
  Truck,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  ClipboardText,
  Storefront,
  Package,
  CheckCircle,
  Clock,
  Warning,
  X,
  ArrowRight,
  Receipt,
  ShoppingCart,
} from '@phosphor-icons/react';

// Types
type WorkflowStage = 'rfq' | 'quotes' | 'purchases' | 'suppliers';
type TrackingStatus = 'pending' | 'in_progress' | 'completed' | 'over_purchased';
type RfqStatus = 'open' | 'quoted' | 'accepted' | 'expired' | 'cancelled';

interface UnifiedProcurementViewProps {
  project: Project;
  items: BOQItem[];
  onItemsRefresh?: () => void | Promise<void>;
}

interface PurchaseFormState {
  supplierName: string;
  quantity: string;
  unitPrice: string;
  purchasedAt: string;
  notes: string;
  procurementRequestId: string | null;
}

type SupplierOption = {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  isTrusted: boolean;
  rating: number;
  source: 'db' | 'static';
};

// Helpers
const mapStaticSupplier = (supplier: StaticSupplier): SupplierOption => ({
  id: supplier.id,
  name: supplier.name,
  location: supplier.location,
  phone: supplier.phone || null,
  email: supplier.email || null,
  website: supplier.website || null,
  isTrusted: supplier.isTrusted,
  rating: supplier.rating,
  source: 'static',
});

const mapDbSupplier = (supplier: DbSupplier): SupplierOption => ({
  id: supplier.id,
  name: supplier.name,
  location: supplier.location,
  phone: supplier.contact_phone,
  email: supplier.contact_email,
  website: supplier.website,
  isTrusted: supplier.is_trusted,
  rating: supplier.rating,
  source: 'db',
});

const mergeSuppliers = (primary: SupplierOption[], fallback: SupplierOption[]) => {
  const seen = new Set(primary.map((s) => s.name.toLowerCase()));
  const merged = [...primary];
  fallback.forEach((s) => {
    if (!seen.has(s.name.toLowerCase())) merged.push(s);
  });
  return merged;
};

const toIsoMidday = (dateString: string) => {
  if (!dateString) return new Date().toISOString();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
};

const statusLabels: Record<TrackingStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  over_purchased: 'Over-purchased',
};

const rfqStatusLabels: Record<RfqStatus, string> = {
  open: 'Open',
  quoted: 'Quotes In',
  accepted: 'Accepted',
  expired: 'Expired',
  cancelled: 'Cancelled',
};


export default function UnifiedProcurementView({ project, items, onItemsRefresh }: UnifiedProcurementViewProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { formatPrice, exchangeRate } = useCurrency();

  // Navigation state
  const [activeStage, setActiveStage] = useState<WorkflowStage>('purchases');

  // Data state
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [rfqs, setRfqs] = useState<RfqWithDetails[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierOption[]>(() => staticSuppliers.map(mapStaticSupplier));

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrackingStatus>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Modal state for purchases
  const [activeRecord, setActiveRecord] = useState<PurchaseRecord | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<PurchaseFormState>({
    supplierName: '',
    quantity: '',
    unitPrice: '',
    purchasedAt: new Date().toISOString().split('T')[0],
    notes: '',
    procurementRequestId: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRecord | null>(null);

  // RFQ state
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [rfqNotes, setRfqNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(project.location || '');
  const [requiredBy, setRequiredBy] = useState('');
  const [isSubmittingRfq, setIsSubmittingRfq] = useState(false);
  const [matchPreview, setMatchPreview] = useState<SupplierMatch[]>([]);
  const [isMatchingSuppliers, setIsMatchingSuppliers] = useState(false);

  // Supplier state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [isSupplierSaving, setIsSupplierSaving] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    location: '',
    contact_phone: '',
    contact_email: '',
    website: '',
    is_trusted: false,
  });

  // Load purchase records
  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    const { records: nextRecords, error } = await getPurchaseRecords(project.id);
    if (error) {
      showError(error.message || 'Failed to load purchase records');
    } else {
      setRecords(nextRecords);
    }
    setIsLoading(false);
  }, [project.id, showError]);

  // Load RFQs
  const loadRfqs = useCallback(async () => {
    const { rfqs: nextRfqs, error } = await getProjectRfqs(project.id);
    if (error) {
      showError('Failed to load RFQs');
    } else {
      setRfqs(nextRfqs);
    }
  }, [project.id, showError]);

  // Load suppliers
  const loadSuppliers = useCallback(async () => {
    const { suppliers, error } = await getSuppliers();
    if (!error && suppliers.length > 0) {
      const dbSuppliers = suppliers.map(mapDbSupplier);
      setSupplierList(mergeSuppliers(dbSuppliers, staticSuppliers.map(mapStaticSupplier)));
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadRfqs();
    loadSuppliers();
  }, [loadRecords, loadRfqs, loadSuppliers]);

  // Computed data
  const recordsByItem = useMemo(() => {
    const grouped: Record<string, PurchaseRecord[]> = {};
    records.forEach((record) => {
      if (!grouped[record.boq_item_id]) grouped[record.boq_item_id] = [];
      grouped[record.boq_item_id].push(record);
    });
    return grouped;
  }, [records]);

  const itemRows = useMemo(() => {
    const epsilon = 0.0001;
    return items.map((item) => {
      const purchases = recordsByItem[item.id] || [];
      const purchasedQty = purchases.reduce((sum, p) => sum + Number(p.quantity), 0);
      const spent = purchases.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price_usd), 0);
      const avgPrice = purchasedQty > 0 ? spent / purchasedQty : null;
      const estimatedQty = Number(item.quantity) || 0;
      const remainingQty = Math.max(estimatedQty - purchasedQty, 0);
      const lastPurchase = purchases.reduce<Date | null>((latest, p) => {
        const d = new Date(p.purchased_at);
        if (!latest || d > latest) return d;
        return latest;
      }, null);

      let status: TrackingStatus = 'pending';
      if (purchasedQty > 0 && purchasedQty < estimatedQty - epsilon) {
        status = 'in_progress';
      } else if (purchasedQty >= estimatedQty + epsilon) {
        status = 'over_purchased';
      } else if (purchasedQty >= estimatedQty - epsilon && purchasedQty > 0) {
        status = 'completed';
      }

      const progress = estimatedQty > 0 ? Math.min((purchasedQty / estimatedQty) * 100, 100) : 0;

      return { item, purchases, purchasedQty, remainingQty, estimatedQty, spent, avgPrice, status, lastPurchase, progress };
    });
  }, [items, recordsByItem]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return itemRows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!term) return true;
      return row.item.material_name.toLowerCase().includes(term);
    });
  }, [itemRows, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const counts: Record<TrackingStatus, number> = { pending: 0, in_progress: 0, completed: 0, over_purchased: 0 };
    let totalEstimatedQty = 0, totalPurchasedQty = 0, totalRemainingQty = 0, totalSpent = 0;

    itemRows.forEach((row) => {
      counts[row.status] += 1;
      totalEstimatedQty += row.estimatedQty;
      totalPurchasedQty += row.purchasedQty;
      totalRemainingQty += row.remainingQty;
      totalSpent += row.spent;
    });

    const progress = totalEstimatedQty > 0 ? Math.min((totalPurchasedQty / totalEstimatedQty) * 100, 100) : 0;
    return { counts, totalEstimatedQty, totalPurchasedQty, totalRemainingQty, totalSpent, progress };
  }, [itemRows]);

  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    let list = supplierList;
    if (trustedOnly) list = list.filter((s) => s.isTrusted);
    if (query) list = list.filter((s) => [s.name, s.location || ''].join(' ').toLowerCase().includes(query));
    return list.slice().sort((a, b) => Number(b.isTrusted) - Number(a.isTrusted) || a.name.localeCompare(b.name));
  }, [supplierList, supplierSearch, trustedOnly]);

  const pendingItems = useMemo(() => items.filter((item) => !item.is_purchased), [items]);

  // Request stats
  const requestStats = useMemo(() => {
    const stats = { total: rfqs.length, open: 0, quoted: 0, accepted: 0 };
    rfqs.forEach((r) => {
      if (r.status === 'open') stats.open++;
      if (r.status === 'quoted') stats.quoted++;
      if (r.status === 'accepted') stats.accepted++;
    });
    return stats;
  }, [rfqs]);

  // Handlers
  const resetForm = () => {
    setFormState({
      supplierName: '',
      quantity: '',
      unitPrice: '',
      purchasedAt: new Date().toISOString().split('T')[0],
      notes: '',
      procurementRequestId: null,
    });
  };

  const openNewPurchase = (itemId: string, supplierName?: string) => {
    setActiveItemId(itemId);
    setActiveRecord(null);
    resetForm();
    if (supplierName) {
      setFormState((prev) => ({ ...prev, supplierName }));
    }
    setIsModalOpen(true);
  };

  const openEditPurchase = (record: PurchaseRecord) => {
    setActiveItemId(record.boq_item_id);
    setActiveRecord(record);
    setFormState({
      supplierName: record.supplier_name,
      quantity: record.quantity.toString(),
      unitPrice: record.unit_price_usd.toString(),
      purchasedAt: new Date(record.purchased_at).toISOString().split('T')[0],
      notes: record.notes || '',
      procurementRequestId: null,
    });
    setIsModalOpen(true);
  };

  const handleSavePurchase = async () => {
    if (!activeItemId) return;
    const supplierName = formState.supplierName.trim();
    if (!supplierName) { showError('Supplier name is required.'); return; }
    const quantity = Number(formState.quantity);
    if (!quantity || quantity <= 0) { showError('Enter a valid quantity.'); return; }
    const unitPrice = Number(formState.unitPrice);
    if (!unitPrice || unitPrice <= 0) { showError('Enter a valid unit price.'); return; }

    const matchedSupplier = supplierList.find((s) => s.name.toLowerCase() === supplierName.toLowerCase());
    setIsSaving(true);

    if (activeRecord) {
      const { error } = await updatePurchaseRecord(activeRecord.id, {
        supplier_name: supplierName,
        supplier_id: matchedSupplier?.id || null,
        quantity,
        unit_price_usd: unitPrice,
        purchased_at: toIsoMidday(formState.purchasedAt),
        notes: formState.notes || null,
      });
      if (error) showError(error.message || 'Failed to update purchase');
      else success('Purchase updated');
    } else {
      const { error } = await createPurchaseRecord({
        project_id: project.id,
        boq_item_id: activeItemId,
        supplier_name: supplierName,
        supplier_id: matchedSupplier?.id || null,
        quantity,
        unit_price_usd: unitPrice,
        purchased_at: toIsoMidday(formState.purchasedAt),
        notes: formState.notes || null,
      });
      if (error) showError(error.message || 'Failed to add purchase');
      else success('Purchase logged');
    }

    setIsSaving(false);
    setIsModalOpen(false);
    resetForm();
    await loadRecords();
    await onItemsRefresh?.();
  };

  const handleDeletePurchase = async () => {
    if (!deleteTarget) return;
    const { error } = await deletePurchaseRecord(deleteTarget.id);
    if (error) { showError(error.message || 'Failed to delete purchase'); return; }
    setDeleteTarget(null);
    success('Purchase deleted');
    await loadRecords();
    await onItemsRefresh?.();
  };

  const toggleItem = (itemId: string) => setSelectedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));

  const handlePreviewMatches = async () => {
    const chosenItems = pendingItems.filter((item) => selectedItems[item.id]);
    if (chosenItems.length === 0) { showError('Select at least one material.'); return; }
    setIsMatchingSuppliers(true);
    const { matches, error } = await matchSuppliersForItems({
      items: chosenItems,
      projectLocation: deliveryAddress || project.location,
      maxSuppliers: 10,
    });
    if (error) {
      showError(error.message || 'Failed to match suppliers');
    } else {
      setMatchPreview(matches);
    }
    setIsMatchingSuppliers(false);
  };

  const handleCreateRequest = async () => {
    if (!user) { showError('Please sign in again.'); return; }
    const chosenItems = pendingItems.filter((item) => selectedItems[item.id]);
    if (chosenItems.length === 0) { showError('Select at least one material.'); return; }

    setIsSubmittingRfq(true);
    const { error, matches } = await createRfqRequest({
      projectId: project.id,
      deliveryAddress: deliveryAddress || project.location || null,
      requiredBy: requiredBy || null,
      notes: rfqNotes || null,
      items: chosenItems,
      maxSuppliers: 10,
    });

    if (error) {
      showError(error.message || 'Failed to create RFQ');
      setIsSubmittingRfq(false);
      return;
    }

    setRfqNotes('');
    setSelectedItems({});
    setMatchPreview(matches);
    setIsSubmittingRfq(false);
    success(`RFQ sent to ${matches.length} suppliers`);
    await loadRfqs();
  };

  const handleAcceptQuote = async (rfqId: string, quoteId: string) => {
    const { error } = await acceptRfqQuote({ rfqId, quoteId });
    if (error) { showError(error.message || 'Failed to accept quote'); return; }
    success('Quote accepted. Order confirmed.');
    await loadRfqs();
  };

  const handleCreateSupplier = async () => {
    if (!user) { showError('Please sign in again.'); return; }
    if (!newSupplier.name.trim()) { showError('Supplier name is required.'); return; }

    setIsSupplierSaving(true);
    const rawWebsite = newSupplier.website.trim();
    const website = rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite;
    const basePayload = {
      name: newSupplier.name.trim(),
      location: newSupplier.location.trim() || null,
      contact_phone: newSupplier.contact_phone.trim() || null,
      contact_email: newSupplier.contact_email.trim() || null,
      website: website || null,
      is_trusted: newSupplier.is_trusted,
    };

    if (editingSupplierId) {
      const { supplier, error } = await updateSupplier(editingSupplierId, basePayload);
      if (error) { showError(error.message); setIsSupplierSaving(false); return; }
      if (supplier) {
        setSupplierList((prev) => prev.map((s) => (s.id === supplier.id ? mapDbSupplier(supplier) : s)));
        success('Supplier updated');
      }
      setEditingSupplierId(null);
    } else {
      const payload: SupplierInsert = { ...basePayload, rating: 0 };
      const { supplier, error } = await createSupplier(payload);
      if (error) { showError(error.message); setIsSupplierSaving(false); return; }
      if (supplier) {
        const mapped = mapDbSupplier(supplier);
        setSupplierList((prev) => [mapped, ...prev]);
        success('Supplier added');
      }
    }

    setNewSupplier({ name: '', location: '', contact_phone: '', contact_email: '', website: '', is_trusted: false });
    setIsSupplierSaving(false);
  };

  const handleEditSupplier = (supplier: SupplierOption) => {
    if (supplier.source !== 'db') { showError("Built-in suppliers can't be edited."); return; }
    setEditingSupplierId(supplier.id);
    setNewSupplier({
      name: supplier.name,
      location: supplier.location || '',
      contact_phone: supplier.phone || '',
      contact_email: supplier.email || '',
      website: supplier.website || '',
      is_trusted: supplier.isTrusted,
    });
    setActiveStage('suppliers');
  };

  const handleCancelEdit = () => {
    setEditingSupplierId(null);
    setNewSupplier({ name: '', location: '', contact_phone: '', contact_email: '', website: '', is_trusted: false });
  };

  const handleDeleteSupplier = async (supplier: SupplierOption) => {
    if (supplier.source !== 'db') { showError("Built-in suppliers can't be deleted."); return; }
    if (!window.confirm(`Delete ${supplier.name}? This cannot be undone.`)) return;
    const { error } = await deleteSupplier(supplier.id);
    if (error) { showError(error.message); return; }
    setSupplierList((prev) => prev.filter((s) => s.id !== supplier.id));
    success('Supplier deleted');
  };

  // Convert accepted quote to purchase record
  const convertToPurchase = (rfq: RfqWithDetails, supplierName?: string) => {
    const firstItem = rfq.rfq_items?.[0];
    if (!firstItem) { showError('RFQ has no items'); return; }
    const matchedItem = items.find((item) => item.material_id === firstItem.material_key)
      || items.find((item) => item.material_name === firstItem.material_name);
    if (!matchedItem) { showError('No matching BOQ item found for this RFQ'); return; }
    setActiveItemId(matchedItem.id);
    setActiveRecord(null);
    setFormState({
      supplierName: supplierName || 'Supplier',
      quantity: '',
      unitPrice: '',
      purchasedAt: new Date().toISOString().split('T')[0],
      notes: `From RFQ #${rfq.id.slice(0, 8)}`,
      procurementRequestId: null,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="unified-procurement">
      {/* Header with workflow navigation */}
      <div className="procurement-header">
        <div>
          <h2>Procurement Hub</h2>
          <p>Manage quotes, purchases, and suppliers in one place</p>
        </div>
      </div>

      {/* Workflow Stage Tabs */}
      <div className="workflow-tabs">
        <button
          className={`workflow-tab ${activeStage === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveStage('purchases')}
        >
          <ShoppingCart size={18} />
          <span>Purchases</span>
          <span className="tab-badge">{summary.counts.completed}/{items.length}</span>
        </button>
        <button
          className={`workflow-tab ${activeStage === 'rfq' ? 'active' : ''}`}
          onClick={() => setActiveStage('rfq')}
        >
          <ClipboardText size={18} />
          <span>Request Quotes</span>
        </button>
        <button
          className={`workflow-tab ${activeStage === 'quotes' ? 'active' : ''}`}
          onClick={() => setActiveStage('quotes')}
        >
          <Receipt size={18} />
          <span>Quotes</span>
          {requestStats.open > 0 && <span className="tab-badge pending">{requestStats.open}</span>}
        </button>
        <button
          className={`workflow-tab ${activeStage === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveStage('suppliers')}
        >
          <Storefront size={18} />
          <span>Suppliers</span>
        </button>
      </div>

      {/* Summary Cards - Always visible */}
      <div className="summary-row">
        <div className="summary-card">
          <Package size={20} />
          <div>
            <span className="label">Items</span>
            <span className="value">{items.length}</span>
          </div>
        </div>
        <div className="summary-card">
          <Clock size={20} />
          <div>
            <span className="label">Pending</span>
            <span className="value">{summary.counts.pending}</span>
          </div>
        </div>
        <div className="summary-card success">
          <CheckCircle size={20} />
          <div>
            <span className="label">Purchased</span>
            <span className="value">{summary.counts.completed}</span>
          </div>
        </div>
        <div className="summary-card highlight">
          <Receipt size={20} />
          <div>
            <span className="label">Total Spent</span>
            <span className="value">{formatPrice(summary.totalSpent, summary.totalSpent * exchangeRate)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Overall Progress</span>
          <span>{summary.progress.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${summary.progress}%` }} />
        </div>
      </div>

      {/* Stage Content */}
      {activeStage === 'purchases' && (
        <div className="stage-content">
          {/* Toolbar */}
          <div className="table-toolbar">
            <div className="search-box">
              <MagnifyingGlass size={16} />
              <input
                type="text"
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-btn" onClick={() => setSearchTerm('')}>
                  <X size={14} />
                </button>
              )}
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TrackingStatus | 'all')}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="over_purchased">Over-purchased</option>
            </select>
          </div>

          {/* Materials Table */}
          <div className="materials-list">
            {filteredRows.length === 0 && !isLoading && (
              <div className="empty-state">
                <Package size={48} weight="light" />
                <p>No items match your filters</p>
              </div>
            )}
            {filteredRows.map((row) => (
              <Fragment key={row.item.id}>
                <div className={`material-card ${row.status}`}>
                  <div className="material-main">
                    <div className="material-info">
                      <h4>{row.item.material_name}</h4>
                      <span className="unit">{row.item.unit}</span>
                    </div>
                    <div className="material-progress">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${row.progress}%` }} />
                      </div>
                      <span>{row.progress.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="material-stats">
                    <div className="stat">
                      <span className="label">Estimated</span>
                      <span className="value">{row.estimatedQty.toFixed(2)}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Purchased</span>
                      <span className="value">{row.purchasedQty.toFixed(2)}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Remaining</span>
                      <span className="value">{row.remainingQty.toFixed(2)}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Spent</span>
                      <span className="value">{formatPrice(row.spent, row.spent * exchangeRate)}</span>
                    </div>
                  </div>

                  <div className="material-actions">
                    <span className={`status-badge ${row.status}`}>{statusLabels[row.status]}</span>
                    <div className="action-buttons">
                      <Button size="sm" icon={<Plus size={14} />} onClick={() => openNewPurchase(row.item.id)}>
                        Add Purchase
                      </Button>
                      <button
                        className="expand-btn"
                        onClick={() => setExpandedItemId(expandedItemId === row.item.id ? null : row.item.id)}
                      >
                        {expandedItemId === row.item.id ? <CaretUp size={16} /> : <CaretDown size={16} />}
                        History
                      </button>
                    </div>
                  </div>
                </div>

                {/* Purchase History */}
                {expandedItemId === row.item.id && (
                  <div className="history-panel">
                    {row.purchases.length === 0 ? (
                      <div className="history-empty">No purchases recorded yet</div>
                    ) : (
                      <div className="history-list">
                        {row.purchases.map((record) => (
                          <div key={record.id} className="history-item">
                            <div className="history-supplier">
                              <Truck size={16} />
                              <span>{record.supplier_name}</span>
                            </div>
                            <div className="history-details">
                              <span>{Number(record.quantity).toFixed(2)} × {formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}</span>
                              <span className="total">= {formatPrice(Number(record.quantity) * Number(record.unit_price_usd), Number(record.quantity) * Number(record.unit_price_usd) * exchangeRate)}</span>
                            </div>
                            <div className="history-date">
                              {new Date(record.purchased_at).toLocaleDateString()}
                            </div>
                            <div className="history-actions">
                              <button onClick={() => openEditPurchase(record)}>
                                <PencilSimple size={14} />
                              </button>
                              <button className="danger" onClick={() => setDeleteTarget(record)}>
                                <Trash size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {activeStage === 'rfq' && (
        <div className="stage-content">
          <div className="rfq-builder">
            <div className="builder-header">
              <ClipboardText size={24} />
              <div>
                <h3>Create Request for Quote</h3>
                <p>Select materials and notify matched suppliers</p>
              </div>
            </div>

            <div className="form-section">
              <label>Delivery Address</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="e.g. 12 Borrowdale Rd, Harare"
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Required By</label>
                <input
                  type="date"
                  value={requiredBy}
                  onChange={(e) => setRequiredBy(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Supplier Matches</label>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handlePreviewMatches}
                  loading={isMatchingSuppliers}
                >
                  Preview Matches
                </Button>
              </div>
            </div>

            <div className="form-section">
              <label>Select Materials ({Object.values(selectedItems).filter(Boolean).length} selected)</label>
              <div className="materials-grid">
                {pendingItems.length === 0 && (
                  <div className="empty-state small">All materials have been purchased</div>
                )}
                {pendingItems.map((item) => (
                  <label key={item.id} className={`material-option ${selectedItems[item.id] ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItems[item.id])}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span className="name">{item.material_name}</span>
                    <span className="qty">{item.quantity} {item.unit}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label>Notes (Optional)</label>
              <textarea
                value={rfqNotes}
                onChange={(e) => setRfqNotes(e.target.value)}
                placeholder="Delivery location, preferred dates, or additional requirements..."
              />
            </div>

            {matchPreview.length > 0 && (
              <div className="match-preview">
                <div className="match-header">
                  <h4>Matched Suppliers ({matchPreview.length})</h4>
                  <span>Top matches based on category and location</span>
                </div>
                <div className="match-grid">
                  {matchPreview.map((match) => (
                    <div key={match.supplier.id} className="match-card">
                      <div>
                        <strong>{match.supplier.name}</strong>
                        {match.supplier.location && <span>{match.supplier.location}</span>}
                      </div>
                      <div className="match-score">Score {match.score.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleCreateRequest}
              loading={isSubmittingRfq}
              icon={<Truck size={18} />}
              disabled={Object.values(selectedItems).filter(Boolean).length === 0}
            >
              Send RFQ to Matched Suppliers
            </Button>
          </div>
        </div>
      )}

      {activeStage === 'quotes' && (
        <div className="stage-content">
          <div className="quotes-header">
            <h3>RFQ Quotes</h3>
            <p>Track and manage supplier quotes</p>
          </div>

          {rfqs.length === 0 ? (
            <div className="empty-state">
              <ClipboardText size={48} weight="light" />
              <p>No RFQs yet</p>
              <Button variant="secondary" onClick={() => setActiveStage('rfq')}>
                Create Request
              </Button>
            </div>
          ) : (
            <div className="quotes-list">
              {rfqs.map((rfq) => (
                <div key={rfq.id} className="quote-card">
                  <div className="quote-header">
                    <div className="quote-supplier">
                      <Truck size={20} />
                      <div>
                        <h4>RFQ #{rfq.id.slice(0, 8)}</h4>
                        <span className="date">Created {new Date(rfq.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`status-badge ${rfq.status}`}>
                      {rfqStatusLabels[rfq.status as RfqStatus] || rfq.status}
                    </span>
                  </div>

                  <div className="quote-items">
                    {rfq.rfq_items.map((item) => (
                      <span key={item.id} className="item-pill">
                        {item.material_name || item.material_key} ({Number(item.quantity).toFixed(2)} {item.unit || ''})
                      </span>
                    ))}
                  </div>

                  <div className="quote-meta">
                    <span>{rfq.rfq_recipients?.length || 0} suppliers notified</span>
                    <span>{rfq.rfq_quotes.length} quotes received</span>
                  </div>

                  <div className="quote-comparison">
                    {rfq.rfq_quotes.length === 0 ? (
                      <div className="quote-empty">No quotes submitted yet.</div>
                    ) : (
                      rfq.rfq_quotes.map((quote) => (
                        <div key={quote.id} className="quote-row">
                          <div>
                            <strong>{quote.supplier?.name || 'Supplier'}</strong>
                            <span className="quote-sub">
                              {quote.delivery_days ? `${quote.delivery_days} days` : 'Delivery TBD'}
                              {quote.valid_until ? ` · Valid until ${new Date(quote.valid_until).toLocaleDateString()}` : ''}
                            </span>
                          </div>
                          <div className="quote-pricing">
                            <span>{formatPrice(Number(quote.total_usd || 0), Number(quote.total_zwg || 0))}</span>
                            <span className={`status-badge ${quote.status}`}>{quote.status}</span>
                          </div>
                          <div className="quote-actions">
                            {rfq.status !== 'accepted' && quote.status === 'submitted' && (
                              <Button
                                size="sm"
                                icon={<CheckCircle size={14} />}
                                onClick={() => handleAcceptQuote(rfq.id, quote.id)}
                              >
                                Accept Quote
                              </Button>
                            )}
                            {rfq.status === 'accepted' && quote.status === 'accepted' && (
                              <Button
                                size="sm"
                                icon={<ArrowRight size={14} />}
                                onClick={() => convertToPurchase(rfq, quote.supplier?.name)}
                              >
                                Record Purchase
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeStage === 'suppliers' && (
        <div className="stage-content">
          <div className="suppliers-section">
            <div className="add-supplier-form">
              <div className="builder-header">
                <Storefront size={24} />
                <div>
                  <h3>{editingSupplierId ? 'Edit Supplier' : 'Add New Supplier'}</h3>
                  <p>Add your own trusted suppliers</p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. PPC Zimbabwe"
                  />
                </div>
                <div className="form-field">
                  <label>Location</label>
                  <input
                    type="text"
                    value={newSupplier.location}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Harare"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={newSupplier.contact_phone}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, contact_phone: e.target.value }))}
                    placeholder="+263..."
                  />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={newSupplier.contact_email}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, contact_email: e.target.value }))}
                    placeholder="sales@example.com"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Website</label>
                <input
                  type="url"
                  value={newSupplier.website}
                  onChange={(e) => setNewSupplier((p) => ({ ...p, website: e.target.value }))}
                  placeholder="https://supplier.co.zw"
                />
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={newSupplier.is_trusted}
                  onChange={(e) => setNewSupplier((p) => ({ ...p, is_trusted: e.target.checked }))}
                />
                Mark as trusted supplier
              </label>

              <div className="form-actions">
                <Button onClick={handleCreateSupplier} loading={isSupplierSaving}>
                  {editingSupplierId ? 'Save Changes' : 'Add Supplier'}
                </Button>
                {editingSupplierId && (
                  <Button variant="secondary" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="suppliers-list-section">
              <h3>All Suppliers</h3>
              <div className="supplier-toolbar">
                <div className="search-box">
                  <MagnifyingGlass size={16} />
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                  />
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={trustedOnly}
                    onChange={(e) => setTrustedOnly(e.target.checked)}
                  />
                  Trusted only
                </label>
              </div>

              <div className="suppliers-grid">
                {filteredSuppliers.map((supplier) => (
                  <div key={supplier.id} className="supplier-card">
                    <div className="supplier-info">
                      <h4>
                        {supplier.name}
                        {supplier.isTrusted && <span className="trusted-badge">★</span>}
                      </h4>
                      <span className="location">{supplier.location || 'No location'}</span>
                      {supplier.source === 'static' && <span className="source-badge">Built-in</span>}
                    </div>
                    <div className="supplier-actions">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEditSupplier(supplier)}
                        disabled={supplier.source !== 'db'}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSupplier(supplier)}
                        disabled={supplier.source !== 'db'}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{activeRecord ? 'Edit Purchase' : 'Add Purchase'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Supplier Name</label>
                <input
                  type="text"
                  list="supplier-list"
                  value={formState.supplierName}
                  onChange={(e) => setFormState({ ...formState, supplierName: e.target.value })}
                  placeholder="e.g. PPC Zimbabwe"
                />
                <datalist id="supplier-list">
                  {supplierList.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.quantity}
                    onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Unit Price (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.unitPrice}
                    onChange={(e) => setFormState({ ...formState, unitPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Purchase Date</label>
                <input
                  type="date"
                  value={formState.purchasedAt}
                  onChange={(e) => setFormState({ ...formState, purchasedAt: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Notes (Optional)</label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Invoice reference or delivery notes"
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePurchase} loading={isSaving}>
                {activeRecord ? 'Save Changes' : 'Add Purchase'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePurchase}
        title="Delete Purchase Record?"
        message="This will remove the purchase and update totals."
        confirmText="Delete"
        variant="danger"
      />

      <style jsx>{`
        .unified-procurement {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .procurement-header {
          margin-bottom: 8px;
        }

        .procurement-header h2 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .procurement-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 1rem;
        }

        /* Workflow Tabs */
        .workflow-tabs {
          display: flex;
          gap: 8px;
          padding: 4px;
          background: #f1f5f9;
          border-radius: 16px;
          overflow-x: auto;
        }

        .workflow-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .workflow-tab:hover {
          background: white;
          color: #334155;
        }

        .workflow-tab.active {
          background: white;
          color: #0f172a;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .tab-badge {
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 10px;
          background: #e2e8f0;
          color: #475569;
        }

        .tab-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        /* Summary Row */
        .summary-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          transition: all 0.2s;
        }

        .summary-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .summary-card svg {
          color: #64748b;
        }

        .summary-card.success svg {
          color: #22c55e;
        }

        .summary-card.highlight {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border: none;
          color: white;
        }

        .summary-card.highlight svg {
          color: white;
        }

        .summary-card .label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }

        .summary-card.highlight .label {
          color: rgba(255, 255, 255, 0.8);
        }

        .summary-card .value {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
        }

        .summary-card.highlight .value {
          color: white;
        }

        /* Progress Section */
        .progress-section {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 12px;
        }

        .progress-bar {
          height: 10px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          border-radius: 999px;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Stage Content */
        .stage-content {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px;
        }

        /* Table Toolbar */
        .table-toolbar {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          flex: 1;
          max-width: 320px;
          transition: all 0.2s;
        }

        .search-box:focus-within {
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-box input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.9rem;
          flex: 1;
          color: #0f172a;
        }

        .clear-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #94a3b8;
          border-radius: 4px;
        }

        .clear-btn:hover {
          color: #64748b;
          background: #e2e8f0;
        }

        select {
          padding: 10px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 0.9rem;
          background: white;
          color: #0f172a;
          cursor: pointer;
          outline: none;
        }

        select:focus {
          border-color: #3b82f6;
        }

        /* Materials List */
        .materials-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .material-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s;
        }

        .material-card:hover {
          border-color: #cbd5e1;
        }

        .material-card.completed {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .material-card.over_purchased {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .material-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .material-info h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
        }

        .material-info .unit {
          font-size: 0.8rem;
          color: #64748b;
        }

        .material-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 120px;
        }

        .material-progress .progress-track {
          flex: 1;
          height: 6px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .material-progress .progress-fill {
          height: 100%;
          background: #22c55e;
          border-radius: 999px;
        }

        .material-progress span {
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
        }

        .material-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat .label {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
        }

        .stat .value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #334155;
        }

        .material-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .status-badge.pending { background: #f1f5f9; color: #475569; }
        .status-badge.in_progress { background: #eff6ff; color: #1d4ed8; }
        .status-badge.completed { background: #dcfce7; color: #166534; }
        .status-badge.over_purchased { background: #fee2e2; color: #991b1b; }
        .status-badge.open { background: #dbeafe; color: #1d4ed8; }
        .status-badge.quoted { background: #fef3c7; color: #92400e; }
        .status-badge.accepted { background: #dcfce7; color: #166534; }
        .status-badge.expired { background: #f1f5f9; color: #64748b; }
        .status-badge.cancelled { background: #fee2e2; color: #dc2626; }
        .status-badge.submitted { background: #e0f2fe; color: #0369a1; }
        .status-badge.rejected { background: #fee2e2; color: #b91c1c; }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .expand-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .expand-btn:hover {
          border-color: #cbd5e1;
          color: #334155;
        }

        /* History Panel */
        .history-panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin-top: -4px;
          margin-bottom: 12px;
          border-left: 4px solid #3b82f6;
        }

        .history-empty {
          text-align: center;
          color: #94a3b8;
          padding: 20px;
          font-style: italic;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
        }

        .history-supplier {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: #334155;
          min-width: 160px;
        }

        .history-details {
          flex: 1;
          font-size: 0.9rem;
          color: #64748b;
        }

        .history-details .total {
          font-weight: 600;
          color: #334155;
        }

        .history-date {
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .history-actions {
          display: flex;
          gap: 4px;
        }

        .history-actions button {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .history-actions button:hover {
          border-color: #cbd5e1;
          color: #334155;
        }

        .history-actions button.danger:hover {
          border-color: #fecaca;
          color: #ef4444;
          background: #fef2f2;
        }

        /* RFQ Builder */
        .rfq-builder, .add-supplier-form {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
        }

        .builder-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }

        .builder-header svg {
          color: #3b82f6;
          padding: 12px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .builder-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .builder-header p {
          margin: 4px 0 0;
          font-size: 0.9rem;
          color: #64748b;
        }

        .form-section {
          margin-bottom: 24px;
        }

        .form-section > label {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 8px;
        }

        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .select-wrapper select {
          flex: 1;
          padding-right: 40px;
          appearance: none;
        }

        .select-wrapper > svg {
          position: absolute;
          right: 14px;
          pointer-events: none;
          color: #64748b;
        }

        .supplier-contact {
          display: flex;
          gap: 16px;
          font-size: 0.85rem;
          color: #64748b;
          margin-top: 8px;
        }

        .materials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        .material-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .material-option:hover {
          border-color: #cbd5e1;
        }

        .material-option.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .material-option .name {
          flex: 1;
          font-weight: 500;
          color: #0f172a;
        }

        .material-option .qty {
          font-size: 0.8rem;
          color: #64748b;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 6px;
        }

        textarea {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 0.95rem;
          resize: vertical;
          min-height: 100px;
          outline: none;
          transition: border-color 0.2s;
        }

        textarea:focus {
          border-color: #3b82f6;
        }

        .match-preview {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .match-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
        }

        .match-header h4 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }

        .match-header span {
          font-size: 0.8rem;
          color: #64748b;
        }

        .match-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .match-card {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
          font-size: 0.85rem;
          color: #334155;
        }

        .match-card strong {
          display: block;
          font-size: 0.9rem;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .match-card span {
          font-size: 0.75rem;
          color: #64748b;
        }

        .match-score {
          font-weight: 700;
          color: #2563eb;
        }

        /* Quotes Section */
        .quotes-header {
          margin-bottom: 24px;
        }

        .quotes-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
        }

        .quotes-header p {
          margin: 4px 0 0;
          color: #64748b;
        }

        .quotes-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .quote-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
        }

        .quote-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .quote-supplier {
          display: flex;
          gap: 12px;
        }

        .quote-supplier svg {
          color: #3b82f6;
        }

        .quote-supplier h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
        }

        .quote-supplier .date {
          font-size: 0.8rem;
          color: #64748b;
        }

        .quote-items {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .item-pill {
          padding: 6px 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #475569;
        }

        .quote-meta {
          display: flex;
          gap: 16px;
          font-size: 0.85rem;
          color: #64748b;
          margin-bottom: 12px;
        }

        .quote-comparison {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .quote-row {
          display: grid;
          grid-template-columns: 1fr 200px 160px;
          gap: 16px;
          align-items: center;
          padding: 12px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .quote-sub {
          display: block;
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 4px;
        }

        .quote-pricing {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          font-size: 0.9rem;
          color: #0f172a;
        }

        .quote-empty {
          padding: 16px;
          border-radius: 12px;
          background: #f8fafc;
          color: #64748b;
          font-size: 0.9rem;
          text-align: center;
        }

        .quote-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        /* Suppliers Section */
        .suppliers-section {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .suppliers-list-section h3 {
          margin: 0 0 16px;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .supplier-toolbar {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 20px;
        }

        .suppliers-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .supplier-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .supplier-card:hover {
          border-color: #cbd5e1;
        }

        .supplier-info h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .trusted-badge {
          color: #eab308;
        }

        .supplier-info .location {
          font-size: 0.85rem;
          color: #64748b;
        }

        .source-badge {
          font-size: 0.7rem;
          padding: 2px 8px;
          background: #e2e8f0;
          border-radius: 4px;
          color: #64748b;
          margin-left: 8px;
        }

        .supplier-actions {
          display: flex;
          gap: 8px;
        }

        /* Form Fields */
        .form-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-field label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
        }

        .form-field input {
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-field input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .checkbox-field {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: #475569;
          font-weight: 500;
          cursor: pointer;
          margin: 16px 0;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          color: #94a3b8;
        }

        .empty-state svg {
          margin-bottom: 16px;
        }

        .empty-state p {
          margin: 0 0 16px;
          font-size: 1rem;
        }

        .empty-state.small {
          padding: 24px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
        }

        .close-btn {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: #94a3b8;
          border-radius: 8px;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: #f1f5f9;
          color: #64748b;
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 24px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          border-radius: 0 0 20px 20px;
        }

        @media (max-width: 768px) {
          .workflow-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .summary-row {
            grid-template-columns: repeat(2, 1fr);
          }

          .material-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .quote-row {
            grid-template-columns: 1fr;
            text-align: left;
          }

          .quote-pricing {
            align-items: flex-start;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .materials-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
