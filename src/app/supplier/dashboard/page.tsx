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
import { useReveal } from '@/hooks/useReveal';
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
  in_stock: { label: 'In Stock', color: 'var(--color-emerald)' },
  low_stock: { label: 'Low Stock', color: 'var(--color-amber)' },
  out_of_stock: { label: 'Out of Stock', color: 'var(--color-danger)' },
  discontinued: { label: 'Discontinued', color: 'var(--color-text-muted)' },
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

  useReveal({ deps: [activeTab, products.length, rfqInbox.length, apiKeys.length, loading, rfqLoading] });

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
      <div className="supplier-loading">
        <Spinner size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  if (!supplier) {
    return null;
  }

  const verificationBadge = {
    unverified: { label: 'Unverified', color: 'var(--color-text-muted)', icon: Clock },
    pending: { label: 'Pending Review', color: 'var(--color-amber)', icon: Clock },
    verified: { label: 'Verified', color: 'var(--color-emerald)', icon: ShieldCheck },
    trusted: { label: 'Trusted Supplier', color: 'var(--color-accent)', icon: ShieldCheck },
    premium: { label: 'Premium Partner', color: 'var(--color-clay)', icon: ShieldCheck },
  }[supplier.verification_status || 'unverified'];

  const VerificationIcon = verificationBadge.icon;

  return (
    <div className="supplier-dashboard">
      {/* Header */}
      <div className="supplier-header reveal" data-delay="1">
        <div className="supplier-header-inner">
          <div>
            <div className="supplier-title">
              <Storefront size={28} style={{ color: 'var(--color-accent)' }} />
              <h1>{supplier.name}</h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: `${verificationBadge.color}15`,
                color: verificationBadge.color,
              }}>
                <VerificationIcon size={14} weight="bold" />
                {verificationBadge.label}
              </span>
            </div>
            <div className="supplier-meta">
              {supplier.location && (
                <span className="supplier-meta-item">
                  <MapPin size={16} />
                  {supplier.location}
                </span>
              )}
              {supplier.contact_phone && (
                <span className="supplier-meta-item">
                  <Phone size={16} />
                  {supplier.contact_phone}
                </span>
              )}
            </div>
          </div>

          <Link
            href="/"
            className="supplier-back-link"
          >
            Back to Home
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="supplier-tabs">
        <div className="supplier-tabs-inner">
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
                className={`supplier-tab ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="supplier-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-grid">
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card reveal" data-delay="1">
                <div className="stat-label">Total Products</div>
                <div className="stat-value">{products.length}</div>
              </div>

              <div className="stat-card reveal" data-delay="2">
                <div className="stat-label">In Stock</div>
                <div className="stat-value stat-value--success">
                  {products.filter(p => p.stock_status === 'in_stock').length}
                </div>
              </div>

              <div className="stat-card reveal" data-delay="3">
                <div className="stat-label">Low Stock</div>
                <div className="stat-value stat-value--warning">
                  {products.filter(p => p.stock_status === 'low_stock').length}
                </div>
              </div>

              <div className="stat-card reveal" data-delay="4">
                <div className="stat-label">Delivery Radius</div>
                <div className="stat-value">
                  {supplier.delivery_radius_km || 50} km
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="panel-card reveal" data-delay="2">
              <h2>Quick Actions</h2>
              <div className="action-row">
                <button
                  onClick={() => setActiveTab('products')}
                  className="action-btn action-btn--primary"
                >
                  <Plus size={18} weight="bold" />
                  Add Product
                </button>
                <Link
                  href="/supplier/analytics"
                  className="action-btn action-btn--secondary"
                >
                  <ChartLine size={18} weight="bold" />
                  View Analytics
                </Link>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="action-btn action-btn--ghost"
                >
                  <PencilSimple size={18} />
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Categories */}
            {supplier.material_categories && supplier.material_categories.length > 0 && (
              <div className="panel-card reveal" data-delay="3">
                <h2>Your Categories</h2>
                <div className="pill-row">
                  {supplier.material_categories.map(category => (
                    <span
                      key={category}
                      className="category-pill"
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
            <div className="section-header reveal" data-delay="1">
              <h2 className="section-title">
                Your Products ({products.length})
              </h2>
              <Link
                href={`/supplier/products/add`}
                className="action-btn action-btn--primary"
              >
                <Plus size={18} weight="bold" />
                Add Product
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="empty-state reveal">
                <Package size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
                <h3>No products yet</h3>
                <p>
                  Add your first product to start appearing in search results.
                </p>
                <Link
                  href={`/supplier/products/add`}
                  className="action-btn action-btn--primary"
                >
                  <Plus size={18} weight="bold" />
                  Add Your First Product
                </Link>
              </div>
            ) : (
              <div className="category-stack">
                {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                  <div
                    key={category}
                    className="category-card reveal"
                  >
                    <button
                      onClick={() => toggleCategory(category)}
                      className="category-toggle"
                    >
                      <span className="category-title">
                        {category} ({categoryProducts.length})
                      </span>
                      {expandedCategories.has(category) ? (
                        <CaretUp size={20} style={{ color: 'var(--color-text-secondary)' }} />
                      ) : (
                        <CaretDown size={20} style={{ color: 'var(--color-text-secondary)' }} />
                      )}
                    </button>

                    {expandedCategories.has(category) && (
                      <div className="category-body">
                        {categoryProducts.map(product => {
                          const statusInfo = STOCK_STATUS_LABELS[product.stock_status] || STOCK_STATUS_LABELS.in_stock;
                          return (
                            <div
                              key={product.id}
                              className="product-row"
                            >
                              <div>
                                <div className="product-title">
                                  {product.material_name || product.material_key}
                                </div>
                                <div className="product-meta">
                                  {product.unit && `Per ${product.unit}`}
                                  {product.min_order_qty > 1 && ` · Min order: ${product.min_order_qty}`}
                                </div>
                              </div>

                              <div className="product-actions">
                                <div className="product-price">
                                  {product.price_usd && (
                                    <div className="product-price-value">
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

                                <div className="icon-button-row">
                                  <Link
                                    href={`/supplier/products/edit/${product.id}`}
                                    className="icon-button"
                                  >
                                    <PencilSimple size={16} />
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="icon-button icon-button--danger"
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
          <div className="quotes-grid">
            <div className="section-header reveal" data-delay="1">
              <h2 className="section-title">
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
                className="action-btn action-btn--ghost"
              >
                Refresh
              </button>
            </div>

            {rfqLoading ? (
              <div className="panel-card reveal">
                <Spinner size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              </div>
            ) : rfqInbox.length === 0 ? (
              <div className="empty-state reveal">
                <ClipboardText size={48} style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }} />
                <h3>No RFQs yet</h3>
                <p>
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
                    className="rfq-card reveal"
                  >
                    <div className="rfq-header">
                      <div>
                        <div className="rfq-title">
                          {rfq.project?.name || 'Project'} · RFQ #{rfq.id.slice(0, 8)}
                        </div>
                        <div className="rfq-meta">
                          {rfq.project?.location || 'Location TBD'}
                          {rfq.required_by && ` · Needed by ${new Date(rfq.required_by).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: 'var(--color-mist)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 600,
                      }}>
                        {rfq.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="rfq-items">
                      {rfq.rfq_items.map((item) => (
                        <div
                          key={item.id}
                          className="rfq-item"
                        >
                          <div>
                            <div className="rfq-item-title">{item.material_name || item.material_key}</div>
                            <div className="rfq-item-meta">
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
                            className="rfq-input"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Available qty"
                            value={form?.items[item.id]?.availableQuantity || ''}
                            onChange={(e) => updateRfqItemField(rfq.id, item.id, 'availableQuantity', e.target.value)}
                            disabled={isLocked}
                            className="rfq-input"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="rfq-input-row">
                      <input
                        type="number"
                        min="0"
                        placeholder="Delivery days"
                        value={form?.deliveryDays || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'deliveryDays', e.target.value)}
                        disabled={isLocked}
                        className="rfq-input"
                      />
                      <input
                        type="date"
                        value={form?.validUntil || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'validUntil', e.target.value)}
                        disabled={isLocked}
                        className="rfq-input"
                      />
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={form?.notes || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'notes', e.target.value)}
                        disabled={isLocked}
                        className="rfq-input"
                      />
                    </div>

                    <div className="rfq-footer">
                      <div className="rfq-total">
                        Total: {formatPrice(totals.usd, totals.zwg)}
                      </div>
                      <button
                        onClick={() => handleSubmitQuote(rfq)}
                        disabled={isLocked}
                        className={`action-btn action-btn--primary ${isLocked ? 'is-disabled' : ''}`}
                        style={isLocked ? { backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' } : undefined}
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
          <div className="panel-card reveal">
            <h2 className="section-title">Business Profile</h2>

            <div className="settings-grid">
              <div className="info-grid">
                <div>
                  <label className="info-label">
                    Business Name
                  </label>
                  <div className="info-value">{supplier.name}</div>
                </div>

                {supplier.registration_number && (
                  <div>
                    <label className="info-label">
                      Registration Number
                    </label>
                    <div className="info-value">{supplier.registration_number}</div>
                  </div>
                )}

                <div>
                  <label className="info-label">
                    Location
                  </label>
                  <div className="info-value">{supplier.location || 'Not set'}</div>
                </div>

                <div>
                  <label className="info-label">
                    Physical Address
                  </label>
                  <div className="info-value">{supplier.physical_address || 'Not set'}</div>
                </div>
              </div>

              <hr className="section-divider" />

              <div className="info-grid">
                <div>
                  <label className="info-label">
                    <Phone size={16} className="inline-icon" />
                    Phone
                  </label>
                  <div className="info-value">{supplier.contact_phone || 'Not set'}</div>
                </div>

                <div>
                  <label className="info-label">
                    <Envelope size={16} className="inline-icon" />
                    Email
                  </label>
                  <div className="info-value">{supplier.contact_email || 'Not set'}</div>
                </div>

                {supplier.website && (
                  <div>
                    <label className="info-label">
                      <Globe size={16} className="inline-icon" />
                      Website
                    </label>
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-accent"
                    >
                      {supplier.website}
                    </a>
                  </div>
                )}
              </div>

              <hr className="section-divider" />

              <div className="info-grid">
                <div>
                  <label className="info-label">
                    Delivery Radius
                  </label>
                  <div className="info-value">{supplier.delivery_radius_km || 50} km</div>
                </div>

                {supplier.payment_terms && (
                  <div>
                    <label className="info-label">
                      Payment Terms
                    </label>
                    <div className="info-value">{supplier.payment_terms}</div>
                  </div>
                )}
              </div>

              <div className="settings-actions">
                <Link
                  href="/supplier/profile/edit"
                  className="action-btn action-btn--primary"
                >
                  <PencilSimple size={18} />
                  Edit Profile
                </Link>
              </div>

              <hr className="section-divider section-divider--spaced" />

              <div className="api-keys">
                <div className="api-keys-header">
                  <Key size={18} />
                  <h3>API Keys</h3>
                </div>
                <p className="muted">
                  Generate API keys to integrate your catalog and availability with ZimEstimate.
                </p>

                <div className="api-key-card">
                  <label className="info-label">Key Label (optional)</label>
                  <input
                    type="text"
                    value={apiKeyLabel}
                    onChange={(e) => setApiKeyLabel(e.target.value)}
                    placeholder="e.g. Inventory sync"
                    className="rfq-input"
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={apiKeyProcessing || apiKeysLoading}
                    className={`action-btn action-btn--primary ${apiKeyProcessing ? 'is-disabled' : ''}`}
                    style={apiKeyProcessing ? { backgroundColor: 'var(--color-border-light)' } : undefined}
                  >
                    {apiKeyProcessing ? 'Creating...' : 'Create API Key'}
                  </button>
                </div>

                {newApiKey && (
                  <div className="api-key-new">
                    <div className="api-key-new-title">
                      New key created — copy it now. You won’t see it again.
                    </div>
                    <div className="api-key-row">
                      <input
                        type="text"
                        readOnly
                        value={newApiKey}
                        className="api-key-input"
                      />
                      <button
                        onClick={handleCopyApiKey}
                        className="action-btn action-btn--secondary"
                      >
                        <ClipboardText size={16} /> Copy
                      </button>
                    </div>
                  </div>
                )}

                {apiKeyError && (
                  <div className="error-text">{apiKeyError}</div>
                )}

                <div className="api-key-table">
                  <h4>Active Keys</h4>
                  {apiKeysLoading ? (
                    <div className="muted">Loading API keys...</div>
                  ) : apiKeys.length === 0 ? (
                    <div className="muted">No API keys created yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="api-table">
                        <thead>
                          <tr>
                            <th>Label</th>
                            <th>Prefix</th>
                            <th>Created</th>
                            <th>Last Used</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map((key) => (
                            <tr key={key.id}>
                              <td>{key.label || '—'}</td>
                              <td className="mono">
                                {key.key_prefix}…
                              </td>
                              <td>{formatTimestamp(key.created_at)}</td>
                              <td>{formatTimestamp(key.last_used_at)}</td>
                              <td>
                                {key.revoked_at ? 'Revoked' : 'Active'}
                              </td>
                              <td className="align-right">
                                {!key.revoked_at && (
                                  <button
                                    onClick={() => handleRevokeApiKey(key.id)}
                                    disabled={apiKeyProcessing}
                                    className="danger-button"
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
      <style jsx>{`
        .supplier-dashboard {
          min-height: 100vh;
          background: var(--color-background);
          color: var(--color-text);
          font-family: var(--font-body);
        }

        .supplier-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-background);
        }

        .supplier-header {
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border-light);
        }

        .supplier-header-inner {
          max-width: var(--container-max);
          margin: 0 auto;
          padding: var(--space-6) var(--container-padding);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
        }

        .supplier-title {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-2);
          flex-wrap: wrap;
        }

        .supplier-title h1 {
          font-size: var(--text-h3);
          font-weight: var(--font-bold);
          margin: 0;
          font-family: var(--font-heading);
          color: var(--color-primary);
        }

        .supplier-meta {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          flex-wrap: wrap;
        }

        .supplier-meta-item {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
        }

        .supplier-back-link {
          padding: var(--space-2) var(--space-4);
          background: var(--color-mist);
          border-radius: var(--radius-md);
          color: var(--color-text-secondary);
          text-decoration: none;
          font-size: var(--text-sm);
          border: 1px solid var(--color-border-light);
          transition: all var(--duration-fast);
        }

        .supplier-back-link:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .supplier-tabs {
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border-light);
        }

        .supplier-tabs-inner {
          max-width: var(--container-max);
          margin: 0 auto;
          display: flex;
          gap: var(--space-2);
          padding: 0 var(--container-padding);
          flex-wrap: wrap;
        }

        .supplier-tab {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-4) var(--space-5);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--color-text-secondary);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .supplier-tab.active {
          border-bottom-color: var(--color-accent);
          color: var(--color-accent);
          font-weight: var(--font-semibold);
        }

        .supplier-content {
          max-width: var(--container-max);
          margin: 0 auto;
          padding: var(--space-8) var(--container-padding);
        }

        .overview-grid {
          display: grid;
          gap: var(--space-6);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .stat-card {
          background: var(--color-surface);
          border-radius: var(--card-radius);
          padding: var(--card-padding);
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border-light);
        }

        .stat-label {
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
          margin-bottom: var(--space-2);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: var(--font-semibold);
        }

        .stat-value {
          font-size: var(--text-h2);
          font-weight: var(--font-bold);
          font-family: var(--font-heading);
          color: var(--color-text);
        }

        .stat-value--success {
          color: var(--color-emerald);
        }

        .stat-value--warning {
          color: var(--color-amber);
        }

        .panel-card {
          background: var(--color-surface);
          border-radius: var(--card-radius);
          padding: var(--card-padding);
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border-light);
          display: grid;
          gap: var(--space-4);
        }

        .panel-card h2 {
          font-size: var(--text-h5);
          font-weight: var(--font-semibold);
          margin: 0;
          font-family: var(--font-heading);
          color: var(--color-primary);
        }

        .action-row {
          display: flex;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-5);
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          font-weight: var(--font-semibold);
          cursor: pointer;
          text-decoration: none;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .action-btn--primary {
          background: var(--color-accent);
          color: var(--color-text-inverse);
          box-shadow: var(--shadow-button);
        }

        .action-btn--primary:hover {
          background: var(--color-accent-dark);
        }

        .action-btn--secondary {
          background: var(--color-mist);
          color: var(--color-text);
          border-color: var(--color-border-light);
        }

        .action-btn--secondary:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .action-btn--ghost {
          background: var(--color-surface);
          color: var(--color-text-secondary);
          border-color: var(--color-border-light);
        }

        .action-btn--ghost:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .action-btn.is-disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .category-pill {
          padding: var(--space-2) var(--space-4);
          background: rgba(46, 108, 246, 0.08);
          color: var(--color-accent);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-6);
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .section-title {
          font-size: var(--text-h4);
          font-weight: var(--font-semibold);
          margin: 0;
          font-family: var(--font-heading);
          color: var(--color-primary);
        }

        .empty-state {
          background: var(--color-surface);
          border-radius: var(--card-radius);
          padding: var(--space-12);
          text-align: center;
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border-light);
          display: grid;
          gap: var(--space-3);
        }

        .empty-state h3 {
          margin: 0;
          font-size: var(--text-h5);
          font-weight: var(--font-semibold);
        }

        .empty-state p {
          margin: 0;
          color: var(--color-text-secondary);
        }

        .category-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .category-card {
          background: var(--color-surface);
          border-radius: var(--card-radius);
          overflow: hidden;
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border-light);
        }

        .category-toggle {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4) var(--space-6);
          background: var(--color-mist);
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .category-title {
          font-weight: var(--font-semibold);
          color: var(--color-primary);
        }

        .category-body {
          padding: var(--space-2);
        }

        .product-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border-light);
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .product-row:last-child {
          border-bottom: none;
        }

        .product-title {
          font-weight: var(--font-semibold);
          margin-bottom: var(--space-1);
        }

        .product-meta {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .product-actions {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .product-price {
          text-align: right;
        }

        .product-price-value {
          font-weight: var(--font-semibold);
        }

        .icon-button-row {
          display: flex;
          gap: var(--space-2);
        }

        .icon-button {
          padding: var(--space-2);
          background: var(--color-mist);
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
        }

        .icon-button--danger {
          background: rgba(220, 38, 38, 0.1);
          color: var(--color-danger);
          border: none;
          cursor: pointer;
        }

        .quotes-grid {
          display: grid;
          gap: var(--space-6);
        }

        .rfq-card {
          background: var(--color-surface);
          border-radius: var(--card-radius);
          padding: var(--card-padding);
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border-light);
          display: grid;
          gap: var(--space-4);
        }

        .rfq-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .rfq-title {
          font-weight: var(--font-semibold);
          margin-bottom: var(--space-1);
        }

        .rfq-meta {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .rfq-items {
          display: grid;
          gap: var(--space-3);
        }

        .rfq-item {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: var(--space-3);
          align-items: center;
          padding: var(--space-3);
          border-radius: var(--radius-md);
          background: var(--color-mist);
        }

        .rfq-item-title {
          font-weight: var(--font-semibold);
        }

        .rfq-item-meta {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
        }

        .rfq-input {
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          font-size: var(--text-sm);
        }

        .rfq-input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(46, 108, 246, 0.12);
        }

        .rfq-input-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
          margin-top: var(--space-4);
        }

        .rfq-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-4);
          flex-wrap: wrap;
          gap: var(--space-3);
        }

        .rfq-total {
          font-weight: var(--font-semibold);
        }

        .settings-grid {
          display: grid;
          gap: var(--space-6);
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--space-6);
        }

        .info-label {
          display: block;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--space-1);
        }

        .info-value {
          font-weight: var(--font-medium);
        }

        .inline-icon {
          display: inline;
          margin-right: var(--space-1);
        }

        .link-accent {
          color: var(--color-accent);
          font-weight: var(--font-medium);
        }

        .settings-actions {
          margin-top: var(--space-4);
        }

        .section-divider {
          border: none;
          border-top: 1px solid var(--color-border-light);
        }

        .section-divider--spaced {
          margin-top: var(--space-8);
        }

        .api-keys {
          margin-top: var(--space-4);
          display: grid;
          gap: var(--space-4);
        }

        .api-keys-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .api-keys-header h3 {
          margin: 0;
          font-size: var(--text-h5);
          font-weight: var(--font-semibold);
        }

        .muted {
          color: var(--color-text-secondary);
        }

        .api-key-card {
          display: grid;
          gap: var(--space-3);
          padding: var(--space-4);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          background: var(--color-mist);
        }

        .api-key-new {
          margin-top: var(--space-4);
          padding: var(--space-4);
          border-radius: var(--radius-md);
          border: 1px solid rgba(46, 108, 246, 0.25);
          background: rgba(46, 108, 246, 0.08);
        }

        .api-key-new-title {
          font-weight: var(--font-semibold);
          margin-bottom: var(--space-2);
        }

        .api-key-row {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .api-key-input {
          flex: 1 1 260px;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          font-family: var(--font-mono);
        }

        .api-key-table h4 {
          margin: 0 0 var(--space-3);
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
        }

        .api-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 520px;
        }

        .api-table th {
          text-align: left;
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          padding: var(--space-2) 0;
        }

        .api-table td {
          padding: var(--space-3) 0;
          border-top: 1px solid var(--color-border-light);
        }

        .mono {
          font-family: var(--font-mono);
        }

        .align-right {
          text-align: right;
        }

        .danger-button {
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-sm);
          border: 1px solid rgba(220, 38, 38, 0.35);
          background: rgba(220, 38, 38, 0.1);
          color: var(--color-danger);
          font-weight: var(--font-semibold);
          cursor: pointer;
        }

        .error-text {
          color: var(--color-danger);
          margin-top: var(--space-3);
        }

        @media (max-width: 1280px) {
          .supplier-header-inner,
          .supplier-tabs-inner,
          .supplier-content {
            padding-left: var(--space-6);
            padding-right: var(--space-6);
          }
        }

        @media (max-width: 768px) {
          .supplier-header-inner {
            flex-direction: column;
            align-items: flex-start;
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .rfq-item {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .supplier-content {
            padding: var(--space-6) var(--space-4);
          }

          .action-row {
            flex-direction: column;
            align-items: stretch;
          }

          .action-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
