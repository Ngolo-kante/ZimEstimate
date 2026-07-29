'use client';

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { WarningCircle, ArrowCounterClockwise, CaretDown, CaretUp } from '@phosphor-icons/react';

export interface ErrorStateProps {
  /** Plain language explanation of what failed */
  whatFailed: string;
  /** Optional technical error details, code, or stack trace */
  technicalDetail?: string;
  /** Retry callback function */
  onRetry?: () => void;
  /** Custom label for retry button (default "Try Again") */
  retryLabel?: string;
  /** Optional custom container class name extensions */
  className?: string;
}

export default function ErrorState({
  whatFailed,
  technicalDetail,
  onRetry,
  retryLabel = 'Try Again',
  className = '',
}: ErrorStateProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 sm:px-8 sm:py-10 text-center shadow-xs ${className}`}
    >
      {/* Error Icon Badge */}
      <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-error-bg)] text-[var(--color-error)] shadow-2xs">
        <WarningCircle size={32} weight="duotone" />
      </div>

      {/* Main Error Headline */}
      <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] tracking-tight">
        {whatFailed}
      </h3>
      <p className="mt-1 max-w-md text-xs sm:text-sm font-medium text-[var(--color-text-secondary)]">
        We encountered an issue completing this request. Please try again or contact support if the problem persists.
      </p>

      {/* Visually De-emphasized Technical Details */}
      {technicalDetail && (
        <div className="mt-4 w-full max-w-md">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            aria-expanded={showTechnicalDetails}
            aria-label="Toggle technical error details"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-text-secondary)] transition outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded px-1"
          >
            <span>{showTechnicalDetails ? 'Hide details' : 'Technical details'}</span>
            {showTechnicalDetails ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </button>

          {showTechnicalDetails && (
            <motion.div
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={reduceMotion ? undefined : { height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 text-left font-mono text-[11px] text-[var(--color-text-secondary)] break-all"
            >
              <code>{technicalDetail}</code>
            </motion.div>
          )}
        </div>
      )}

      {/* Retry Action Button */}
      {onRetry && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-surface)] shadow-sm transition-all hover:bg-[var(--color-primary-light)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] cursor-pointer"
            aria-label={retryLabel}
          >
            <ArrowCounterClockwise size={16} />
            <span>{retryLabel}</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
