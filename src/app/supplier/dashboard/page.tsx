'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Storefront,
  Package,
  ChartLine,
  Gear,
  Plus,
  PencilSimple,
  Trash,
  Check,
  Warning,
  Clock,
  CurrencyDollar,
  MapPin,
  Phone,
  Envelope,
  Globe,
  ShieldCheck,
  Spinner,
  Eye,
  ArrowRight,
  CaretDown,
  CaretUp,
  ClipboardText,
  Key,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  getUserSupplierProfile,
  getSupplierProducts,
  deleteSupplierProduct,
  MATERIAL_CATEGORIES,
  listSupplierApiKeys,
  createSupplierApiKey,
  revokeSupplierApiKey,
} from '@/lib/services/suppliers';
import {
  getSupplierRfqInbox,
  markRfqRecipientViewed,
  submitSupplierQuote,
  type SupplierInboxRfq,
} from '@/lib/services/rfq';
import type { Supplier, SupplierApiKey, SupplierProduct } from '@/lib/database.types';

type TabKey = 'overview' | 'products' | 'quotes' | 'settings';

const STOCK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'In Stock', color: '#16a34a' },
  low_stock: { label: 'Low Stock', color: '#f59e0b' },
  out_of_stock: { label: 'Out of Stock', color: '#ef4444' },
  discontinued: { label: 'Discontinued', color: '#6b7280' },
};

