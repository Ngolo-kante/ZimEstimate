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

export default function AnalysisProgress() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress through steps
    const stepDuration = 800; // ms per step
    const progressInterval = 50; // ms per progress tick

    const advanceProgress = () => {
      setProgress((prev) => {
        const target = ((currentStep + 1) / ANALYSIS_STEPS.length) * 100;
        if (prev < target) {
          return Math.min(prev + 2, target);
        }
        return prev;
      });
    };

    const progressTimer = setInterval(advanceProgress, progressInterval);

    const stepTimer = setTimeout(() => {
      if (currentStep < ANALYSIS_STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    }, stepDuration);

    return () => {
      clearTimeout(stepTimer);
      clearInterval(progressTimer);
    };
  }, [currentStep]);

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
      </Card>

      <style jsx>{`
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
          margin: 0 0 var(--spacing-xl) 0;
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
          background: var(--color-background);
          transition: all 0.3s ease;
        }

        .step-item.current {
          background: var(--color-accent-bg);
        }

        .step-item.complete {
          opacity: 0.7;
        }

        .step-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background: var(--color-surface);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          transition: all 0.3s ease;
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

        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
