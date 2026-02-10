'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  CurrencyDollar,
  Cube,
  Clock,
  Spinner,
  Check,
  Trash,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import {
  getUserSupplierProfile,
  getSupplierProducts,
  upsertSupplierProduct,
  deleteSupplierProduct,
} from '@/lib/services/suppliers';
import type { Supplier, SupplierProduct, StockStatus } from '@/lib/database.types';

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'discontinued', label: 'Discontinued' },
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [product, setProduct] = useState<SupplierProduct | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    priceUsd: '',
    priceZwg: '',
    minOrderQty: '1',
    maxOrderQty: '',
    stockStatus: 'in_stock' as StockStatus,
    leadTimeDays: '1',
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const supplierProfile = await getUserSupplierProfile(user.id);

      if (!supplierProfile) {
        router.push('/supplier/register');
        return;
      }

      setSupplier(supplierProfile);

      // Load the product
      const products = await getSupplierProducts(supplierProfile.id);
      const foundProduct = products.find(p => p.id === productId);

      if (!foundProduct) {
        router.push('/supplier/dashboard');
        return;
      }

      setProduct(foundProduct);
      setFormData({
        priceUsd: foundProduct.price_usd?.toString() || '',
        priceZwg: foundProduct.price_zwg?.toString() || '',
        minOrderQty: foundProduct.min_order_qty?.toString() || '1',
        maxOrderQty: foundProduct.max_order_qty?.toString() || '',
        stockStatus: foundProduct.stock_status,
        leadTimeDays: foundProduct.lead_time_days?.toString() || '1',
        notes: foundProduct.notes || '',
        isActive: foundProduct.is_active,
      });

      setLoading(false);
    }

    loadData();
  }, [router, productId]);

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.priceUsd || parseFloat(formData.priceUsd) <= 0) {
      newErrors.priceUsd = 'Price must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!supplier || !product || !validate()) return;

    setSaving(true);

    const result = await upsertSupplierProduct(supplier.id, {
      material_key: product.material_key,
      material_name: product.material_name,
      unit: product.unit,
      price_usd: parseFloat(formData.priceUsd),
      price_zwg: formData.priceZwg ? parseFloat(formData.priceZwg) : null,
      min_order_qty: parseInt(formData.minOrderQty) || 1,
      max_order_qty: formData.maxOrderQty ? parseInt(formData.maxOrderQty) : null,
      stock_status: formData.stockStatus,
      lead_time_days: parseInt(formData.leadTimeDays) || 1,
      notes: formData.notes || null,
      is_active: formData.isActive,
    });

    setSaving(false);

    if (result.success) {
      router.push('/supplier/dashboard');
    } else {
      setErrors({ save: result.error || 'Failed to save changes' });
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

    setDeleting(true);

    const result = await deleteSupplierProduct(product.id);

    setDeleting(false);

    if (result.success) {
      router.push('/supplier/dashboard');
    } else {
      setErrors({ save: result.error || 'Failed to delete product' });
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
      }}>
        <Spinner size={32} className="animate-spin" style={{ color: '#3b82f6' }} />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Link
            href="/supplier/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748b',
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Edit Product</h1>
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Product Info (Read-only) */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Package size={20} style={{ color: '#3b82f6' }} />
                <span style={{ fontWeight: 600 }}>{product.material_name || product.material_key}</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {product.unit && `Unit: ${product.unit}`}
              </div>
            </div>

            {/* Active Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              backgroundColor: formData.isActive ? '#f0fdf4' : '#fef2f2',
              borderRadius: '8px',
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>Product Active</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {formData.isActive ? 'Visible to buyers' : 'Hidden from buyers'}
                </div>
              </div>
              <button
                onClick={() => updateField('isActive', !formData.isActive)}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: formData.isActive ? '#16a34a' : '#d1d5db',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  left: formData.isActive ? '22px' : '2px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Pricing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Price (USD) *
                </label>
                <div style={{ position: 'relative' }}>
                  <CurrencyDollar size={20} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.priceUsd}
                    onChange={e => updateField('priceUsd', e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: `1px solid ${errors.priceUsd ? '#ef4444' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '1rem',
                    }}
                  />
                </div>
                {errors.priceUsd && (
                  <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.priceUsd}</span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Price (ZWG)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.priceZwg}
                  onChange={e => updateField('priceZwg', e.target.value)}
                  placeholder="Optional"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            {/* Order Quantities */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  <Cube size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Min Order Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.minOrderQty}
                  onChange={e => updateField('minOrderQty', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Max Order Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxOrderQty}
                  onChange={e => updateField('maxOrderQty', e.target.value)}
                  placeholder="No limit"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            {/* Stock Status & Lead Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Stock Status
                </label>
                <select
                  value={formData.stockStatus}
                  onChange={e => updateField('stockStatus', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                  }}
                >
                  {STOCK_STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  <Clock size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.leadTimeDays}
                  onChange={e => updateField('leadTimeDays', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={e => updateField('notes', e.target.value)}
                placeholder="Any additional information..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Error Message */}
            {errors.save && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                color: '#991b1b',
                fontSize: '0.875rem',
              }}>
                {errors.save}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  backgroundColor: saving ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? (
                  <>
                    <Spinner size={20} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={20} weight="bold" />
                    Save Changes
                  </>
                )}
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  backgroundColor: deleting ? '#94a3b8' : '#fef2f2',
                  color: deleting ? 'white' : '#ef4444',
                  border: deleting ? 'none' : '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? (
                  <Spinner size={20} className="animate-spin" />
                ) : (
                  <Trash size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
