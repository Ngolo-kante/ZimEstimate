import { initProductAnalytics } from '@/lib/productAnalytics';

try {
  initProductAnalytics();
} catch {
  // Analytics must never prevent the application from hydrating.
}

