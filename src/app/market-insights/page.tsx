'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Input from '@/components/ui/Input';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
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
        <div className="page-header">
          <div className="header-content">
            <h1>Market Insights</h1>
            <p>Real-time construction material prices tracked across Zimbabwe.</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="stats-row">
          <div className="stat-card">
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

          <div className="stat-card">
            <div className="stat-icon neutral">
              <Storefront size={24} weight="fill" />
            </div>
            <div>
              <p className="stat-label">Price Movers</p>
              <p className="stat-value neutral">{risingCount} <span className="sub">of {marketPrices.length}</span></p>
              <p className="stat-period">Items rising in price</p>
            </div>
          </div>

          <div className="stat-card">
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
          <div className="filters-sidebar">
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
          <div className="listings-section">
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
          max-width: 1200px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* Header */
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 40px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
        }

        .header-content h1 {
            font-size: 2rem;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.03em;
            margin-bottom: 8px;
        }

        .header-content p {
            color: #64748b;
            font-size: 1.05rem;
            margin: 0;
        }

        /* Stats Cards */
        .stats-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 24px;
            display: flex;
            align-items: flex-start;
            gap: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.03);
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .stat-icon.up { background: #dcfce7; color: #16a34a; }
        .stat-icon.neutral { background: #f1f5f9; color: #475569; }
        .stat-icon.blue { background: #eff6ff; color: #2563eb; }

        .stat-label {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
            color: #64748b;
            margin: 0 0 6px 0;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 4px 0;
            display: flex;
            align-items: baseline;
            gap: 3px;
        }

        .stat-value .sub {
            font-size: 0.9rem;
            color: #94a3b8;
            font-weight: 500;
            margin-left: 4px;
        }

        .stat-value.up { color: #16a34a; }
        .stat-value.down { color: #ef4444; }

        .stat-period {
            font-size: 0.8rem;
            color: #94a3b8;
            margin: 0;
        }

        /* Layout Grid */
        .content-grid {
            display: grid;
            grid-template-columns: 260px 1fr;
            gap: 40px;
        }

        /* Sidebar */
        .filters-sidebar {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .category-list h3 {
            font-size: 0.8rem;
            text-transform: uppercase;
            color: #94a3b8;
            font-weight: 700;
            margin-bottom: 12px;
            padding-left: 8px;
        }

        .pills-container {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .category-pill {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            width: 100%;
            background: transparent;
            border: none;
            border-radius: 8px;
            font-size: 0.95rem;
            color: #64748b;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
        }

        .category-pill:hover {
            background: #f8fafc;
            color: #0f172a;
        }

        .category-pill.active {
            background: #eff6ff;
            color: #2563eb;
            font-weight: 600;
        }

        .active-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #2563eb;
            margin-left: auto;
        }

        /* Main Listing Area */
        .listings-section {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .list-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .list-header h2 {
            font-size: 1.25rem;
            font-weight: 700;
            color: #0f172a;
            margin: 0;
        }

        .sort-control select {
            background: transparent;
            border: none;
            color: #64748b;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
             outline: none;
        }
        
        .sort-control select:hover {
            color: #0f172a;
        }

        .prices-container {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
            overflow: hidden;
            min-height: 400px;
        }

        .prices-table {
            width: 100%;
            border-collapse: collapse;
        }

        .prices-table th {
            text-align: left;
            padding: 16px 24px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 600;
        }

        .prices-table td {
            padding: 16px 24px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
            vertical-align: middle;
        }
        
        .prices-table tr:last-child td {
            border-bottom: none;
        }
        
        .prices-table tr:hover td {
            background: #fcfcfc;
        }

        .material-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .material-info .name {
            font-weight: 600;
            color: #0f172a;
            font-size: 0.95rem;
        }

        .material-info .unit {
            font-size: 0.8rem;
            color: #94a3b8;
        }

        .price-tag {
            font-weight: 700;
            color: #0f172a;
            font-size: 1rem;
        }

        .trend-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 99px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .trend-badge.up { background: #dcfce7; color: #166534; }
        .trend-badge.down { background: #fee2e2; color: #991b1b; }
        .trend-badge.stable { background: #f1f5f9; color: #64748b; }
        
        .dash {
            width: 6px;
            height: 2px;
            background: currentColor;
            border-radius: 2px;
        }

        .date-cell {
            color: #94a3b8;
            font-size: 0.85rem;
        }

        .market-disclaimer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 0.9rem;
        }
        
        .market-disclaimer p { margin: 0; }
        .quote-link {
            color: #2563eb;
            font-weight: 600;
            text-decoration: none;
        }
        
        .quote-link:hover { text-decoration: underline; }

        .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #94a3b8;
            gap: 16px;
        }
        
        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #f1f5f9;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
            .stats-row { grid-template-columns: 1fr; gap: 16px; }
            .content-grid { grid-template-columns: 1fr; gap: 32px; }
            .filters-sidebar { flex-direction: row; flex-wrap: wrap; align-items: start; }
            .category-list { width: 100%; }
            .pills-container { flex-direction: row; flex-wrap: wrap; }
            .category-pill { width: auto; }
            .page-header { flex-direction: column; align-items: flex-start; gap: 16px; }
        }
      `}</style>
    </MainLayout>
  );
}
