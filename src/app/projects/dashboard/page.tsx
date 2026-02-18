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
function ProjectsSubNav({ active }: { active: 'dashboard' | 'all' }) {
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

function MetricCard({
  label,
  value,
  sublabel,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  icon?: React.ReactNode;
}) {
  const toneStyles = {
    default: { borderColor: 'transparent', iconBg: '#f1f5f9', iconColor: '#64748b' },
    positive: { borderColor: '#16a34a', iconBg: '#dcfce7', iconColor: '#16a34a' },
    negative: { borderColor: '#ef4444', iconBg: '#fee2e2', iconColor: '#ef4444' },
    warning: { borderColor: '#f59e0b', iconBg: '#fef3c7', iconColor: '#f59e0b' },
  };
  const style = toneStyles[tone];

  return (
    <div className="metric-card" style={{ borderLeftColor: style.borderColor }}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {icon && (
          <span className="metric-icon" style={{ background: style.iconBg, color: style.iconColor }}>
            {icon}
          </span>
        )}
      </div>
      <div className="metric-value">{value}</div>
      {sublabel && <div className="metric-sublabel">{sublabel}</div>}
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

  return (
    <MainLayout title="My Projects">
      <ProjectsSubNav active="dashboard" />

      <div className="dashboard-page">
        {/* Hero Section */}
        <section className="dashboard-hero reveal">
          <div className="hero-content">
            <div className="hero-greeting">
              <span className="hero-label">Portfolio Overview</span>
              <h1>Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
              <p>Track your construction portfolio performance at a glance.</p>
            </div>
            <div className="hero-actions">
              <Link href="/boq/new">
                <Button icon={<Plus size={18} />}>New Project</Button>
              </Link>
              <Button variant="secondary" icon={<DownloadSimple size={18} />} onClick={() => window.print()}>
                Export Report
              </Button>
            </div>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="metrics-grid reveal" data-delay="1">
          <MetricCard
            label="Total Spend"
            value={formatValue(analytics.totalSpendUsd)}
            sublabel="Across all projects"
            icon={<CurrencyDollar size={18} />}
          />
          <MetricCard
            label="Total Budget"
            value={formatValue(analytics.totalBudgetUsd)}
            sublabel={`${analytics.totalProjects} project${analytics.totalProjects !== 1 ? 's' : ''}`}
            icon={<Gauge size={18} />}
          />
          <MetricCard
            label="Budget Variance"
            value={formatValue(Math.abs(analytics.budgetVarianceUsd))}
            sublabel={analytics.budgetVarianceUsd >= 0 ? 'Under budget' : 'Over budget'}
            tone={varianceTone}
            icon={analytics.budgetVarianceUsd >= 0 ? <TrendUp size={18} /> : <TrendDown size={18} />}
          />
          <MetricCard
            label="Avg. Completion"
            value={`${analytics.avgCompletionPct.toFixed(0)}%`}
            sublabel={`${analytics.activeProjects} active, ${analytics.completedProjects} done`}
            icon={<ChartLineUp size={18} />}
          />
        </section>

        {/* Projects Section - Featured */}
        <section className="projects-section reveal" data-delay="2">
          <div className="section-header">
            <h2 className="section-title">Your Projects</h2>
            <div className="section-actions">
              <Link href="/projects" className="see-all-btn">
                View All Projects <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className="projects-grid-featured">
            {analytics.projectSummaries.slice(0, 4).map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="project-card-featured">
                <div className="project-card-header">
                  <span className="project-name">{project.name}</span>
                  <span className={`project-badge ${project.status}`}>
                    {project.status === 'active' && <Clock size={12} />}
                    {project.status === 'completed' && <CheckCircle size={12} />}
                    {project.status}
                  </span>
                </div>
                <div className="project-card-body">
                  <div className="project-metric">
                    <span className="metric-label">Spent</span>
                    <span className="metric-value">{formatValue(project.spendUsd)}</span>
                  </div>
                  <div className="project-metric">
                    <span className="metric-label">Budget</span>
                    <span className="metric-value">{formatValue(project.budgetUsd)}</span>
                  </div>
                </div>
                <div className="project-compliance">
                  {project.soil_type && (
                    <span className="compliance-chip info">
                      {SOIL_LABELS[project.soil_type] || project.soil_type}
                    </span>
                  )}
                  {project.site_slope && (
                    <span className="compliance-chip info">
                      {SLOPE_LABELS[project.site_slope] || project.site_slope}
                    </span>
                  )}
                  <span className={`compliance-chip ${project.geotech_report_uploaded ? 'ok' : 'warn'}`}>
                    {project.geotech_report_uploaded ? 'Geotech Uploaded' : 'Geotech Pending'}
                  </span>
                </div>
                <div className="project-progress">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(project.completionPct, 100)}%`,
                        background: project.completionPct >= 100 ? '#16a34a' : '#3b82f6'
                      }}
                    />
                  </div>
                  <span className="progress-label">{project.completionPct.toFixed(0)}% complete</span>
                </div>
                <div className="project-card-action">
                  <span>Open Project</span>
                  <CaretRight size={14} />
                </div>
              </Link>
            ))}
            {analytics.projectSummaries.length === 0 && (
              <div className="empty-projects">
                <Buildings size={48} weight="light" />
                <p>No projects yet. Create your first project to get started.</p>
                <Link href="/boq/new">
                  <Button size="sm" icon={<Plus size={16} />}>Create Project</Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Analytics Grid */}
        <div className="dashboard-grid">
          {/* Budget Progress */}
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
                <div className="progress-ring">
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
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(spendProgress, 100)}%`,
                    background: spendProgress > 100 ? '#ef4444' : spendProgress > 75 ? '#f59e0b' : '#16a34a',
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Spend Timeline */}
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
              <div className="supplier-list">
                {analytics.topSuppliers.map((supplier) => (
                  <div key={supplier.name} className="supplier-row">
                    <div className="supplier-icon">
                      <Storefront size={16} weight="duotone" />
                    </div>
                    <span className="supplier-name">{supplier.name}</span>
                    <div className="supplier-bar">
                      <div className="bar-fill" style={{ width: `${supplier.sharePct}%` }} />
                    </div>
                    <span className="supplier-spend">{formatValue(supplier.spendUsd)}</span>
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
              <div className="purchases-list">
                {analytics.recentPurchases.slice(0, 5).map((purchase) => (
                  <div key={purchase.id} className="purchase-row">
                    <div className="purchase-icon">
                      <Package size={16} weight="duotone" />
                    </div>
                    <div className="purchase-info">
                      <span className="purchase-material">{purchase.materialName}</span>
                      <span className="purchase-meta">
                        {purchase.supplierName} • {new Date(purchase.purchasedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className="purchase-amount">{formatValue(purchase.totalUsd)}</span>
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
          gap: 24px;
          padding-bottom: 48px;
        }

        .dashboard-hero {
          background: linear-gradient(135deg, rgba(6, 20, 47, 0.95), rgba(46, 108, 246, 0.85));
          border-radius: 24px;
          padding: 32px;
          color: white;
        }

        .hero-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 24px;
        }

        .hero-label {
          font-size: 0.75rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          opacity: 0.75;
        }

        .dashboard-hero h1 {
          margin: 12px 0 8px;
          font-size: 2rem;
          font-weight: 700;
        }

        .dashboard-hero p {
          margin: 0;
          opacity: 0.85;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .metric-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-left-width: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .metric-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #64748b;
        }

        .metric-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
        }

        .metric-sublabel {
          font-size: 0.8rem;
          color: #94a3b8;
          margin-top: 4px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        :global(.spend-card),
        :global(.timeline-card) {
          grid-column: span 1;
        }

        .spend-content {
          padding: 20px;
        }

        .spend-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 20px;
        }

        .spend-label {
          font-size: 0.85rem;
          color: #64748b;
        }

        .spend-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
        }

        .progress-ring {
          width: 80px;
          height: 80px;
        }

        .progress-ring svg {
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

        .progress-bar {
          height: 8px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.5s ease;
        }

        .timeline-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 160px;
          padding: 20px;
          gap: 12px;
        }

        .bar-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
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
          border-radius: 6px 6px 0 0;
          transition: height 0.3s ease;
        }

        .bar-label {
          font-size: 0.7rem;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .bar-value {
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
        }

        .supplier-list,
        .purchases-list {
          padding: 12px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .supplier-row,
        .purchase-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .supplier-icon,
        .purchase-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #eff6ff;
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .supplier-name {
          flex: 1;
          font-weight: 500;
          color: #0f172a;
          min-width: 80px;
        }

        .supplier-bar {
          flex: 1;
          height: 6px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .supplier-bar .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1e40af);
          border-radius: 999px;
        }

        .supplier-spend {
          font-weight: 600;
          font-size: 0.85rem;
          color: #0f172a;
          min-width: 80px;
          text-align: right;
        }

        .purchase-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .purchase-material {
          font-weight: 500;
          color: #0f172a;
        }

        .purchase-meta {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .purchase-amount {
          font-weight: 600;
          color: #0f172a;
        }

        .empty-sub {
          padding: 24px;
          text-align: center;
          color: #94a3b8;
        }

        /* Featured Projects Section */
        .projects-section {
          background: white;
          border-radius: 20px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .section-actions {
          display: flex;
          gap: 12px;
        }

        .see-all-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          color: #3b82f6;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 8px;
          background: #eff6ff;
          transition: all 0.2s;
        }

        .see-all-btn:hover {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .projects-grid-featured {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .project-card-featured {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .project-card-featured:hover {
          background: white;
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
          transform: translateY(-2px);
        }

        .project-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .project-card-featured .project-name {
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
          flex: 1;
        }

        .project-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }

        .project-badge.active {
          background: #dcfce7;
          color: #16a34a;
        }

        .project-badge.completed {
          background: #dbeafe;
          color: #2563eb;
        }

        .project-badge.draft {
          background: #f1f5f9;
          color: #64748b;
        }

        .project-card-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .project-metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .project-metric .metric-label {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }

        .project-metric .metric-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .project-progress {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .project-compliance {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .compliance-chip {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .compliance-chip.info {
          color: #1d4ed8;
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .compliance-chip.ok {
          color: #166534;
          background: #dcfce7;
          border-color: #86efac;
        }

        .compliance-chip.warn {
          color: #92400e;
          background: #fef3c7;
          border-color: #fcd34d;
        }

        .progress-track {
          height: 6px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .project-progress .progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .progress-label {
          font-size: 0.75rem;
          color: #64748b;
        }

        .project-card-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          font-size: 0.85rem;
          font-weight: 500;
          color: #3b82f6;
        }

        .empty-projects {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          gap: 16px;
          color: #64748b;
        }

        .empty-projects p {
          margin: 0;
          max-width: 300px;
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .dashboard-page {
            gap: 16px;
          }

          .dashboard-hero {
            padding: 20px;
            border-radius: 16px;
          }

          .dashboard-hero h1 {
            font-size: 1.35rem;
          }

          .hero-actions {
            width: 100%;
            flex-direction: column;
          }

          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .metric-card {
            padding: 16px;
          }

          .metric-value {
            font-size: 1.25rem;
          }

          .projects-section {
            padding: 16px;
            border-radius: 16px;
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .section-title {
            font-size: 1.1rem;
          }

          .see-all-btn {
            width: 100%;
            justify-content: center;
          }

          .projects-grid-featured {
            grid-template-columns: 1fr;
          }

          .project-card-featured {
            padding: 16px;
          }

          .spend-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .progress-ring {
            align-self: center;
          }

          .timeline-bars {
            height: 120px;
            padding: 12px;
          }

          .bar-value {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .project-card-body {
            grid-template-columns: 1fr;
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
