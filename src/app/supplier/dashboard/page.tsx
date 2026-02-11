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
    const materialKey = product.material_key;
    let category = 'Other';

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size={32} className="animate-spin text-accent" />
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
    <div className="min-h-screen bg-background text-text font-body">
      {/* Header */}
      <div className="bg-surface border-b border-border-light">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <Storefront size={28} className="text-accent" />
              <h1 className="text-2xl md:text-3xl font-bold font-heading text-primary m-0">
                {supplier.name}
              </h1>
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${verificationBadge.color}15`,
                  color: verificationBadge.color,
                }}
              >
                <VerificationIcon size={14} weight="bold" />
                {verificationBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-secondary flex-wrap">
              {supplier.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={16} />
                  {supplier.location}
                </span>
              )}
              {supplier.contact_phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={16} />
                  {supplier.contact_phone}
                </span>
              )}
            </div>
          </div>

          <Link
            href="/"
            className="px-4 py-2 bg-mist rounded-md text-secondary text-sm border border-border-light hover:border-accent hover:text-accent transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface border-b border-border-light">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 overflow-x-auto">
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
                className={`flex items-center gap-2 px-5 py-4 bg-transparent border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${isActive
                    ? 'border-accent text-accent font-semibold'
                    : 'border-transparent text-secondary hover:text-text'
                  }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface rounded-xl p-5 shadow-card border border-border-light reveal" data-delay="1">
                <div className="text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Total Products</div>
                <div className="text-3xl font-bold font-heading text-primary">{products.length}</div>
              </div>

              <div className="bg-surface rounded-xl p-5 shadow-card border border-border-light reveal" data-delay="2">
                <div className="text-secondary text-sm font-semibold uppercase tracking-wider mb-2">In Stock</div>
                <div className="text-3xl font-bold font-heading text-emerald-600">
                  {products.filter(p => p.stock_status === 'in_stock').length}
                </div>
              </div>

              <div className="bg-surface rounded-xl p-5 shadow-card border border-border-light reveal" data-delay="3">
                <div className="text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Low Stock</div>
                <div className="text-3xl font-bold font-heading text-amber-500">
                  {products.filter(p => p.stock_status === 'low_stock').length}
                </div>
              </div>

              <div className="bg-surface rounded-xl p-5 shadow-card border border-border-light reveal" data-delay="4">
                <div className="text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Delivery Radius</div>
                <div className="text-3xl font-bold font-heading text-primary">
                  {supplier.delivery_radius_km || 50} km
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-surface rounded-xl p-5 shadow-card border border-border-light grid gap-4 reveal" data-delay="2">
              <h2 className="text-lg font-semibold font-heading text-primary m-0">Quick Actions</h2>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setActiveTab('products')}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-md font-semibold hover:bg-accent-dark transition-colors shadow-sm"
                >
                  <Plus size={18} weight="bold" />
                  Add Product
                </button>
                <Link
                  href="/supplier/analytics"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-mist text-text border border-border-light rounded-md font-semibold hover:bg-white hover:border-accent hover:text-accent transition-colors"
                >
                  <ChartLine size={18} weight="bold" />
                  View Analytics
                </Link>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-surface text-secondary border border-border-light rounded-md font-semibold hover:border-accent hover:text-accent transition-colors"
                >
                  <PencilSimple size={18} />
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Categories */}
            {supplier.material_categories && supplier.material_categories.length > 0 && (
              <div className="bg-surface rounded-xl p-5 shadow-card border border-border-light grid gap-4 reveal" data-delay="3">
                <h2 className="text-lg font-semibold font-heading text-primary m-0">Your Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {supplier.material_categories.map(category => (
                    <span
                      key={category}
                      className="px-4 py-2 bg-accent-light text-accent rounded-full text-sm font-medium"
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 reveal" data-delay="1">
              <h2 className="text-xl font-semibold font-heading text-primary m-0">
                Your Products ({products.length})
              </h2>
              <Link
                href={`/supplier/products/add`}
                className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-md font-semibold hover:bg-accent-dark transition-colors shadow-sm"
              >
                <Plus size={18} weight="bold" />
                Add Product
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="bg-surface rounded-xl p-12 text-center shadow-card border border-border-light grid gap-3 reveal">
                <div className="flex justify-center">
                  <Package size={48} className="text-muted mb-4" />
                </div>
                <h3 className="text-lg font-semibold m-0">No products yet</h3>
                <p className="text-secondary m-0">
                  Add your first product to start appearing in search results.
                </p>
                <div className="flex justify-center mt-4">
                  <Link
                    href={`/supplier/products/add`}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-md font-semibold hover:bg-accent-dark transition-colors shadow-sm"
                  >
                    <Plus size={18} weight="bold" />
                    Add Your First Product
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                  <div
                    key={category}
                    className="bg-surface rounded-xl overflow-hidden shadow-card border border-border-light reveal"
                  >
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex justify-between items-center px-6 py-4 bg-mist border-none cursor-pointer text-left hover:bg-surface transition-colors"
                    >
                      <span className="font-semibold text-primary">
                        {category} ({categoryProducts.length})
                      </span>
                      {expandedCategories.has(category) ? (
                        <CaretUp size={20} className="text-secondary" />
                      ) : (
                        <CaretDown size={20} className="text-secondary" />
                      )}
                    </button>

                    {expandedCategories.has(category) && (
                      <div className="p-2">
                        {categoryProducts.map(product => {
                          const statusInfo = STOCK_STATUS_LABELS[product.stock_status] || STOCK_STATUS_LABELS.in_stock;
                          return (
                            <div
                              key={product.id}
                              className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-border-light last:border-0 gap-4"
                            >
                              <div>
                                <div className="font-semibold mb-1">
                                  {product.material_name || product.material_key}
                                </div>
                                <div className="text-sm text-secondary">
                                  {product.unit && `Per ${product.unit}`}
                                  {product.min_order_qty > 1 && ` · Min order: ${product.min_order_qty}`}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right">
                                  {product.price_usd && (
                                    <div className="font-semibold">
                                      ${product.price_usd.toFixed(2)}
                                    </div>
                                  )}
                                  <span
                                    className="inline-block text-xs px-2 py-0.5 rounded"
                                    style={{
                                      backgroundColor: `${statusInfo.color}15`,
                                      color: statusInfo.color,
                                    }}
                                  >
                                    {statusInfo.label}
                                  </span>
                                </div>

                                <div className="flex gap-2">
                                  <Link
                                    href={`/supplier/products/edit/${product.id}`}
                                    className="p-2 bg-mist rounded text-secondary hover:bg-white hover:text-accent transition-colors"
                                  >
                                    <PencilSimple size={16} />
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="p-2 bg-error/10 rounded text-error hover:bg-error/20 transition-colors cursor-pointer border-none"
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
          <div className="grid gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 reveal" data-delay="1">
              <h2 className="text-xl font-semibold font-heading text-primary m-0">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface text-secondary border border-border-light rounded-md font-medium hover:border-accent hover:text-accent transition-colors cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {rfqLoading ? (
              <div className="bg-surface rounded-xl p-8 flex justify-center shadow-card border border-border-light reveal">
                <Spinner size={32} className="animate-spin text-accent" />
              </div>
            ) : rfqInbox.length === 0 ? (
              <div className="bg-surface rounded-xl p-12 text-center shadow-card border border-border-light grid gap-3 reveal">
                <div className="flex justify-center">
                  <ClipboardText size={48} className="text-muted mb-4" />
                </div>
                <h3 className="text-lg font-semibold m-0">No RFQs yet</h3>
                <p className="text-secondary m-0">
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
                    className="bg-surface rounded-xl p-6 shadow-card border border-border-light grid gap-4 reveal"
                  >
                    <div className="flex justify-between items-start gap-4 flex-wrap">
                      <div>
                        <div className="font-semibold mb-1">
                          {rfq.project?.name || 'Project'} · RFQ #{rfq.id.slice(0, 8)}
                        </div>
                        <div className="text-sm text-secondary">
                          {rfq.project?.location || 'Location TBD'}
                          {rfq.required_by && ` · Needed by ${new Date(rfq.required_by).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-3 py-1 bg-mist text-secondary rounded-full uppercase tracking-wider">
                        {rfq.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {rfq.rfq_items.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3 items-center p-3 rounded-md bg-mist"
                        >
                          <div>
                            <div className="font-semibold">{item.material_name || item.material_key}</div>
                            <div className="text-xs text-secondary">
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
                            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Available qty"
                            value={form?.items[item.id]?.availableQuantity || ''}
                            onChange={(e) => updateRfqItemField(rfq.id, item.id, 'availableQuantity', e.target.value)}
                            disabled={isLocked}
                            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Delivery days"
                        value={form?.deliveryDays || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'deliveryDays', e.target.value)}
                        disabled={isLocked}
                        className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                      <input
                        type="date"
                        value={form?.validUntil || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'validUntil', e.target.value)}
                        disabled={isLocked}
                        className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={form?.notes || ''}
                        onChange={(e) => updateRfqField(rfq.id, 'notes', e.target.value)}
                        disabled={isLocked}
                        className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                    </div>

                    <div className="flex justify-between items-center mt-2 flex-wrap gap-3 border-t border-border-light pt-4">
                      <div className="font-semibold text-primary">
                        Total: {formatPrice(totals.usd, totals.zwg)}
                      </div>
                      <button
                        onClick={() => handleSubmitQuote(rfq)}
                        disabled={isLocked}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold transition-colors shadow-sm ${isLocked
                            ? 'bg-border-light text-muted cursor-not-allowed'
                            : 'bg-accent text-white hover:bg-accent-dark'
                          }`}
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
          <div className="bg-surface rounded-xl p-6 shadow-card border border-border-light reveal">
            <h2 className="text-xl font-semibold font-heading text-primary m-0 mb-6">Business Profile</h2>

            <div className="grid gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-secondary mb-1">
                    Business Name
                  </label>
                  <div className="font-medium">{supplier.name}</div>
                </div>

                {supplier.registration_number && (
                  <div>
                    <label className="block text-sm text-secondary mb-1">
                      Registration Number
                    </label>
                    <div className="font-medium">{supplier.registration_number}</div>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-secondary mb-1">
                    Location
                  </label>
                  <div className="font-medium">{supplier.location || 'Not set'}</div>
                </div>

                <div>
                  <label className="block text-sm text-secondary mb-1">
                    Physical Address
                  </label>
                  <div className="font-medium">{supplier.physical_address || 'Not set'}</div>
                </div>
              </div>

              <hr className="border-t border-border-light" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-secondary mb-1">
                    <Phone size={16} className="inline mr-1" />
                    Phone
                  </label>
                  <div className="font-medium">{supplier.contact_phone || 'Not set'}</div>
                </div>

                <div>
                  <label className="block text-sm text-secondary mb-1">
                    <Envelope size={16} className="inline mr-1" />
                    Email
                  </label>
                  <div className="font-medium">{supplier.contact_email || 'Not set'}</div>
                </div>

                {supplier.website && (
                  <div>
                    <label className="block text-sm text-secondary mb-1">
                      <Globe size={16} className="inline mr-1" />
                      Website
                    </label>
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent font-medium hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </div>
                )}
              </div>

              <hr className="border-t border-border-light" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-secondary mb-1">
                    Delivery Radius
                  </label>
                  <div className="font-medium">{supplier.delivery_radius_km || 50} km</div>
                </div>

                {supplier.payment_terms && (
                  <div>
                    <label className="block text-sm text-secondary mb-1">
                      Payment Terms
                    </label>
                    <div className="font-medium">{supplier.payment_terms}</div>
                  </div>
                )}
              </div>

              <div className="mt-2">
                <Link
                  href="/supplier/profile/edit"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-md font-semibold hover:bg-accent-dark transition-colors shadow-sm"
                >
                  <PencilSimple size={18} />
                  Edit Profile
                </Link>
              </div>

              <hr className="border-t border-border-light mt-4" />

              <div className="grid gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-secondary" />
                  <h3 className="text-lg font-semibold font-heading text-primary m-0">API Keys</h3>
                </div>
                <p className="text-secondary m-0">
                  Generate API keys to integrate your catalog and availability with ZimEstimate.
                </p>

                <div className="grid gap-3 p-4 border border-border-light rounded-md bg-mist">
                  <label className="text-sm text-secondary">Key Label (optional)</label>
                  <input
                    type="text"
                    value={apiKeyLabel}
                    onChange={(e) => setApiKeyLabel(e.target.value)}
                    placeholder="e.g. Inventory sync"
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={apiKeyProcessing || apiKeysLoading}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-md font-semibold transition-colors shadow-sm w-full sm:w-auto ${apiKeyProcessing ? 'bg-border-light text-muted cursor-not-allowed' : 'hover:bg-accent-dark'
                      }`}
                  >
                    {apiKeyProcessing ? 'Creating...' : 'Create API Key'}
                  </button>
                </div>

                {newApiKey && (
                  <div className="mt-4 p-4 rounded-md border border-accent-light bg-accent-light">
                    <div className="font-semibold text-primary mb-2">
                      New key created — copy it now. You won’t see it again.
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        readOnly
                        value={newApiKey}
                        className="flex-1 px-3 py-2 rounded-md border border-border bg-white font-mono text-sm"
                      />
                      <button
                        onClick={handleCopyApiKey}
                        className="px-4 py-2 bg-white border border-border-light text-text rounded-md hover:border-accent hover:text-accent transition-colors flex items-center gap-2"
                      >
                        <ClipboardText size={16} /> Copy
                      </button>
                    </div>
                  </div>
                )}

                {apiKeyError && (
                  <div className="text-error mt-2">{apiKeyError}</div>
                )}

                <div className="mt-4">
                  <h4 className="text-base font-semibold mb-3">Active Keys</h4>
                  {apiKeysLoading ? (
                    <div className="text-secondary">Loading API keys...</div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-secondary">No API keys created yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse min-w-[520px]">
                        <thead>
                          <tr>
                            <th className="text-left text-xs uppercase tracking-wider text-secondary py-2">Label</th>
                            <th className="text-left text-xs uppercase tracking-wider text-secondary py-2">Prefix</th>
                            <th className="text-left text-xs uppercase tracking-wider text-secondary py-2">Created</th>
                            <th className="text-left text-xs uppercase tracking-wider text-secondary py-2">Last Used</th>
                            <th className="text-left text-xs uppercase tracking-wider text-secondary py-2">Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map((key) => (
                            <tr key={key.id} className="border-t border-border-light">
                              <td className="py-3 pr-4">{key.label || '—'}</td>
                              <td className="py-3 pr-4 font-mono text-sm">
                                {key.key_prefix}…
                              </td>
                              <td className="py-3 pr-4 text-sm">{formatTimestamp(key.created_at)}</td>
                              <td className="py-3 pr-4 text-sm">{formatTimestamp(key.last_used_at)}</td>
                              <td className="py-3 pr-4 text-sm">
                                {key.revoked_at ? 'Revoked' : 'Active'}
                              </td>
                              <td className="py-3 text-right">
                                {!key.revoked_at && (
                                  <button
                                    onClick={() => handleRevokeApiKey(key.id)}
                                    disabled={apiKeyProcessing}
                                    className="px-3 py-1 bg-error/10 text-error border border-error/30 rounded text-sm font-semibold hover:bg-error/20 transition-colors"
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
