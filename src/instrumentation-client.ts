import { initProductAnalytics } from '@/lib/productAnalytics';
import { isInstalledApp } from '@/lib/appMode';

// Remember TWA launches even when the first route has no install banner.
isInstalledApp();

try {
  initProductAnalytics();
} catch {
  // Analytics must never prevent the application from hydrating.
}

