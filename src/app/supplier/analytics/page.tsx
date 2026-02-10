'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Card, { CardContent, CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { supabase } from '@/lib/supabase';
import { getUserSupplierProfile } from '@/lib/services/suppliers';
import { getSupplierAnalytics, type SupplierAnalyticsData } from '@/lib/services/analytics';
import {
  ArrowLeft,
  TrendUp,
  Clock,
  CurrencyDollar,
  ShieldCheck,
} from '@phosphor-icons/react';

export default function SupplierAnalyticsPage() {
  const router = useRouter();
  const { exchangeRate, formatPrice } = useCurrency();
  const [analytics, setAnalytics] = useState<SupplierAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?redirect=/supplier/analytics');
        return;
      }

      const supplierProfile = await getUserSupplierProfile(user.id);
      if (!supplierProfile) {
        router.push('/supplier/register');
        return;
      }

      const { data, error: loadError } = await getSupplierAnalytics(supplierProfile.id);
      if (loadError) {
        setError(loadError.message);
        setAnalytics(null);
      } else {
        setAnalytics(data);
      }
      setLoading(false);
    };

    loadAnalytics();
  }, [router]);

  const formatValue = (usd: number) => formatPrice(usd, usd * exchangeRate);

  const responseRate = analytics?.responseRate || 0;
  const acceptanceRate = analytics?.acceptanceRate || 0;
  const avgResponseHours = analytics?.avgResponseHours || 0;
  const revenueUsd = analytics?.revenueUsd || 0;
  const platformResponse = analytics?.platformBenchmarks.responseRate || 0;
  const platformAcceptance = analytics?.platformBenchmarks.acceptanceRate || 0;

  const responseDelta = responseRate - platformResponse;
  const acceptanceDelta = acceptanceRate - platformAcceptance;

  const ratingLabel = useMemo(() => {
    const avgRating = analytics?.supplier?.rating || 0;
    return avgRating ? avgRating.toFixed(1) : '—';
  }, [analytics?.supplier?.rating]);

  return (
    <ProtectedRoute>
      <MainLayout title="Supplier Analytics">
        <div className="supplier-analytics">
          <div className="page-header">
            <div>
              <div className="header-label">Supplier Performance</div>
              <h1>Analytics & Growth Insights</h1>
              <p>Track your RFQ responsiveness, revenue performance, and competitive standing.</p>
            </div>
            <div className="header-actions">
              <Link href="/supplier/dashboard">
                <Button variant="secondary" icon={<ArrowLeft size={18} />}>
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {loading && (
            <div className="loading-card">
              <div className="spinner" />
              <span>Loading supplier analytics…</span>
            </div>
          )}

          {error && !loading && (
            <div className="error-card">
              <h3>Unable to load analytics</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && analytics && (
            <>
              <div className="summary-grid">
                <Card className="metric">
                  <CardContent>
                    <div className="metric-row">
                      <span className="metric-label">Response Rate</span>
                      <TrendUp size={18} />
                    </div>
                    <div className="metric-value">{responseRate.toFixed(1)}%</div>
                    <div className="metric-sub">Platform avg {platformResponse.toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card className="metric">
                  <CardContent>
                    <div className="metric-row">
                      <span className="metric-label">Quote Acceptance</span>
                      <ShieldCheck size={18} />
                    </div>
                    <div className="metric-value">{acceptanceRate.toFixed(1)}%</div>
                    <div className="metric-sub">Platform avg {platformAcceptance.toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card className="metric">
                  <CardContent>
                    <div className="metric-row">
                      <span className="metric-label">Avg Response Time</span>
                      <Clock size={18} />
                    </div>
                    <div className="metric-value">{avgResponseHours > 0 ? `${avgResponseHours.toFixed(1)} hrs` : '—'}</div>
                    <div className="metric-sub">Last 30 RFQs</div>
                  </CardContent>
                </Card>
                <Card className="metric">
                  <CardContent>
                    <div className="metric-row">
                      <span className="metric-label">Revenue (Accepted)</span>
                      <CurrencyDollar size={18} />
                    </div>
                    <div className="metric-value">{formatValue(revenueUsd)}</div>
                    <div className="metric-sub">Rolling 6 months</div>
                  </CardContent>
                </Card>
              </div>

              <div className="analytics-grid">
                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Competitive Positioning</CardTitle>
                    <CardBadge variant="accent">Benchmark</CardBadge>
                  </CardHeader>
                  <CardContent>
                    <div className="position-row">
                      <div>
                        <div className="metric-label">Response Rate</div>
                        <div className="metric-value">{responseRate.toFixed(1)}%</div>
                      </div>
                      <div className={`delta ${responseDelta >= 0 ? 'positive' : 'negative'}`}>
                        {responseDelta >= 0 ? '+' : ''}{responseDelta.toFixed(1)}% vs avg
                      </div>
                    </div>
                    <div className="position-bar">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.min(100, responseRate)}%` }} />
                      </div>
                      <span className="bar-hint">Platform {platformResponse.toFixed(1)}%</span>
                    </div>
                    <div className="position-row">
                      <div>
                        <div className="metric-label">Acceptance Rate</div>
                        <div className="metric-value">{acceptanceRate.toFixed(1)}%</div>
                      </div>
                      <div className={`delta ${acceptanceDelta >= 0 ? 'positive' : 'negative'}`}>
                        {acceptanceDelta >= 0 ? '+' : ''}{acceptanceDelta.toFixed(1)}% vs avg
                      </div>
                    </div>
                    <div className="position-bar">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.min(100, acceptanceRate)}%` }} />
                      </div>
                      <span className="bar-hint">Platform {platformAcceptance.toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Ratings Breakdown</CardTitle>
                    <CardBadge variant="accent">Avg {ratingLabel}</CardBadge>
                  </CardHeader>
                  <CardContent>
                    <div className="rating-list">
                      {analytics.ratingBreakdown.map((row) => (
                        <div key={row.stars} className="rating-row">
                          <span className="rating-label">{row.stars} ★</span>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${row.sharePct}%` }} />
                          </div>
                          <span className="rating-value">{row.sharePct.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="muted">Based on average supplier rating.</div>
                  </CardContent>
                </Card>
              </div>

              <div className="analytics-grid">
                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Revenue Timeline</CardTitle>
                    <CardBadge variant="accent">Last 6 months</CardBadge>
                  </CardHeader>
                  <CardContent>
                    <div className="timeline-bars">
                      {analytics.revenueTimeline.map((point) => (
                        <div key={point.month} className="timeline-bar">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${revenueUsd > 0 ? Math.min(100, (point.revenueUsd / (revenueUsd || 1)) * 100) : 0}%`,
                            }}
                          />
                          <span>{point.month.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="wide-card">
                  <CardHeader>
                    <CardTitle>Recent Quote Activity</CardTitle>
                    <CardBadge variant="accent">Latest 10</CardBadge>
                  </CardHeader>
                  <CardContent>
                    {analytics.quoteHistory.length === 0 ? (
                      <div className="empty-sub">No RFQ quotes submitted yet.</div>
                    ) : (
                      <div className="quote-list">
                        {analytics.quoteHistory.map((quote) => (
                          <div key={quote.rfqId} className="quote-row">
                            <div>
                              <div className="quote-id">RFQ {quote.rfqId.slice(0, 8)}</div>
                              <div className="muted">
                                {quote.submittedAt ? new Date(quote.submittedAt).toLocaleDateString() : 'Pending'}
                              </div>
                            </div>
                            <span className={`status ${quote.status}`}>{quote.status}</span>
                            <span className="quote-total">{formatValue(Number(quote.totalUsd || 0))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        <style jsx>{`
          .supplier-analytics {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .page-header {
            background: white;
            border-radius: 20px;
            padding: 28px 32px;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 24px;
            box-shadow: 0 12px 24px rgba(6, 20, 47, 0.08);
          }

          .header-label {
            font-size: 0.75rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--color-text-secondary);
          }

          .page-header h1 {
            margin: 12px 0 8px;
          }

          .page-header p {
            margin: 0;
            color: var(--color-text-secondary);
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

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
          }

          :global(.metric) {
            padding: 0;
          }

          :global(.metric .card-content) {
            display: grid;
            gap: 6px;
          }

          .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--color-text-secondary);
          }

          .metric-label {
            font-size: 0.85rem;
          }

          .metric-value {
            font-size: 1.5rem;
            font-weight: 700;
          }

          .metric-sub {
            font-size: 0.8rem;
            color: var(--color-text-secondary);
          }

          .analytics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
          }

          :global(.wide-card) {
            padding: 0;
          }

          .position-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .delta {
            font-weight: 600;
          }

          .delta.positive {
            color: #16a34a;
          }

          .delta.negative {
            color: #ef4444;
          }

          .position-bar {
            margin: 12px 0 18px;
          }

          .bar-track {
            height: 8px;
            border-radius: 999px;
            background: var(--color-border-light);
            overflow: hidden;
          }

          .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4e9af7, #2b6cb0);
          }

          .bar-hint {
            font-size: 0.75rem;
            color: var(--color-text-secondary);
          }

          .rating-list {
            display: grid;
            gap: 10px;
          }

          .rating-row {
            display: grid;
            grid-template-columns: 60px 1fr 50px;
            gap: 12px;
            align-items: center;
            font-size: 0.85rem;
          }

          .rating-label {
            color: var(--color-text-secondary);
          }

          .rating-value {
            text-align: right;
            font-weight: 600;
          }

          .timeline-bars {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            height: 140px;
          }

          .timeline-bar {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }

          .timeline-bar .bar-fill {
            width: 100%;
            border-radius: 12px;
            transition: height 0.3s ease;
          }

          .timeline-bar span {
            font-size: 0.7rem;
            color: var(--color-text-secondary);
          }

          .quote-list {
            display: grid;
            gap: 12px;
          }

          .quote-row {
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 16px;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--color-border-light);
          }

          .quote-id {
            font-weight: 600;
          }

          .status {
            text-transform: capitalize;
            font-size: 0.8rem;
            padding: 4px 10px;
            border-radius: 999px;
            background: var(--color-border-light);
            color: var(--color-text-secondary);
          }

          .status.accepted {
            background: rgba(16, 185, 129, 0.15);
            color: #16a34a;
          }

          .status.rejected,
          .status.expired {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
          }

          .status.submitted {
            background: rgba(59, 130, 246, 0.12);
            color: #2563eb;
          }

          .quote-total {
            font-weight: 600;
          }

          .muted {
            font-size: 0.8rem;
            color: var(--color-text-secondary);
          }

          .empty-sub {
            color: var(--color-text-secondary);
            font-size: 0.9rem;
          }

          @media (max-width: 768px) {
            .page-header {
              padding: 24px;
            }

            .quote-row {
              grid-template-columns: 1fr;
              gap: 8px;
            }

            .rating-row {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </MainLayout>
    </ProtectedRoute>
  );
}
