'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import {
  MagnifyingGlass,
  Ruler,
  House,
  Check,
} from '@phosphor-icons/react';

const ANALYSIS_STEPS = [
  { id: 'detect', label: 'Detecting floor plan elements', icon: MagnifyingGlass },
  { id: 'measure', label: 'Measuring room dimensions', icon: Ruler },
  { id: 'structure', label: 'Analyzing building structure', icon: House },
];

export default function AnalysisProgress({ onCancel, retrying = false }: { onCancel: () => void; retrying?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  // Derived from the clock rather than set from inside the timer's state
  // update, which React expects to be free of side effects.
  const currentStep = Math.min(Math.floor(elapsed / 10), ANALYSIS_STEPS.length - 1);
  const progress = Math.min(92, 12 + elapsed * 2);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
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

        <h2>Analyzing Floor Plan</h2>
        <p className="subtitle">Our AI is extracting room dimensions and building details</p>
        <p className="time-note">{elapsed < 45 ? `Reading plan · ${elapsed}s elapsed` : 'Still working — complex PDFs can take longer'}</p>

        <div className="steps-list">
          {ANALYSIS_STEPS.map((step, index) => {
            const IconComponent = step.icon;
            const isComplete = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div
                key={step.id}
                className={`step-item ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <div className="step-icon">
                  {isComplete ? (
                    <Check size={18} weight="bold" />
                  ) : (
                    <IconComponent size={18} weight="light" />
                  )}
                </div>
                <span className="step-label">{step.label}</span>
                {isCurrent && <div className="step-dots"><span /><span /><span /></div>}
              </div>
            );
          })}
        </div>

        {retrying && (
          <p className="retry-note" role="status">
            The plan reader was busy, so we&apos;re trying again. This can take up to a minute.
          </p>
        )}

        <button type="button" className="cancel-button" onClick={onCancel}>Cancel and choose another file</button>
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

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
          text-align: left;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          background: rgba(6, 20, 47, 0.02);
          transition: all 0.3s ease;
        }

        .step-item.current {
          background: rgba(78, 154, 247, 0.12);
        }

        .step-item.complete {
          opacity: 0.7;
        }

        .step-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: all 0.3s ease;
          border: 1px solid var(--color-border-light);
        }

        .step-item.current .step-icon {
          background: var(--color-accent);
          color: white;
        }

        .step-item.complete .step-icon {
          background: var(--color-success);
          color: white;
        }

        .step-label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          flex: 1;
        }

        .step-item.current .step-label {
          color: var(--color-text);
          font-weight: 500;
        }

        .step-dots {
          display: flex;
          gap: 4px;
        }

        .step-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-accent);
          animation: pulse 1.4s infinite ease-in-out;
        }

        .step-dots span:nth-child(1) { animation-delay: 0s; }
        .step-dots span:nth-child(2) { animation-delay: 0.2s; }
        .step-dots span:nth-child(3) { animation-delay: 0.4s; }

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

        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
