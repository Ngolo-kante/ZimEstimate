'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  MapPin,
  Phone,
  Envelope,
  ShieldCheck,
  Star,
  Package,
  Timer,
  ArrowLeft,
} from '@phosphor-icons/react';
import type { Supplier, SupplierProduct } from '@/lib/database.types';

const STOCK_LABELS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'In Stock', color: '#16a34a' },
  low_stock: { label: 'Low Stock', color: '#f59e0b' },
  out_of_stock: { label: 'Out of Stock', color: '#ef4444' },
  discontinued: { label: 'Discontinued', color: '#6b7280' },
};

const VERIFICATION_BADGES: Record<string, { label: string; color: string }> = {
  verified: { label: 'Verified', color: '#16a34a' },
  trusted: { label: 'Trusted', color: '#2563eb' },
  premium: { label: 'Premium', color: '#7c3aed' },
};

const isSupplierRow = (row: unknown): row is Supplier => {
  if (!row || typeof row !== 'object') return false;
  const candidate = row as { id?: unknown; name?: unknown };
  return typeof candidate.id === 'string' && typeof candidate.name === 'string';
};

const isSupplierProductRow = (row: unknown): row is SupplierProduct => {
  if (!row || typeof row !== 'object') return false;
  const candidate = row as { supplier_id?: unknown; material_name?: unknown };
  return typeof candidate.supplier_id === 'string' && typeof candidate.material_name === 'string';
};

