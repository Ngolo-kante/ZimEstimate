'use client';

import { Calculator } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';

/* A short beat between choosing materials and seeing the estimate. The BOQ
   is already worked out by the time this shows (useVisionTakeoff), so every
   figure here is the plan's own. It used to count up random numbers of
   bricks, cement bags and tonnes of sand for two and a half seconds. */

export default function CalculationAnimation({ rooms, floorAreaM2, lines }: {
  rooms: number;
  floorAreaM2: number;
  /** Lines in the bill of quantities just made. */
  lines: number;
}) {
  const figures = [
    { label: rooms === 1 ? 'Room' : 'Rooms', value: rooms.toLocaleString() },
    { label: 'Floor area', value: `${Math.round(floorAreaM2).toLocaleString()} m²` },
    { label: 'Items priced', value: lines.toLocaleString() },
  ];

  return (
    <div className="calculation-animation" role="status">
      <Card>
        <div className="calc-icon" aria-hidden="true">
          <Calculator size={40} weight="light" />
        </div>

        <h1 tabIndex={-1}>Pricing your plan</h1>

        <dl className="figures">
          {figures.map((figure) => (
            <div key={figure.label} className="figure">
              <dd>{figure.value}</dd>
              <dt>{figure.label}</dt>
            </div>
          ))}
        </dl>
      </Card>

      <style jsx>{`
        .calculation-animation {
          max-width: 500px;
          margin: 0 auto;
          padding: var(--spacing-xl) 0;
        }

        .calculation-animation :global(.card) {
          text-align: center;
          padding: var(--spacing-2xl) var(--spacing-lg);
        }

        .calc-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          margin: 0 auto var(--spacing-md);
          border: 1px solid rgba(46, 108, 246, 0.2);
          border-radius: var(--radius-full);
          background: var(--color-accent-muted);
          color: var(--color-accent);
        }

        h1 {
          margin: 0 0 var(--spacing-lg);
          color: var(--color-text);
          font-size: 1.25rem;
          font-weight: 600;
          outline: none;
        }

        .figures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-sm);
          margin: 0;
          padding: var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-mist);
        }

        .figure {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        dd {
          margin: 0;
          color: var(--color-text);
          font-size: 1.125rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        dt {
          color: var(--color-text-secondary);
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
