'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { ShoppingCart, MagnifyingGlass, Check, X, Clock } from '@phosphor-icons/react';

type RfqRow = {
  id: string;
  project_name: string;
  builder_name: string;
  items: { name: string; qty: number; unit: string }[];
  status: string;
  created_at: string;
  deadline: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'status-pending',
  quoted: 'status-quoted',
  accepted: 'status-accepted',
  declined: 'status-declined',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting Quote',
  quoted: 'Quote Sent',
  accepted: 'Accepted',
  declined: 'Declined',
};

const MOCK_ORDERS: RfqRow[] = [
  { id: 'RFQ-001', project_name: 'Harare Residential Build', builder_name: 'Tafadzwa M.', items: [{ name: 'Portland Cement 50kg', qty: 50, unit: 'bags' }], status: 'pending', created_at: '2026-03-26T10:00:00Z', deadline: '2026-03-28' },
  { id: 'RFQ-002', project_name: 'Bulawayo Office Block', builder_name: 'Sithembile N.', items: [{ name: 'Y12 Rebar', qty: 20, unit: 'bars' }, { name: 'Y16 Rebar', qty: 15, unit: 'bars' }], status: 'quoted', created_at: '2026-03-24T08:30:00Z', deadline: '2026-03-27' },
  { id: 'RFQ-003', project_name: 'Masvingo Townhouse', builder_name: 'Chiedza P.', items: [{ name: 'IBR Sheets 3m', qty: 30, unit: 'sheets' }], status: 'accepted', created_at: '2026-03-20T14:00:00Z', deadline: null },
  { id: 'RFQ-004', project_name: 'Gweru Warehouse', builder_name: 'Amos K.', items: [{ name: 'Face Bricks', qty: 5000, unit: 'units' }], status: 'declined', created_at: '2026-03-18T09:00:00Z', deadline: null },
];

export default function SupplierOrdersPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = MOCK_ORDERS.filter(o => {
    const matchFilter = filter === 'all' || o.status === filter;
    const matchSearch = o.project_name.toLowerCase().includes(search.toLowerCase()) ||
      o.builder_name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-left">
          <ShoppingCart size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Orders & Requests</h1>
            <p>Respond to builder RFQs and quote requests</p>
          </div>
        </div>
        <div className="search-wrap">
          <MagnifyingGlass size={15} />
          <input className="search-input" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card warn"><span className="stat-label">Awaiting Response</span><span className="stat-value">{MOCK_ORDERS.filter(o => o.status === 'pending').length}</span></div>
        <div className="stat-card blue"><span className="stat-label">Quote Sent</span><span className="stat-value">{MOCK_ORDERS.filter(o => o.status === 'quoted').length}</span></div>
        <div className="stat-card good"><span className="stat-label">Accepted</span><span className="stat-value">{MOCK_ORDERS.filter(o => o.status === 'accepted').length}</span></div>
        <div className="stat-card"><span className="stat-label">Total Orders</span><span className="stat-value">{MOCK_ORDERS.length}</span></div>
      </div>

      <div className="filter-bar">
        {['all', 'pending', 'quoted', 'accepted', 'declined'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="orders-list">
        {filtered.length === 0 ? (
          <div className="empty-state"><ShoppingCart size={36} /><p>No orders match your filter.</p></div>
        ) : filtered.map(o => (
          <div key={o.id} className="order-card">
            <div className="order-header" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
              <div className="order-left">
                <span className="order-id">{o.id}</span>
                <div className="order-project">{o.project_name}</div>
                <div className="order-builder">from {o.builder_name}</div>
              </div>
              <div className="order-right">
                {o.deadline && o.status === 'pending' && (
                  <span className="deadline"><Clock size={12} /> Due {o.deadline}</span>
                )}
                <span className={`status-badge ${STATUS_STYLE[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                <span className="date">{new Date(o.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {expanded === o.id && (
              <div className="order-body">
                <div className="items-section">
                  <div className="items-label">Requested Items</div>
                  <table className="items-table">
                    <thead><tr><th>Material</th><th>Qty</th><th>Unit</th></tr></thead>
                    <tbody>
                      {o.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.name}</td>
                          <td>{item.qty}</td>
                          <td className="text-muted">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {o.status === 'pending' && (
                  <div className="order-actions">
                    <button className="btn-accept"><Check size={14} /> Submit Quote</button>
                    <button className="btn-decline"><X size={14} /> Decline</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .page { padding: 28px 32px; max-width: 900px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .search-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; }
        .search-input { border: none; outline: none; font-size: 0.8125rem; width: 180px; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: white; border-radius: 10px; padding: 14px 18px; border: 1px solid #e2e8f0; }
        .stat-card.warn { border-left: 3px solid #f59e0b; }
        .stat-card.good { border-left: 3px solid #10b981; }
        .stat-card.blue { border-left: 3px solid #2563eb; }
        .stat-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
        .stat-value { font-size: 1.4rem; font-weight: 700; color: #0f172a; }
        .filter-bar { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-btn { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 5px 14px; font-size: 0.8rem; font-weight: 500; cursor: pointer; color: #64748b; }
        .filter-btn.active { background: #eff6ff; border-color: #93c5fd; color: #2563eb; font-weight: 600; }
        .orders-list { display: flex; flex-direction: column; gap: 10px; }
        .order-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        .order-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; gap: 12px; flex-wrap: wrap; }
        .order-header:hover { background: #f8fafc; }
        .order-left { display: flex; flex-direction: column; gap: 2px; }
        .order-id { font-size: 0.7rem; font-family: monospace; color: #94a3b8; }
        .order-project { font-size: 0.9375rem; font-weight: 700; color: #0f172a; }
        .order-builder { font-size: 0.8rem; color: #64748b; }
        .order-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .deadline { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 600; color: #d97706; background: #fef3c7; padding: 3px 8px; border-radius: 20px; }
        .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .status-quoted { background: #eff6ff; color: #2563eb; }
        .status-accepted { background: #d1fae5; color: #059669; }
        .status-declined { background: #f1f5f9; color: #94a3b8; }
        .date { font-size: 0.75rem; color: #94a3b8; }
        .order-body { border-top: 1px solid #f1f5f9; padding: 16px 20px; }
        .items-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 10px; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin-bottom: 16px; }
        .items-table th { text-align: left; padding: 6px 10px; background: #f8fafc; font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }
        .items-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
        .text-muted { color: #94a3b8; }
        .order-actions { display: flex; gap: 10px; }
        .btn-accept { display: flex; align-items: center; gap: 6px; background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .btn-decline { display: flex; align-items: center; gap: 6px; background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .empty-state { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 60px; text-align: center; color: #94a3b8; }
        .empty-state p { margin-top: 12px; }
      `}</style>
    </div>
  );
}
