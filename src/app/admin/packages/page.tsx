'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getAllPackages, upsertPackage } from '@/lib/services/admin-analytics';
import type { ProductPackage, ProductPackageItem } from '@/lib/database.types';
import {
  ArrowLeft,
  Package,
  Plus,
  Trash,
  PencilSimple,
  X,
  CheckCircle,
} from '@phosphor-icons/react';

const EMPTY_ITEM: ProductPackageItem = {
  material_key: '',
  material_name: '',
  quantity: 1,
  unit: 'bag',
  unit_price_usd: 0,
};

export default function AdminPackagesPage() {
  const { adminId, checking } = useAdminAuth();
  const [packages, setPackages] = useState<ProductPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPkg, setEditPkg] = useState<ProductPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [items, setItems] = useState<ProductPackageItem[]>([{ ...EMPTY_ITEM }]);
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getAllPackages();
    setPackages(data as ProductPackage[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!adminId) return;
    void Promise.resolve().then(load);
  }, [adminId]);

  const openCreate = () => {
    setEditPkg(null);
    setName('');
    setDescription('');
    setDiscountPct(0);
    setItems([{ ...EMPTY_ITEM }]);
    setIsActive(true);
    setShowForm(true);
  };

  const openEdit = (pkg: ProductPackage) => {
    setEditPkg(pkg);
    setName(pkg.name);
    setDescription(pkg.description ?? '');
    setDiscountPct(pkg.discount_pct);
    setItems(pkg.items.length > 0 ? pkg.items : [{ ...EMPTY_ITEM }]);
    setIsActive(pkg.is_active);
    setShowForm(true);
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ProductPackageItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const totalUsd = items.reduce((sum, i) => sum + i.quantity * i.unit_price_usd, 0);
  const discountedTotal = totalUsd * (1 - discountPct / 100);

  const handleSave = async () => {
    if (!adminId || !name.trim()) return;
    setSaving(true);
    await upsertPackage(adminId, {
      id: editPkg?.id,
      name: name.trim(),
      description: description || undefined,
      items,
      discount_pct: discountPct,
      total_usd: discountedTotal,
      is_active: isActive,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setShowForm(false);
    load();
  };

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>Product Packages</h1>
        <p className="header-sub">Create combo bundles for suppliers and builders</p>
      </div>

      <div className="top-action">
        <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
          New Package
        </Button>
      </div>

      {showForm && (
        <Card className="form-card">
          <CardHeader>
            <CardTitle>{editPkg ? 'Edit Package' : 'New Package'}</CardTitle>
            <button className="close-btn" onClick={() => setShowForm(false)} aria-label="Close form"><X size={18} /></button>
          </CardHeader>
          <CardContent>
            <div className="form-grid">
              <div className="form-field">
                <label>Package Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="e.g. Foundation Starter Pack" />
              </div>
              <div className="form-field">
                <label>Discount %</label>
                <input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} className="form-input" />
              </div>
              <div className="form-field full-width">
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="form-textarea" placeholder="Optional description..." rows={2} />
              </div>
            </div>

            <div className="items-section">
              <div className="items-header">
                <h4>Package Items</h4>
                <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addItem}>Add Item</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="item-row">
                  <input value={item.material_name} onChange={(e) => updateItem(idx, 'material_name', e.target.value)} className="item-input flex-2" placeholder="Material name" />
                  <input value={item.material_key} onChange={(e) => updateItem(idx, 'material_key', e.target.value)} className="item-input flex-1" placeholder="material_key" />
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className="item-input w80" min={1} />
                  <input value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="item-input w70" placeholder="unit" />
                  <input type="number" value={item.unit_price_usd} onChange={(e) => updateItem(idx, 'unit_price_usd', Number(e.target.value))} className="item-input w90" min={0} step={0.01} placeholder="$/unit" />
                  <button className="remove-btn" onClick={() => removeItem(idx)} aria-label="Remove item"><Trash size={14} /></button>
                </div>
              ))}
            </div>

            <div className="form-summary">
              <div>Subtotal: <strong>${totalUsd.toFixed(2)}</strong></div>
              <div>After {discountPct}% discount: <strong>${discountedTotal.toFixed(2)}</strong></div>
            </div>

            <div className="form-active">
              <label className="toggle-label">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active (visible to users)
              </label>
            </div>

            <div className="form-actions">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={handleSave} icon={saved ? <CheckCircle size={16} /> : undefined}>
                {saved ? 'Saved!' : 'Save Package'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="table-loading">Loading packages...</div>
      ) : packages.length === 0 ? (
        <div className="empty-state">
          <Package size={40} />
          <p>No packages yet. Create your first combo package above.</p>
        </div>
      ) : (
        <div className="packages-grid">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={`pkg-card ${!pkg.is_active ? 'inactive' : ''}`}>
              <CardContent>
                <div className="pkg-header">
                  <div className="pkg-name">{pkg.name}</div>
                  <div className="pkg-badges">
                    {!pkg.is_active && <span className="inactive-badge">Inactive</span>}
                    {pkg.discount_pct > 0 && <span className="discount-badge">{pkg.discount_pct}% off</span>}
                  </div>
                </div>
                {pkg.description && <p className="pkg-desc">{pkg.description}</p>}
                <div className="pkg-items">
                  {pkg.items.slice(0, 4).map((item, i) => (
                    <span key={i} className="pkg-item-chip">{item.material_name} × {item.quantity}</span>
                  ))}
                  {pkg.items.length > 4 && <span className="pkg-item-chip muted">+{pkg.items.length - 4}</span>}
                </div>
                <div className="pkg-footer">
                  <span className="pkg-price">${Number(pkg.total_usd ?? 0).toFixed(2)}</span>
                  <Button size="sm" variant="ghost" icon={<PencilSimple size={14} />} onClick={() => openEdit(pkg)}>Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <style jsx>{`
        .admin-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 24px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .header-sub { font-size: 14px; color: #94a3b8; margin: 0; }
        .top-action { margin-bottom: 20px; }
        .close-btn { background: none; border: none; cursor: pointer; color: #94a3b8; }
        .close-btn:hover { color: #475569; }
        .form-card { margin-bottom: 24px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .form-field label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .form-input { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .form-input:focus { outline: none; border-color: #1e40af; }
        .form-textarea { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; resize: vertical; font-family: inherit; }
        .full-width { grid-column: 1 / -1; }
        .items-section { margin-bottom: 16px; }
        .items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        h4 { font-size: 14px; font-weight: 600; color: #334155; margin: 0; }
        .item-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .item-input { padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
        .item-input:focus { outline: none; border-color: #1e40af; }
        .flex-2 { flex: 2; }
        .flex-1 { flex: 1; }
        .w80 { width: 80px; }
        .w70 { width: 70px; }
        .w90 { width: 90px; }
        .remove-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 6px; flex-shrink: 0; }
        .remove-btn:hover { color: #dc2626; }
        .form-summary { padding: 12px 0; font-size: 14px; color: #475569; display: flex; gap: 20px; border-top: 1px solid #f1f5f9; margin-bottom: 12px; }
        .form-active { margin-bottom: 16px; }
        .toggle-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #334155; cursor: pointer; }
        .form-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .table-loading { text-align: center; padding: 40px; color: #94a3b8; }
        .empty-state { text-align: center; padding: 60px; color: #94a3b8; }
        .empty-state p { font-size: 15px; color: #64748b; margin-top: 12px; }
        .packages-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .pkg-card.inactive { opacity: 0.6; }
        .pkg-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .pkg-name { font-size: 16px; font-weight: 700; color: #1e293b; }
        .pkg-badges { display: flex; gap: 6px; }
        .inactive-badge { padding: 2px 8px; background: #f1f5f9; border-radius: 6px; font-size: 11px; color: #94a3b8; }
        .discount-badge { padding: 2px 8px; background: #dcfce7; border-radius: 6px; font-size: 11px; font-weight: 600; color: #16a34a; }
        .pkg-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; }
        .pkg-items { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
        .pkg-item-chip { padding: 3px 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px; color: #475569; }
        .pkg-item-chip.muted { color: #94a3b8; }
        .pkg-footer { display: flex; justify-content: space-between; align-items: center; }
        .pkg-price { font-size: 18px; font-weight: 700; color: #1e293b; }
      `}</style>
    </div>
  );
}
