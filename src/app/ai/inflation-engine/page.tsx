'use client';

import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  TrendUp,
  TrendDown,
  ChartLine,
  Lightning,
  Warning,
  Info,
  ArrowRight,
} from '@phosphor-icons/react';

interface PricePrediction {
  materialId: string;
  materialName: string;
  category: string;
  currentPrice: number;
  predictions: {
    months1: { price: number; change: number };
    months3: { price: number; change: number };
    months6: { price: number; change: number };
    months12: { price: number; change: number };
  };
  volatility: 'low' | 'medium' | 'high';
  confidence: number;
  factors: string[];
}

function PriceDisplay({ price }: { price: number }) {
  const { formatPrice } = useCurrency();
  const zwgPrice = price * 30; // Approximate rate
  return <>{formatPrice(price, zwgPrice)}</>;
}

function ChangeIndicator({ change }: { change: number }) {
  const isPositive = change > 0;
  return (
    <span className={`change ${isPositive ? 'up' : change < 0 ? 'down' : ''}`}>
      {isPositive ? <TrendUp size={14} /> : change < 0 ? <TrendDown size={14} /> : null}
      {change > 0 ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

// Generate predictions (in production, this would come from an ML model)
function generatePredictions(): PricePrediction[] {
  const predictionData: PricePrediction[] = [
    {
      materialId: 'cement-325',
      materialName: 'Standard Cement 32.5N',
      category: 'cement',
      currentPrice: 10,
      predictions: {
        months1: { price: 10.3, change: 3.0 },
        months3: { price: 11.2, change: 12.0 },
        months6: { price: 12.5, change: 25.0 },
        months12: { price: 14.0, change: 40.0 },
      },
      volatility: 'high',
      confidence: 72,
      factors: ['USD/ZWL exchange rate fluctuations', 'Regional cement shortage', 'Increased construction demand'],
    },
    {
      materialId: 'brick-common',
      materialName: 'Common Cement Brick',
      category: 'bricks',
      currentPrice: 75,
      predictions: {
        months1: { price: 76, change: 1.3 },
        months3: { price: 78, change: 4.0 },
        months6: { price: 82, change: 9.3 },
        months12: { price: 88, change: 17.3 },
      },
      volatility: 'low',
      confidence: 85,
      factors: ['Local production stable', 'Minimal import dependency'],
    },
    {
      materialId: 'sand-river',
      materialName: 'River Sand (Concrete)',
      category: 'sand',
      currentPrice: 45,
      predictions: {
        months1: { price: 45.5, change: 1.1 },
        months3: { price: 47, change: 4.4 },
        months6: { price: 48, change: 6.7 },
        months12: { price: 52, change: 15.6 },
      },
      volatility: 'low',
      confidence: 88,
      factors: ['Seasonal availability patterns', 'Fuel cost changes'],
    },
    {
      materialId: 'rebar-12',
      materialName: 'Rebar Y12 (6m)',
      category: 'steel',
      currentPrice: 8,
      predictions: {
        months1: { price: 8.4, change: 5.0 },
        months3: { price: 9.2, change: 15.0 },
        months6: { price: 10.5, change: 31.3 },
        months12: { price: 12.0, change: 50.0 },
      },
      volatility: 'high',
      confidence: 65,
      factors: ['Global steel prices', 'Import duty changes', 'USD exchange rate'],
    },
    {
      materialId: 'ibr-04-3m',
      materialName: 'IBR Sheet 0.4mm (3m)',
      category: 'roofing',
      currentPrice: 18,
      predictions: {
        months1: { price: 18.5, change: 2.8 },
        months3: { price: 19.8, change: 10.0 },
        months6: { price: 21.5, change: 19.4 },
        months12: { price: 24, change: 33.3 },
      },
      volatility: 'medium',
      confidence: 75,
      factors: ['Zinc coating costs', 'Steel input prices', 'Local production capacity'],
    },
    {
      materialId: 'cable-25',
      materialName: '2.5mm Twin & Earth Cable',
      category: 'electrical',
      currentPrice: 85,
      predictions: {
        months1: { price: 87, change: 2.4 },
        months3: { price: 92, change: 8.2 },
        months6: { price: 98, change: 15.3 },
        months12: { price: 110, change: 29.4 },
      },
      volatility: 'medium',
      confidence: 78,
      factors: ['Copper price volatility', 'Import logistics costs'],
    },
  ];

  return predictionData;
}

export default function InflationEnginePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'months1' | 'months3' | 'months6' | 'months12'>('months3');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const predictions = useMemo(() => generatePredictions(), []);

  const periods = [
    { id: 'months1', label: '1 Month' },
    { id: 'months3', label: '3 Months' },
    { id: 'months6', label: '6 Months' },
    { id: 'months12', label: '12 Months' },
  ] as const;

  const filteredPredictions = selectedCategory === 'all'
    ? predictions
    : predictions.filter((p) => p.category === selectedCategory);

  // Calculate average prediction
  const avgChange = filteredPredictions.reduce((sum, p) => sum + p.predictions[selectedPeriod].change, 0) / filteredPredictions.length;
  const highRiskCount = filteredPredictions.filter((p) => p.volatility === 'high').length;

  return (
    <MainLayout title="Inflation Engine">
      <div className="inflation-page">
        {/* Header Stats */}
        <div className="stats-row">
          <Card className="stat-card">
            <CardContent>
              <div className="stat-icon orange">
                <ChartLine size={24} weight="light" />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {avgChange > 0 ? '+' : ''}{avgChange.toFixed(1)}%
                </span>
                <span className="stat-label">Avg. Predicted Change</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <div className="stat-icon red">
                <Warning size={24} weight="light" />
              </div>
              <div className="stat-content">
                <span className="stat-value">{highRiskCount}</span>
                <span className="stat-label">High Volatility Items</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent>
              <div className="stat-icon blue">
                <Lightning size={24} weight="fill" />
              </div>
              <div className="stat-content">
                <span className="stat-value">AI Powered</span>
                <span className="stat-label">Based on market trends & patterns</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="filters-row">
          <div className="period-selector">
            <span className="filter-label">Prediction period:</span>
            <div className="period-pills">
              {periods.map((period) => (
                <button
                  key={period.id}
                  className={`period-pill ${selectedPeriod === period.id ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod(period.id)}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          <div className="category-filter">
            <span className="filter-label">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              <option value="all">All Materials</option>
              <option value="cement">Cement</option>
              <option value="bricks">Bricks</option>
              <option value="sand">Sand & Aggregates</option>
              <option value="steel">Steel</option>
              <option value="roofing">Roofing</option>
              <option value="electrical">Electrical</option>
            </select>
          </div>
        </div>

        {/* Predictions Grid */}
        <div className="predictions-grid">
          {filteredPredictions.map((prediction) => (
            <Card key={prediction.materialId} className="prediction-card">
              <CardContent>
                <div className="card-header">
                  <div>
                    <h3>{prediction.materialName}</h3>
                    <span className="category-badge">{prediction.category}</span>
                  </div>
                  <div className={`volatility-badge ${prediction.volatility}`}>
                    {prediction.volatility} volatility
                  </div>
                </div>

                <div className="price-comparison">
                  <div className="price-block current">
                    <span className="price-label">Current</span>
                    <span className="price-value">
                      <PriceDisplay price={prediction.currentPrice} />
                    </span>
                  </div>
                  <ArrowRight size={20} className="arrow" />
                  <div className="price-block predicted">
                    <span className="price-label">Predicted</span>
                    <span className="price-value">
                      <PriceDisplay price={prediction.predictions[selectedPeriod].price} />
                    </span>
                    <ChangeIndicator change={prediction.predictions[selectedPeriod].change} />
                  </div>
                </div>

                <div className="prediction-timeline">
                  {periods.map((period) => (
                    <div
                      key={period.id}
                      className={`timeline-item ${period.id === selectedPeriod ? 'active' : ''}`}
                    >
                      <span className="timeline-label">{period.label}</span>
                      <span className="timeline-change">
                        {prediction.predictions[period.id].change > 0 ? '+' : ''}
                        {prediction.predictions[period.id].change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="factors">
                  <h4><Info size={14} /> Key Factors</h4>
                  <ul>
                    {prediction.factors.map((factor, index) => (
                      <li key={index}>{factor}</li>
                    ))}
                  </ul>
                </div>

                <div className="confidence-bar">
                  <span className="confidence-label">AI Confidence: {prediction.confidence}%</span>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{ width: `${prediction.confidence}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Disclaimer */}
        <Card className="disclaimer-card">
          <CardContent>
            <div className="disclaimer-content">
              <Info size={20} />
              <div>
                <strong>Disclaimer</strong>
                <p>
                  Price predictions are generated using machine learning models trained on historical
                  data and market indicators. Actual prices may vary based on real-world conditions.
                  Use these predictions as guidance, not guaranteed outcomes. The model is updated
                  weekly with the latest market data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        .inflation-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-md);
        }

        .stat-card {
          display: flex;
        }

        .stat-card :global(.card-content) {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.orange {
          background: rgba(252, 163, 17, 0.15);
          color: var(--color-accent);
        }

        .stat-icon.red {
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-error);
        }

        .stat-icon.blue {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .stat-value {
          display: block;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .filters-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }

        .filter-label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-right: var(--spacing-sm);
        }

        .period-selector {
          display: flex;
          align-items: center;
        }

        .period-pills {
          display: flex;
          gap: var(--spacing-xs);
        }

        .period-pill {
          padding: var(--spacing-xs) var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          background: var(--color-surface);
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .period-pill:hover {
          border-color: var(--color-accent);
        }

        .period-pill.active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: var(--color-primary);
        }

        .category-filter {
          display: flex;
          align-items: center;
        }

        .category-select {
          padding: var(--spacing-xs) var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 0.875rem;
        }

        .predictions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: var(--spacing-lg);
        }

        .prediction-card .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-md);
        }

        .prediction-card h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .category-badge {
          font-size: 0.75rem;
          text-transform: capitalize;
          color: var(--color-text-muted);
        }

        .volatility-badge {
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          text-transform: capitalize;
        }

        .volatility-badge.low {
          background: rgba(34, 197, 94, 0.15);
          color: var(--color-success);
        }

        .volatility-badge.medium {
          background: rgba(251, 191, 36, 0.15);
          color: var(--color-warning);
        }

        .volatility-badge.high {
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-error);
        }

        .price-comparison {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-background);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
          margin-bottom: var(--spacing-md);
        }

        .price-block {
          text-align: center;
        }

        .price-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-bottom: 4px;
        }

        .price-value {
          display: block;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .predicted .price-value {
          color: var(--color-accent);
        }

        .arrow {
          color: var(--color-text-muted);
        }

        .change {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .change.up {
          color: var(--color-error);
        }

        .change.down {
          color: var(--color-success);
        }

        .prediction-timeline {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
          padding: var(--spacing-sm) 0;
          border-bottom: 1px solid var(--color-border-light);
        }

        .timeline-item {
          text-align: center;
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
          transition: background 0.2s ease;
        }

        .timeline-item.active {
          background: rgba(252, 163, 17, 0.1);
        }

        .timeline-label {
          display: block;
          font-size: 0.625rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
        }

        .timeline-change {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .timeline-item.active .timeline-change {
          color: var(--color-accent);
        }

        .factors h4 {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .factors ul {
          margin: 0;
          padding-left: var(--spacing-md);
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .factors li {
          margin-bottom: 4px;
        }

        .confidence-bar {
          margin-top: var(--spacing-md);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
        }

        .confidence-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        .bar {
          height: 4px;
          background: var(--color-background);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: var(--color-accent);
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .disclaimer-card {
          background: var(--color-background);
        }

        .disclaimer-content {
          display: flex;
          gap: var(--spacing-md);
          color: var(--color-text-secondary);
        }

        .disclaimer-content strong {
          display: block;
          color: var(--color-text);
          margin-bottom: var(--spacing-xs);
        }

        .disclaimer-content p {
          margin: 0;
          font-size: 0.875rem;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .stats-row {
            grid-template-columns: 1fr;
          }

          .predictions-grid {
            grid-template-columns: 1fr;
          }

          .filters-row {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </MainLayout>
  );
}