export default function SupplierDashboardPage() {
  const router = useRouter();
  const { formatPrice, exchangeRate } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [rfqInbox, setRfqInbox] = useState<SupplierInboxRfq[]>([]);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqForms, setRfqForms] = useState<Record<string, {
    deliveryDays: string;
    validUntil: string;
    notes: string;
    items: Record<string, { unitPriceUsd: string; availableQuantity: string }>;
  }>>({});
  const [apiKeys, setApiKeys] = useState<SupplierApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyLabel, setApiKeyLabel] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeyProcessing, setApiKeyProcessing] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login?redirect=/supplier/dashboard');
        return;
      }

      const supplierProfile = await getUserSupplierProfile(user.id);

      if (!supplierProfile) {
        // No supplier profile - redirect to registration
        router.push('/supplier/register');
        return;
      }

      setSupplier(supplierProfile);

      // Load products
      const supplierProducts = await getSupplierProducts(supplierProfile.id);
      setProducts(supplierProducts);

      // Load API keys
      setApiKeysLoading(true);
      const keys = await listSupplierApiKeys(supplierProfile.id);
      setApiKeys(keys);
      setApiKeysLoading(false);

      // Load RFQ inbox
      setRfqLoading(true);
      const { rfqs, error: rfqError } = await getSupplierRfqInbox(supplierProfile.id);
      if (!rfqError) {
        setRfqInbox(rfqs);
      }
      setRfqLoading(false);

      setLoading(false);
    }

    loadData();
  }, [router]);

  useEffect(() => {
    if (rfqInbox.length === 0) return;

    setRfqForms((prev) => {
      const next = { ...prev };
      rfqInbox.forEach((rfq) => {
        if (next[rfq.id]) return;
        const items: Record<string, { unitPriceUsd: string; availableQuantity: string }> = {};
        rfq.rfq_items.forEach((item) => {
          const existingItem = rfq.supplier_quote?.rfq_quote_items?.find((quoteItem) => quoteItem.rfq_item_id === item.id);
          items[item.id] = {
            unitPriceUsd: existingItem?.unit_price_usd ? String(existingItem.unit_price_usd) : '',
            availableQuantity: existingItem?.available_quantity ? String(existingItem.available_quantity) : String(item.quantity),
          };
        });
        next[rfq.id] = {
          deliveryDays: rfq.supplier_quote?.delivery_days ? String(rfq.supplier_quote.delivery_days) : '',
          validUntil: rfq.supplier_quote?.valid_until ? String(rfq.supplier_quote.valid_until) : '',
          notes: rfq.supplier_quote?.notes || '',
          items,
        };
      });
      return next;
    });

    rfqInbox.forEach((rfq) => {
      if (rfq.recipient.status === 'notified') {
        markRfqRecipientViewed(rfq.recipient.id);
      }
    });
  }, [rfqInbox]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const result = await deleteSupplierProduct(productId);
    if (result.success) {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  const refreshApiKeys = async (supplierId: string) => {
    setApiKeysLoading(true);
    const keys = await listSupplierApiKeys(supplierId);
    setApiKeys(keys);
    setApiKeysLoading(false);
  };

  const handleCreateApiKey = async () => {
    if (!supplier) return;
    setApiKeyProcessing(true);
    setApiKeyError(null);
    setNewApiKey(null);

    const result = await createSupplierApiKey({
      supplierId: supplier.id,
      label: apiKeyLabel.trim() || undefined,
    });

    if (!result.success || !result.key || !result.apiKey) {
      setApiKeyError(result.error || 'Unable to create API key.');
      setApiKeyProcessing(false);
      return;
    }

    setApiKeyLabel('');
    setNewApiKey(result.apiKey);
    setApiKeys((prev) => [result.key as SupplierApiKey, ...prev]);
    setApiKeyProcessing(false);
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!supplier) return;
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    setApiKeyProcessing(true);
    setApiKeyError(null);

    const result = await revokeSupplierApiKey(keyId);
    if (!result.success) {
      setApiKeyError(result.error || 'Unable to revoke API key.');
      setApiKeyProcessing(false);
      return;
    }

    await refreshApiKeys(supplier.id);
    setApiKeyProcessing(false);
  };

  const handleCopyApiKey = async () => {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
    } catch {
      // ignore clipboard errors
    }
  };

  const updateRfqField = (rfqId: string, field: 'deliveryDays' | 'validUntil' | 'notes', value: string) => {
    setRfqForms((prev) => ({
      ...prev,
      [rfqId]: {
        deliveryDays: prev[rfqId]?.deliveryDays || '',
        validUntil: prev[rfqId]?.validUntil || '',
        notes: prev[rfqId]?.notes || '',
        items: prev[rfqId]?.items || {},
        [field]: value,
      },
    }));
  };

  const updateRfqItemField = (
    rfqId: string,
    itemId: string,
    field: 'unitPriceUsd' | 'availableQuantity',
    value: string
  ) => {
    setRfqForms((prev) => ({
      ...prev,
      [rfqId]: {
        deliveryDays: prev[rfqId]?.deliveryDays || '',
        validUntil: prev[rfqId]?.validUntil || '',
        notes: prev[rfqId]?.notes || '',
        items: {
          ...(prev[rfqId]?.items || {}),
          [itemId]: {
            unitPriceUsd: prev[rfqId]?.items?.[itemId]?.unitPriceUsd || '',
            availableQuantity: prev[rfqId]?.items?.[itemId]?.availableQuantity || '',
            [field]: value,
          },
        },
      },
    }));
  };

  const handleSubmitQuote = async (rfq: SupplierInboxRfq) => {
    if (!supplier) return;
    const form = rfqForms[rfq.id];
    if (!form) return;

    const items = rfq.rfq_items.map((item) => {
      const entry = form.items[item.id];
      const unitPriceUsd = Number(entry?.unitPriceUsd || 0);
      const availableQuantity = Number(entry?.availableQuantity || 0);
      return {
        rfq_item_id: item.id,
        unit_price_usd: unitPriceUsd,
        unit_price_zwg: unitPriceUsd * exchangeRate,
        available_quantity: availableQuantity,
        notes: null,
      };
    });

    const invalid = items.some((item) => item.unit_price_usd <= 0 || item.available_quantity <= 0);
    if (invalid) {
      alert('Enter valid prices and quantities for all items.');
      return;
    }

    const { error } = await submitSupplierQuote({
      rfqId: rfq.id,
      supplierId: supplier.id,
      deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : null,
      validUntil: form.validUntil || null,
      notes: form.notes || null,
      items,
    });

    if (error) {
      alert(error.message || 'Failed to submit quote.');
      return;
    }

    const { rfqs } = await getSupplierRfqInbox(supplier.id);
    setRfqInbox(rfqs);
  };

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    // Extract category from material_key (e.g., "cement_50kg" -> "Cement & Concrete")
    const materialKey = product.material_key;
    let category = 'Other';

    // Simple category detection from material_key
    if (materialKey.includes('cement') || materialKey.includes('concrete')) {
      category = 'Cement & Concrete';
    } else if (materialKey.includes('brick') || materialKey.includes('block')) {
      category = 'Bricks & Blocks';
    } else if (materialKey.includes('roof') || materialKey.includes('sheet')) {
      category = 'Roofing Materials';
    } else if (materialKey.includes('steel') || materialKey.includes('rebar')) {
      category = 'Steel & Metal';
    } else if (materialKey.includes('timber') || materialKey.includes('wood')) {
      category = 'Timber & Wood';
    } else if (materialKey.includes('pipe') || materialKey.includes('plumb')) {
      category = 'Plumbing Supplies';
    } else if (materialKey.includes('wire') || materialKey.includes('electric')) {
      category = 'Electrical Supplies';
    } else if (materialKey.includes('paint')) {
      category = 'Paint & Finishes';
    } else if (materialKey.includes('tile')) {
      category = 'Tiles & Flooring';
    } else if (materialKey.includes('sand') || materialKey.includes('aggregate') || materialKey.includes('stone')) {
      category = 'Aggregates & Sand';
    }

    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {} as Record<string, SupplierProduct[]>);

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

  if (!supplier) {
    return null;
  }

  const verificationBadge = {
    unverified: { label: 'Unverified', color: '#6b7280', icon: Clock },
    pending: { label: 'Pending Review', color: '#f59e0b', icon: Clock },
    verified: { label: 'Verified', color: '#16a34a', icon: ShieldCheck },
    trusted: { label: 'Trusted Supplier', color: '#3b82f6', icon: ShieldCheck },
    premium: { label: 'Premium Partner', color: '#7c3aed', icon: ShieldCheck },
  }[supplier.verification_status || 'unverified'];

  const VerificationIcon = verificationBadge.icon;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Storefront size={28} style={{ color: '#3b82f6' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{supplier.name}</h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: `${verificationBadge.color}15`,
                color: verificationBadge.color,
              }}>
                <VerificationIcon size={14} weight="bold" />
                {verificationBadge.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
              {supplier.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <MapPin size={16} />
                  {supplier.location}
                </span>
              )}
              {supplier.contact_phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Phone size={16} />
                  {supplier.contact_phone}
                </span>
              )}
            </div>
          </div>

          <Link
            href="/"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '0.875rem',
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '0.5rem',
          padding: '0 2rem',
        }}>
          {[
            { key: 'overview' as TabKey, label: 'Overview', icon: ChartLine },
            { key: 'products' as TabKey, label: 'Products', icon: Package },
            { key: 'quotes' as TabKey, label: 'RFQ Quotes', icon: ClipboardText },
            { key: 'settings' as TabKey, label: 'Settings', icon: Gear },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  color: isActive ? '#3b82f6' : '#64748b',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
      }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Total Products
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 600 }}>{products.length}</div>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  In Stock
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: '#16a34a' }}>
                  {products.filter(p => p.stock_status === 'in_stock').length}
                </div>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Low Stock
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f59e0b' }}>
                  {products.filter(p => p.stock_status === 'low_stock').length}
                </div>
              </div>

              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Delivery Radius
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 600 }}>
                  {supplier.delivery_radius_km || 50} km
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                Quick Actions
              </h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab('products')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <Plus size={18} weight="bold" />
                  Add Product
                </button>
                <Link
                  href="/supplier/analytics"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  <ChartLine size={18} weight="bold" />
                  View Analytics
                </Link>
                <button
                  onClick={() => setActiveTab('settings')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'white',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <PencilSimple size={18} />
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Categories */}
            {supplier.material_categories && supplier.material_categories.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                  Your Categories
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {supplier.material_categories.map(category => (
                    <span
                      key={category}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#eff6ff',
                        color: '#3b82f6',
                        borderRadius: '20px',
                        fontSize: '0.875rem',
                      }}
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Your Products ({products.length})
              </h2>
              <Link
                href={`/supplier/products/add`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <Plus size={18} weight="bold" />
                Add Product
              </Link>
            </div>

            {products.length === 0 ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <Package size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  No products yet
                </h3>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                  Add your first product to start appearing in search results.
                </p>
                <Link
                  href={`/supplier/products/add`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  <Plus size={18} weight="bold" />
                  Add Your First Product
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                  <div
                    key={category}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    <button
                      onClick={() => toggleCategory(category)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 1.5rem',
                        backgroundColor: '#f8fafc',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {category} ({categoryProducts.length})
                      </span>
                      {expandedCategories.has(category) ? (
                        <CaretUp size={20} style={{ color: '#64748b' }} />
                      ) : (
                        <CaretDown size={20} style={{ color: '#64748b' }} />
                      )}
                    </button>

                    {expandedCategories.has(category) && (
                      <div style={{ padding: '0.5rem' }}>
                        {categoryProducts.map(product => {
                          const statusInfo = STOCK_STATUS_LABELS[product.stock_status] || STOCK_STATUS_LABELS.in_stock;
                          return (
                            <div
                              key={product.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                borderBottom: '1px solid #f1f5f9',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                  {product.material_name || product.material_key}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                  {product.unit && `Per ${product.unit}`}
                                  {product.min_order_qty > 1 && ` · Min order: ${product.min_order_qty}`}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                  {product.price_usd && (
                                    <div style={{ fontWeight: 600 }}>
                                      ${product.price_usd.toFixed(2)}
                                    </div>
                                  )}
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '4px',
                                    backgroundColor: `${statusInfo.color}15`,
                                    color: statusInfo.color,
                                  }}>
                                    {statusInfo.label}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <Link
                                    href={`/supplier/products/edit/${product.id}`}
                                    style={{
                                      padding: '0.5rem',
                                      backgroundColor: '#f1f5f9',
                                      borderRadius: '6px',
                                      color: '#64748b',
                                    }}
                                  >
                                    <PencilSimple size={16} />
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    style={{
                                      padding: '0.5rem',
                                      backgroundColor: '#fef2f2',
                                      border: 'none',
                                      borderRadius: '6px',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RFQ Quotes Tab */}
        {activeTab === 'quotes' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                RFQ Quotes ({rfqInbox.length})
              </h2>
              <button
                onClick={async () => {
                  if (!supplier) return;
                  setRfqLoading(true);
                  const { rfqs } = await getSupplierRfqInbox(supplier.id);
                  setRfqInbox(rfqs);
                  setRfqLoading(false);
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Refresh
              </button>
            </div>

            {rfqLoading ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <Spinner size={24} className="animate-spin" style={{ color: '#3b82f6' }} />
              </div>
            ) : rfqInbox.length === 0 ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <ClipboardText size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  No RFQs yet
                </h3>
                <p style={{ color: '#64748b' }}>
                  Matched requests will appear here once builders send RFQs.
                </p>
              </div>
            ) : (
              rfqInbox.map((rfq) => {
                const form = rfqForms[rfq.id];
                const totals = rfq.rfq_items.reduce(
                  (acc, item) => {
                    const entry = form?.items[item.id];
                    const price = Number(entry?.unitPriceUsd || 0);
                    const qty = Number(entry?.availableQuantity || 0);
                    acc.usd += price * qty;
                    acc.zwg += price * qty * exchangeRate;
                    return acc;
                  },
                  { usd: 0, zwg: 0 }
                );
                const isLocked = ['accepted', 'cancelled', 'expired'].includes(rfq.status);

                return (
                  <div
                    key={rfq.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                          {rfq.project?.name || 'Project'} · RFQ #{rfq.id.slice(0, 8)}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          {rfq.project?.location || 'Location TBD'}
                          {rfq.required_by && ` · Needed by ${new Date(rfq.required_by).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        fontWeight: 600,
                      }}>
                        {rfq.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {rfq.rfq_items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr',
                            gap: '0.75rem',
                            alignItems: 'center',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            backgroundColor: '#f8fafc',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{item.material_name || item.material_key}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              Requested: {Number(item.quantity).toFixed(2)} {item.unit || ''}
                            </div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Unit price USD"
                            value={form?.items[item.id]?.unitPriceUsd || ''}
                            onChange={(e) => updateRfqItemField(rfq.id, item.id, 'unitPriceUsd', e.target.value)}
                            disabled={isLocked}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Available qty"
                            value={form?.items[item.id]?.availableQuantity || ''}
                            onChange={(e) => updateRfqItemField(rfq.id, item.id, 'availableQuantity', e.target.value)}
                            disabled={isLocked}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem',
                      marginTop: '1rem',
                    }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="Delivery days"
                        value={form?.deliveryDays || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'deliveryDays', e.target.value)}
                        disabled={isLocked}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <input
                        type="date"
                        value={form?.validUntil || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'validUntil', e.target.value)}
                        disabled={isLocked}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={form?.notes || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'notes', e.target.value)}
                        disabled={isLocked}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                      <div style={{ fontWeight: 600 }}>
                        Total: {formatPrice(totals.usd, totals.zwg)}
                      </div>
                      <button
                        onClick={() => handleSubmitQuote(rfq)}
                        disabled={isLocked}
                        style={{
                          padding: '0.75rem 1.25rem',
                          backgroundColor: isLocked ? '#e2e8f0' : '#3b82f6',
                          color: isLocked ? '#94a3b8' : 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {rfq.supplier_quote ? 'Update Quote' : 'Submit Quote'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              Business Profile
            </h2>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    Business Name
                  </label>
                  <div style={{ fontWeight: 500 }}>{supplier.name}</div>
                </div>

                {supplier.registration_number && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      Registration Number
                    </label>
                    <div style={{ fontWeight: 500 }}>{supplier.registration_number}</div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    Location
                  </label>
                  <div style={{ fontWeight: 500 }}>{supplier.location || 'Not set'}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    Physical Address
                  </label>
                  <div style={{ fontWeight: 500 }}>{supplier.physical_address || 'Not set'}</div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    <Phone size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    Phone
                  </label>
                  <div style={{ fontWeight: 500 }}>{supplier.contact_phone || 'Not set'}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    <Envelope size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    Email
                  </label>
                  <div style={{ fontWeight: 500 }}>{supplier.contact_email || 'Not set'}</div>
                </div>

                {supplier.website && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      <Globe size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      Website
                    </label>
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', fontWeight: 500 }}
                    >
                      {supplier.website}
                    </a>
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    Delivery Radius
                  </label>
                  <div style={{ fontWeight: 500 }}>{supplier.delivery_radius_km || 50} km</div>
                </div>

                {supplier.payment_terms && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      Payment Terms
                    </label>
                    <div style={{ fontWeight: 500 }}>{supplier.payment_terms}</div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Link
                  href="/supplier/profile/edit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  <PencilSimple size={18} />
                  Edit Profile
                </Link>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', marginTop: '2rem' }} />

              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Key size={18} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>API Keys</h3>
                </div>
                <p style={{ marginTop: 0, color: '#64748b' }}>
                  Generate API keys to integrate your catalog and availability with ZimEstimate.
                </p>

                <div style={{
                  display: 'grid',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  background: '#f8fafc',
                }}>
                  <label style={{ fontSize: '0.875rem', color: '#64748b' }}>Key Label (optional)</label>
                  <input
                    type="text"
                    value={apiKeyLabel}
                    onChange={(e) => setApiKeyLabel(e.target.value)}
                    placeholder="e.g. Inventory sync"
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={apiKeyProcessing || apiKeysLoading}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: apiKeyProcessing ? '#cbd5f5' : '#2563eb',
                      color: 'white',
                      fontWeight: 600,
                      cursor: apiKeyProcessing ? 'not-allowed' : 'pointer',
                      width: 'fit-content',
                    }}
                  >
                    {apiKeyProcessing ? 'Creating...' : 'Create API Key'}
                  </button>
                </div>

                {newApiKey && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid #bae6fd',
                    background: '#f0f9ff',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      New key created — copy it now. You won’t see it again.
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        readOnly
                        value={newApiKey}
                        style={{
                          flex: '1 1 260px',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        onClick={handleCopyApiKey}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #93c5fd',
                          background: '#ffffff',
                          color: '#1d4ed8',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <ClipboardText size={16} /> Copy
                      </button>
                    </div>
                  </div>
                )}

                {apiKeyError && (
                  <div style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{apiKeyError}</div>
                )}

                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Active Keys</h4>
                  {apiKeysLoading ? (
                    <div style={{ color: '#64748b' }}>Loading API keys...</div>
                  ) : apiKeys.length === 0 ? (
                    <div style={{ color: '#64748b' }}>No API keys created yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.5rem 0' }}>Label</th>
                            <th style={{ padding: '0.5rem 0' }}>Prefix</th>
                            <th style={{ padding: '0.5rem 0' }}>Created</th>
                            <th style={{ padding: '0.5rem 0' }}>Last Used</th>
                            <th style={{ padding: '0.5rem 0' }}>Status</th>
                            <th style={{ padding: '0.5rem 0' }} />
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map((key) => (
                            <tr key={key.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.75rem 0' }}>{key.label || '—'}</td>
                              <td style={{ padding: '0.75rem 0', fontFamily: 'monospace' }}>
                                {key.key_prefix}…
                              </td>
                              <td style={{ padding: '0.75rem 0' }}>{formatTimestamp(key.created_at)}</td>
                              <td style={{ padding: '0.75rem 0' }}>{formatTimestamp(key.last_used_at)}</td>
                              <td style={{ padding: '0.75rem 0' }}>
                                {key.revoked_at ? 'Revoked' : 'Active'}
                              </td>
                              <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                                {!key.revoked_at && (
                                  <button
                                    onClick={() => handleRevokeApiKey(key.id)}
                                    disabled={apiKeyProcessing}
                                    style={{
                                      padding: '0.4rem 0.75rem',
                                      borderRadius: '6px',
                                      border: '1px solid #fecaca',
                                      background: '#fef2f2',
                                      color: '#b91c1c',
                                      fontWeight: 600,
                                      cursor: apiKeyProcessing ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    Revoke
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
