'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { getRevenueMetrics, type RevenueMetrics } from '@/lib/services/admin-analytics';
import {
  ArrowLeft,
  CurrencyDollar,
  TrendUp,
  Users,
  ArrowUp,
  ArrowDown,
} from '@phosphor-icons/react';

export default function AdminRevenuePage() {
  const { adminId, checking } = useAdminAuth();
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminId) return;
    getRevenueMetrics().then((m) => {
      setMetrics(m);
      setLoading(false);
    });
  }, [adminId]);

  if (checking || loading) {
    return <div className="admin-loading">Loading revenue data...</div>;
  }

  const m = metrics!;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <Link href="/admin/suppliers" className="back-link">
          <ArrowLeft size={18} /> Admin
        </Link>
        <h1>Revenue Dashboard</h1>
      </div>

      <div className="metrics-grid">
        <Card>
          <CardContent>
            <div className="metric-label">Monthly Recurring Revenue</div>
            <div className="metric-value">
              <CurrencyDollar size={20} />
              {m.mrr.toLocaleString()}
            </div>
            <div className="metric-sub">MRR</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="metric-label">Annual Recurring Revenue</div>
            <div className="metric-value">
              <TrendUp size={20} />
              ${m.arr.toLocaleString()}
            </div>
            <div className="metric-sub">ARR (projected)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="metric-label">Active Paid Subscribers</div>
            <div className="metric-value">
              <Users size={20} />
              {m.totalActiveSubscribers}
            </div>
            <div className="metric-sub">{m.newSubscriptions30d} new in last 30d</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="metric-label">Churn (30 days)</div>
            <div className="metric-value churn">
              <ArrowDown size={20} />
              {m.churnCount30d}
            </div>
            <div className="metric-sub">Cancelled subscriptions</div>
          </CardContent>
        </Card>
      </div>

      {/* Subscribers by plan */}
      <Card className="plan-breakdown">
        <CardHeader>
          <CardTitle>Subscribers by Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="plan-bars">
            {(
              [
                { id: 'basic', label: 'Basic', color: '#94a3b8', price: 0 },
                { id: 'pro', label: 'Pro', color: '#1e40af', price: 15 },
                { id: 'premium', label: 'Premium', color: '#7c3aed', price: 35 },
              ] as const
            ).map((plan) => {
              const count = m.subscribersByPlan[plan.id] ?? 0;
              const total =
                (m.subscribersByPlan.basic ?? 0) +
                (m.subscribersByPlan.pro ?? 0) +
                (m.subscribersByPlan.premium ?? 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={plan.id} className="plan-bar-row">
                  <div className="plan-bar-label">
                    <span className="plan-dot" style={{ background: plan.color }} />
                    {plan.label} {plan.price > 0 ? `($${plan.price}/mo)` : '(Free)'}
                  </div>
                  <div className="plan-bar-track">
                    <div
                      className="plan-bar-fill"
                      style={{ width: `${pct}%`, background: plan.color }}
                    />
                  </div>
                  <div className="plan-bar-count">{count}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {m.recentPayments.length === 0 ? (
            <p className="empty-state">No payments yet.</p>
          ) : (
            <div className="payments-table">
              <div className="payments-header">
                <span>Date</span>
                <span>Supplier</span>
                <span>Amount</span>
                <span>Provider</span>
                <span>Status</span>
              </div>
              {m.recentPayments.map((p) => (
                <div key={p.id} className="payment-row">
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  <span className="mono">{p.supplier_id.slice(0, 8)}…</span>
                  <span className="bold">
                    {p.currency === 'USD' ? '$' : 'ZWG '}
                    {Number(p.amount).toFixed(2)}
                  </span>
                  <span>{p.payment_provider}</span>
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <style jsx>{`
        .admin-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .admin-loading { text-align: center; padding: 60px; color: #64748b; }
        .admin-header { margin-bottom: 28px; }
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          color: #64748b; font-size: 14px; text-decoration: none; margin-bottom: 10px;
        }
        .back-link:hover { color: #1e40af; }
        h1 { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; }
        .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        .metric-label { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
        .metric-value { display: flex; align-items: center; gap: 8px; font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .metric-value.churn { color: #dc2626; }
        .metric-sub { font-size: 12px; color: #94a3b8; }
        .plan-breakdown { margin-bottom: 20px; }
        .plan-bars { display: flex; flex-direction: column; gap: 14px; }
        .plan-bar-row { display: flex; align-items: center; gap: 12px; }
        .plan-bar-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #334155; min-width: 180px; }
        .plan-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .plan-bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
        .plan-bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s; }
        .plan-bar-count { font-size: 14px; font-weight: 600; color: #334155; min-width: 30px; text-align: right; }
        .empty-state { color: #94a3b8; text-align: center; padding: 24px; }
        .payments-table { display: flex; flex-direction: column; }
        .payments-header {
          display: grid; grid-template-columns: 1fr 1.5fr 1fr 1fr 1fr;
          padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; border-bottom: 1px solid #f1f5f9;
        }
        .payment-row {
          display: grid; grid-template-columns: 1fr 1.5fr 1fr 1fr 1fr;
          padding: 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f8fafc; align-items: center;
        }
        .payment-row:last-child { border-bottom: none; }
        .bold { font-weight: 600; color: #1e293b; }
        .mono { font-family: monospace; font-size: 12px; color: #64748b; }
        .status-badge {
          display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600;
        }
        .status-succeeded { background: #dcfce7; color: #16a34a; }
        .status-pending { background: #fef3c7; color: #b45309; }
        .status-failed { background: #fef2f2; color: #dc2626; }
        @media (max-width: 768px) {
          .metrics-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
