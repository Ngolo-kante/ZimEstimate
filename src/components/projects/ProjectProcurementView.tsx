'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { suppliers as staticSuppliers, Supplier as StaticSupplier } from '@/lib/materials';
import {
  createProcurementRequest,
  createSupplier,
  deleteSupplier,
  getProcurementRequests,
  getSuppliers,
  updateSupplier,
  updateProcurementRequest,
} from '@/lib/services/projects';
import { BOQItem, ProcurementRequest, Project, Supplier as DbSupplier, SupplierInsert } from '@/lib/database.types';
import {
  ClipboardText,
  CaretDown,
  Storefront,
  Truck,
} from '@phosphor-icons/react';

interface ProjectProcurementViewProps {
  project: Project;
  items: BOQItem[];
}

type ProcurementStatus = 'draft' | 'requested' | 'received' | 'approved' | 'ordered' | 'cancelled';

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
  const seen = new Set(primary.map((supplier) => supplier.name.toLowerCase()));
  const merged = [...primary];
  fallback.forEach((supplier) => {
    if (!seen.has(supplier.name.toLowerCase())) {
      merged.push(supplier);
    }
  });
  return merged;
};

export default function ProjectProcurementView({ project, items }: ProjectProcurementViewProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [supplierList, setSupplierList] = useState<SupplierOption[]>(() => staticSuppliers.map(mapStaticSupplier));
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSupplierSaving, setIsSupplierSaving] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    location: '',
    contact_phone: '',
    contact_email: '',
    website: '',
    is_trusted: false,
  });

  useEffect(() => {
    const loadRequests = async () => {
      const { requests, error } = await getProcurementRequests(project.id);
      if (error) {
        showError('Failed to load procurement requests');
      } else {
        setRequests(requests);
      }
    };
    loadRequests();
  }, [project.id, showError]);

  useEffect(() => {
    let isMounted = true;
    const loadSuppliers = async () => {
      const { suppliers, error } = await getSuppliers();
      if (!error && suppliers.length > 0 && isMounted) {
        const dbSuppliers = suppliers.map(mapDbSupplier);
        setSupplierList(mergeSuppliers(dbSuppliers, staticSuppliers.map(mapStaticSupplier)));
      }
    };
    loadSuppliers();
    return () => {
      isMounted = false;
    };
  }, []);

  const sortedSuppliers = useMemo(() => {
    return supplierList
      .slice()
      .sort((a, b) => Number(b.isTrusted) - Number(a.isTrusted) || a.name.localeCompare(b.name));
  }, [supplierList]);

  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    let list = supplierList;
    if (trustedOnly) {
      list = list.filter((supplier) => supplier.isTrusted);
    }
    if (query) {
      list = list.filter((supplier) =>
        [supplier.name, supplier.location || '']
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }
    return list
      .slice()
      .sort((a, b) => Number(b.isTrusted) - Number(a.isTrusted) || a.name.localeCompare(b.name));
  }, [supplierList, supplierSearch, trustedOnly]);

  const dropdownSuppliers = useMemo(() => {
    const base = sortedSuppliers;
    if (!selectedSupplierId) {
      return base;
    }
    const hasSelected = base.some((supplier) => supplier.id === selectedSupplierId);
    if (hasSelected) {
      return base;
    }
    const selected = supplierList.find((supplier) => supplier.id === selectedSupplierId);
    return selected ? [selected, ...base] : base;
  }, [sortedSuppliers, selectedSupplierId, supplierList]);

  const effectiveSupplierId = selectedSupplierId || dropdownSuppliers[0]?.id || '';

  const pendingItems = useMemo(() => {
    return items.filter((item) => !item.is_purchased);
  }, [items]);

  const selectedSupplier = supplierList.find((s) => s.id === effectiveSupplierId);

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleCreateRequest = async () => {
    if (!user) {
      showError('Please sign in again to request quotes.');
      return;
    }
    if (!selectedSupplier) {
      showError('Select a supplier first.');
      return;
    }

    const chosenItems = pendingItems.filter((item) => selectedItems[item.id]);
    if (chosenItems.length === 0) {
      showError('Select at least one material.');
      return;
    }

    setIsSubmitting(true);
    const itemsPayload = chosenItems.map((item) => ({
      boq_item_id: item.id,
      name: item.material_name,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const { request, error } = await createProcurementRequest({
      project_id: project.id,
      requested_by: user.id,
      supplier_id: selectedSupplier.id,
      supplier_name: selectedSupplier.name,
      supplier_email: selectedSupplier.email || null,
      supplier_phone: selectedSupplier.phone || null,
      status: 'requested',
      notes: notes || null,
      items: itemsPayload,
    });

    if (error) {
      showError('Failed to create procurement request');
      setIsSubmitting(false);
      return;
    }

    if (request) {
      setRequests((prev) => [request, ...prev]);
    }

    setNotes('');
    setSelectedItems({});
    setIsSubmitting(false);
    success('Request created');
  };

  const handleCreateSupplier = async () => {
    if (!user) {
      showError('Please sign in again to add a supplier.');
      return;
    }
    if (!newSupplier.name.trim()) {
      showError('Supplier name is required.');
      return;
    }

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
      if (error) {
        showError(error.message);
        setIsSupplierSaving(false);
        return;
      }
      if (supplier) {
        const mapped = mapDbSupplier(supplier);
        setSupplierList((prev) => prev.map((s) => (s.id === mapped.id ? mapped : s)));
        success('Supplier updated');
      }
      setEditingSupplierId(null);
    } else {
      const payload: SupplierInsert = {
        ...basePayload,
        rating: 0,
      };
      const { supplier, error } = await createSupplier(payload);
      if (error) {
        showError(error.message);
        setIsSupplierSaving(false);
        return;
      }

      if (supplier) {
        const mapped = mapDbSupplier(supplier);
        setSupplierList((prev) => [mapped, ...prev]);
        setSelectedSupplierId(mapped.id);
        success('Supplier added');
      }
    }

    setNewSupplier({
      name: '',
      location: '',
      contact_phone: '',
      contact_email: '',
      website: '',
      is_trusted: false,
    });
    setIsSupplierSaving(false);
  };

  const handleEditSupplier = (supplier: SupplierOption) => {
    if (supplier.source !== 'db') {
      showError('Built-in suppliers can’t be edited yet.');
      return;
    }
    setEditingSupplierId(supplier.id);
    setNewSupplier({
      name: supplier.name,
      location: supplier.location || '',
      contact_phone: supplier.phone || '',
      contact_email: supplier.email || '',
      website: supplier.website || '',
      is_trusted: supplier.isTrusted,
    });
  };

  const handleCancelEdit = () => {
    setEditingSupplierId(null);
    setNewSupplier({
      name: '',
      location: '',
      contact_phone: '',
      contact_email: '',
      website: '',
      is_trusted: false,
    });
  };

  const handleDeleteSupplier = async (supplier: SupplierOption) => {
    if (supplier.source !== 'db') {
      showError('Built-in suppliers can’t be deleted yet.');
      return;
    }
    const confirmed = window.confirm(`Delete ${supplier.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    const { error } = await deleteSupplier(supplier.id);
    if (error) {
      showError(error.message);
      return;
    }
    setSupplierList((prev) => prev.filter((s) => s.id !== supplier.id));
    if (selectedSupplierId === supplier.id) {
      setSelectedSupplierId('');
    }
    success('Supplier deleted');
  };

  const handleStatusChange = async (requestId: string, status: ProcurementStatus) => {
    const { request, error } = await updateProcurementRequest(requestId, { status });
    if (error) {
      showError('Failed to update status');
      return;
    }
    if (request) {
      setRequests((prev) => prev.map((r) => (r.id === requestId ? request : r)));
    }
  };

  return (
    <div className="procurement-page">
      <div className="procurement-header">
        <div>
          <h2>Procurement Hub</h2>
          <p>Request quotes and track supplier responses.</p>
        </div>
      </div>

      <div className="procurement-builder">
        <div className="builder-header">
          <ClipboardText size={18} />
          <div>
            <h3>Create RFQ</h3>
            <p>Select materials and send a request to a supplier.</p>
          </div>
        </div>

        <div className="builder-form">
          <div className="form-group">
            <label>Supplier</label>
            <div className="select-wrapper">
              <select value={effectiveSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                {dropdownSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}{supplier.location ? ` (${supplier.location})` : ''}
                  </option>
                ))}
              </select>
              <CaretDown size={14} />
            </div>
            {selectedSupplier && (
              <div className="supplier-meta">
                <span>{selectedSupplier.phone || 'No phone listed'}</span>
                <span>{selectedSupplier.email || 'No email listed'}</span>
                {selectedSupplier.website ? (
                  <a href={selectedSupplier.website} target="_blank" rel="noreferrer">
                    {selectedSupplier.website}
                  </a>
                ) : (
                  <span>No website listed</span>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Materials</label>
            <div className="items-grid">
              {pendingItems.length === 0 && (
                <div className="empty">All materials are purchased.</div>
              )}
              {pendingItems.map((item) => (
                <label key={item.id} className={`item-option ${selectedItems[item.id] ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItems[item.id])}
                    onChange={() => toggleItem(item.id)}
                  />
                  <span>{item.material_name}</span>
                  <small>{item.quantity} {item.unit}</small>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery location, preferred dates, or additional requirements."
            />
          </div>

          <Button onClick={handleCreateRequest} loading={isSubmitting} icon={<Truck size={16} />}>
            Create Request
          </Button>
        </div>
      </div>

      <div className="procurement-builder supplier-hub">
        <div className="builder-header">
          <Storefront size={18} />
          <div>
            <h3>Supplier Hub</h3>
            <p>Add trusted suppliers and link their website for procurement.</p>
          </div>
        </div>

        <div className="builder-form">
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name</label>
              <input
                type="text"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. PPC Zimbabwe"
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={newSupplier.location}
                onChange={(e) => setNewSupplier((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. Harare"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={newSupplier.contact_phone}
                onChange={(e) => setNewSupplier((prev) => ({ ...prev, contact_phone: e.target.value }))}
                placeholder="+263..."
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={newSupplier.contact_email}
                onChange={(e) => setNewSupplier((prev) => ({ ...prev, contact_email: e.target.value }))}
                placeholder="sales@example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              value={newSupplier.website}
              onChange={(e) => setNewSupplier((prev) => ({ ...prev, website: e.target.value }))}
              placeholder="https://supplier.co.zw"
            />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={newSupplier.is_trusted}
              onChange={(e) => setNewSupplier((prev) => ({ ...prev, is_trusted: e.target.checked }))}
            />
            Mark as trusted supplier
          </label>

          <Button onClick={handleCreateSupplier} loading={isSupplierSaving} icon={<Storefront size={16} />}>
            {editingSupplierId ? 'Save Supplier' : 'Add Supplier'}
          </Button>
          {editingSupplierId && (
            <Button variant="secondary" onClick={handleCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="procurement-list">
        <h3>Requests</h3>
        {requests.length === 0 ? (
          <div className="empty">No procurement requests yet.</div>
        ) : (
          <div className="request-list">
            {requests.map((request) => (
              <div key={request.id} className="request-card">
                <div>
                  <h4>{request.supplier_name}</h4>
                  <p>{Array.isArray(request.items) ? request.items.length : 0} items</p>
                </div>
                <div className="status">
                  <select
                    value={request.status}
                    onChange={(e) => handleStatusChange(request.id, e.target.value as ProcurementStatus)}
                  >
                    <option value="draft">Draft</option>
                    <option value="requested">Requested</option>
                    <option value="received">Received</option>
                    <option value="approved">Approved</option>
                    <option value="ordered">Ordered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className="date">{new Date(request.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="procurement-list supplier-list">
        <h3>Manage Suppliers</h3>
        <div className="supplier-toolbar">
          <input
            type="text"
            placeholder="Search suppliers"
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={trustedOnly}
              onChange={(e) => setTrustedOnly(e.target.checked)}
            />
            Trusted only
          </label>
        </div>
        {filteredSuppliers.length === 0 ? (
          <div className="empty">No suppliers yet.</div>
        ) : (
          <div className="request-list">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="request-card">
                <div>
                  <h4>{supplier.name}</h4>
                  <p>
                    {supplier.location || 'No location'}
                    {supplier.source === 'static' ? ' · Built-in' : ''}
                  </p>
                </div>
                <div className="status">
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
        )}
      </div>

      <style jsx>{`
        .procurement-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .procurement-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }

        .procurement-header h2 {
          margin: 0;
          font-size: 1.75rem;
          color: #0f172a;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .procurement-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 1rem;
        }

        .procurement-builder,
        .procurement-list {
          background: #ffffff;
          border: 1px solid rgba(226, 232, 240, 0.6);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
          transition: transform 0.2s;
        }

        .builder-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }
        
        .builder-header svg {
            color: #3b82f6;
            padding: 10px;
            background: #eff6ff;
            border-radius: 12px;
            width: 44px;
            height: 44px;
        }

        .builder-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #0f172a;
          font-weight: 700;
        }

        .builder-header p {
          margin: 4px 0 0;
          font-size: 0.9rem;
          color: #64748b;
        }

        .builder-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .supplier-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          margin: 16px 0 24px;
        }

        .supplier-toolbar input {
          flex: 1;
          min-width: 240px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .supplier-toolbar input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-group label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          font-weight: 700;
        }

        .form-group input,
        .form-group textarea {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.95rem;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s;
          background: #ffffff;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          transition: border-color 0.2s;
        }
        
        .select-wrapper:focus-within {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .select-wrapper select {
          border: none;
          outline: none;
          flex: 1;
          padding: 10px 14px;
          background: transparent;
          font-size: 0.95rem;
          color: #0f172a;
          appearance: none;
          cursor: pointer;
        }
        
        .select-wrapper svg {
            margin-right: 14px;
            pointer-events: none;
            color: #64748b;
        }

        .supplier-meta {
          display: flex;
          gap: 16px;
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 8px;
          flex-wrap: wrap;
          padding: 0 4px;
        }

        .supplier-meta span, .supplier-meta a {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .supplier-meta a {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
        }

        .supplier-meta a:hover {
          text-decoration: underline;
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
          margin-top: 4px;
        }

        .item-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: #f8fafc;
        }
        
        .item-option:hover {
            border-color: #cbd5e1;
            background: #ffffff;
        }

        .item-option.selected {
          border-color: #3b82f6;
          background: #eff6ff;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.05);
        }
        
        .item-option span {
            flex: 1;
            font-weight: 500;
            color: #0f172a;
            font-size: 0.9rem;
        }

        .item-option small {
          color: #64748b;
          font-size: 0.8rem;
          background: #ffffff;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
        }

        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: #475569;
          font-weight: 500;
          cursor: pointer;
        }

        .request-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }

        .request-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 16px 20px;
          background: #ffffff;
          transition: all 0.2s;
        }
        
        .request-card:hover {
            border-color: #e2e8f0;
            background: #f8fafc;
        }

        .request-card h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
        }

        .request-card p {
          margin: 4px 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status select {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.85rem;
          color: #334155;
          outline: none;
          cursor: pointer;
          background: #ffffff;
        }
        
        .status select:focus {
            border-color: #3b82f6;
        }

        .date {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .empty {
          font-size: 0.9rem;
          color: #94a3b8;
          padding: 32px;
          text-align: center;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px dashed #e2e8f0;
        }
        
        .procurement-list h3 {
            margin: 0 0 16px;
            font-size: 1.1rem;
            color: #0f172a;
        }
      `}</style>
    </div>
  );
}
