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
  /** null when no source has priced this material yet. */
  priceUsd: number | null;
  priceZwg: number | null;
  /** null when there is not enough history to compute a real change. */
  change: number | null;
  trend: 'up' | 'down' | 'stable' | null;
  lastUpdated: string | null;
}

type PriceObservation = Database['public']['Tables']['price_observations']['Row'];

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number | null }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg ?? priceUsd * 30)}</>;
}

/** Catalogue units are inconsistent: some already start with "per". */
function formatUnit(unit: string): string {
  const u = unit.trim();
  return /^per\b/i.test(u) ? u.charAt(0).toUpperCase() + u.slice(1) : `Per ${u}`;
}

export default function MarketInsightsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name');

  // Dynamic price data state
  const [marketPrices, setMarketPrices] = useState<MarketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceCount, setSourceCount] = useState<number | null>(null);

  useReveal({ deps: [marketPrices.length, selectedCategory, isLoading] });

  // Initialize with static data then fetch updates
  useEffect(() => {
    const fetchPrices = async () => {
      setIsLoading(true);

      // Baseline from the catalogue. Trend is left null here and only filled in
      // from real weekly history below.
      //
      // This previously invented its own market data: the trend came from
      // `trends[index % 3]` and the percentage from a hardcoded array indexed by
      // position in the list. Those fake numbers also fed the "Market Trend" and
      // "Price Movers" headline stats, so a page captioned "Real-time
      // construction material prices tracked across Zimbabwe" was reporting
      // movements that had never happened.
      const baseItems: MarketItem[] = materials.slice(0, 25).map((m) => {
        const bestPrice = getBestPrice(m.id);

        return {
          id: m.id,
          name: m.name,
          category: m.category,
          unit: m.unit,
          priceUsd: bestPrice?.priceUsd ?? null,
          priceZwg: bestPrice?.priceZwg ?? null,
          change: null,
          trend: null,
          lastUpdated: bestPrice?.lastUpdated ?? null,
        };
      });

      // 2. Overlay scraped observations, newest per material.
      try {
        const { data } = await supabase
          .from('price_observations')
          .select('*')
          .order('scraped_at', { ascending: false });

        const observations = data as PriceObservation[] | null;

        if (observations && observations.length > 0) {
          const latestObs = new Map<string, PriceObservation>();
          observations.forEach((obs) => {
            if (!latestObs.has(obs.material_key)) {
              latestObs.set(obs.material_key, obs);
            }
          });

          baseItems.forEach(item => {
            const obs = latestObs.get(item.id);
            if (!obs || obs.price_usd === null) return;

            // Reject an observation whose unit contradicts the catalogue's.
            const obsUnit = (obs.unit ?? '').trim().toLowerCase();
            if (obsUnit && obsUnit !== item.unit.trim().toLowerCase()) return;

            // Most scraped rows carry no unit at all, so the check above cannot
            // protect us. Fall back to an order-of-magnitude sanity band against
            // the catalogue price: brick-common is catalogued at $0.12 each and
            // observed at $108, which is a per-1000 quote recorded against a
            // material sold each — displaying it made a single brick cost $108.
            // A disagreement that large means the two are not measuring the same
            // quantity, so the known-good catalogue price is kept.
            if (item.priceUsd !== null && item.priceUsd > 0) {
              const ratio = obs.price_usd / item.priceUsd;
              if (ratio > 10 || ratio < 0.1) {
                console.warn(
                  `Ignoring ${obs.material_key} observation $${obs.price_usd}: ` +
                  `${ratio.toFixed(0)}x the catalogue price of $${item.priceUsd} per ${item.unit} — likely a different unit.`
                );
                return;
              }
            }

            item.priceUsd = obs.price_usd;
            item.priceZwg = null;
            if (obs.scraped_at) item.lastUpdated = obs.scraped_at;
          });
        }
      } catch (err) {
        console.error('Failed to fetch observations:', err);
      }

      // 3. Real 30-day movement from weekly history. Anything without at least
      // two weeks of data keeps trend === null and renders as "No data" rather
      // than as a number nobody measured.
      try {
        const { data } = await supabase
          .from('price_weekly')
          .select('material_key, week_start, avg_price_usd')
          .order('week_start', { ascending: false });

        const weekly = (data ?? []) as { material_key: string; week_start: string; avg_price_usd: number | null }[];
        const byMaterial = new Map<string, { week_start: string; avg_price_usd: number | null }[]>();
        weekly.forEach((w) => {
          if (!byMaterial.has(w.material_key)) byMaterial.set(w.material_key, []);
          byMaterial.get(w.material_key)!.push(w);
        });

        baseItems.forEach((item) => {
          const history = (byMaterial.get(item.id) ?? []).filter((w) => w.avg_price_usd !== null);
          if (history.length < 2) return;

          const latest = history[0].avg_price_usd!;
          const previous = history[1].avg_price_usd!;
          if (previous === 0) return;

          const changePercent = ((latest - previous) / previous) * 100;
          item.change = Math.round(changePercent * 10) / 10;
          item.trend = changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'stable';
        });
      } catch (err) {
        console.error('Failed to fetch weekly prices:', err);
      }

      // 4. How many distinct sources actually back these numbers.
      try {
        const { count } = await supabase
          .from('price_sources')
          .select('id', { count: 'exact', head: true });
        setSourceCount(count ?? 0);
      } catch {
        setSourceCount(0);
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
      if (sortBy === 'price') return (b.priceUsd ?? -1) - (a.priceUsd ?? -1);
      if (sortBy === 'change') return (b.change ?? -Infinity) - (a.change ?? -Infinity);
      return a.name.localeCompare(b.name);
    });

  // Averaged over the items that actually have measured movement, not the
  // whole list — otherwise every material still awaiting history would be
  // silently counted as 0% and drag the figure toward zero.
  const measured = marketPrices.filter((m) => m.change !== null);
  const avgChange = measured.length > 0
    ? measured.reduce((sum, m) => sum + (m.change ?? 0), 0) / measured.length
    : null;
  const risingCount = marketPrices.filter((m) => m.trend === 'up').length;
  const pricedCount = marketPrices.filter((m) => m.priceUsd !== null && m.priceUsd > 0).length;

  return (
    <MainLayout title="Market Insights">
      <div className="market-page">
        {/* Page Header */}
        <div className="page-header reveal" data-delay="1">
          <div className="header-content">
            {/* MainLayout already renders an <h1> from its title prop, so this
                page was serving two identical top-level headings. */}
            <p>
              Construction material prices for Zimbabwe, from our catalogue and
              live supplier observations where available.
            </p>
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
              {avgChange === null ? (
                <>
                  <p className="stat-value neutral">&mdash;</p>
                  <p className="stat-period">Awaiting price history</p>
                </>
              ) : (
                <>
                  <p className={`stat-value ${avgChange >= 0 ? 'up' : 'down'}`}>
                    {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
                  </p>
                  <p className="stat-period">
                    Avg. 30-day change across {measured.length} tracked {measured.length === 1 ? 'item' : 'items'}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="stat-card reveal" data-delay="2">
            <div className="stat-icon neutral">
              <Storefront size={24} weight="fill" />
            </div>
            <div>
              <p className="stat-label">Price Movers</p>
              <p className="stat-value neutral">
                {measured.length === 0 ? <>&mdash;</> : <>{risingCount} <span className="sub">of {measured.length}</span></>}
              </p>
              <p className="stat-period">
                {measured.length === 0 ? 'No movement recorded yet' : 'Tracked items rising in price'}
              </p>
            </div>
          </div>

          <div className="stat-card reveal" data-delay="3">
            <div className="stat-icon blue">
              <DatabaseIcon size={24} weight="fill" />
            </div>
            <div>
              <p className="stat-label">Data Coverage</p>
              {/* Was hardcoded to "12 Sources / Live tracking active" while the
                  price_sources table was empty. */}
              <p className="stat-value neutral">
                {pricedCount} <span className="sub">of {marketPrices.length} priced</span>
              </p>
              <p className="stat-period">
                {sourceCount === null
                  ? 'Checking sources…'
                  : sourceCount > 0
                    ? `${sourceCount} live ${sourceCount === 1 ? 'source' : 'sources'} tracking`
                    : 'Catalogue pricing — no live sources connected'}
              </p>
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
                          <td data-label="Material" className="col-name">
                            <div className="material-info">
                              <span className="name">{material.name}</span>
                              {/* Units already read "per 50kg bag", so the old
                                  "Per {unit}" prefix produced "Per per 50kg bag". */}
                              <span className="unit">{formatUnit(material.unit)}</span>
                            </div>
                          </td>
                          <td data-label="Current price" className="col-price">
                            {material.priceUsd === null || material.priceUsd <= 0 ? (
                              <span className="no-data">Not priced yet</span>
                            ) : (
                              <div className="price-tag">
                                <PriceDisplay priceUsd={material.priceUsd} priceZwg={material.priceZwg} />
                              </div>
                            )}
                          </td>
                          <td data-label="Trend (30d)" className="col-trend">
                            {material.trend === null ? (
                              <span className="no-data">No history</span>
                            ) : (
                              <div className={`trend-badge ${material.trend}`}>
                                {material.trend === 'up' ? <TrendUp size={14} weight="bold" /> :
                                  material.trend === 'down' ? <TrendDown size={14} weight="bold" /> :
                                    <div className="dash" />}
                                <span>
                                  {material.trend === 'stable' ? 'Stable' : `${Math.abs(material.change ?? 0)}%`}
                                </span>
                              </div>
                            )}
                          </td>
                          <td data-label="Updated" className="col-updated">
                            {material.lastUpdated
                              ? new Date(material.lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                              : <span className="no-data">&mdash;</span>}
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

        .no-data {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-style: italic;
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
            /* Grid and flex children default to min-width:auto, so the filter
               column refused to shrink below its content and rendered 476px
               wide inside a 375px screen, pushing the whole page sideways. */
            .content-grid > *, .filters-sidebar, .listings-section { min-width: 0; }
            .filters-sidebar { flex-direction: column; gap: var(--space-4); }
            .category-list { width: 100%; min-width: 0; }
            .pills-container {
              flex-direction: row;
              flex-wrap: nowrap;
              overflow-x: auto;
              gap: 8px;
              padding-bottom: 4px;
              scrollbar-width: none;
            }
            .pills-container::-webkit-scrollbar { display: none; }
            .category-pill { width: auto; flex: 0 0 auto; white-space: nowrap; }
            .page-header { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
        }

        /* Below 768px the price table becomes cards, matching the BOQ and usage
           tables. Four columns of prices do not fit a phone, and a header row
           that has scrolled out of view labels nothing. */
        @media (max-width: 768px) {
            .table-responsive { overflow-x: visible; }
            .prices-table, .prices-table tbody, .prices-table tr, .prices-table td {
              display: block; width: auto;
            }
            .prices-table thead {
              position: absolute; width: 1px; height: 1px;
              overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
            }
            .prices-table tr {
              border: 1px solid var(--color-border, #e2e8f0);
              border-radius: 12px;
              padding: 4px 14px;
              margin-bottom: 10px;
              background: var(--color-surface, #fff);
            }
            .prices-table td {
              display: flex; align-items: center; justify-content: space-between;
              gap: 14px; padding: 9px 0; text-align: right;
              border: 0; border-bottom: 1px solid var(--color-border-subtle, #f1f5f9);
            }
            .prices-table td:last-child { border-bottom: 0; }
            .prices-table td::before {
              content: attr(data-label);
              flex-shrink: 0; text-align: left;
              font-size: 0.75rem; font-weight: 600;
              color: var(--color-text-secondary, #64748b);
            }
            .prices-table td.col-name { display: block; text-align: left; padding: 12px 0 10px; }
            .prices-table td.col-name::before { content: none; }
        }
      `}</style>
    </MainLayout>
  );
}
