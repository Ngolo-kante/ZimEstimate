'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  createPurchaseRecord,
  deletePurchaseRecord,
  getPurchaseRecords,
  getSuppliers,
  updatePurchaseRecord,
} from '@/lib/services/projects';
import { BOQItem, PurchaseRecord, Supplier } from '@/lib/database.types';
import {
  CaretDown,
  CaretUp,
  Plus,
  Truck,
  PencilSimple,
  Trash,
  MagnifyingGlass,
} from '@phosphor-icons/react';

type TrackingStatus = 'pending' | 'in_progress' | 'completed' | 'over_purchased';

interface ProjectTrackingViewProps {
  projectId: string;
  items: BOQItem[];
  onItemsRefresh?: () => void | Promise<void>;
}

interface PurchaseFormState {
  supplierName: string;
  quantity: string;
  unitPrice: string;
  purchasedAt: string;
  notes: string;
}

const statusLabels: Record<TrackingStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  over_purchased: 'Over-purchased',
};

const toIsoMidday = (dateString: string) => {
  if (!dateString) return new Date().toISOString();
  const [year, month, day] = dateString.split('-').map(Number);
  const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return safeDate.toISOString();
};

export default function ProjectTrackingView({ projectId, items, onItemsRefresh }: ProjectTrackingViewProps) {
  const { success, error: showError } = useToast();
  const { formatPrice, exchangeRate } = useCurrency();
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TrackingStatus>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
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
  });
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRecord | null>(null);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    const { records: nextRecords, error } = await getPurchaseRecords(projectId);
    if (error) {
      showError(error.message || 'Failed to load purchase records');
    } else {
      setRecords(nextRecords);
    }
    setIsLoading(false);
  }, [projectId, showError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const loadSuppliers = async () => {
      const { suppliers: list, error } = await getSuppliers();
      if (!error) {
        setSuppliers(list);
      }
    };
    loadSuppliers();
  }, []);

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
      const purchasedQty = purchases.reduce((sum, purchase) => sum + Number(purchase.quantity), 0);
      const spent = purchases.reduce((sum, purchase) => sum + Number(purchase.quantity) * Number(purchase.unit_price_usd), 0);
      const avgPrice = purchasedQty > 0 ? spent / purchasedQty : null;
      const estimatedQty = Number(item.quantity) || 0;
      const remainingQty = Math.max(estimatedQty - purchasedQty, 0);
      const lastPurchase = purchases.reduce<Date | null>((latest, purchase) => {
        const nextDate = new Date(purchase.purchased_at);
        if (!latest || nextDate > latest) return nextDate;
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
      return {
        item,
        purchases,
        purchasedQty,
        remainingQty,
        estimatedQty,
        spent,
        avgPrice,
        status,
        lastPurchase,
        progress,
      };
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
    const counts: Record<TrackingStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      over_purchased: 0,
    };
    let totalEstimatedQty = 0;
    let totalPurchasedQty = 0;
    let totalRemainingQty = 0;
    let totalSpent = 0;

    itemRows.forEach((row) => {
      counts[row.status] += 1;
      totalEstimatedQty += row.estimatedQty;
      totalPurchasedQty += row.purchasedQty;
      totalRemainingQty += row.remainingQty;
      totalSpent += row.spent;
    });

    const progress = totalEstimatedQty > 0 ? Math.min((totalPurchasedQty / totalEstimatedQty) * 100, 100) : 0;
    return {
      counts,
      totalEstimatedQty,
      totalPurchasedQty,
      totalRemainingQty,
      totalSpent,
      progress,
    };
  }, [itemRows]);

  const resetForm = () => {
    setFormState({
      supplierName: '',
      quantity: '',
      unitPrice: '',
      purchasedAt: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const openNewPurchase = (itemId: string) => {
    setActiveItemId(itemId);
    setActiveRecord(null);
    resetForm();
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
    });
    setIsModalOpen(true);
  };

  const handleSavePurchase = async () => {
    if (!activeItemId) return;
    const supplierName = formState.supplierName.trim();
    if (!supplierName) {
      showError('Supplier name is required.');
      return;
    }
    const quantity = Number(formState.quantity);
    if (!quantity || quantity <= 0) {
      showError('Enter a valid quantity.');
      return;
    }
    const unitPrice = Number(formState.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      showError('Enter a valid unit price.');
      return;
    }

    const matchedSupplier = suppliers.find(
      (supplier) => supplier.name.toLowerCase() === supplierName.toLowerCase()
    );
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
      if (error) {
        showError(error.message || 'Failed to update purchase');
      } else {
        success('Purchase updated');
      }
    } else {
      const { error } = await createPurchaseRecord({
        project_id: projectId,
        boq_item_id: activeItemId,
        supplier_name: supplierName,
        supplier_id: matchedSupplier?.id || null,
        quantity,
        unit_price_usd: unitPrice,
        purchased_at: toIsoMidday(formState.purchasedAt),
        notes: formState.notes || null,
      });
      if (error) {
        showError(error.message || 'Failed to add purchase');
      } else {
        success('Purchase logged');
      }
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
    if (error) {
      showError(error.message || 'Failed to delete purchase');
      return;
    }
    setDeleteTarget(null);
    success('Purchase deleted');
    await loadRecords();
    await onItemsRefresh?.();
  };

  return (
    <div className="tracking-page">
      <div className="tracking-header">
        <div>
          <h2>Tracking & Procurement</h2>
          <p>Track purchases against estimated quantities and suppliers.</p>
        </div>
        <div className="summary-cards">
          <div className="summary-card">
            <span className="label">Pending</span>
            <span className="value">{summary.counts.pending}</span>
          </div>
          <div className="summary-card">
            <span className="label">In Progress</span>
            <span className="value">{summary.counts.in_progress}</span>
          </div>
          <div className="summary-card">
            <span className="label">Completed</span>
            <span className="value">{summary.counts.completed}</span>
          </div>
          <div className="summary-card alert">
            <span className="label">Over-purchased</span>
            <span className="value">{summary.counts.over_purchased}</span>
          </div>
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-header">
          <span>Overall progress</span>
          <span>{summary.progress.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${summary.progress}%` }} />
        </div>
        <div className="progress-meta">
          <span>
            Purchased {summary.totalPurchasedQty.toFixed(2)} of {summary.totalEstimatedQty.toFixed(2)} units
          </span>
          <span>Remaining {summary.totalRemainingQty.toFixed(2)} units</span>
          <span>Total spent {formatPrice(summary.totalSpent, summary.totalSpent * exchangeRate)}</span>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search">
            <MagnifyingGlass size={14} />
            <input
              type="text"
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TrackingStatus | 'all')}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="over_purchased">Over-purchased</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Est Qty</th>
                <th className="num">Purchased</th>
                <th className="num">Remaining</th>
                <th className="num">Avg Price</th>
                <th className="num">Total Spent</th>
                <th>Last Purchase</th>
                <th>Status</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={9} className="empty">
                    No items match your filters.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => (
                <Fragment key={row.item.id}>
                  <tr key={row.item.id} className={`row status-${row.status}`}>
                    <td className="item-cell">
                      <div className="item-title">{row.item.material_name}</div>
                      <div className="item-sub">{row.item.unit}</div>
                      <div className="progress-mini">
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${row.progress}%` }} />
                        </div>
                        <span>{row.progress.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="num">{row.estimatedQty.toFixed(2)}</td>
                    <td className="num">{row.purchasedQty.toFixed(2)}</td>
                    <td className="num">{row.remainingQty.toFixed(2)}</td>
                    <td className="num">
                      {row.avgPrice ? formatPrice(row.avgPrice, row.avgPrice * exchangeRate) : '—'}
                    </td>
                    <td className="num">{formatPrice(row.spent, row.spent * exchangeRate)}</td>
                    <td>{row.lastPurchase ? row.lastPurchase.toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`status-pill ${row.status}`}>{statusLabels[row.status]}</span>
                    </td>
                    <td className="actions">
                      <Button size="sm" icon={<Plus size={12} />} onClick={() => openNewPurchase(row.item.id)}>
                        Add
                      </Button>
                      <button
                        className="history-btn"
                        onClick={() => setExpandedItemId(expandedItemId === row.item.id ? null : row.item.id)}
                      >
                        {expandedItemId === row.item.id ? <CaretUp size={14} /> : <CaretDown size={14} />}
                        History
                      </button>
                    </td>
                  </tr>
                  {expandedItemId === row.item.id && (
                    <tr className="history-row">
                      <td colSpan={9}>
                        <div className="history-panel">
                          {row.purchases.length === 0 ? (
                            <div className="history-empty">No purchase history yet.</div>
                          ) : (
                            <table className="history-table">
                              <thead>
                                <tr>
                                  <th>Supplier</th>
                                  <th className="num">Qty</th>
                                  <th className="num">Unit Price</th>
                                  <th className="num">Total</th>
                                  <th>Date</th>
                                  <th className="actions">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.purchases.map((record) => (
                                  <tr key={record.id}>
                                    <td>
                                      <div className="supplier-name">
                                        <Truck size={14} />
                                        {record.supplier_name}
                                      </div>
                                    </td>
                                    <td className="num">{Number(record.quantity).toFixed(2)}</td>
                                    <td className="num">
                                      {formatPrice(Number(record.unit_price_usd), Number(record.unit_price_usd) * exchangeRate)}
                                    </td>
                                    <td className="num">
                                      {formatPrice(
                                        Number(record.quantity) * Number(record.unit_price_usd),
                                        Number(record.quantity) * Number(record.unit_price_usd) * exchangeRate
                                      )}
                                    </td>
                                    <td>{new Date(record.purchased_at).toLocaleDateString()}</td>
                                    <td className="actions">
                                      <button className="icon-btn" onClick={() => openEditPurchase(record)}>
                                        <PencilSimple size={14} />
                                      </button>
                                      <button className="icon-btn danger" onClick={() => setDeleteTarget(record)}>
                                        <Trash size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{activeRecord ? 'Edit purchase' : 'Add purchase'}</h3>
              <p>Supplier details are required for purchase history.</p>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Supplier Name</label>
                <input
                  type="text"
                  list="supplier-list"
                  value={formState.supplierName}
                  onChange={(e) => setFormState({ ...formState, supplierName: e.target.value })}
                  placeholder="e.g. PPC Zimbabwe"
                  required
                />
                <datalist id="supplier-list">
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.name} />
                  ))}
                </datalist>
              </div>
              <div className="field-grid">
                <div className="field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.quantity}
                    onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Unit Price (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.unitPrice}
                    onChange={(e) => setFormState({ ...formState, unitPrice: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Purchase Date</label>
                  <input
                    type="date"
                    value={formState.purchasedAt}
                    onChange={(e) => setFormState({ ...formState, purchasedAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Notes (optional)</label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Delivery notes or invoice reference"
                />
              </div>
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePurchase} loading={isSaving}>
                {activeRecord ? 'Save changes' : 'Save purchase'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePurchase}
        title="Delete purchase record?"
        message="This will remove the purchase from history and update totals."
        confirmText="Delete"
        variant="danger"
      />

      <style jsx>{`
                .tracking-page {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .tracking-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 20px;
                    flex-wrap: wrap;
                    margin-bottom: 8px;
                }

                .tracking-header h2 {
                    margin: 0;
                    font-size: 1.75rem;
                    color: #0f172a;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                }

                .tracking-header p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 1rem;
                }

                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 16px;
                    min-width: 420px;
                }

                .summary-card {
                    background: #ffffff;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    border-radius: 20px;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                0 2px 4px -1px rgba(0, 0, 0, 0.01);
                    transition: transform 0.2s;
                }

                .summary-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
                }

                .summary-card.alert {
                    border-color: rgba(239, 68, 68, 0.2);
                    background: #fef2f2;
                }

                .summary-card .label {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                    font-weight: 700;
                }

                .summary-card .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #0f172a;
                    line-height: 1;
                }
                
                .summary-card.alert .value {
                    color: #ef4444;
                }

                .progress-card {
                    background: #ffffff;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    border-radius: 20px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                0 2px 4px -1px rgba(0, 0, 0, 0.01);
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #334155;
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

                .progress-meta {
                    display: flex;
                    gap: 24px;
                    flex-wrap: wrap;
                    font-size: 0.85rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .table-card {
                    background: #ffffff;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                0 2px 4px -1px rgba(0, 0, 0, 0.01);
                }

                .table-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 24px;
                    background: #ffffff;
                    border-bottom: 1px solid #f1f5f9;
                }

                .search {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 8px 12px;
                    flex: 1;
                    max-width: 320px;
                    transition: all 0.2s;
                }
                
                .search:focus-within {
                    border-color: #3b82f6;
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .search input {
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 0.9rem;
                    width: 100%;
                    color: #0f172a;
                }

                select {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 8px 12px;
                    font-size: 0.9rem;
                    background: #ffffff;
                    color: #0f172a;
                    cursor: pointer;
                    outline: none;
                    transition: all 0.2s;
                }
                
                select:focus {
                    border-color: #3b82f6;
                }

                .table-wrap {
                    overflow-x: auto;
                }

                .tracking-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .tracking-table th {
                    text-align: left;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                    padding: 12px 24px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    white-space: nowrap;
                }

                .tracking-table td {
                    padding: 16px 24px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.9rem;
                    color: #334155;
                    vertical-align: middle;
                }

                .tracking-table .num {
                    text-align: right;
                    white-space: nowrap;
                    font-variant-numeric: tabular-nums;
                }

                .tracking-table .actions {
                    text-align: right;
                    white-space: nowrap;
                }
                
                .tracking-table tr:last-child td {
                    border-bottom: none;
                }

                .row.status-over_purchased {
                    background: #fef2f2;
                }
                
                .row.status-over_purchased td {
                    color: #991b1b;
                }

                .item-cell {
                    min-width: 240px;
                }

                .item-title {
                    font-weight: 600;
                    color: #0f172a;
                    font-size: 0.95rem;
                }

                .item-sub {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 4px;
                }

                .progress-mini {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                    font-size: 0.7rem;
                    color: #64748b;
                }

                .progress-track {
                    flex: 1;
                    height: 4px;
                    background: #e2e8f0;
                    border-radius: 999px;
                    overflow: hidden;
                    max-width: 80px;
                }

                .progress-mini .progress-fill {
                    background: #22c55e;
                }

                .status-pill {
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    background: #f1f5f9;
                    color: #475569;
                    display: inline-block;
                }

                .status-pill.completed {
                    background: #dcfce7;
                    color: #166534;
                }
                
                .status-pill.in_progress {
                    background: #eff6ff;
                    color: #1d4ed8;
                }
                
                .status-pill.over_purchased {
                    background: #fee2e2;
                    color: #991b1b;
                }
                
                .history-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.8rem;
                    color: #64748b;
                    padding: 6px 10px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    margin-left: 8px;
                }
                
                .history-btn:hover {
                    background: #f1f5f9;
                    color: #334155;
                }

                .history-row td {
                    padding: 0;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }

                .history-panel {
                    padding: 24px;
                    border-left: 4px solid #3b82f6;
                    background: #fcfcfc;
                }

                .history-empty {
                    padding: 16px;
                    text-align: center;
                    color: #94a3b8;
                    font-style: italic;
                    font-size: 0.9rem;
                }

                .history-table {
                    width: 100%;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .history-table th {
                    text-align: left;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    color: #64748b;
                    padding: 10px 16px;
                    background: #f1f5f9;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .history-table td {
                    padding: 10px 16px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.85rem;
                }
                
                .supplier-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                    color: #334155;
                }

                .icon-btn {
                    width: 28px;
                    height: 28px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    color: #64748b;
                    cursor: pointer;
                    margin-left: 4px;
                    transition: all 0.2s;
                }
                
                .icon-btn:hover {
                    border-color: #cbd5e1;
                    color: #334155;
                    background: #f8fafc;
                }
                
                .icon-btn.danger:hover {
                    border-color: #fecaca;
                    color: #ef4444;
                    background: #fef2f2;
                }
                
                /* Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(4px);
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                
                .modal {
                    background: #ffffff;
                    border-radius: 24px;
                    width: 100%;
                    max-width: 500px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    overflow: hidden;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .modal-header {
                    padding: 24px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                }
                
                .modal-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #0f172a;
                }
                
                .modal-header p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 0.9rem;
                }
                
                .modal-body {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                
                .field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .field label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #334155;
                }
                
                .field input {
                    padding: 10px 14px;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    font-size: 1rem;
                    transition: border 0.2s;
                    outline: none;
                }
                
                .field input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .field-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                
                .modal-actions {
                    padding: 20px 24px;
                    background: #f8fafc;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                
                @media (max-width: 640px) {
                    .tracking-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .summary-cards {
                        width: 100%;
                        min-width: 0;
                    }
                    .field-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
    </div>
  );
}
