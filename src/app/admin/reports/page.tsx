'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Export, FileCsv, FilePdf, ChartBar, Calendar, Download } from '@phosphor-icons/react';

const REPORTS = [
  {
    id: 'revenue-monthly',
    title: 'Monthly Revenue Report',
    description: 'Subscription income, commissions, and refunds broken down by month',
    icon: ChartBar,
    formats: ['CSV', 'PDF'],
    lastRun: '2026-03-01',
  },
  {
    id: 'users-growth',
    title: 'User Growth Report',
    description: 'New signups, active users, churn rate, and tier distribution',
    icon: ChartBar,
    formats: ['CSV'],
    lastRun: '2026-03-15',
  },
  {
    id: 'supplier-activity',
    title: 'Supplier Activity Report',
    description: 'Product listings, RFQ responses, lead conversion rates per supplier',
    icon: ChartBar,
    formats: ['CSV', 'PDF'],
    lastRun: '2026-03-20',
  },
  {
    id: 'material-price-history',
    title: 'Material Price History',
    description: 'Price changes over time for all tracked materials with trend analysis',
    icon: ChartBar,
    formats: ['CSV'],
    lastRun: '2026-03-26',
  },
  {
    id: 'project-summary',
    title: 'Project Summary Report',
    description: 'Total projects created, BOQs generated, and estimated construction value',
    icon: ChartBar,
    formats: ['CSV', 'PDF'],
    lastRun: '2026-03-10',
  },
];

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year', 'Custom'];

export default function AdminReportsPage() {
  const { checking } = useAdminAuth();
  const [range, setRange] = useState('Last 30 days');
  const [generating, setGenerating] = useState<string | null>(null);

  if (checking) return <div className="admin-loading">Loading...</div>;

  const handleGenerate = (id: string, format: string) => {
    setGenerating(`${id}-${format}`);
    setTimeout(() => setGenerating(null), 1800);
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="header-left">
          <Export size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Reports & Exports</h1>
            <p>Generate and download platform data reports</p>
          </div>
        </div>
        <div className="range-select-wrap">
          <Calendar size={15} className="range-icon" />
          <select className="range-select" value={range} onChange={e => setRange(e.target.value)}>
            {DATE_RANGES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="reports-grid">
        {REPORTS.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.id} className="report-card">
              <div className="report-header">
                <div className="report-icon"><Icon size={20} weight="duotone" /></div>
                <div className="report-info">
                  <div className="report-title">{r.title}</div>
                  <div className="report-desc">{r.description}</div>
                </div>
              </div>
              <div className="report-footer">
                <span className="last-run">Last run: {r.lastRun}</span>
                <div className="format-btns">
                  {r.formats.map(fmt => {
                    const key = `${r.id}-${fmt}`;
                    const loading = generating === key;
                    return (
                      <button
                        key={fmt}
                        className={`fmt-btn ${fmt.toLowerCase()}`}
                        onClick={() => handleGenerate(r.id, fmt)}
                        disabled={loading}
                      >
                        {loading ? (
                          <span className="spinner" />
                        ) : fmt === 'CSV' ? (
                          <FileCsv size={14} />
                        ) : (
                          <FilePdf size={14} />
                        )}
                        {loading ? 'Generating...' : `Export ${fmt}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="scheduled-section">
        <div className="section-title">Scheduled Reports</div>
        <div className="scheduled-empty">
          <Export size={28} />
          <p>No scheduled reports configured yet.</p>
          <button className="btn-primary"><Download size={14} /> Schedule a Report</button>
        </div>
      </div>

      <style jsx>{`
        .admin-page { padding: 28px 32px; max-width: 1000px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #2563eb; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .range-select-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; }
        .range-icon { color: #64748b; }
        .range-select { border: none; outline: none; font-size: 0.8125rem; color: #1e293b; background: transparent; }
        .reports-grid { display: grid; gap: 14px; margin-bottom: 32px; }
        .report-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; }
        .report-header { display: flex; gap: 14px; margin-bottom: 16px; }
        .report-icon { width: 40px; height: 40px; background: #eff6ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #2563eb; flex-shrink: 0; }
        .report-info { flex: 1; }
        .report-title { font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .report-desc { font-size: 0.8rem; color: #64748b; line-height: 1.4; }
        .report-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .last-run { font-size: 0.75rem; color: #94a3b8; }
        .format-btns { display: flex; gap: 8px; }
        .fmt-btn { display: flex; align-items: center; gap: 6px; border: none; border-radius: 7px; padding: 7px 14px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .fmt-btn.csv { background: #d1fae5; color: #059669; }
        .fmt-btn.pdf { background: #fee2e2; color: #dc2626; }
        .fmt-btn:disabled { opacity: 0.6; cursor: wait; }
        .spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .scheduled-section { margin-top: 8px; }
        .section-title { font-size: 0.8125rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
        .scheduled-empty { background: white; border: 1px dashed #e2e8f0; border-radius: 12px; padding: 40px; text-align: center; color: #94a3b8; }
        .scheduled-empty p { margin: 12px 0 16px; font-size: 0.875rem; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .admin-loading { padding: 60px; text-align: center; color: #94a3b8; }
      `}</style>
    </div>
  );
}
