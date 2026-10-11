'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { capturePageView } from '@/lib/productAnalytics';

export default function ProductAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    capturePageView(pathname);
  }, [pathname]);

  return children;
}
