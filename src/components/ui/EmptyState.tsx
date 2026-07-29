'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Package } from '@phosphor-icons/react';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface EmptyStateProps {
  /** Phosphor Icon component or custom React element */
  icon?: React.ElementType | React.ReactNode;
  /** Primary title / headline explaining the state */
  headline?: string;
  /** Alias for headline for backward compatibility */
  title?: string;
  /** One-line encouraging explanation */
  description: string;
  /** Optional primary action button or link navigation */
  action?: EmptyStateAction | React.ReactNode;
  /** Optional custom container class name extensions */
  className?: string;
}

export default function EmptyState({
  icon: IconProp = Package,
  headline,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();
  const displayTitle = headline || title || 'No items found';

  const renderIcon = () => {
    if (!IconProp) return null;
    if (React.isValidElement(IconProp)) {
      return IconProp;
    }
    const IconComponent = IconProp as React.ElementType;
    return <IconComponent size={36} className="text-[var(--color-accent)]" />;
  };

  const renderAction = () => {
    if (!action) return null;

    if (React.isValidElement(action)) {
      return action;
    }

    const actionObj = action as EmptyStateAction;
    if (!actionObj.label) return null;

    const buttonContent = (
      <span className="inline-flex items-center justify-center font-semibold">
        {actionObj.label}
      </span>
    );

    const baseStyles =
      'inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs sm:text-sm font-bold text-[var(--color-surface)] shadow-sm transition-all hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.98] cursor-pointer';

    if (actionObj.href) {
      return (
        <Link href={actionObj.href} className={baseStyles} aria-label={actionObj.label}>
          {buttonContent}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={actionObj.onClick}
        className={baseStyles}
        aria-label={actionObj.label}
      >
        {buttonContent}
      </button>
    );
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
      role="region"
      aria-label={displayTitle}
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-10 sm:px-8 sm:py-14 text-center shadow-xs ${className}`}
    >
      {/* Icon Badge */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-primary-bg)] shadow-2xs">
        {renderIcon()}
      </div>

      {/* Headline & Description */}
      <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] tracking-tight">
        {displayTitle}
      </h3>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] leading-relaxed">
        {description}
      </p>

      {/* Action Button */}
      {action && <div className="mt-6">{renderAction()}</div>}
    </motion.div>
  );
}
