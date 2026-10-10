'use client';

import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { captureProductEvent, type ProductAnalyticsEvent } from '@/lib/productAnalytics';

type TrackedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    event: ProductAnalyticsEvent;
    eventProperties?: Record<string, string | number | boolean | null | undefined>;
  };

export default function TrackedLink({
  children,
  event,
  eventProperties,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(clickEvent) => {
        captureProductEvent(event, eventProperties);
        onClick?.(clickEvent);
      }}
    >
      {children}
    </Link>
  );
}

