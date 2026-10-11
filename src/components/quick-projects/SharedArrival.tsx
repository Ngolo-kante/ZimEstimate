'use client';

import { useEffect } from 'react';
import { recordSharedLinkArrival } from '@/lib/productAnalytics';

/** Counts the visit as a shared-link arrival — held until the visitor consents. */
export default function SharedArrival({ estimate }: { estimate: string }) {
  useEffect(() => {
    recordSharedLinkArrival(estimate);
  }, [estimate]);
  return null;
}
