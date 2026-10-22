'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Link from 'next/link';
import { analysisProgress, type AnalysisPhase } from '@/lib/vision/analyzePlan';

export default function AnalysisProgress({ onCancel, retrying = false, phase = 'preparing' }: {
  onCancel: () => void;
  retrying?: boolean;
  phase?: AnalysisPhase;
}) {
  const [elapsed, setElapsed] = useState(0);

  const progress = analysisProgress(elapsed);
  const preparing = phase === 'preparing';

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="analysis-progress">
      <Card className="progress-card">
        <div className="spinner-container">
          <div className="spinner">
            <svg viewBox="0 0 100 100" className="spinner-svg">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--color-border-light)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.83} 283`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="spinner-center">
              <span className="progress-text">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        <h2>{preparing ? 'Preparing your plan…' : 'Reading your plan…'}</h2>
        <p className="subtitle">{preparing ? 'Preparing your file for upload.' : 'Extracting room dimensions and building details.'}</p>
        <p className="time-note" role="status">{elapsed >= 75
          ? 'This is taking much longer than usual.'
          : elapsed >= 45
            ? 'Detailed plans can take up to a minute — still working.'
            : `${preparing ? 'Preparing' : 'Reading'} plan · ${Math.floor(elapsed)}s elapsed`}</p>

        {retrying && (
          <p className="retry-note" role="status">
            The plan reader was busy, so we&apos;re trying again. This can take up to a minute.
          </p>
        )}

        <button type="button" className="cancel-button" onClick={onCancel}>{elapsed >= 75 ? 'Cancel' : 'Cancel and choose another file'}</button>
        {elapsed >= 75 && <Link href="/boq/new?method=manual" className="manual-button" onClick={onCancel}>Use the manual builder</Link>}
      </Card>

      <style jsx>{`
        .retry-note {
          margin: 12px 0 0;
          border-radius: 10px;
          background: #fff7e6;
          padding: 10px 12px;
          color: #8a5300;
          font-size: 0.85rem;
          line-height: 1.45;
          text-align: center;
        }

        .analysis-progress {
          max-width: 500px;
          margin: 0 auto;
          padding: var(--spacing-xl) 0;
        }

        .progress-card :global(.card) {
          text-align: center;
          padding: var(--spacing-2xl);
        }

        .spinner-container {
          display: flex;
          justify-content: center;
          margin-bottom: var(--spacing-xl);
        }

        .spinner {
          position: relative;
          width: 120px;
          height: 120px;
        }

        .spinner-svg {
          width: 100%;
          height: 100%;
          animation: rotate 2s linear infinite;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spinner-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .progress-text {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-text);
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
          margin: 0 0 var(--spacing-sm) 0;
        }

        .time-note {
          margin: 0 0 var(--spacing-xl);
          color: var(--color-text-muted);
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .analysis-progress :global(.manual-button) {
          display: inline-block;
          margin: 12px;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          background: var(--color-accent);
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
        }

        .cancel-button {
          margin-top: var(--spacing-lg);
          padding: 9px 12px;
          color: var(--color-text-secondary);
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--color-border-light);
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }

        .cancel-button:hover {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }

      `}</style>
    </div>
  );
}
