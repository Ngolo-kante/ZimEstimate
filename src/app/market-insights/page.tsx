'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  TrendUp,
  TrendDown,
  MagnifyingGlass,
  Cube,
  Drop,
  CheckCircle,
  Lightning,
} from '@phosphor-icons/react';
import {
  materials,
  getBestPrice,
} from '@/lib/materials';

// Material categories for filtering
const categories = [
  { id: 'all', label: 'All Materials', icon: Cube },
  { id: 'bricks', label: 'Bricks', icon: Cube },
  { id: 'cement', label: 'Cement', icon: CheckCircle },
  { id: 'sand', label: 'Sand & Aggregates', icon: Drop },
  { id: 'roofing', label: 'Roofing', icon: Cube },
  { id: 'electrical', label: 'Electrical', icon: Lightning },
];

// Build price data from materials database with simulated trends
const materialPrices = materials.slice(0, 15).map((m, index) => {
  const bestPrice = getBestPrice(m.id);
  const trends = ['up', 'down', 'stable'] as const;
  const trend = trends[index % 3];
  const changes = [2.5, -1.8, 0, 5.2, 3.1, -2.3, 8.5, 4.2, 0, 1.5];

  return {
    id: index + 1,
    name: m.name,
    category: m.category,
    unit: m.unit,
    priceUsd: bestPrice?.priceUsd || 0,
    priceZwg: bestPrice?.priceZwg || 0,
    change: changes[index % changes.length],
    trend: trend,
  };
});

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
  const { formatPrice } = useCurrency();
  return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function MarketInsightsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name');

  const filteredMaterials = materialPrices
    .filter((m) => selectedCategory === 'all' || m.category === selectedCategory)
    .filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price') return b.priceUsd - a.priceUsd;
      if (sortBy === 'change') return b.change - a.change;
      return a.name.localeCompare(b.name);
    });

  const avgChange = materialPrices.reduce((sum, m) => sum + m.change, 0) / materialPrices.length;
  const risingCount = materialPrices.filter((m) => m.trend === 'up').length;

  return (
    <MainLayout title="Market Insights">
      <div className="market-page">
        {/* Summary Stats */}
        <div className="stats-row">
          <Card variant="dashboard" className="stat-card">
            <CardContent>
              <p className="stat-label">Average Price Change</p>
              <p className={`stat-value ${avgChange >= 0 ? 'up' : 'down'}`}>
                {avgChange >= 0 ? <TrendUp size={24} /> : <TrendDown size={24} />}
                {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)}%
              </p>
              <p className="stat-period">Last 30 days</p>
            </CardContent>
          </Card>

          <Card variant="dashboard" className="stat-card">
            <CardContent>
              <p className="stat-label">Materials Rising</p>
              <p className="stat-value neutral">{risingCount} of {materialPrices.length}</p>
              <p className="stat-period">Currently trending up</p>
            </CardContent>
          </Card>

          <Card variant="dashboard" className="stat-card">
            <CardContent>
              <p className="stat-label">Data Sources</p>
              <p className="stat-value neutral">12 active</p>
              <p className="stat-period">Updated 2 hours ago</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="search-box">
            <Input
              placeholder="Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<MagnifyingGlass size={18} weight="light" />}
            />
          </div>

          <div className="category-pills">
            {categories.map((cat) => {
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <IconComponent size={16} weight="light" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="sort-control">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="change">% Change</option>
            </select>
          </div>
        </div>

        {/* Price Table */}
        <Card className="prices-card">
          <table className="prices-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th>Price</th>
                <th>30-Day Change</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((material) => (
                <tr key={material.id}>
                  <td>
                    <span className="material-name">{material.name}</span>
                    <span className="material-category">{categories.find(c => c.id === material.category)?.label}</span>
                  </td>
                  <td className="unit-cell">{material.unit}</td>
                  <td className="price-cell">
                    <PriceDisplay priceUsd={material.priceUsd} priceZwg={material.priceZwg} />
                  </td>
                  <td className={`change-cell ${material.trend}`}>
                    {material.trend === 'up' && <TrendUp size={16} />}
                    {material.trend === 'down' && <TrendDown size={16} />}
                    {material.change === 0 ? '—' : `${material.change >= 0 ? '+' : ''}${material.change}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="disclaimer">
          Prices are indicative averages from multiple suppliers in Harare. Actual prices may vary by location and supplier.
        </p>
      </div>

      <style jsx>{`
        .market-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-lg);
        }

        .stat-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .stat-value {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 var(--spacing-xs) 0;
        }

        .stat-value.up { color: var(--color-success); }
        .stat-value.down { color: var(--color-error); }
        .stat-value.neutral { color: var(--color-text); }

        .stat-period {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        .filters-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .search-box {
          max-width: 400px;
        }

        .category-pills {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
        }

        .category-pill {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-md);
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-full);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-pill:hover {
          border-color: var(--color-accent);
        }

        .category-pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-primary);
        }

        .sort-control {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .sort-control label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .sort-control select {
          padding: var(--spacing-xs) var(--spacing-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          font-size: 0.875rem;
          color: var(--color-text);
        }

        .prices-table {
          width: 100%;
          border-collapse: collapse;
        }

        .prices-table th,
        .prices-table td {
          padding: var(--spacing-md);
          text-align: left;
          border-bottom: 1px solid var(--color-border-light);
        }

        .prices-table th {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .material-name {
          display: block;
          font-weight: 500;
          color: var(--color-text);
        }

        .material-category {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .unit-cell {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .price-cell {
          font-weight: 600;
          color: var(--color-text);
        }

        .change-cell {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-weight: 500;
        }

        .change-cell.up { color: var(--color-success); }
        .change-cell.down { color: var(--color-error); }
        .change-cell.stable { color: var(--color-text-muted); }

        .disclaimer {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          text-align: center;
          margin: 0;
        }

        @media (max-width: 768px) {
          .stats-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </MainLayout>
  );
}
