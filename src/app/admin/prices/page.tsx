'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  Tag,
  MagnifyingGlass,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  Check,
  X,
  Robot,
} from '@phosphor-icons/react';

const MOCK_PRICES = [
  { id: 1, category: 'Cement', name: 'Portland Cement 50kg', unit: 'bag', price: 18.50, prev: 17.00, source: 'Scraper', lastUpdated: '2026-03-26' },
  { id: 2, category: 'Steel', name: 'Y12 Rebar 12m', unit: 'bar', price: 22.00, prev: 22.00, source: 'Manual', lastUpdated: '2026-03-25' },
  { id: 3, category: 'Roofing', name: 'IBR Sheet 3m', unit: 'sheet', price: 34.00, prev: 36.00, source: 'Scraper', lastUpdated: '2026-03-26' },
  { id: 4, category: 'Brick', name: 'Face Brick (each)', unit: 'unit', price: 0.45, prev: 0.42, source: 'Scraper', lastUpdated: '2026-03-24' },
  { id: 5, category: 'Paint', name: 'Dulux Interior 20L', unit: 'tin', price: 65.00, prev: 65.00, source: 'Manual', lastUpdated: '2026-03-20' },
  { id: 6, category: 'Plumbing', name: '110mm uPVC Pipe 6m', unit: 'length', price: 12.50, prev: 11.00, source: 'Scraper', lastUpdated: '2026-03-26' },
];

export default function AdminPricesPage() {
  const { checking } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  if (checking) return <div className="admin-loading">Loading...</div>;

  const filtered = MOCK_PRICES.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (item: typeof MOCK_PRICES[0]) => {
    setEditId(item.id);
    setEditValue(String(item.price));
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="header-left">
          <Tag size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Material Prices</h1>
            <p>Review scraper-collected prices and override when needed</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-wrap">
            <MagnifyingGlass size={15} />
            <input
              className="search-input"
              placeholder="Search materials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary">
            <Robot size={15} /> Run Scraper
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Items</span>
          <span className="stat-value">{MOCK_PRICES.length}</span>
        </div>
        <div className="stat-card up">
          <span className="stat-label">Price Increases</span>
          <span className="stat-value">{MOCK_PRICES.filter(p => p.price > p.prev).length}</span>
        </div>
        <div className="stat-card down">
          <span className="stat-label">Price Drops</span>
          <span className="stat-value">{MOCK_PRICES.filter(p => p.price < p.prev).length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last Scraped</span>
          <span className="stat-value">Today</span>
        </div>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Material</th>
              <th>Unit</th>
              <th>Current Price (USD)</th>
              <th>Change</th>
              <th>Source</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const diff = item.price - item.prev;
              const pct = item.prev > 0 ? ((diff / item.prev) * 100).toFixed(1) : '0';
              return (
                <tr key={item.id}>
                  <td><span className="category-badge">{item.category}</span></td>
                  <td className="material-name">{item.name}</td>
                  <td className="text-muted">{item.unit}</td>
                  <td className="price-cell">
                    {editId === item.id ? (
                      <span className="edit-row">
                        <input
                          className="price-input"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                        />
                        <button className="icon-btn green" onClick={() => setEditId(null)} aria-label="Save price">
                          <Check size={13} />
                        </button>
                        <button className="icon-btn red" onClick={() => setEditId(null)} aria-label="Cancel edit">
                          <X size={13} />
                        </button>
                      </span>
                    ) : (
                      <span className="price-val">${editId === item.id ? editValue : item.price.toFixed(2)}</span>
                    )}
                  </td>
                  <td>
                    {diff === 0 ? (
                      <span className="change neutral">—</span>
                    ) : diff > 0 ? (
                      <span className="change up">
                        <ArrowUp size={11} /> {pct}%
                      </span>
                    ) : (
                      <span className="change down">
                        <ArrowDown size={11} /> {Math.abs(Number(pct))}%
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`source-badge ${item.source === 'Scraper' ? 'auto' : 'manual'}`}>
                      {item.source}
                    </span>
                  </td>
                  <td className="text-muted">{item.lastUpdated}</td>
                  <td>
                    <button className="icon-btn" onClick={() => startEdit(item)} aria-label="Edit price">
                      <PencilSimple size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .admin-page { padding: 28px 32px; max-width: 1200px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .header-actions { display: flex; align-items: center; gap: 10px; }
        .search-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; }
        .search-input { border: none; outline: none; font-size: 0.8125rem; color: #1e293b; width: 180px; }
        .btn-primary { display: flex; align-items: center; gap: 6px; background: #2563eb; color: white; border: none; border-radius: 8px; padding: 8px 14px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
        .stat-card { background: white; border-radius: 10px; padding: 16px 20px; border: 1px solid #e2e8f0; }
        .stat-card.up { border-left: 3px solid #f59e0b; }
        .stat-card.down { border-left: 3px solid #10b981; }
        .stat-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 6px; }
        .stat-value { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
        .table-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
        .data-table th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
        .data-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
        .data-table tr:last-child td { border-bottom: none; }
        .category-badge { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
        .material-name { font-weight: 500; }
        .text-muted { color: #94a3b8; }
        .price-val { font-weight: 600; color: #0f172a; }
        .edit-row { display: flex; align-items: center; gap: 4px; }
        .price-input { width: 70px; border: 1px solid #93c5fd; border-radius: 5px; padding: 3px 7px; font-size: 0.8125rem; outline: none; }
        .change { display: inline-flex; align-items: center; gap: 3px; font-size: 0.75rem; font-weight: 600; padding: 2px 7px; border-radius: 20px; }
        .change.up { background: #fef3c7; color: #d97706; }
        .change.down { background: #d1fae5; color: #059669; }
        .change.neutral { color: #94a3b8; }
        .source-badge { font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
        .source-badge.auto { background: #eff6ff; color: #2563eb; }
        .source-badge.manual { background: #f0fdf4; color: #16a34a; }
        .icon-btn { background: none; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px; cursor: pointer; color: #64748b; display: inline-flex; align-items: center; }
        .icon-btn:hover { background: #f1f5f9; }
        .icon-btn.green { border-color: #bbf7d0; color: #16a34a; }
        .icon-btn.red { border-color: #fecaca; color: #dc2626; }
        .admin-loading { padding: 60px; text-align: center; color: #94a3b8; }
      `}</style>
    </div>
  );
}
