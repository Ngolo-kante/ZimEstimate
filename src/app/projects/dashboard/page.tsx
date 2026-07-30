'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useAuth } from '@/components/providers/AuthProvider';
import { useReveal } from '@/hooks/useReveal';
import { getPortfolioAnalytics, type PortfolioAnalyticsData } from '@/lib/services/analytics';
import {
  TrendUp,
  TrendDown,
  Buildings,
  CheckCircle,
  Clock,
  Package,
  Storefront,
  ArrowRight,
  Plus,
  Receipt,
  ChartLineUp,
  CurrencyDollar,
  Gauge,
  DownloadSimple,
  CaretRight,
  Folders,
  ChartBar,
  HardHat,
  MapPin,
  Lightning,
} from '@phosphor-icons/react';

const SOIL_LABELS: Record<string, string> = {
  sandy: 'Sandy',
  clay_black_mountain: 'Clay/Black Mountain',
  loam: 'Loam',
  rock: 'Rock',
};

const SLOPE_LABELS: Record<string, string> = {
  flat: 'Flat',
  gentle: 'Gentle Slope',
  moderate: 'Moderate Slope',
  steep: 'Steep',
};

// Sub-navigation for My Projects section
function ProjectsSubNav({ active }: { active: 'dashboard' | 'all' | 'quick' }) {
  return (
    <div className="projects-subnav">
      <nav className="subnav-tabs">
        <Link
          href="/projects/dashboard"
          className={`subnav-tab ${active === 'dashboard' ? 'active' : ''}`}
        >
          <ChartBar size={18} />
          Dashboard
        </Link>
        <Link
          href="/projects"
          className={`subnav-tab ${active === 'all' ? 'active' : ''}`}
        >
          <Folders size={18} />
          All Projects
        </Link>
        <Link
          href="/projects/quick"
          className={`subnav-tab ${active === 'quick' ? 'active' : ''}`}
        >
          <Lightning size={18} />
          Quick BOQs
        </Link>
      </nav>

      <style jsx>{`
        .projects-subnav {
          margin-bottom: 24px;
        }

        .subnav-tabs {
          display: flex;
          gap: 8px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 12px;
          width: fit-content;
        }

        .subnav-tab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          font-size: 0.9rem;
          font-weight: 500;
          color: #64748b;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .subnav-tab:hover {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.5);
        }

        .subnav-tab.active {
          background: white;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 480px) {
          .subnav-tabs {
            width: 100%;
          }

          .subnav-tab {
            flex: 1;
            justify-content: center;
            padding: 10px 12px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}

function DashboardContent() {
  const { profile } = useAuth();
  const { formatPrice, exchangeRate } = useCurrency();
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useReveal({ deps: [loading] });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await getPortfolioAnalytics();
      setAnalytics(data);
      setLoading(false);
    };
    load();
  }, []);

  const formatValue = (usd: number) => formatPrice(usd, usd * exchangeRate);

  const spendProgress = useMemo(() => {
    if (!analytics || analytics.totalBudgetUsd === 0) return 0;
    return Math.min(100, (analytics.totalSpendUsd / analytics.totalBudgetUsd) * 100);
  }, [analytics]);

  const varianceTone = useMemo(() => {
    if (!analytics) return 'default' as const;
    return analytics.budgetVarianceUsd >= 0 ? 'positive' as const : 'negative' as const;
  }, [analytics]);

  if (loading) {
    return (
      <MainLayout title="My Projects">
        <ProjectsSubNav active="dashboard" />
        <div className="dashboard-loading">
          <div className="spinner" />
          <span>Loading your dashboard...</span>
        </div>
        <style jsx>{`
          .dashboard-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: 16px;
            color: #64748b;
          }
          .spinner {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid #e2e8f0;
            border-top-color: #3b82f6;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </MainLayout>
    );
  }

  if (!analytics || analytics.totalProjects === 0) {
    return (
      <MainLayout title="My Projects">
        <ProjectsSubNav active="dashboard" />
        <div className="empty-dashboard">
          <Buildings size={64} weight="light" />
          <h2>Welcome to ZimEstimate</h2>
          <p>Create your first project to start tracking budgets and purchases.</p>
          <Link href="/boq/new">
            <Button icon={<Plus size={18} />}>Create Project</Button>
          </Link>
        </div>
        <style jsx>{`
          .empty-dashboard {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 500px;
            gap: 16px;
            text-align: center;
            color: #64748b;
          }
          .empty-dashboard h2 {
            margin: 0;
            color: #0f172a;
            font-size: 1.5rem;
          }
          .empty-dashboard p {
            max-width: 400px;
            margin: 0;
          }
        `}</style>
      </MainLayout>
    );
  }

  const toneColors = {
    default: { border: 'transparent', iconBg: '#f1f5f9', iconColor: '#64748b' },
    positive: { border: '#16a34a', iconBg: '#dcfce7', iconColor: '#16a34a' },
    negative: { border: '#ef4444', iconBg: '#fee2e2', iconColor: '#ef4444' },
    warning: { border: '#f59e0b', iconBg: '#fef3c7', iconColor: '#f59e0b' },
  };

  const kpis = [
    {
      label: 'Total Spend',
      value: formatValue(analytics.totalSpendUsd),
      sub: 'Across all projects',
      icon: <CurrencyDollar size={18} weight="duotone" />,
      tone: 'default' as const,
    },
    {
      label: 'Total Budget',
      value: formatValue(analytics.totalBudgetUsd),
      sub: `${analytics.totalProjects} project${analytics.totalProjects !== 1 ? 's' : ''}`,
      icon: <Gauge size={18} weight="duotone" />,
      tone: 'default' as const,
    },
    {
      label: 'Budget Variance',
      value: formatValue(Math.abs(analytics.budgetVarianceUsd)),
      sub: analytics.budgetVarianceUsd >= 0 ? 'Under budget' : 'Over budget',
      icon: analytics.budgetVarianceUsd >= 0 ? <TrendUp size={18} weight="duotone" /> : <TrendDown size={18} weight="duotone" />,
      tone: varianceTone,
    },
    {
      label: 'Avg. Completion',
      value: `${analytics.avgCompletionPct.toFixed(0)}%`,
      sub: `${analytics.activeProjects} active, ${analytics.completedProjects} done`,
      icon: <ChartLineUp size={18} weight="duotone" />,
      tone: 'default' as const,
    },
  ];

  return (
    <MainLayout title="My Projects">
      <ProjectsSubNav active="dashboard" />

      <div className="dashboard-page">
        {/* ── Slim Hero ── */}
        <section className="dash-hero reveal">
          <div className="hero-left">
            <div className="hero-avatar">
              <HardHat size={24} weight="fill" />
            </div>
            <div>
              <h1>Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
              <p>Your construction portfolio at a glance</p>
            </div>
          </div>
          <div className="hero-actions">
            <Link href="/boq/new">
              <Button icon={<Plus size={16} />}>New Project</Button>
            </Link>
            <Button variant="secondary" icon={<DownloadSimple size={16} />} onClick={() => window.print()}>
              Export
            </Button>
          </div>
        </section>

        {/* ── KPI Strip ── */}
        <section className="kpi-strip reveal" data-delay="1">
          {kpis.map((kpi) => {
            const colors = toneColors[kpi.tone];
            return (
              <div key={kpi.label} className="kpi-card" style={{ borderLeftColor: colors.border }}>
                <div className="kpi-top">
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-icon" style={{ background: colors.iconBg, color: colors.iconColor }}>
                    {kpi.icon}
                  </span>
                </div>
                <div className="kpi-value">{kpi.value}</div>
                <div className="kpi-sub">{kpi.sub}</div>
              </div>
            );
          })}
        </section>

        {/* ── Projects Table ── */}
        <section className="projects-panel reveal" data-delay="2">
          <div className="panel-head">
            <h2>Your Projects</h2>
            <Link href="/projects" className="see-all">
              All Projects <ArrowRight size={14} />
            </Link>
          </div>

          <div className="projects-table">
            {/* Header row — desktop only */}
            <div className="pt-row pt-header">
              <div className="pt-cell pt-name-cell">Project</div>
              <div className="pt-cell pt-status-cell">Status</div>
              <div className="pt-cell pt-spend-cell">Spent</div>
              <div className="pt-cell pt-budget-cell">Budget</div>
              <div className="pt-cell pt-progress-cell">Progress</div>
              <div className="pt-cell pt-action-cell" />
            </div>

            {analytics.projectSummaries.slice(0, 6).map((project) => {
              const pct = Math.min(project.completionPct, 100);
              const spendPct = project.budgetUsd > 0 ? Math.min((project.spendUsd / project.budgetUsd) * 100, 100) : 0;
              const overBudget = project.budgetUsd > 0 && project.spendUsd > project.budgetUsd;

              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="pt-row-link">
                  <div className="pt-row pt-data">
                    {/* Project Name + Location */}
                    <div className="pt-cell pt-name-cell">
                      <span className="pt-project-name">{project.name}</span>
                      {project.site_slope && (
                        <span className="pt-location">
                          <MapPin size={11} weight="fill" />
                          {SLOPE_LABELS[project.site_slope] || project.site_slope}
                          {project.soil_type ? ` · ${SOIL_LABELS[project.soil_type] || project.soil_type}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="pt-cell pt-status-cell">
                      <span className={`pt-badge ${project.status}`}>
                        {project.status === 'active' && <Clock size={11} />}
                        {project.status === 'completed' && <CheckCircle size={11} />}
                        {project.status}
                      </span>
                    </div>

                    {/* Spent */}
                    <div className="pt-cell pt-spend-cell">
                      <span className={`pt-money ${overBudget ? 'over' : ''}`}>{formatValue(project.spendUsd)}</span>
                      <div className="spend-micro-bar">
                        <div className="spend-micro-fill" style={{
                          width: `${spendPct}%`,
                          background: overBudget ? '#ef4444' : spendPct > 75 ? '#f59e0b' : '#3b82f6',
                        }} />
                      </div>
                    </div>

                    {/* Budget */}
                    <div className="pt-cell pt-budget-cell">
                      <span className="pt-money">{formatValue(project.budgetUsd)}</span>
                    </div>

                    {/* Progress */}
                    <div className="pt-cell pt-progress-cell">
                      <div className="pt-progress-ring" style={{ '--pct': `${pct * 3.6}deg` } as React.CSSProperties}>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="pt-cell pt-action-cell">
                      <span className="pt-arrow"><CaretRight size={16} /></span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {analytics.projectSummaries.length === 0 && (
              <div className="empty-projects">
                <Buildings size={40} weight="light" />
                <p>No projects yet.</p>
                <Link href="/boq/new">
                  <Button size="sm" icon={<Plus size={16} />}>Create Project</Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Analytics Grid ── */}
        <div className="analytics-grid">
          {/* Budget Health */}
          <Card className="spend-card reveal" data-delay="3">
            <CardHeader>
              <CardTitle>Budget Health</CardTitle>
              <CardBadge variant={analytics.budgetVarianceUsd >= 0 ? 'success' : 'warning'}>
                {analytics.budgetVarianceUsd >= 0 ? 'On Track' : 'At Risk'}
              </CardBadge>
            </CardHeader>
            <div className="spend-content">
              <div className="spend-row">
                <div>
                  <div className="spend-label">Total Spent</div>
                  <div className="spend-value">{formatValue(analytics.totalSpendUsd)}</div>
                </div>
                <div>
                  <div className="spend-label">Total Budget</div>
                  <div className="spend-value">{formatValue(analytics.totalBudgetUsd)}</div>
                </div>
                <div className="progress-ring-lg">
                  <svg viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="42" />
                    <circle
                      className="ring-fill"
                      cx="50"
                      cy="50"
                      r="42"
                      style={{
                        strokeDasharray: `${spendProgress * 2.64} 264`,
                        stroke: spendProgress > 100 ? '#ef4444' : spendProgress > 75 ? '#f59e0b' : '#16a34a',
                      }}
                    />
                    <text x="50" y="54" className="ring-text">{spendProgress.toFixed(0)}%</text>
                  </svg>
                </div>
              </div>
              <div className="progress-bar-lg">
                <div
                  className="pb-fill"
                  style={{
                    width: `${Math.min(spendProgress, 100)}%`,
                    background: spendProgress > 100 ? '#ef4444' : spendProgress > 75 ? '#f59e0b' : '#16a34a',
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Monthly Spend */}
          <Card className="timeline-card reveal" data-delay="4">
            <CardHeader>
              <CardTitle>Monthly Spend</CardTitle>
              <CardBadge variant="accent">Last 6 Months</CardBadge>
            </CardHeader>
            <div className="timeline-bars">
              {analytics.spendTimeline.map((point) => {
                const maxSpend = Math.max(...analytics.spendTimeline.map((p) => p.spendUsd), 1);
                const height = (point.spendUsd / maxSpend) * 100;
                return (
                  <div key={point.month} className="bar-column">
                    <div className="bar-wrapper">
                      <div className="bar-fill" style={{ height: `${height}%` }} />
                    </div>
                    <span className="bar-label">{point.month.split(' ')[0]}</span>
                    <span className="bar-value">{formatValue(point.spendUsd)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Suppliers */}
          <Card className="suppliers-card reveal" data-delay="5">
            <CardHeader>
              <CardTitle>Top Suppliers</CardTitle>
              <CardBadge variant="accent">By Spend</CardBadge>
            </CardHeader>
            {analytics.topSuppliers.length === 0 ? (
              <div className="empty-sub">No purchases recorded yet.</div>
            ) : (
              <div className="list-section">
                {analytics.topSuppliers.map((supplier) => (
                  <div key={supplier.name} className="list-row">
                    <div className="list-icon supplier-icon">
                      <Storefront size={15} weight="duotone" />
                    </div>
                    <span className="list-name">{supplier.name}</span>
                    <div className="list-bar">
                      <div className="bar-fill" style={{ width: `${supplier.sharePct}%` }} />
                    </div>
                    <span className="list-amount">{formatValue(supplier.spendUsd)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Purchases */}
          <Card className="purchases-card reveal" data-delay="6">
            <CardHeader>
              <CardTitle>Recent Purchases</CardTitle>
              <Receipt size={18} weight="duotone" />
            </CardHeader>
            {analytics.recentPurchases.length === 0 ? (
              <div className="empty-sub">No purchases recorded yet.</div>
            ) : (
              <div className="list-section">
                {analytics.recentPurchases.slice(0, 5).map((purchase) => (
                  <div key={purchase.id} className="list-row">
                    <div className="list-icon purchase-icon">
                      <Package size={15} weight="duotone" />
                    </div>
                    <div className="list-info">
                      <span className="list-name">{purchase.materialName}</span>
                      <span className="list-meta">
                        {purchase.supplierName} • {new Date(purchase.purchasedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className="list-amount">{formatValue(purchase.totalUsd)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <style jsx>{`
        .dashboard-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 48px;
        }

        /* ── Hero ── */
        .dash-hero {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent-dark) 50%, var(--color-accent) 100%);
          border-radius: 20px;
          padding: 24px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          color: white;
        }

        .hero-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .hero-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dash-hero h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .dash-hero p {
          margin: 4px 0 0;
          font-size: 0.875rem;
          opacity: 0.8;
        }

        .hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ── KPI Strip ── */
        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .kpi-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-left-width: 4px;
          border-radius: 14px;
          padding: 18px 20px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
        }

        .kpi-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .kpi-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .kpi-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kpi-value {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .kpi-sub {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-top: 4px;
        }

        /* ── Projects Panel ── */
        .projects-panel {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .panel-head h2 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .see-all {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #3b82f6;
          text-decoration: none;
          padding: 6px 14px;
          border-radius: 8px;
          background: #eff6ff;
          transition: all 0.2s;
        }

        .see-all:hover {
          background: #dbeafe;
          color: #1d4ed8;
        }

        /* ── Projects Table ── */
        .projects-table {
          display: flex;
          flex-direction: column;
        }

        .pt-row {
          display: grid;
          grid-template-columns: 2fr 0.8fr 1fr 1fr 0.7fr 40px;
          align-items: center;
          gap: 8px;
          padding: 0 24px;
          min-height: 56px;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.12s ease;
        }

        .pt-row-link {
          display: block;
          color: inherit;
          text-decoration: none;
        }

        .pt-cell {
          min-width: 0;
        }

        .pt-status-cell,
        .pt-progress-cell {
          justify-self: center;
        }

        .pt-action-cell {
          display: flex;
          justify-content: flex-end;
        }

        .pt-spend-cell,
        .pt-budget-cell {
          text-align: right;
        }

        .pt-spend-cell .spend-micro-bar {
          margin-left: auto;
          max-width: 160px;
        }

        .pt-header {
          min-height: 40px;
        }

        .pt-header .pt-cell {
          font-size: 0.7rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .pt-header .pt-status-cell,
        .pt-header .pt-progress-cell,
        .pt-header .pt-action-cell {
          justify-self: center;
        }

        .pt-data:hover {
          background: #f8fafc;
        }

        .pt-row-link:last-child .pt-data {
          border-bottom: none;
        }

        .pt-project-name {
          font-size: 0.92rem;
          font-weight: 600;
          color: #0f172a;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pt-location {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 0.7rem;
          color: #94a3b8;
          margin-top: 2px;
        }

        /* Status Badge */
        .pt-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 4px 10px;
          border-radius: 99px;
          white-space: nowrap;
        }

        .pt-badge.draft {
          background: #f1f5f9;
          color: #64748b;
        }

        .pt-badge.active {
          background: #dcfce7;
          color: #16a34a;
        }

        .pt-badge.completed {
          background: #dbeafe;
          color: #2563eb;
        }

        /* Money cells */
        .pt-money {
          font-size: 0.92rem;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
        }

        .pt-money.over {
          color: #ef4444;
        }

        .spend-micro-bar {
          height: 3px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
          margin-top: 5px;
        }

        .spend-micro-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.4s ease;
        }

        /* Mini progress ring */
        .pt-progress-ring {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: conic-gradient(
            #3b82f6 0deg,
            #3b82f6 var(--pct),
            #e2e8f0 var(--pct),
            #e2e8f0 360deg
          );
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .pt-progress-ring::before {
          content: '';
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
        }

        .pt-progress-ring span {
          position: relative;
          z-index: 1;
          font-size: 0.65rem;
          font-weight: 800;
          color: #334155;
        }

        .pt-arrow {
          display: flex;
          align-items: center;
          color: #cbd5e1;
          transition: color 0.2s ease, transform 0.2s ease;
        }

        .pt-data:hover .pt-arrow {
          color: #3b82f6;
          transform: translateX(3px);
        }

        .empty-projects {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          gap: 12px;
          color: #94a3b8;
        }

        .empty-projects p {
          margin: 0;
        }

        /* ── Analytics Grid ── */
        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .spend-content {
          padding: 20px;
        }

        .spend-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 16px;
        }

        .spend-label {
          font-size: 0.82rem;
          color: #64748b;
        }

        .spend-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
        }

        .progress-ring-lg {
          width: 72px;
          height: 72px;
          flex-shrink: 0;
        }

        .progress-ring-lg svg {
          transform: rotate(-90deg);
        }

        .ring-bg {
          fill: none;
          stroke: #e2e8f0;
          stroke-width: 8;
        }

        .ring-fill {
          fill: none;
          stroke-width: 8;
          stroke-linecap: round;
          transition: stroke-dasharray 0.5s ease;
        }

        .ring-text {
          fill: #0f172a;
          font-size: 18px;
          font-weight: 700;
          text-anchor: middle;
          transform: rotate(90deg);
          transform-origin: 50% 50%;
        }

        .progress-bar-lg {
          height: 7px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
        }

        .pb-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.5s ease;
        }

        /* Timeline bars */
        .timeline-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 160px;
          padding: 16px 20px;
          gap: 10px;
        }

        .bar-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          height: 100%;
        }

        .bar-wrapper {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
        }

        .bar-wrapper .bar-fill {
          width: 100%;
          min-height: 4px;
          background: linear-gradient(180deg, #3b82f6, #1e40af);
          border-radius: 5px 5px 0 0;
          transition: height 0.3s ease;
        }

        .bar-label {
          font-size: 0.68rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-weight: 600;
        }

        .bar-value {
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
        }

        /* Shared list section */
        .list-section {
          padding: 8px 20px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .list-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .list-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .supplier-icon {
          background: #eff6ff;
          color: #3b82f6;
        }

        .purchase-icon {
          background: #f0fdf4;
          color: #16a34a;
        }

        .list-name {
          font-size: 0.88rem;
          font-weight: 500;
          color: #0f172a;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .list-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .list-meta {
          font-size: 0.72rem;
          color: #94a3b8;
        }

        .list-bar {
          flex: 1;
          height: 5px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
        }

        .list-bar .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1e40af);
          border-radius: 99px;
        }

        .list-amount {
          font-weight: 700;
          font-size: 0.85rem;
          color: #0f172a;
          min-width: 70px;
          text-align: right;
          white-space: nowrap;
        }

        .empty-sub {
          padding: 24px;
          text-align: center;
          color: #94a3b8;
          font-size: 0.88rem;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .analytics-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .dashboard-page {
            gap: 14px;
          }

          .dash-hero {
            padding: 18px 20px;
            border-radius: 16px;
            flex-direction: column;
            align-items: stretch;
          }

          .dash-hero h1 {
            font-size: 1.2rem;
          }

          .hero-actions {
            width: 100%;
          }

          .kpi-strip {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .kpi-card {
            padding: 14px 16px;
          }

          .kpi-value {
            font-size: 1.15rem;
          }

          /* Table → card-like rows on mobile */
          .pt-header {
            display: none;
          }

          .pt-row.pt-data {
            grid-template-columns: 1fr auto auto;
            grid-template-rows: auto auto;
            gap: 6px 12px;
            padding: 14px 18px;
          }

          .pt-name-cell {
            grid-column: 1 / 3;
          }

          .pt-status-cell {
            grid-column: 3;
            grid-row: 1;
            justify-self: end;
          }

          .pt-spend-cell {
            grid-column: 1;
            grid-row: 2;
          }

          .pt-budget-cell {
            grid-column: 2;
            grid-row: 2;
          }

          .pt-progress-cell {
            grid-column: 3;
            grid-row: 2;
            justify-self: end;
          }

          .pt-action-cell {
            display: none;
          }

          .spend-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .progress-ring-lg {
            align-self: center;
          }

          .timeline-bars {
            height: 120px;
            padding: 12px;
          }

          .bar-value {
            display: none;
          }

          .panel-head {
            padding: 14px 18px;
          }

          .pt-row {
            padding: 0 18px;
          }
        }

        @media (max-width: 480px) {
          .kpi-strip {
            grid-template-columns: 1fr;
          }

          .pt-progress-ring {
            width: 32px;
            height: 32px;
          }

          .pt-progress-ring::before {
            width: 24px;
            height: 24px;
          }

          .pt-progress-ring span {
            font-size: 0.6rem;
          }
        }
      `}</style>
    </MainLayout>
  );
}

export default function ProjectsDashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
