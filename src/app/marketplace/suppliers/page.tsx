'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Input from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useReveal } from '@/hooks/useReveal';
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

  useReveal({ deps: [filteredSuppliers.length, loading, loadingMore] });

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
        <div className="directory-header reveal" data-delay="1">
          <div>
            <h1>Supplier Directory</h1>
            <p>Browse verified suppliers and their product catalogs.</p>
          </div>
          <Link href="/marketplace" className="back-link">Back to Marketplace</Link>
        </div>

        <div className="directory-filters reveal" data-delay="2">
          <Input
            placeholder="Search suppliers by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<MagnifyingGlass size={18} weight="light" />}
            className="search-input"
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
          <div className="loading-state reveal">
            <SpinnerGap size={32} className="spinner" />
            <p>Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="empty-state reveal">
            <Storefront size={48} weight="light" />
            <p>No suppliers match your search.</p>
          </div>
        ) : (
          <>
            <div className="results-info reveal">
              Showing {filteredSuppliers.length} of {totalCount} suppliers
            </div>
            <div className="supplier-grid">
              {filteredSuppliers.map((supplier, index) => {
                const badge = supplier.verification_status ? VERIFICATION_BADGES[supplier.verification_status] : null;
                const count = productCounts[supplier.id] || 0;
                // Stagger delay based on index modulo 5
                const delay = (index % 5) + 1;

                return (
                  <div key={supplier.id} className="supplier-card reveal" data-delay={delay}>
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
                      <span className="rating"><Star size={14} weight="fill" color="var(--color-amber)" />{supplier.rating?.toFixed(1) || '—'}</span>
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
              <div className="load-more-container reveal">
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
          gap: var(--space-6);
          max-width: var(--container-max);
          margin: 0 auto;
          padding: var(--space-8) var(--container-padding);
          font-family: var(--font-body);
        }

        .directory-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .directory-header h1 {
          margin: 0 0 var(--space-2);
          font-family: var(--font-heading);
          font-size: var(--text-h2);
          font-weight: var(--font-bold);
          color: var(--color-primary);
        }

        .directory-header p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: var(--text-lg);
        }

        .back-link {
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          text-decoration: none;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-light);
          transition: all var(--duration-fast);
        }

        .back-link:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .directory-filters {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .pill {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          padding: 6px 14px;
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          cursor: pointer;
          color: var(--color-text-secondary);
          font-weight: var(--font-medium);
          transition: all var(--duration-fast);
          font-family: var(--font-body);
        }

        .pill:hover {
          background: var(--color-mist);
          color: var(--color-text);
        }

        .pill.active {
          background: rgba(46, 108, 246, 0.1);
          border-color: var(--color-accent);
          color: var(--color-accent);
          font-weight: var(--font-semibold);
        }

        .loading-state,
        .empty-state {
          padding: var(--space-12);
          text-align: center;
          color: var(--color-text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
        }

        .supplier-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--grid-gutter);
          margin-top: var(--space-4);
        }

        .supplier-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--card-radius);
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
          box-shadow: var(--shadow-card);
        }

        .supplier-card:hover {
          transform: translateY(-4px);
          border-color: var(--color-accent);
          box-shadow: var(--shadow-lg);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
        }

        .card-header h3 {
          margin: 0 0 var(--space-1);
          font-family: var(--font-heading);
          font-size: var(--text-lg);
          font-weight: var(--font-bold);
          color: var(--color-primary);
        }

        .location {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          white-space: nowrap;
          height: fit-content;
        }

        .card-meta {
          display: flex;
          gap: var(--space-4);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .rating,
        .products {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: var(--font-medium);
        }

        .category-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .tag {
          font-size: var(--text-xs);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          background: var(--color-mist);
          color: var(--color-text-secondary);
          font-weight: var(--font-medium);
        }

        .card-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--text-sm);
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border-light);
          margin-top: auto;
        }

        .view-link {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: var(--font-semibold);
          transition: color 0.2s;
        }
        
        .view-link:hover {
            color: var(--color-accent-dark);
        }

        .contact {
          color: var(--color-text-muted);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
        }

        .results-info {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        .load-more-container {
          display: flex;
          justify-content: center;
          margin-top: var(--space-8);
        }

        .load-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 32px;
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--color-primary);
          cursor: pointer;
          transition: all var(--duration-fast);
          box-shadow: var(--shadow-sm);
        }

        .load-more-btn:hover:not(:disabled) {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: var(--color-white);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .load-more-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Spinner Animation */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        :global(.spinner) {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 768px) {
          .directory-header {
            flex-direction: column;
          }
          .supplier-grid {
             grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}
