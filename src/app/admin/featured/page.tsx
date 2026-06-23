'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Star, MagnifyingGlass, Check, X, Plus } from '@phosphor-icons/react';

const MOCK_SUPPLIERS = [
  { id: 1, name: 'BuildMart Zimbabwe', category: 'General', city: 'Harare', rating: 4.8, featured: true, featuredUntil: '2026-04-30', plan: 'Pro' },
  { id: 2, name: 'Harare Steel Co.', category: 'Steel', city: 'Harare', rating: 4.5, featured: true, featuredUntil: '2026-03-31', plan: 'Pro' },
  { id: 3, name: 'ZimPaint Supplies', category: 'Paint', city: 'Bulawayo', rating: 4.2, featured: false, featuredUntil: null, plan: 'Basic' },
  { id: 4, name: 'Roofing Plus Ltd', category: 'Roofing', city: 'Harare', rating: 4.6, featured: false, featuredUntil: null, plan: 'Pro' },
  { id: 5, name: 'Cement World', category: 'Cement', city: 'Mutare', rating: 4.3, featured: true, featuredUntil: '2026-05-15', plan: 'Enterprise' },
];

export default function AdminFeaturedPage() {
  const { checking } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState(MOCK_SUPPLIERS);

  if (checking) return <div className="admin-loading">Loading...</div>;

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, featured: !s.featured, featuredUntil: !s.featured ? '2026-04-30' : null } : s));
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="header-left">
          <Star size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Featured Suppliers</h1>
            <p>Promote verified suppliers to the top of the marketplace</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-wrap">
            <MagnifyingGlass size={15} />
            <input className="search-input" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card gold">
          <span className="stat-label">Currently Featured</span>
          <span className="stat-value">{suppliers.filter(s => s.featured).length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Eligible (Pro+)</span>
          <span className="stat-value">{suppliers.filter(s => s.plan !== 'Basic').length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Suppliers</span>
          <span className="stat-value">{suppliers.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Expiring Soon</span>
          <span className="stat-value">{suppliers.filter(s => s.featured && s.featuredUntil === '2026-03-31').length}</span>
        </div>
      </div>

      <div className="section-title">Featured Slots</div>
      <div className="featured-grid">
        {suppliers.filter(s => s.featured).map(s => (
          <div key={s.id} className="featured-card">
            <div className="featured-badge"><Star size={11} weight="fill" /> Featured</div>
            <div className="supplier-name">{s.name}</div>
            <div className="supplier-meta">{s.category} · {s.city}</div>
            <div className="supplier-rating">{'★'.repeat(Math.floor(s.rating))} {s.rating}</div>
            <div className="expiry">Expires: {s.featuredUntil}</div>
            <button className="btn-remove" onClick={() => toggle(s.id)}><X size={13} /> Remove</button>
          </div>
        ))}
        <div className="featured-card add-slot" onClick={() => {}}>
          <Plus size={24} className="add-icon" />
          <span>Add Featured Slot</span>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>All Suppliers</div>
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Category</th>
              <th>City</th>
              <th>Rating</th>
              <th>Plan</th>
              <th>Featured Until</th>
              <th>Featured</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td className="supplier-name-cell">{s.name}</td>
                <td><span className="category-badge">{s.category}</span></td>
                <td className="text-muted">{s.city}</td>
                <td className="rating-cell">{'★'.repeat(Math.floor(s.rating))} {s.rating}</td>
                <td><span className={`plan-badge plan-${s.plan.toLowerCase()}`}>{s.plan}</span></td>
                <td className="text-muted">{s.featuredUntil || '—'}</td>
                <td>
                  <button
                    className={`toggle-btn ${s.featured ? 'on' : 'off'}`}
                    onClick={() => toggle(s.id)}
                    disabled={s.plan === 'Basic'}
                  >
                    {s.featured ? <><Check size={12} /> On</> : 'Off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .admin-page { padding: 28px 32px; max-width: 1100px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #f59e0b; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .search-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; }
        .search-input { border: none; outline: none; font-size: 0.8125rem; width: 180px; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
        .stat-card { background: white; border-radius: 10px; padding: 16px 20px; border: 1px solid #e2e8f0; }
        .stat-card.gold { border-left: 3px solid #f59e0b; }
        .stat-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 6px; }
        .stat-value { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
        .section-title { font-size: 0.8125rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
        .featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 8px; }
        .featured-card { background: white; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; position: relative; }
        .featured-badge { display: inline-flex; align-items: center; gap: 4px; background: #fef3c7; color: #d97706; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-bottom: 10px; text-transform: uppercase; }
        .supplier-name { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
        .supplier-meta { font-size: 0.75rem; color: #64748b; margin-bottom: 6px; }
        .supplier-rating { font-size: 0.75rem; color: #f59e0b; margin-bottom: 6px; }
        .expiry { font-size: 0.7rem; color: #94a3b8; margin-bottom: 10px; }
        .btn-remove { display: flex; align-items: center; gap: 5px; background: #fef2f2; color: #dc2626; border: none; border-radius: 6px; padding: 5px 10px; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
        .add-slot { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #e2e8f0; background: #f8fafc; cursor: pointer; gap: 8px; color: #94a3b8; font-size: 0.8125rem; min-height: 130px; }
        .add-slot:hover { border-color: #93c5fd; color: #2563eb; }
        .add-icon { color: inherit; }
        .table-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .data-table th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
        .data-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; }
        .data-table tr:last-child td { border-bottom: none; }
        .supplier-name-cell { font-weight: 500; color: #1e293b; }
        .category-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
        .text-muted { color: #94a3b8; }
        .rating-cell { color: #f59e0b; font-size: 0.8rem; }
        .plan-badge { padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
        .plan-pro { background: #eff6ff; color: #2563eb; }
        .plan-basic { background: #f1f5f9; color: #64748b; }
        .plan-enterprise { background: #faf5ff; color: #7c3aed; }
        .toggle-btn { display: inline-flex; align-items: center; gap: 4px; border: none; border-radius: 20px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
        .toggle-btn.on { background: #d1fae5; color: #059669; }
        .toggle-btn.off { background: #f1f5f9; color: #94a3b8; }
        .toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .admin-loading { padding: 60px; text-align: center; color: #94a3b8; }
      `}</style>
    </div>
  );
}
