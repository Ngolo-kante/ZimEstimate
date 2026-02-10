'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Input from '@/components/ui/Input';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { useReveal } from '@/hooks/useReveal';
import {
  TrendUp,
  TrendDown,
  MagnifyingGlass,
  Cube,
  Drop,
  CheckCircle,
  Lightning,
  ChartLineUp,
  Storefront,
  Database as DatabaseIcon
} from '@phosphor-icons/react';
import {
  materials,
  getBestPrice,
} from '@/lib/materials';

// Material categories for filtering
const categories = [
  { id: 'all', label: 'All', icon: Cube },
  { id: 'bricks', label: 'Bricks', icon: Cube },
  { id: 'cement', label: 'Cement', icon: CheckCircle },
  { id: 'sand', label: 'Sand', icon: Drop },
  { id: 'roofing', label: 'Roofing', icon: Cube },
  { id: 'electrical', label: 'Electrical', icon: Lightning },
];

interface MarketItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  priceUsd: number;
  priceZwg: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

type PriceObservation = Database['public']['Tables']['price_observations']['Row'];

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function MarketInsightsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name');

  // Dynamic price data state
  const [marketPrices, setMarketPrices] = useState<MarketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useReveal({ deps: [marketPrices.length, selectedCategory, isLoading] });

  // Initialize with static data then fetch updates
  useEffect(() => {
    const fetchPrices = async () => {
      setIsLoading(true);

      // 1. Get base items from static DB (take top 25 for demo)
      const baseItems: MarketItem[] = materials.slice(0, 25).map((m, index) => {
        const bestPrice = getBestPrice(m.id);
        const trends = ['up', 'down', 'stable'] as const;
        // Deterministic trend based on index for demo continuity
        const trend = trends[index % 3];
        const changes = [2.5, -1.8, 0, 5.2, 3.1, -2.3, 8.5, 4.2, 0, 1.5];

        return {
          id: m.id,
          name: m.name,
          category: m.category,
          unit: m.unit,
          priceUsd: bestPrice?.priceUsd || 0,
          priceZwg: bestPrice?.priceZwg || 0,
          change: changes[index % changes.length],
          trend: trend,
          lastUpdated: new Date().toISOString(),
        };
      });

      // 2. Fetch real observations from Supabase
      try {
        const { data } = await supabase
          .from('price_observations')
          .select('*')
          .order('scraped_at', { ascending: false });

        const observations = data as PriceObservation[] | null;

        if (observations && observations.length > 0) {
          // Create a map of latest observation per material_key
          const latestObs = new Map<string, PriceObservation>();
          observations.forEach((obs) => {
            if (!latestObs.has(obs.material_key)) {
              latestObs.set(obs.material_key, obs);
            }
          });

          baseItems.forEach(item => {
            const obs = latestObs.get(item.id);
            if (obs && obs.price_usd !== null) {
              item.priceUsd = obs.price_usd;
              if (obs.scraped_at) {
                item.lastUpdated = obs.scraped_at;
              }
            }
          });
        }
      } catch (err) {
        console.error('Failed to fetch observations:', err);
      }

      setMarketPrices(baseItems);
      setIsLoading(false);
    };

    fetchPrices();
  }, []);

  const filteredMaterials = marketPrices
    .filter((m) => selectedCategory === 'all' || m.category === selectedCategory)
    .filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price') return b.priceUsd - a.priceUsd;
      if (sortBy === 'change') return b.change - a.change;
      return a.name.localeCompare(b.name);
    });

  const avgChange = marketPrices.length > 0 ? marketPrices.reduce((sum, m) => sum + m.change, 0) / marketPrices.length : 0;
  const risingCount = marketPrices.filter((m) => m.trend === 'up').length;

  return (
    <MainLayout title="Market Insights">
      <div className="market-page">
        {/* Page Header */}
        <div className="page-header reveal" data-delay="1">
          <div className="header-content">
            <h1>Market Insights</h1>
            <p>Real-time construction material prices tracked across Zimbabwe.</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="stats-row">
          <div className="stat-card reveal" data-delay="1">
            <div className="stat-icon up">
              <ChartLineUp size={24} weight="fill" />
            </div>
            <div>
              <p className="stat-label">Market Trend</p>
              <p className={`stat-value ${avgChange >= 0 ? 'up' : 'down'}`}>
                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
              </p>
              <p className="stat-period">Avg. 30-day change</p>
            </div>
          </div>

          <div className="stat-card reveal" data-delay="2">
            <div className="stat-icon neutral">
              <Storefront size={24} weight="fill" />
            </div>
            <div>
              <p className="stat-label">Price Movers</p>
              <p className="stat-value neutral">{risingCount} <span className="sub">of {marketPrices.length}</span></p>
              <p className="stat-period">Items rising in price</p>
            </div>
          </div>

          <div className="stat-card reveal" data-delay="3">
            <div className="stat-icon blue">
              <DatabaseIcon size={24} weight="fill" />
            </div>
            <div>
              <p className="stat-label">Data Coverage</p>
              <p className="stat-value neutral">12 <span className="sub">Sources</span></p>
              <p className="stat-period">Live tracking active</p>
            </div>
          </div>
        </div>

        {/* content grid */}
        <div className="content-grid">
          {/* Sidebar / Filters */}
          <div className="filters-sidebar reveal" data-delay="3">
            <div className="search-box">
              <Input
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<MagnifyingGlass size={18} weight="bold" />}
              />
            </div>

            <div className="category-list">
              <h3>Categories</h3>
              <div className="pills-container">
                {categories.map((cat) => {
                  const IconComponent = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <IconComponent size={18} weight={selectedCategory === cat.id ? "fill" : "regular"} />
                      <span>{cat.label}</span>
                      {selectedCategory === cat.id && <div className="active-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="listings-section reveal" data-delay="4">
            <div className="list-header">
              <h2>{categories.find(c => c.id === selectedCategory)?.label} Prices</h2>
              <div className="sort-control">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                  <option value="name">Sort by Name</option>
                  <option value="price">Sort by Price</option>
                  <option value="change">Sort by Change</option>
                </select>
              </div>
            </div>

            <div className="prices-container">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Fetching latest market data...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="prices-table">
                    <thead>
                      <tr>
                        <th className="col-name">Material</th>
                        <th className="col-price">Current Price</th>
                        <th className="col-trend">Trend (30d)</th>
                        <th className="col-updated">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.map((material) => (
                        <tr key={material.id}>
                          <td className="col-name">
                            <div className="material-info">
                              <span className="name">{material.name}</span>
                              <span className="unit">Per {material.unit}</span>
                            </div>
                          </td>
                          <td className="col-price">
                            <div className="price-tag">
                              <PriceDisplay priceUsd={material.priceUsd} priceZwg={material.priceZwg} />
                            </div>
                          </td>
                          <td className="col-trend">
                            <div className={`trend-badge ${material.trend}`}>
                              {material.trend === 'up' ? <TrendUp size={14} weight="bold" /> :
                                material.trend === 'down' ? <TrendDown size={14} weight="bold" /> :
                                  <div className="dash" />}
                              <span>
                                {material.change === 0 ? 'Stable' : `${Math.abs(material.change)}%`}
                              </span>
                            </div>
                          </td>
                          <td className="col-updated">
                            {new Date(material.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="market-disclaimer">
              <p>
                <strong>Note:</strong> Prices are aggregated from local suppliers and classifieds. Always verify final quotes.
              </p>
              <Link href="/ai/quote-scanner" className="quote-link">
                Get an Official Quote &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .market-page {
          max-width: var(--container-max);
          margin: 0 auto;
          padding: var(--space-8) var(--container-padding);
          font-family: var(--font-body);
        }

        /* Header */
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: var(--space-8);
          padding-bottom: var(--space-6);
          border-bottom: 1px solid var(--color-border-light);
        }

        .header-content h1 {
          font-family: var(--font-heading);
          font-size: var(--text-h2);
          font-weight: var(--font-bold);
          color: var(--color-primary);
          letter-spacing: -0.03em;
          margin-bottom: var(--space-2);
        }

        .header-content p {
          color: var(--color-text-secondary);
          font-size: var(--text-lg);
          margin: 0;
        }

        /* Stats Cards */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--grid-gutter);
          margin-bottom: var(--space-10);
        }

        .stat-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--card-radius);
          padding: var(--card-padding);
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
          box-shadow: var(--shadow-sm);
          transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out);
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon.up { background: rgba(22, 163, 74, 0.1); color: var(--color-emerald); }
        .stat-icon.neutral { background: var(--color-mist); color: var(--color-slate-light); }
        .stat-icon.blue { background: rgba(46, 108, 246, 0.1); color: var(--color-accent); }

        .stat-label {
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: var(--font-semibold);
          color: var(--color-text-muted);
          margin: 0 0 var(--space-1) 0;
        }

        .stat-value {
          font-family: var(--font-heading);
          font-size: var(--text-h3);
          font-weight: var(--font-bold);
          color: var(--color-text);
          margin: 0 0 var(--space-1) 0;
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .stat-value .sub {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-weight: var(--font-medium);
          margin-left: var(--space-1);
          font-family: var(--font-body);
        }

        .stat-value.up { color: var(--color-emerald); }
        .stat-value.down { color: var(--color-danger); }

        .stat-period {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin: 0;
        }

        /* Layout Grid */
        .content-grid {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: var(--grid-gutter);
        }

        /* Sidebar */
        .filters-sidebar {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .category-list h3 {
          font-size: var(--text-xs);
          text-transform: uppercase;
          color: var(--color-text-muted);
          font-weight: var(--font-bold);
          margin-bottom: var(--space-3);
          padding-left: var(--space-2);
        }

        .pills-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .category-pill {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          width: 100%;
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-default);
          text-align: left;
          font-family: var(--font-body);
        }

        .category-pill:hover {
          background: var(--color-mist);
          color: var(--color-text);
        }

        .category-pill.active {
          background: rgba(46, 108, 246, 0.08);
          color: var(--color-accent);
          font-weight: var(--font-semibold);
        }

        .active-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-accent);
          margin-left: auto;
        }

        /* Main Listing Area */
        .listings-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .list-header h2 {
          font-family: var(--font-heading);
          font-size: var(--text-h4);
          font-weight: var(--font-bold);
          color: var(--color-primary);
          margin: 0;
        }

        .sort-control select {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          cursor: pointer;
          outline: none;
          font-family: var(--font-body);
        }
        
        .sort-control select:hover {
          color: var(--color-primary);
        }

        .prices-container {
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--card-radius);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          min-height: 400px;
        }

        .prices-table {
          width: 100%;
          border-collapse: collapse;
        }

        .prices-table th {
          position: sticky;
          top: 0;
          text-align: left;
          padding: var(--space-4) var(--space-6);
          background: var(--color-mist);
          border-bottom: 1px solid var(--color-border-light);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          font-weight: var(--font-bold);
          z-index: 10;
        }

        .prices-table td {
          padding: var(--space-4) var(--space-6);
          border-bottom: 1px solid var(--color-border-light);
          color: var(--color-text);
          vertical-align: middle;
        }
        
        .prices-table tr:last-child td {
          border-bottom: none;
        }
        
        .prices-table tr:nth-child(even) {
          background-color: var(--table-zebra-bg);
        }

        .prices-table tr:hover {
          background-color: var(--table-row-hover);
        }

        .material-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .material-info .name {
          font-weight: var(--font-semibold);
          color: var(--color-primary);
          font-size: var(--text-sm);
        }

        .material-info .unit {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .price-tag {
          font-family: var(--font-mono);
          font-weight: var(--font-medium);
          color: var(--color-primary);
          font-size: var(--text-sm);
        }

        .trend-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
        }

        .trend-badge.up { background: rgba(22, 163, 74, 0.1); color: var(--color-emerald); }
        .trend-badge.down { background: rgba(220, 38, 38, 0.1); color: var(--color-danger); }
        .trend-badge.stable { background: var(--color-mist); color: var(--color-text-secondary); }
        
        .dash {
          width: 6px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
        }

        .col-updated {
          color: var(--color-text-muted);
          font-size: var(--text-xs);
        }

        .market-disclaimer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background: var(--color-mist);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-light);
          color: var(--color-text-secondary);
          font-size: var(--text-sm);
        }
        
        .market-disclaimer p { margin: 0; }
        .quote-link {
          color: var(--color-accent);
          font-weight: var(--font-medium);
          text-decoration: none;
        }
        
        .quote-link:hover { text-decoration: underline; }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: var(--color-text-muted);
          gap: var(--space-4);
        }
        
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-mist);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
            .stats-row { grid-template-columns: 1fr; gap: var(--space-4); }
            .content-grid { grid-template-columns: 1fr; gap: var(--space-8); }
            .filters-sidebar { flex-direction: row; flex-wrap: wrap; align-items: start; }
            .category-list { width: 100%; }
            .pills-container { flex-direction: row; flex-wrap: wrap; }
            .category-pill { width: auto; }
            .page-header { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
        }
      `}</style>
    </MainLayout>
  );
}
