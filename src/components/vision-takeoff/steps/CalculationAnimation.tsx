'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import {
  Calculator,
  Wall,
  Shovel,
  HouseLine,
  PaintBucket,
} from '@phosphor-icons/react';

const CALCULATION_ITEMS = [
  { id: 'foundation', label: 'Foundation materials', icon: Shovel },
  { id: 'walls', label: 'Wall bricks & mortar', icon: Wall },
  { id: 'structure', label: 'Structural elements', icon: HouseLine },
  { id: 'finishes', label: 'Finishes & fittings', icon: PaintBucket },
];

export default function CalculationAnimation() {
  const [currentItem, setCurrentItem] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({
    bricks: 0,
    cement: 0,
    sand: 0,
  });

  useEffect(() => {
    // Animate through calculation items
    const itemTimer = setInterval(() => {
      setCurrentItem((prev) => (prev + 1) % CALCULATION_ITEMS.length);
    }, 600);

    // Animate counting numbers
    const countTimer = setInterval(() => {
      setCounts((prev) => ({
        bricks: Math.min(prev.bricks + Math.floor(Math.random() * 500), 12500),
        cement: Math.min(prev.cement + Math.floor(Math.random() * 5), 85),
        sand: Math.min(prev.sand + Math.floor(Math.random() * 2), 24),
      }));
    }, 100);

    return () => {
      clearInterval(itemTimer);
      clearInterval(countTimer);
    };
  }, []);

  return (
    <div className="calculation-animation">
      <Card>
        <div className="calc-icon">
          <Calculator size={48} weight="light" />
        </div>

        <h2>Generating Bill of Quantities</h2>
        <p className="subtitle">Calculating materials based on your floor plan and configuration</p>

        <div className="items-list">
          {CALCULATION_ITEMS.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = index === currentItem;
            const isPast = index < currentItem;

            return (
              <div
                key={item.id}
                className={`calc-item ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
              >
                <div className="item-icon">
                  <IconComponent size={20} weight={isActive ? 'fill' : 'light'} />
                </div>
                <span className="item-label">{item.label}</span>
                {isActive && <div className="item-progress" />}
              </div>
            );
          })}
        </div>

        <div className="live-counts">
          <div className="count-item">
            <span className="count-value">{counts.bricks.toLocaleString()}</span>
            <span className="count-label">Bricks</span>
          </div>
          <div className="count-item">
            <span className="count-value">{counts.cement}</span>
            <span className="count-label">Cement bags</span>
          </div>
          <div className="count-item">
            <span className="count-value">{counts.sand}</span>
            <span className="count-label">Sand (tonnes)</span>
          </div>
        </div>
      </Card>

      <style jsx>{`
        .calculation-animation {
          max-width: 500px;
          margin: 0 auto;
          padding: var(--spacing-xl) 0;
        }

        .calculation-animation :global(.card) {
          text-align: center;
          padding: var(--spacing-2xl);
        }

        .calc-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto var(--spacing-lg);
          border-radius: var(--radius-full);
          background: var(--color-accent-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          animation: pulse-icon 1s ease-in-out infinite;
        }

        @keyframes pulse-icon {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .subtitle {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-xl) 0;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xl);
        }

        .calc-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-background);
          border-radius: var(--radius-md);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .calc-item.active {
          background: var(--color-accent-bg);
        }

        .calc-item.past {
          opacity: 0.5;
        }

        .item-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background: var(--color-surface);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: all 0.3s ease;
        }

        .calc-item.active .item-icon {
          background: var(--color-accent);
          color: white;
        }

        .item-label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          flex: 1;
          text-align: left;
        }

        .calc-item.active .item-label {
          color: var(--color-text);
          font-weight: 500;
        }

        .item-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          background: var(--color-accent);
          animation: progress 0.6s linear;
        }

        @keyframes progress {
          from { width: 0; }
          to { width: 100%; }
        }

        .live-counts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          background: var(--color-background);
          border-radius: var(--radius-md);
        }

        .count-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .count-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-accent);
          font-variant-numeric: tabular-nums;
        }

        .count-label {
          font-size: 0.625rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
