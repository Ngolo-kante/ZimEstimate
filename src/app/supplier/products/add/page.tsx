'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  CurrencyDollar,
  Cube,
  Clock,
  Spinner,
  Check,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import {
  getUserSupplierProfile,
  upsertSupplierProduct,
} from '@/lib/services/suppliers';
import { materials, searchMaterials } from '@/lib/materials';
import type { Supplier, StockStatus } from '@/lib/database.types';

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'discontinued', label: 'Discontinued' },
];

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<{
    id: string;
    name: string;
    unit: string;
    category: string;
  } | null>(null);

  type MaterialItem = typeof filteredMaterials[number];
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    priceUsd: '',
    priceZwg: '',
    minOrderQty: '1',
    maxOrderQty: '',
    stockStatus: 'in_stock' as StockStatus,
    leadTimeDays: '1',
    notes: '',
  });

  // Filter materials based on search
  const filteredMaterials = searchTerm.length >= 2
    ? searchMaterials(searchTerm).slice(0, 20)
    : [];

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
      setLoading(false);
    }

    loadData();
  }, [router]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const selectMaterial = (material: MaterialItem) => {
    setSelectedMaterial({
      id: material.id,
      name: material.name,
      unit: material.unit,
      category: material.category,
    });
    setSearchTerm('');
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedMaterial) {
      newErrors.material = 'Please select a material';
    }
    if (!formData.priceUsd || parseFloat(formData.priceUsd) <= 0) {
      newErrors.priceUsd = 'Price must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!supplier || !selectedMaterial || !validate()) return;

    setSaving(true);

    const result = await upsertSupplierProduct(supplier.id, {
      material_key: selectedMaterial.id,
      material_name: selectedMaterial.name,
      unit: selectedMaterial.unit,
      price_usd: parseFloat(formData.priceUsd),
      price_zwg: formData.priceZwg ? parseFloat(formData.priceZwg) : null,
      min_order_qty: parseInt(formData.minOrderQty) || 1,
      max_order_qty: formData.maxOrderQty ? parseInt(formData.maxOrderQty) : null,
      stock_status: formData.stockStatus,
      lead_time_days: parseInt(formData.leadTimeDays) || 1,
      notes: formData.notes || null,
      is_active: true,
    });

    setSaving(false);

    if (result.success) {
      router.push('/supplier/dashboard');
    } else {
      setErrors({ save: result.error || 'Failed to add product' });
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Add Product</h1>
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Material Selection */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                <Package size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Material *
              </label>

              {selectedMaterial ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{selectedMaterial.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {selectedMaterial.category} · {selectedMaterial.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMaterial(null)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <MagnifyingGlass size={20} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '12px',
                    color: '#94a3b8',
                  }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search for a material..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: `1px solid ${errors.material ? '#ef4444' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      fontSize: '1rem',
                    }}
                  />

                  {filteredMaterials.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 10,
                    }}>
                      {filteredMaterials.map(material => (
                        <button
                          key={material.id}
                          onClick={() => selectMaterial(material)}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{material.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {material.category} · {material.unit}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errors.material && (
                <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{errors.material}</span>
              )}
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
                placeholder="Any additional information about this product..."
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

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
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
                  Adding...
                </>
              ) : (
                <>
                  <Check size={20} weight="bold" />
                  Add Product
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
