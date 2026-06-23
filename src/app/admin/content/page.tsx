'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import type { Material } from '@/lib/database.types';
import {
  ArrowLeft,
  MagnifyingGlass,
  PencilSimple,
  CheckCircle,
  X,
  Package,
} from '@phosphor-icons/react';

export default function AdminContentPage() {
  const { adminId, checking } = useAdminAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPriceUsd, setEditPriceUsd] = useState('');
  const [editPriceZwg, setEditPriceZwg] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from('materials')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (categoryFilter) query = query.eq('category', categoryFilter);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data } = await query;
    setMaterials((data ?? []) as Material[]);

    if (categories.length === 0) {
      const { data: cats } = await supabase
        .from('materials')
        .select('category')
        .order('category');
      const unique = [...new Set(((cats ?? []) as unknown as Array<{ category: string | null }>).map((r) => r.category).filter((c): c is string => c !== null))];
      setCategories(unique);
    }

    setLoading(false);
  }, [search, categoryFilter, page, categories.length]);

  useEffect(() => {
    if (!adminId) return;
    void Promise.resolve().then(load);
  }, [adminId, load]);

  const startEdit = (m: Material) => {
    setEditingId(m.id);
    setEditPriceUsd(String(m.price_usd));
    setEditPriceZwg(String(m.price_zwg));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    await supabase
      .from('materials')
      .update({
        price_usd: parseFloat(editPriceUsd),
        price_zwg: parseFloat(editPriceZwg),
        last_updated: new Date().toISOString(),
      } as never)
      .eq('id', id);

    setSaving(false);
    setEditingId(null);
    load();
  };

  const toggleActive = async (m: Material) => {
    await supabase
      .from('materials')
      .update({ is_active: !m.is_active } as never)
      .eq('id', m.id);
    load();
  };

  if (checking) return <div className="admin-loading">Loading...</div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>Content Management</h1>
        <p className="header-sub">Manage material catalog and prices</p>
      </div>

      <div className="filters-row">
        <div className="search-wrap">
          <MagnifyingGlass size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="search-input"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="filter-select"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={load}>Refresh</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="table-loading">Loading materials...</div>
          ) : materials.length === 0 ? (
            <div className="empty-state">
              <Package size={40} />
              <p>No materials found.</p>
            </div>
          ) : (
            <div className="mat-table">
              <div className="table-header">
                <span>Material</span>
                <span>Category</span>
                <span>Unit</span>
                <span>Price USD</span>
                <span>Price ZWG</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {materials.map((m) => (
                <div key={m.id} className={`table-row ${!m.is_active ? 'inactive' : ''}`}>
                  <div>
                    <div className="mat-name">{m.name}</div>
                    {m.specifications && <div className="mat-spec">{m.specifications}</div>}
                  </div>
                  <span className="category-label">{m.category}</span>
                  <span className="unit-label">{m.unit}</span>
                  {editingId === m.id ? (
                    <>
                      <input
                        type="number"
                        value={editPriceUsd}
                        onChange={(e) => setEditPriceUsd(e.target.value)}
                        className="price-input"
                        step="0.01"
                        min="0"
                      />
                      <input
                        type="number"
                        value={editPriceZwg}
                        onChange={(e) => setEditPriceZwg(e.target.value)}
                        className="price-input"
                        step="0.01"
                        min="0"
                      />
                    </>
                  ) : (
                    <>
                      <span className="price-cell">${Number(m.price_usd).toFixed(2)}</span>
                      <span className="price-cell zwg">ZWG {Number(m.price_zwg).toFixed(2)}</span>
                    </>
                  )}
                  <span>
                    <button
                      className={`active-toggle ${m.is_active ? 'active' : 'inactive'}`}
                      onClick={() => toggleActive(m)}
                    >
                      {m.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </span>
                  <div className="actions-cell">
                    {editingId === m.id ? (
                      <>
                        <Button size="sm" variant="primary" loading={saving} onClick={() => saveEdit(m.id)} icon={<CheckCircle size={14} />}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} icon={<X size={14} />} />
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" icon={<PencilSimple size={14} />} onClick={() => startEdit(m)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pagination">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="page-info">Page {page}</span>
            <Button size="sm" variant="ghost" disabled={materials.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>

      <style jsx>{`
        .admin-page { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 24px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px; }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .header-sub { font-size: 14px; color: #94a3b8; margin: 0; }
        .filters-row { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
        .search-wrap { position: relative; flex: 1; min-width: 200px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .search-input { width: 100%; padding: 8px 12px 8px 36px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .search-input:focus { outline: none; border-color: #1e40af; }
        .filter-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; }
        .table-loading { text-align: center; padding: 40px; color: #94a3b8; }
        .empty-state { text-align: center; padding: 60px; color: #94a3b8; }
        .empty-state p { font-size: 15px; color: #64748b; margin-top: 12px; }
        .mat-table { display: flex; flex-direction: column; }
        .table-header {
          display: grid; grid-template-columns: 2fr 1fr 0.7fr 1fr 1fr 0.8fr 1fr;
          padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; border-bottom: 1px solid #f1f5f9;
        }
        .table-row {
          display: grid; grid-template-columns: 2fr 1fr 0.7fr 1fr 1fr 0.8fr 1fr;
          padding: 10px 12px; border-bottom: 1px solid #f8fafc; align-items: center; font-size: 13px;
        }
        .table-row.inactive { opacity: 0.6; }
        .table-row:last-child { border-bottom: none; }
        .mat-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .mat-spec { font-size: 11px; color: #94a3b8; }
        .category-label { font-size: 12px; color: #64748b; }
        .unit-label { font-size: 13px; color: #475569; }
        .price-cell { font-size: 13px; font-weight: 600; color: #1e293b; }
        .price-cell.zwg { color: #475569; font-weight: 400; }
        .price-input { width: 90px; padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
        .price-input:focus { outline: none; border-color: #1e40af; }
        .active-toggle {
          padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
          border: 1px solid; cursor: pointer; background: none;
        }
        .active-toggle.active { color: #16a34a; border-color: #86efac; background: #f0fdf4; }
        .active-toggle.inactive { color: #94a3b8; border-color: #e2e8f0; background: #f8fafc; }
        .active-toggle:hover { opacity: 0.8; }
        .actions-cell { display: flex; gap: 6px; }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 0 0; }
        .page-info { font-size: 13px; color: #64748b; }
        @media (max-width: 900px) {
          .table-header { grid-template-columns: 2fr 1fr 1fr 1fr; }
          .table-row { grid-template-columns: 2fr 1fr 1fr 1fr; }
          .table-header span:nth-child(n+5), .table-row > *:nth-child(n+5) { display: none; }
        }
      `}</style>
    </div>
  );
}
