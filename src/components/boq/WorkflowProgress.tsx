'use client';

import { useEffect, useRef } from 'react';
import styles from './WorkflowProgress.module.css';

export interface WorkflowStep {
  id: string;
  label: string;
}

interface WorkflowProgressProps {
  currentStep: number;
  maxStepReached: number;
  steps: WorkflowStep[];
  minutesRemaining?: number;
  onStepSelect?: (index: number) => void;
}

export default function WorkflowProgress({
  currentStep,
  maxStepReached,
  steps,
  minutesRemaining,
  onStepSelect,
}: WorkflowProgressProps) {
  const progress = steps.length > 1 ? Math.round((currentStep / (steps.length - 1)) * 100) : 100;
  const stepsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const centerCurrentStep = () => {
      const nav = stepsRef.current;
      const current = nav?.children[currentStep] as HTMLElement | undefined;
      if (!nav || !current) return;
      nav.scrollTo({
        left: Math.max(0, current.offsetLeft - nav.clientWidth / 2 + current.clientWidth / 2),
        behavior: 'smooth',
      });
    };

    centerCurrentStep();
    window.addEventListener('resize', centerCurrentStep);
    return () => window.removeEventListener('resize', centerCurrentStep);
  }, [currentStep]);

  return (
    <div className={styles.progress}>
      <div className={styles.meta}>
        <span>Step {currentStep + 1} of {steps.length}</span>
        <strong>{progress}%</strong>
        {minutesRemaining !== undefined && <span>~{minutesRemaining} min remaining</span>}
      </div>
      <div className={styles.track} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <nav ref={stepsRef} className={styles.steps} aria-label="Estimate steps">
        {steps.map((step, index) => {
          const current = index === currentStep;
          const reachable = index <= maxStepReached;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable || !onStepSelect}
              aria-current={current ? 'step' : undefined}
              onClick={() => onStepSelect?.(index)}
              className={`${styles.step} ${current ? styles.current : reachable ? styles.complete : styles.locked}`}
            >
              <span>{index + 1}</span>
              {step.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
