'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Wallet, ArrowUp, Check, X, MagnifyingGlass, Download } from '@phosphor-icons/react';

const MOCK_PAYOUTS = [
  { id: 'TXN-001', supplier: 'BuildMart Zimbabwe', amount: 340.00, type: 'Subscription', status: 'completed', date: '2026-03-25' },
  { id: 'TXN-002', supplier: 'Harare Steel Co.', amount: 120.00, type: 'Commission', status: 'pending', date: '2026-03-26' },
  { id: 'TXN-003', supplier: 'ZimPaint Supplies', amount: 85.00, type: 'Subscription', status: 'completed', date: '2026-03-24' },
  { id: 'TXN-004', supplier: 'Roofing Plus Ltd', amount: 200.00, type: 'Refund', status: 'failed', date: '2026-03-23' },
  { id: 'TXN-005', supplier: 'Cement World', amount: 340.00, type: 'Subscription', status: 'completed', date: '2026-03-22' },
  { id: 'TXN-006', supplier: 'Plumbing Hub', amount: 55.00, type: 'Commission', status: 'pending', date: '2026-03-26' },
];

const STATUS_STYLE: Record<string, string> = {
  completed: 'status-completed',
  pending: 'status-pending',
  failed: 'status-failed',
};

export default function AdminPayoutsPage() {
  const { checking } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  if (checking) return <div className="admin-loading">Loading...</div>;

  const filtered = MOCK_PAYOUTS.filter(t => {
    const matchSearch = t.supplier.toLowerCase().includes(search.toLowerCase()) || t.id.includes(search);
    const matchFilter = filter === 'all' || t.status === filter;
    return matchSearch && matchFilter;
  });

  const total = MOCK_PAYOUTS.reduce((s, t) => s + (t.status !== 'failed' ? t.amount : 0), 0);
  const pending = MOCK_PAYOUTS.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="header-left">
          <Wallet size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Payouts & Transactions</h1>
            <p>Track subscription revenue, commissions, and refunds</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-wrap">
            <MagnifyingGlass size={15} />
            <input className="search-input" placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-outline"><Download size={15} /> Export CSV</button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Collected</span>
          <span className="stat-value">${total.toLocaleString()}</span>
          <span className="stat-sub"><ArrowUp size={11} /> this month</span>
        </div>
        <div className="stat-card warn">
          <span className="stat-label">Pending Payout</span>
          <span className="stat-value">${pending.toFixed(2)}</span>
          <span className="stat-sub">{MOCK_PAYOUTS.filter(t => t.status === 'pending').length} transactions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <span className="stat-value">{MOCK_PAYOUTS.filter(t => t.status === 'completed').length}</span>
        </div>
        <div className="stat-card danger">
          <span className="stat-label">Failed</span>
          <span className="stat-value">{MOCK_PAYOUTS.filter(t => t.status === 'failed').length}</span>
        </div>
      </div>

      <div className="filter-bar">
        {['all', 'completed', 'pending', 'failed'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Supplier</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td className="txn-id">{t.id}</td>
                <td className="supplier-name">{t.supplier}</td>
                <td><span className="type-badge">{t.type}</span></td>
                <td className="amount">${t.amount.toFixed(2)}</td>
                <td><span className={`status-badge ${STATUS_STYLE[t.status]}`}>{t.status}</span></td>
                <td className="text-muted">{t.date}</td>
                <td>
                  {t.status === 'pending' && (
                    <span className="action-btns">
                      <button className="icon-btn green" title="Approve"><Check size={13} /></button>
                      <button className="icon-btn red" title="Reject"><X size={13} /></button>
                    </span>
                  )}
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
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .search-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; }
        .search-input { border: none; outline: none; font-size: 0.8125rem; width: 180px; }
        .btn-outline { display: flex; align-items: center; gap: 6px; background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .stat-card { background: white; border-radius: 10px; padding: 16px 20px; border: 1px solid #e2e8f0; }
        .stat-card.warn { border-left: 3px solid #f59e0b; }
        .stat-card.danger { border-left: 3px solid #ef4444; }
        .stat-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 6px; }
        .stat-value { display: block; font-size: 1.4rem; font-weight: 700; color: #0f172a; }
        .stat-sub { font-size: 0.7rem; color: #94a3b8; display: flex; align-items: center; gap: 3px; margin-top: 4px; }
        .filter-bar { display: flex; gap: 6px; margin-bottom: 16px; }
        .filter-btn { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 5px 14px; font-size: 0.8rem; font-weight: 500; cursor: pointer; color: #64748b; }
        .filter-btn.active { background: #eff6ff; border-color: #93c5fd; color: #2563eb; font-weight: 600; }
        .table-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .data-table th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
        .data-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
        .data-table tr:last-child td { border-bottom: none; }
        .txn-id { font-family: monospace; font-size: 0.75rem; color: #64748b; }
        .supplier-name { font-weight: 500; }
        .amount { font-weight: 700; color: #0f172a; }
        .text-muted { color: #94a3b8; }
        .type-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
        .status-badge { padding: 3px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
        .status-completed { background: #d1fae5; color: #059669; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .status-failed { background: #fee2e2; color: #dc2626; }
        .action-btns { display: flex; gap: 4px; }
        .icon-btn { background: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; cursor: pointer; color: #64748b; display: inline-flex; align-items: center; }
        .icon-btn.green { border-color: #bbf7d0; color: #16a34a; }
        .icon-btn.red { border-color: #fecaca; color: #dc2626; }
        .admin-loading { padding: 60px; text-align: center; color: #94a3b8; }
      `}</style>
    </div>
  );
}
