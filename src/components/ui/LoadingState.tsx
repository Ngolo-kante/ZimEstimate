'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type LoadingVariant = 'table' | 'cards' | 'page';

export interface LoadingStateProps {
  /** Skeleton layout variant: table (rows), cards (grid), or page (full shell) */
  variant?: LoadingVariant;
  /** Number of table rows to render (applicable for 'table' variant, default 5) */
  rows?: number;
  /** Number of cards to render (applicable for 'cards' variant, default 6) */
  count?: number;
  /** Optional custom container class name extensions */
  className?: string;
  /** Custom accessible label for screen readers */
  label?: string;
}

export default function LoadingState({
  variant = 'cards',
  rows = 5,
  count = 6,
  className = '',
  label = 'Loading content, please wait...',
}: LoadingStateProps) {
  const renderSkeletonBox = (boxClassName: string, key?: React.Key) => (
    <motion.div
      key={key}
      animate={{ opacity: [0.4, 0.85, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      className={`rounded-lg bg-[var(--color-border-light)] motion-reduce:animate-none ${boxClassName}`}
    />
  );

  const renderTableSkeleton = () => (
    <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xs">
      {/* Table Header Placeholder */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-light)] bg-[var(--color-background)] px-4 py-3 sm:px-6">
        {renderSkeletonBox('h-4 w-32')}
        {renderSkeletonBox('h-4 w-20')}
        {renderSkeletonBox('h-4 w-24 hidden sm:block')}
        {renderSkeletonBox('h-4 w-16')}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-[var(--color-border-light)]">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-3.5 sm:px-6 gap-3"
          >
            <div className="flex items-center gap-3 flex-1">
              {renderSkeletonBox('h-8 w-8 rounded-lg shrink-0')}
              <div className="space-y-1.5 flex-1 max-w-xs">
                {renderSkeletonBox('h-3.5 w-3/4')}
                {renderSkeletonBox('h-2.5 w-1/2')}
              </div>
            </div>
            {renderSkeletonBox('h-4 w-16 shrink-0')}
            {renderSkeletonBox('h-4 w-20 shrink-0 hidden sm:block')}
            {renderSkeletonBox('h-7 w-20 rounded-lg shrink-0')}
          </div>
        ))}
      </div>
    </div>
  );

  const renderCardsSkeleton = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col justify-between rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 shadow-2xs space-y-4"
        >
          {/* Card Top */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {renderSkeletonBox('h-5 w-28')}
              {renderSkeletonBox('h-5 w-14 rounded-full')}
            </div>
            {renderSkeletonBox('h-3.5 w-full')}
            {renderSkeletonBox('h-3.5 w-4/5')}
          </div>

          {/* Card Middle Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border-light)]">
            <div className="space-y-1">
              {renderSkeletonBox('h-2.5 w-12')}
              {renderSkeletonBox('h-4 w-20')}
            </div>
            <div className="space-y-1 text-right flex flex-col items-end">
              {renderSkeletonBox('h-2.5 w-12')}
              {renderSkeletonBox('h-4 w-16')}
            </div>
          </div>

          {/* Card Button */}
          {renderSkeletonBox('h-9 w-full rounded-xl')}
        </div>
      ))}
    </div>
  );

  const renderPageSkeleton = () => (
    <div className="space-y-6 w-full">
      {/* Hero Banner Shell */}
      <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2 flex-1">
            {renderSkeletonBox('h-7 w-56')}
            {renderSkeletonBox('h-4 w-3/4')}
          </div>
          {renderSkeletonBox('h-10 w-36 rounded-xl shrink-0')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[var(--color-border-light)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              {renderSkeletonBox('h-2.5 w-16')}
              {renderSkeletonBox('h-5 w-24')}
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid Content Shell */}
      {renderCardsSkeleton()}
    </div>
  );

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`w-full ${className}`}
    >
      <span className="sr-only">{label}</span>
      {variant === 'table' && renderTableSkeleton()}
      {variant === 'cards' && renderCardsSkeleton()}
      {variant === 'page' && renderPageSkeleton()}
    </div>
  );
}
