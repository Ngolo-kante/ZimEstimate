'use client';

import Card from '@/components/ui/Card';
import {
  Warning,
  ArrowRight,
  PencilLine,
} from '@phosphor-icons/react';

interface ConfidenceWarningProps {
  confidence: number;
  onContinue: () => void;
  onManualEntry: () => void;
}

export default function ConfidenceWarning({
  confidence,
  onContinue,
  onManualEntry,
}: ConfidenceWarningProps) {
  const confidenceLevel = confidence < 50 ? 'low' : 'medium';

  return (
    <div className="confidence-warning">
      <Card className="warning-card">
        <div className={`warning-icon ${confidenceLevel}`}>
          <Warning size={40} weight="fill" />
        </div>

        <h2>Low Detection Confidence</h2>

        <div className="confidence-display">
          <div className="confidence-bar">
            <div
              className={`confidence-fill ${confidenceLevel}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="confidence-value">{Math.round(confidence)}% confidence</span>
        </div>

        <p className="warning-message">
          Our AI was only able to detect floor plan elements with{' '}
          <strong>{Math.round(confidence)}% confidence</strong>. This may happen with:
        </p>

        <ul className="issue-list">
          <li>Low resolution or blurry images</li>
          <li>Hand-drawn sketches</li>
          <li>Plans without visible dimensions</li>
          <li>Complex or non-standard layouts</li>
        </ul>

        <div className="recommendation">
          <strong>Recommendation:</strong> For accurate cost estimates, we suggest using
          the manual BOQ builder where you can enter exact dimensions.
        </div>

        <div className="action-buttons">
          <button className="btn btn-secondary" onClick={onContinue}>
            Continue Anyway
            <ArrowRight size={18} weight="bold" />
          </button>

          <button className="btn btn-primary" onClick={onManualEntry}>
            <PencilLine size={18} weight="light" />
            Use Manual Entry
          </button>
        </div>
      </Card>

      <style jsx>{`
        .confidence-warning {
          max-width: 500px;
          margin: 0 auto;
          padding: var(--spacing-xl) 0;
        }

        .warning-card :global(.card) {
          text-align: center;
          padding: var(--spacing-2xl);
        }

        .warning-icon {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--spacing-lg);
        }

        .warning-icon.low {
          background: var(--color-error-bg);
          color: var(--color-error);
        }

        .warning-icon.medium {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }

        h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-lg) 0;
        }

        .confidence-display {
          margin-bottom: var(--spacing-lg);
        }

        .confidence-bar {
          height: 8px;
          background: var(--color-background);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: var(--spacing-xs);
        }

        .confidence-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }

        .confidence-fill.low {
          background: var(--color-error);
        }

        .confidence-fill.medium {
          background: var(--color-warning);
        }

        .confidence-value {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .warning-message {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          line-height: 1.6;
          margin: 0 0 var(--spacing-md) 0;
          text-align: left;
        }

        .issue-list {
          text-align: left;
          margin: 0 0 var(--spacing-lg) 0;
          padding-left: var(--spacing-lg);
        }

        .issue-list li {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin-bottom: var(--spacing-xs);
        }

        .recommendation {
          text-align: left;
          padding: var(--spacing-md);
          background: var(--color-accent-bg);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xl);
        }

        .recommendation strong {
          color: var(--color-accent);
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-lg);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-primary {
          background: var(--color-primary);
          color: var(--color-text-inverse);
        }

        .btn-primary:hover {
          background: var(--color-primary-dark);
        }

        .btn-secondary {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        }

        .btn-secondary:hover {
          border-color: var(--color-text-muted);
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
}
