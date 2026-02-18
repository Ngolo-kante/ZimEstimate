'use client';

import { useMemo } from 'react';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { BOQItem, PurchaseRecord } from '@/lib/database.types';
import {
  Wallet,
  TrendUp,
  TrendDown,
  Warning,
  Package,
  ShoppingCart,
  ChartLine,
  ArrowRight,
  CheckCircle,
  Clock,
  Cube,
} from '@phosphor-icons/react';

interface ProjectKPIDashboardProps {
  items: BOQItem[];
  purchases: PurchaseRecord[];
  usageByItem: Record<string, number>;
  totalBudget: number;
  onNavigate?: (view: string) => void;
}

interface KPICard {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  action?: { label: string; onClick: () => void };
}

export default function ProjectKPIDashboard({
  items,
  purchases,
  usageByItem,
  totalBudget,
  onNavigate,
}: ProjectKPIDashboardProps) {
  const { formatPrice, exchangeRate } = useCurrency();

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    // Budget & Spending
    const estimatedTotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price_usd) || 0;
      return sum + qty * price;
    }, 0);

    const actualTotal = items.reduce((sum, item) => {
      const qty = Number(item.actual_quantity ?? item.quantity) || 0;
      const price = Number(item.actual_price_usd ?? item.unit_price_usd) || 0;
      return sum + qty * price;
    }, 0);

    const purchasedTotal = items
      .filter(item => item.is_purchased)
      .reduce((sum, item) => {
        const qty = Number(item.actual_quantity ?? item.quantity) || 0;
        const price = Number(item.actual_price_usd ?? item.unit_price_usd) || 0;
        return sum + qty * price;
      }, 0);

    const budgetVariance = actualTotal - estimatedTotal;
    const budgetVariancePercent = estimatedTotal > 0 ? (budgetVariance / estimatedTotal) * 100 : 0;

    // Purchase status counts
    const purchasedItems = items.filter(i => i.is_purchased).length;
    const pendingItems = items.filter(i => !i.is_purchased).length;
    const completionRate = items.length > 0 ? (purchasedItems / items.length) * 100 : 0;

    // Over-purchase detection
    const overPurchasedItems = items.filter(item => {
      const estimatedQty = Number(item.quantity) || 0;
      const actualQty = Number(item.actual_quantity) || 0;
      return actualQty > estimatedQty * 1.05; // 5% tolerance
    });

    const overPurchaseValue = overPurchasedItems.reduce((sum, item) => {
      const estimatedQty = Number(item.quantity) || 0;
      const actualQty = Number(item.actual_quantity) || 0;
      const price = Number(item.actual_price_usd ?? item.unit_price_usd) || 0;
      return sum + (actualQty - estimatedQty) * price;
    }, 0);

    // Usage stats
    const totalUsage = Object.values(usageByItem).reduce((sum, u) => sum + u, 0);
    const itemsWithUsage = Object.keys(usageByItem).length;
    const usageValue = items.reduce((sum, item) => {
      const usage = usageByItem[item.id] || 0;
      const price = Number(item.actual_price_usd ?? item.unit_price_usd) || 0;
      return sum + usage * price;
    }, 0);

    // Monthly spending (from purchases)
    const now = new Date();
    const thisMonth = purchases.filter(p => {
      const pDate = new Date(p.purchased_at);
      return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
    });
    const lastMonth = purchases.filter(p => {
      const pDate = new Date(p.purchased_at);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return pDate.getMonth() === lastMonthDate.getMonth() && pDate.getFullYear() === lastMonthDate.getFullYear();
    });

    const thisMonthSpending = thisMonth.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price_usd), 0);
    const lastMonthSpending = lastMonth.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unit_price_usd), 0);
    const monthlyTrend = lastMonthSpending > 0
      ? ((thisMonthSpending - lastMonthSpending) / lastMonthSpending) * 100
      : 0;

    // Remaining budget
    const remainingBudget = totalBudget - purchasedTotal;
    const budgetUtilization = totalBudget > 0 ? (purchasedTotal / totalBudget) * 100 : 0;

    return {
      estimatedTotal,
      actualTotal,
      purchasedTotal,
      budgetVariance,
      budgetVariancePercent,
      purchasedItems,
      pendingItems,
      completionRate,
      overPurchasedItems,
      overPurchaseValue,
      totalUsage,
      itemsWithUsage,
      usageValue,
      thisMonthSpending,
      lastMonthSpending,
      monthlyTrend,
      remainingBudget,
      budgetUtilization,
    };
  }, [items, purchases, usageByItem, totalBudget]);

  const kpiCards: KPICard[] = [
    {
      label: 'Budget vs Actual',
      value: formatPrice(stats.actualTotal, stats.actualTotal * exchangeRate),
      subValue: `Est: ${formatPrice(stats.estimatedTotal, stats.estimatedTotal * exchangeRate)}`,
      trend: stats.budgetVariance > 0 ? 'up' : stats.budgetVariance < 0 ? 'down' : 'neutral',
      trendValue: `${stats.budgetVariance >= 0 ? '+' : ''}${stats.budgetVariancePercent.toFixed(1)}%`,
      icon: <Wallet size={22} weight="duotone" />,
      color: stats.budgetVariance > 0 ? 'orange' : 'green',
    },
    {
      label: 'Purchased Items',
      value: `${stats.purchasedItems}/${items.length}`,
      subValue: `${stats.completionRate.toFixed(0)}% complete`,
      icon: <ShoppingCart size={22} weight="duotone" />,
      color: 'blue',
      action: onNavigate ? { label: 'View All', onClick: () => onNavigate('procurement') } : undefined,
    },
    {
      label: 'Monthly Spending',
      value: formatPrice(stats.thisMonthSpending, stats.thisMonthSpending * exchangeRate),
      subValue: 'This month',
      trend: stats.monthlyTrend > 0 ? 'up' : stats.monthlyTrend < 0 ? 'down' : 'neutral',
      trendValue: stats.lastMonthSpending > 0 ? `${stats.monthlyTrend >= 0 ? '+' : ''}${stats.monthlyTrend.toFixed(0)}%` : undefined,
      icon: <ChartLine size={22} weight="duotone" />,
      color: 'purple',
    },
    {
      label: 'Remaining Budget',
      value: formatPrice(stats.remainingBudget, stats.remainingBudget * exchangeRate),
      subValue: `${stats.budgetUtilization.toFixed(0)}% utilized`,
      icon: <Cube size={22} weight="duotone" />,
      color: stats.remainingBudget < 0 ? 'red' : 'green',
    },
  ];

  return (
    <div className="kpi-dashboard">
      {/* Main KPI Grid */}
      <div className="kpi-grid">
        {kpiCards.map((kpi, index) => (
          <div key={index} className={`kpi-card kpi-${kpi.color}`}>
            <div className="kpi-header">
              <div className={`kpi-icon icon-${kpi.color}`}>{kpi.icon}</div>
              {kpi.trend && kpi.trendValue && (
                <div className={`kpi-trend trend-${kpi.trend}`}>
                  {kpi.trend === 'up' ? <TrendUp size={14} /> : kpi.trend === 'down' ? <TrendDown size={14} /> : null}
                  <span>{kpi.trendValue}</span>
                </div>
              )}
            </div>
            <div className="kpi-content">
              <span className="kpi-label">{kpi.label}</span>
              <span className="kpi-value">{kpi.value}</span>
              {kpi.subValue && <span className="kpi-sub">{kpi.subValue}</span>}
            </div>
            {kpi.action && (
              <button className="kpi-action" onClick={kpi.action.onClick}>
                {kpi.action.label}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="stats-row">
        {/* Over-purchase Warning */}
        {stats.overPurchasedItems.length > 0 && (
          <div className="stat-alert alert-warning">
            <Warning size={20} weight="fill" />
            <div className="alert-content">
              <strong>{stats.overPurchasedItems.length} over-purchased items</strong>
              <span>Excess value: {formatPrice(stats.overPurchaseValue, stats.overPurchaseValue * exchangeRate)}</span>
            </div>
            {onNavigate && (
              <button className="alert-action" onClick={() => onNavigate('procurement')}>
                Review
              </button>
            )}
          </div>
        )}

        {/* Usage Summary */}
        <div className="stat-card">
          <div className="stat-icon icon-teal">
            <Package size={18} weight="duotone" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Materials Used</span>
            <span className="stat-value">{stats.itemsWithUsage} items</span>
            <span className="stat-sub">Value: {formatPrice(stats.usageValue, stats.usageValue * exchangeRate)}</span>
          </div>
          {onNavigate && (
            <button className="stat-action" onClick={() => onNavigate('usage')}>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Pending Items */}
        <div className="stat-card">
          <div className="stat-icon icon-amber">
            <Clock size={18} weight="duotone" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pending Purchase</span>
            <span className="stat-value">{stats.pendingItems} items</span>
            <span className="stat-sub">
              {formatPrice(
                stats.estimatedTotal - stats.purchasedTotal,
                (stats.estimatedTotal - stats.purchasedTotal) * exchangeRate
              )}
            </span>
          </div>
          {onNavigate && (
            <button className="stat-action" onClick={() => onNavigate('procurement')}>
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Completion Status */}
        <div className="stat-card">
          <div className="stat-icon icon-emerald">
            <CheckCircle size={18} weight="duotone" />
          </div>
          <div className="stat-content">
            <span className="stat-label">Completion</span>
            <span className="stat-value">{stats.completionRate.toFixed(0)}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(stats.completionRate, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .kpi-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s ease;
        }

        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
        }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .kpi-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-blue { background: #eff6ff; color: #3b82f6; }
        .icon-green { background: #f0fdf4; color: #22c55e; }
        .icon-orange { background: #fff7ed; color: #f97316; }
        .icon-red { background: #fef2f2; color: #ef4444; }
        .icon-purple { background: #faf5ff; color: #a855f7; }
        .icon-teal { background: #f0fdfa; color: #14b8a6; }
        .icon-amber { background: #fffbeb; color: #f59e0b; }
        .icon-emerald { background: #ecfdf5; color: #10b981; }

        .kpi-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .trend-up { background: #fef2f2; color: #ef4444; }
        .trend-down { background: #f0fdf4; color: #22c55e; }
        .trend-neutral { background: #f1f5f9; color: #64748b; }

        .kpi-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .kpi-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .kpi-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .kpi-sub {
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .kpi-action {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #3b82f6;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: auto;
        }

        .kpi-action:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .stat-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          grid-column: span 2;
        }

        .alert-warning {
          background: linear-gradient(135deg, #fef3c7, #fef9c3);
          border: 1px solid #fcd34d;
          color: #92400e;
        }

        .alert-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .alert-content strong {
          font-size: 0.9rem;
        }

        .alert-content span {
          font-size: 0.8rem;
          opacity: 0.8;
        }

        .alert-action {
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid #fcd34d;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #92400e;
          cursor: pointer;
          transition: all 0.2s;
        }

        .alert-action:hover {
          background: #ffffff;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }

        .stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .stat-value {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .stat-sub {
          font-size: 0.75rem;
          color: #64748b;
        }

        .stat-action {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          border: none;
          border-radius: 6px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .stat-action:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
          margin-top: 4px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #34d399);
          border-radius: 99px;
          transition: width 0.3s ease;
        }

        @media (max-width: 1024px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }

          .stat-alert {
            grid-column: span 1;
          }

          .kpi-value {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
