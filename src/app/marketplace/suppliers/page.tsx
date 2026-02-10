'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Input from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import {
  MagnifyingGlass,
  MapPin,
  Star,
  ShieldCheck,
  Storefront,
  Package,
  SpinnerGap,
} from '@phosphor-icons/react';
import type { Supplier, SupplierProduct } from '@/lib/database.types';

// PERF-002 FIX: Implement pagination to prevent loading all suppliers at once
const PAGE_SIZE = 20;

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
  const candidate = row as { supplier_id?: unknown };
  return typeof candidate.supplier_id === 'string';
};

export default function SupplierDirectoryPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const loadSuppliers = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    // Fetch total count for pagination info
    if (offset === 0) {
      const { count } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);
      setTotalCount(count || 0);
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!error && data) {
      const newSuppliers: Supplier[] = Array.isArray(data) ? data.filter(isSupplierRow) : [];
      setSuppliers((prev) => (append ? [...prev, ...newSuppliers] : newSuppliers));
      setHasMore(newSuppliers.length === PAGE_SIZE);

      // Fetch product counts for the new batch of suppliers
      const supplierIds = newSuppliers.map((s) => s.id);
      if (supplierIds.length > 0) {
        const { data: products } = await supabase
          .from('supplier_products')
          .select('supplier_id, id')
          .eq('is_active', true)
          .in('supplier_id', supplierIds);

        if (products) {
          const counts: Record<string, number> = {};
          const filteredProducts: SupplierProduct[] = Array.isArray(products) ? products.filter(isSupplierProductRow) : [];
          filteredProducts.forEach((product) => {
            const supplierId = product.supplier_id;
            counts[supplierId] = (counts[supplierId] || 0) + 1;
          });
          setProductCounts((prev) => (append ? { ...prev, ...counts } : counts));
        }
      }
    }

    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    loadSuppliers(0, false);
  }, [loadSuppliers]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadSuppliers(suppliers.length, true);
    }
  }, [loadSuppliers, loadingMore, hasMore, suppliers.length]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((supplier) => {
      supplier.material_categories?.forEach((category) => set.add(category));
    });
    return Array.from(set).sort();
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (selectedCategory !== 'all') {
        if (!supplier.material_categories?.includes(selectedCategory)) return false;
      }
      if (!query) return true;
      const haystack = [supplier.name, supplier.location, supplier.physical_address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [suppliers, searchQuery, selectedCategory]);

  return (
    <MainLayout title="Supplier Directory">
      <div className="supplier-directory">
        <div className="directory-header">
          <div>
            <h1>Supplier Directory</h1>
            <p>Browse verified suppliers and their product catalogs.</p>
          </div>
          <Link href="/marketplace" className="back-link">Back to Marketplace</Link>
        </div>

        <div className="directory-filters">
          <Input
            placeholder="Search suppliers by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<MagnifyingGlass size={18} weight="light" />}
          />

          <div className="category-filters">
            <button
              className={`pill ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`pill ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading suppliers...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <Storefront size={48} weight="light" />
            <p>No suppliers match your search.</p>
          </div>
        ) : (
          <>
            <div className="results-info">
              Showing {filteredSuppliers.length} of {totalCount} suppliers
            </div>
            <div className="supplier-grid">
              {filteredSuppliers.map((supplier) => {
                const badge = supplier.verification_status ? VERIFICATION_BADGES[supplier.verification_status] : null;
                const count = productCounts[supplier.id] || 0;
                return (
                  <div key={supplier.id} className="supplier-card">
                    <div className="card-header">
                      <div>
                        <h3>{supplier.name}</h3>
                        {supplier.location && (
                          <span className="location"><MapPin size={12} />{supplier.location}</span>
                        )}
                      </div>
                      {badge && (
                        <span className="badge" style={{ backgroundColor: `${badge.color}15`, color: badge.color }}>
                          <ShieldCheck size={12} />{badge.label}
                        </span>
                      )}
                    </div>

                    <div className="card-meta">
                      <span className="rating"><Star size={14} weight="fill" />{supplier.rating?.toFixed(1) || '—'}</span>
                      <span className="products"><Package size={14} />{count} products</span>
                    </div>

                    <div className="category-tags">
                      {(supplier.material_categories || []).slice(0, 4).map((category) => (
                        <span key={category} className="tag">{category}</span>
                      ))}
                    </div>

                    <div className="card-actions">
                      <Link href={`/marketplace/suppliers/${supplier.id}`} className="view-link">
                        View Products
                      </Link>
                      {supplier.contact_phone && (
                        <span className="contact">{supplier.contact_phone}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="load-more-container">
                <button
                  className="load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <SpinnerGap size={16} className="spinner" />
                      Loading...
                    </>
                  ) : (
                    `Load More Suppliers`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .supplier-directory {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .directory-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .directory-header h1 {
          margin: 0 0 6px;
          font-size: 1.5rem;
          color: var(--color-text);
        }

        .directory-header p {
          margin: 0;
          color: var(--color-text-secondary);
        }

        .back-link {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          text-decoration: none;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--color-border-light);
        }

        .directory-filters {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pill {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.8rem;
          cursor: pointer;
          color: var(--color-text-secondary);
        }

        .pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-primary);
        }

        .loading-state,
        .empty-state {
          padding: 48px;
          text-align: center;
          color: var(--color-text-muted);
        }

        .supplier-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }

        .supplier-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .card-header h3 {
          margin: 0 0 4px;
          font-size: 1rem;
          color: var(--color-text);
        }

        .location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .card-meta {
          display: flex;
          gap: 16px;
          font-size: 0.8rem;
          color: var(--color-text-secondary);
        }

        .rating,
        .products {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .category-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag {
          font-size: 0.7rem;
          padding: 4px 8px;
          border-radius: 8px;
          background: var(--color-background);
          color: var(--color-text-muted);
        }

        .card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
        }

        .view-link {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: 600;
        }

        .contact {
          color: var(--color-text-muted);
        }

        .results-info {
          font-size: 0.875rem;
          color: var(--color-text-muted);
        }

        .load-more-container {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }

        .load-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .load-more-btn:hover:not(:disabled) {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-primary);
        }

        .load-more-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .load-more-btn :global(.spinner) {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 768px) {
          .directory-header {
            flex-direction: column;
          }
        }
      `}</style>
    </MainLayout>
  );
}