export default function SupplierDetailPage() {
  const params = useParams();
  const supplierId = params.id as string;
  const { formatPrice, exchangeRate } = useCurrency();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseRate, setResponseRate] = useState<number | null>(null);

  useEffect(() => {
    async function loadSupplier() {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .is('deleted_at', null)
        .single();

      if (!error && isSupplierRow(data)) {
        setSupplier(data);
      }

      const { data: productRows } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplierId)
        .eq('is_active', true)
        .order('material_name', { ascending: true });

      if (productRows) {
        const validProducts = Array.isArray(productRows)
          ? productRows.filter(isSupplierProductRow)
          : [];
        setProducts(validProducts);
      }

      const { data: recipients, error: recipientsError } = await supabase
        .from('rfq_recipients')
        .select('status')
        .eq('supplier_id', supplierId);

      if (!recipientsError && Array.isArray(recipients)) {
        const total = recipients.length;
        const responded = recipients.filter((r: { status?: string }) => r.status === 'quoted').length;
        setResponseRate(total > 0 ? Math.round((responded / total) * 100) : 0);
      }

      setLoading(false);
    }

    if (supplierId) {
      loadSupplier();
    }
  }, [supplierId]);

  const stats = useMemo(() => {
    const avgLead = products.length > 0
      ? Math.round(products.reduce((sum, p) => sum + (p.lead_time_days || 0), 0) / products.length)
      : null;
    return {
      productCount: products.length,
      avgLeadTime: avgLead,
    };
  }, [products]);

  if (loading) {
    return (
      <MainLayout title="Supplier">
        <div className="loading-state">Loading supplier...</div>
      </MainLayout>
    );
  }

  if (!supplier) {
    return (
      <MainLayout title="Supplier">
        <div className="empty-state">
          <p>Supplier not found.</p>
          <Link href="/marketplace/suppliers" className="back-link">
            <ArrowLeft size={14} /> Back to directory
          </Link>
        </div>
      </MainLayout>
    );
  }

  const badge = supplier.verification_status ? VERIFICATION_BADGES[supplier.verification_status] : null;

  return (
    <MainLayout title={supplier.name}>
      <div className="supplier-detail">
        <Link href="/marketplace/suppliers" className="back-link">
          <ArrowLeft size={14} /> Back to directory
        </Link>

        <div className="supplier-hero">
          <div>
            <div className="title-row">
              <h1>{supplier.name}</h1>
              {badge && (
                <span className="badge" style={{ backgroundColor: `${badge.color}15`, color: badge.color }}>
                  <ShieldCheck size={12} />{badge.label}
                </span>
              )}
            </div>
            <div className="meta-row">
              {supplier.location && (
                <span><MapPin size={12} />{supplier.location}</span>
              )}
              {supplier.contact_phone && (
                <span><Phone size={12} />{supplier.contact_phone}</span>
              )}
              {supplier.contact_email && (
                <span><Envelope size={12} />{supplier.contact_email}</span>
              )}
            </div>
          </div>
          <div className="rating">
            <Star size={16} weight="fill" />
            {supplier.rating?.toFixed(1) || '—'}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <Package size={18} />
            <div>
              <span className="label">Products</span>
              <span className="value">{stats.productCount}</span>
            </div>
          </div>
          <div className="stat-card">
            <Timer size={18} />
            <div>
              <span className="label">Avg Lead Time</span>
              <span className="value">{stats.avgLeadTime ? `${stats.avgLeadTime} days` : '—'}</span>
            </div>
          </div>
          <div className="stat-card">
            <ShieldCheck size={18} />
            <div>
              <span className="label">Response Rate</span>
              <span className="value">{responseRate !== null ? `${responseRate}%` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>Product Catalog</h2>
          {products.length === 0 ? (
            <p className="muted">No active products listed.</p>
          ) : (
            <div className="product-list">
              {products.map((product) => {
                const status = STOCK_LABELS[product.stock_status] || STOCK_LABELS.in_stock;
                return (
                  <div key={product.id} className="product-card">
                    <div>
                      <h3>{product.material_name || product.material_key}</h3>
                      <span className="muted">{product.unit ? `Per ${product.unit}` : 'Unit not set'}</span>
                    </div>
                    <div className="price">
                      {product.price_usd !== null ? (
                        <span>{formatPrice(Number(product.price_usd), Number(product.price_usd) * exchangeRate)}</span>
                      ) : (
                        <span className="muted">Price on request</span>
                      )}
                      <span className="stock" style={{ backgroundColor: `${status.color}15`, color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="section">
          <h2>Categories</h2>
          <div className="tag-row">
            {(supplier.material_categories || []).map((category) => (
              <span key={category} className="tag">{category}</span>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Reviews</h2>
          <p className="muted">No reviews yet.</p>
        </div>
      </div>

      <style jsx>{`
        .supplier-detail {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          text-decoration: none;
        }

        .supplier-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: 16px;
          padding: 20px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .title-row h1 {
          margin: 0;
          font-size: 1.5rem;
          color: var(--color-text);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 999px;
        }

        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
          color: var(--color-text-muted);
          font-size: 0.8rem;
        }

        .meta-row span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .rating {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 1rem;
          color: var(--color-accent);
          font-weight: 600;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--color-border-light);
          background: var(--color-surface);
        }

        .stat-card .label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .stat-card .value {
          display: block;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .section {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: 16px;
          padding: 20px;
        }

        .section h2 {
          margin: 0 0 16px;
          font-size: 1.1rem;
        }

        .product-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .product-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--color-border-light);
          background: var(--color-background);
        }

        .product-card h3 {
          margin: 0 0 4px;
          font-size: 0.95rem;
        }

        .price {
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-weight: 600;
        }

        .stock {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          padding: 4px 8px;
          border-radius: 999px;
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          font-size: 0.7rem;
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--color-background);
          color: var(--color-text-muted);
        }

        .muted {
          color: var(--color-text-muted);
          font-size: 0.85rem;
        }

        .loading-state,
        .empty-state {
          text-align: center;
          padding: 48px;
          color: var(--color-text-muted);
        }

        @media (max-width: 768px) {
          .supplier-hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .product-card {
            flex-direction: column;
            align-items: flex-start;
          }

          .price {
            text-align: left;
          }
        }
      `}</style>
    </MainLayout>
  );
}
