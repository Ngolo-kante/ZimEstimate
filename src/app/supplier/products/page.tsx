'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { Package, Plus, PencilSimple, Trash, MagnifyingGlass, Warning } from '@phosphor-icons/react';

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  price_usd: number;
  stock_status: string;
  created_at: string;
};

const STOCK_COLORS: Record<string, string> = {
  in_stock: '#059669',
  low_stock: '#d97706',
  out_of_stock: '#dc2626',
  discontinued: '#94a3b8',
};

const STOCK_LABELS: Record<string, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  discontinued: 'Discontinued',
};

export default function SupplierProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('supplier_products')
        .select('id, name, category, unit, price_usd, stock_status, created_at')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false });
      setProducts((data as Product[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleDelete = async (id: string) => {
    await supabase.from('supplier_products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleteId(null);
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-left">
          <Package size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>My Products</h1>
            <p>Manage your full product catalogue</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-wrap">
            <MagnifyingGlass size={15} />
            <input className="search-input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Link href="/supplier/products/add" className="btn-primary">
            <Plus size={15} /> Add Product
          </Link>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><span className="stat-label">Total</span><span className="stat-value">{products.length}</span></div>
        <div className="stat-card good"><span className="stat-label">In Stock</span><span className="stat-value">{products.filter(p => p.stock_status === 'in_stock').length}</span></div>
        <div className="stat-card warn"><span className="stat-label">Low Stock</span><span className="stat-value">{products.filter(p => p.stock_status === 'low_stock').length}</span></div>
        <div className="stat-card bad"><span className="stat-label">Out of Stock</span><span className="stat-value">{products.filter(p => p.stock_status === 'out_of_stock').length}</span></div>
      </div>

      {loading ? (
        <div className="empty-state"><Package size={32} /><p>Loading products...</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Package size={40} />
          <h3>No products yet</h3>
          <p>Add your first product to appear in the marketplace</p>
          <Link href="/supplier/products/add" className="btn-primary"><Plus size={14} /> Add First Product</Link>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price (USD)</th>
                <th>Stock</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="product-name">{p.name}</td>
                  <td><span className="category-badge">{p.category}</span></td>
                  <td className="text-muted">{p.unit}</td>
                  <td className="price">${p.price_usd?.toFixed(2)}</td>
                  <td>
                    <span className="stock-dot" style={{ background: STOCK_COLORS[p.stock_status] }} />
                    <span className="stock-label">{STOCK_LABELS[p.stock_status] || p.stock_status}</span>
                  </td>
                  <td className="text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/supplier/products/${p.id}/edit`} className="icon-btn">
                        <PencilSimple size={14} />
                      </Link>
                      {deleteId === p.id ? (
                        <span className="confirm-delete">
                          <button className="icon-btn danger" onClick={() => handleDelete(p.id)}>Delete</button>
                          <button className="icon-btn" onClick={() => setDeleteId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button className="icon-btn" onClick={() => setDeleteId(p.id)}>
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page { padding: 28px 32px; max-width: 1100px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .search-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; }
        .search-input { border: none; outline: none; font-size: 0.8125rem; width: 180px; }
        .btn-primary { display: flex; align-items: center; gap: 6px; background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 14px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; text-decoration: none; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: white; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; }
        .stat-card.good { border-left: 3px solid #10b981; }
        .stat-card.warn { border-left: 3px solid #f59e0b; }
        .stat-card.bad { border-left: 3px solid #ef4444; }
        .stat-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
        .stat-value { font-size: 1.4rem; font-weight: 700; color: #0f172a; }
        .table-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .data-table th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
        .data-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
        .data-table tr:last-child td { border-bottom: none; }
        .product-name { font-weight: 600; }
        .category-badge { background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
        .text-muted { color: #94a3b8; }
        .price { font-weight: 700; }
        .stock-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; }
        .stock-label { font-size: 0.8rem; }
        .row-actions { display: flex; align-items: center; gap: 6px; }
        .icon-btn { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 8px; cursor: pointer; color: #64748b; display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; text-decoration: none; }
        .icon-btn:hover { background: #f1f5f9; }
        .icon-btn.danger { border-color: #fecaca; color: #dc2626; background: #fef2f2; }
        .confirm-delete { display: flex; gap: 4px; }
        .empty-state { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 60px; text-align: center; color: #94a3b8; }
        .empty-state h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 12px 0 6px; }
        .empty-state p { margin-bottom: 20px; }
      `}</style>
    </div>
  );
}
