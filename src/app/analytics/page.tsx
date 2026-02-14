'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import ProjectPickerModal from '@/components/ui/ProjectPickerModal';
import { ProgressBar, default as ProgressRing } from '@/components/ui/ProgressRing';
import PriceSparkline from '@/components/ui/PriceSparkline';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { downloadAnalyticsPDF } from '@/lib/pdf-export';
import { getBuilderAnalytics, type BuilderAnalyticsData } from '@/lib/services/analytics';
import type { Project } from '@/lib/database.types';
import {
  ChartBar,
  DownloadSimple,
  FolderOpen,
  TrendUp,
  TrendDown,
  Gauge,
  CurrencyDollar,
  Buildings,
  ChartLineUp,
} from '@phosphor-icons/react';

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
  return (
    <Card className={`metric-card ${tone}`}>
      <CardContent>
        <div className="metric-header">
          <span className="metric-label">{label}</span>
          {icon && <span className="metric-icon">{icon}</span>}
        </div>
        <div className="metric-value">{value}</div>
        {sublabel && <div className="metric-sublabel">{sublabel}</div>}
      </CardContent>
    </Card>
  );
}

import { Suspense } from 'react';

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, exchangeRate, formatPrice } = useCurrency();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [analytics, setAnalytics] = useState<BuilderAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [watchedMaterials] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('priceAlerts');
    if (stored) {
      try { return JSON.parse(stored); } catch { return []; }
    }
    return [];
  });
  const [areaSqm, setAreaSqm] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const param = searchParams.get('project');
    if (param) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL param to state
      setProjectId(param);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;
    const stored = localStorage.getItem(`analytics_area_${projectId}`);
    if (stored) {
      setAreaSqm(stored); // eslint-disable-line react-hooks/set-state-in-effect -- sync localStorage
    } else {
      setAreaSqm('');
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);
      const { data, error: loadError } = await getBuilderAnalytics(projectId, watchedMaterials);
      if (loadError) {
        setError(loadError.message);
        setAnalytics(null);
        setProject(null);
      } else {
        setAnalytics(data);
        setProject(data?.project || null);
      }
      setLoading(false);
    };

    loadAnalytics();
  }, [projectId, watchedMaterials]);

  const numericArea = useMemo(() => {
    const value = Number(areaSqm);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [areaSqm]);

  const totalSpend = analytics?.spendUsd || 0;
  const budgetUsd = analytics?.budgetUsd || 0;
  const varianceUsd = analytics?.varianceUsd || 0;
  const completionPct = analytics?.completionPct || 0;

  const spendProgress = budgetUsd > 0 ? Math.min(100, (totalSpend / budgetUsd) * 100) : 0;
  const costPerSqm = numericArea > 0 ? totalSpend / numericArea : 0;
  const costPerSqmTimeline = analytics?.spendTimeline.map((point) => ({
    month: point.month,
    value: numericArea > 0 ? point.spendUsd / numericArea : 0,
  })) || [];

  const formatValue = (usd: number) => formatPrice(usd, usd * exchangeRate);

  const handleSelectProject = (selected: Project) => {
    setProjectId(selected.id);
    router.replace(`/analytics?project=${selected.id}`);
  };

  const handleAreaChange = (value: string) => {
    setAreaSqm(value);
    if (projectId && typeof window !== 'undefined') {
      localStorage.setItem(`analytics_area_${projectId}`, value);
    }
  };

  const handleExport = async () => {
    if (!analytics || !project) return;
    setExporting(true);

    const toCurrency = (usd: number) => (currency === 'USD' ? usd : usd * exchangeRate);

    downloadAnalyticsPDF({
      projectName: project.name,
      generatedAt: new Date(),
      currency,
      summary: {
        totalSpend: toCurrency(totalSpend),
        budget: toCurrency(budgetUsd),
        variance: toCurrency(varianceUsd),
        completionPct,
        areaSqm: numericArea,
        costPerSqm: toCurrency(costPerSqm),
      },
      supplierBreakdown: analytics.supplierSpend.map((row) => ({
        name: row.name,
        spend: toCurrency(row.spendUsd),
        sharePct: row.sharePct,
      })),
      watchedMaterials: analytics.priceTrends.map((trend) => ({
        name: trend.name,
        price: toCurrency(trend.priceUsd),
        changePct: trend.changePct,
        trend: trend.trend,
      })),
      projectComparison: analytics.projectComparisons.map((row) => ({
        name: row.name,
        status: row.status,
        spend: toCurrency(row.spendUsd),
        budget: toCurrency(row.budgetUsd),
        completionPct: row.completionPct,
      })),
    });

    setExporting(false);
  };

  return (
    <ProtectedRoute>
      <MainLayout title="Analytics">
        <div className="analytics-page">
          <div className="analytics-hero">
            <div className="hero-copy">
              <div className="hero-label">Analytics & Reporting</div>
              <h1>Project Performance Control Center</h1>
              <p>Track budget health, supplier exposure, and price movement in one place.</p>
              {project && (
                <div className="project-pill">
                  <Buildings size={16} weight="bold" />
                  <span>{project.name}</span>
                </div>
              )}
            </div>
            <div className="hero-actions">
              <Button
                variant="secondary"
                icon={<FolderOpen size={18} />}
                onClick={() => setShowProjectPicker(true)}
              >
                {project ? 'Switch Project' : 'Select Project'}
              </Button>
              <Button
                icon={<DownloadSimple size={18} />}
                onClick={handleExport}
                disabled={!analytics || exporting}
                loading={exporting}
              >
                Export Report
              </Button>
            </div>
          </div>

          {loading && (
            <div className="loading-card">
              <div className="spinner" />
              <span>Preparing analytics…</span>
            </div>
          )}

          {error && !loading && (
            <div className="error-card">
              <h3>Unable to load analytics</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !project && !error && (
            <div className="empty-state">
              <ChartBar size={42} weight="light" />
              <h2>Select a project to begin</h2>
              <p>Analytics are generated per project so we can keep the reporting precise.</p>
              <Button onClick={() => setShowProjectPicker(true)} icon={<FolderOpen size={18} />}>
                Choose Project
              </Button>
            </div>
          )}

          {!loading && project && analytics && (
            <>
              <div className="summary-grid">
                <MetricCard
                  label="Total Spend"
                  value={formatValue(totalSpend)}
                  sublabel="Actual purchases"
                  icon={<CurrencyDollar size={18} />}
                />
                <MetricCard
                  label="Budget"
                  value={formatValue(budgetUsd)}
                  sublabel="Target envelope"
                  icon={<Gauge size={18} />}
                />
                <MetricCard
                  label="Variance"
                  value={formatValue(varianceUsd)}
                  sublabel={varianceUsd >= 0 ? 'Under budget' : 'Over budget'}
                  tone={varianceUsd >= 0 ? 'positive' : 'negative'}
                  icon={varianceUsd >= 0 ? <TrendUp size={18} /> : <TrendDown size={18} />}
                />
                <MetricCard
                  label="Completion"
                  value={`${completionPct.toFixed(1)}%`}
                  sublabel="Stage progress"
                  icon={<ChartLineUp size={18} />}
                />
              </div>

              <div className="analytics-grid">
                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Spend vs Budget</CardTitle>
                    <CardBadge variant={varianceUsd >= 0 ? 'success' : 'warning'}>
                      {varianceUsd >= 0 ? 'On Track' : 'At Risk'}
                    </CardBadge>
                  </CardHeader>
                  <CardContent>
                    <div className="spend-row">
                      <div>
                        <div className="spend-label">Actual Spend</div>
                        <div className="spend-value">{formatValue(totalSpend)}</div>
                      </div>
                      <div>
                        <div className="spend-label">Budget</div>
                        <div className="spend-value">{formatValue(budgetUsd)}</div>
                      </div>
                      <ProgressRing progress={spendProgress} size={90} />
                    </div>
                    <div className="progress-track">
                      <ProgressBar progress={spendProgress} showLabel />
                    </div>
                  </CardContent>
                </Card>

                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Cost per sqm</CardTitle>
                    <CardBadge variant={numericArea > 0 ? 'accent' : 'default'}>
                      {numericArea > 0 ? 'Set' : 'Needed'}
                    </CardBadge>
                  </CardHeader>
                  <CardContent>
                    <div className="cost-grid">
                      <div>
                        <div className="spend-label">Project Area (m²)</div>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 180"
                          value={areaSqm}
                          onChange={(e) => handleAreaChange(e.target.value)}
                        />
                      </div>
                      <div>
                        <div className="spend-label">Current Cost / sqm</div>
                        <div className="spend-value">{numericArea > 0 ? `${formatValue(costPerSqm)} / m²` : '—'}</div>
                        <div className="muted">Updates based on recorded purchases</div>
                      </div>
                    </div>
                    <div className="mini-bars">
                      {costPerSqmTimeline.map((point) => (
                        <div key={point.month} className="mini-bar">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${numericArea > 0 ? Math.min(100, (point.value / (costPerSqm || 1)) * 100) : 0}%`,
                            }}
                          />
                          <span>{point.month.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="analytics-grid">
                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Supplier Spend Breakdown</CardTitle>
                    <CardBadge variant="accent">Top Suppliers</CardBadge>
                  </CardHeader>
                  <CardContent>
                    {analytics.supplierSpend.length === 0 ? (
                      <div className="empty-sub">No purchases recorded yet.</div>
                    ) : (
                      <div className="bar-list">
                        {analytics.supplierSpend.slice(0, 6).map((row) => (
                          <div key={row.name} className="bar-row">
                            <span className="bar-label">{row.name}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${Math.max(4, row.sharePct)}%` }} />
                            </div>
                            <span className="bar-value">{formatValue(row.spendUsd)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Watched Material Trends</CardTitle>
                    <CardBadge variant="accent">Price Alerts</CardBadge>
                  </CardHeader>
                  <CardContent>
                    {analytics.priceTrends.length === 0 ? (
                      <div className="empty-sub">
                        No watched materials. <Link href="/marketplace">Set alerts in Marketplace.</Link>
                      </div>
                    ) : (
                      <div className="trend-list">
                        {analytics.priceTrends.map((trend) => (
                          <div key={trend.materialKey} className="trend-row">
                            <div>
                              <div className="trend-name">{trend.name}</div>
                              <div className="muted">{formatValue(trend.priceUsd)}</div>
                            </div>
                            <PriceSparkline data={trend.history} trend={trend.trend} width={90} height={32} />
                            <div className={`trend-change ${trend.trend}`}>
                              {trend.changePct > 0 ? '+' : ''}{trend.changePct.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="wide-card comparison-card">
                <CardHeader>
                  <CardTitle>Project Comparison</CardTitle>
                  <CardBadge variant="accent">Portfolio</CardBadge>
                </CardHeader>
                <CardContent>
                  {analytics.projectComparisons.length === 0 ? (
                    <div className="empty-sub">No other active projects to compare.</div>
                  ) : (
                    <div className="comparison-table">
                      <div className="comparison-head">
                        <span>Project</span>
                        <span>Status</span>
                        <span>Spend</span>
                        <span>Budget</span>
                        <span>Completion</span>
                      </div>
                      {analytics.projectComparisons.map((row) => (
                        <div key={row.id} className="comparison-row">
                          <span className="comparison-name">{row.name}</span>
                          <span className="comparison-status">{row.status.replace('_', ' ')}</span>
                          <span>{formatValue(row.spendUsd)}</span>
                          <span>{formatValue(row.budgetUsd)}</span>
                          <span>{row.completionPct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <ProjectPickerModal
          isOpen={showProjectPicker}
          onClose={() => setShowProjectPicker(false)}
          onSelect={handleSelectProject}
          title="Choose Project for Analytics"
          description="Select the project you want to analyze"
          confirmLabel="Select Project"
        />

        <style jsx>{`
          .analytics-page {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .analytics-hero {
            background: linear-gradient(135deg, rgba(6, 20, 47, 0.95), rgba(78, 154, 247, 0.85));
            border-radius: 24px;
            padding: 32px;
            color: white;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 24px;
            box-shadow: 0 20px 40px rgba(6, 20, 47, 0.18);
          }

          .hero-label {
            font-size: 0.75rem;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            opacity: 0.75;
          }

          .analytics-hero h1 {
            margin: 12px 0 8px;
            font-size: 2rem;
          }

          .analytics-hero p {
            margin: 0;
            opacity: 0.85;
          }

          .project-pill {
            margin-top: 16px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 999px;
            font-weight: 500;
          }

          .hero-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .loading-card,
          .error-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .spinner {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid rgba(78, 154, 247, 0.2);
            border-top-color: var(--color-accent);
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .empty-state {
            background: white;
            border-radius: 20px;
            padding: 48px 32px;
            text-align: center;
            display: grid;
            gap: 12px;
            justify-items: center;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
          }

          :global(.metric-card) {
            padding: 0;
          }

          :global(.metric-card .card-content) {
            display: grid;
            gap: 8px;
          }

          .metric-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--color-text-secondary);
          }

          .metric-label {
            font-size: 0.85rem;
            font-weight: 600;
          }

          .metric-value {
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--color-text);
          }

          .metric-sublabel {
            font-size: 0.8rem;
            color: var(--color-text-secondary);
          }

          :global(.metric-card.positive) {
            border-left: 4px solid #16a34a;
          }

          :global(.metric-card.negative) {
            border-left: 4px solid #ef4444;
          }

          .analytics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
          }

          :global(.wide-card) {
            padding: 0;
          }

          .spend-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
          }

          .spend-label {
            font-size: 0.85rem;
            color: var(--color-text-secondary);
          }

          .spend-value {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--color-text);
          }

          .progress-track {
            margin-top: 16px;
          }

          .cost-grid {
            display: grid;
            gap: 16px;
          }

          .mini-bars {
            margin-top: 16px;
            display: flex;
            gap: 12px;
            align-items: flex-end;
            height: 120px;
          }

          .mini-bar {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }

          .mini-bar .bar-fill {
            width: 100%;
            border-radius: 12px;
            background: linear-gradient(180deg, rgba(78, 154, 247, 0.9), rgba(6, 20, 47, 0.8));
            transition: height 0.3s ease;
          }

          .mini-bar span {
            font-size: 0.7rem;
            color: var(--color-text-secondary);
          }

          .bar-list {
            display: grid;
            gap: 12px;
          }

          .bar-row {
            display: grid;
            grid-template-columns: 140px 1fr auto;
            gap: 12px;
            align-items: center;
          }

          .bar-label {
            font-size: 0.85rem;
            color: var(--color-text);
          }

          .bar-track {
            height: 8px;
            background: var(--color-border-light);
            border-radius: 999px;
            overflow: hidden;
          }

          .bar-track .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4e9af7, #2b6cb0);
            border-radius: 999px;
          }

          .bar-value {
            font-size: 0.85rem;
            font-weight: 600;
          }

          .trend-list {
            display: grid;
            gap: 12px;
          }

          .trend-row {
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 16px;
            align-items: center;
          }

          .trend-name {
            font-weight: 600;
          }

          .trend-change {
            font-weight: 600;
          }

          .trend-change.up {
            color: #16a34a;
          }

          .trend-change.down {
            color: #ef4444;
          }

          .trend-change.stable {
            color: #64748b;
          }

          .comparison-card {
            padding: 0;
          }

          .comparison-table {
            display: grid;
            gap: 12px;
          }

          .comparison-head,
          .comparison-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
            gap: 12px;
            align-items: center;
            font-size: 0.85rem;
          }

          .comparison-head {
            color: var(--color-text-secondary);
            font-weight: 600;
          }

          .comparison-row {
            padding: 12px 0;
            border-bottom: 1px solid var(--color-border-light);
          }

          .comparison-name {
            font-weight: 600;
          }

          .comparison-status {
            text-transform: capitalize;
            color: var(--color-text-secondary);
          }

          .empty-sub {
            color: var(--color-text-secondary);
            font-size: 0.9rem;
          }

          .muted {
            color: var(--color-text-secondary);
            font-size: 0.8rem;
          }

          @media (max-width: 768px) {
            .analytics-hero {
              padding: 24px;
            }

            .hero-actions {
              width: 100%;
              flex-direction: column;
              align-items: stretch;
            }

            .spend-row {
              flex-direction: column;
              align-items: flex-start;
            }

            .bar-row {
              grid-template-columns: 1fr;
            }

            .comparison-head,
            .comparison-row {
              grid-template-columns: 1fr 1fr;
              grid-row-gap: 8px;
            }
          }
        `}</style>
      </MainLayout>
    </ProtectedRoute>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading analytics...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
