'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import AnalyticsConsentBanner from '@/components/ui/AnalyticsConsentBanner';
import {
  capturePageView,
  getAnalyticsConsent,
  identifyAnalyticsUser,
  isProductAnalyticsConfigured,
  setAnalyticsConsent,
  subscribeToAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/productAnalytics';

function subscribeToMount() {
  return () => undefined;
}

export default function ProductAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const configured = isProductAnalyticsConfigured();
  const consent = useSyncExternalStore(subscribeToAnalyticsConsent, getAnalyticsConsent, () => null);
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true);
    window.addEventListener('zimestimate:open-analytics-preferences', openPreferences);
    return () => window.removeEventListener('zimestimate:open-analytics-preferences', openPreferences);
  }, []);

  useEffect(() => {
    if (consent !== 'granted') return;
    capturePageView(pathname);
  }, [consent, pathname]);

  useEffect(() => {
    if (consent !== 'granted' || !user?.id) return;
    identifyAnalyticsUser(user.id, {
      account_type: profile?.user_type || 'unknown',
      plan_tier: profile?.tier || 'unknown',
    });
  }, [consent, profile?.tier, profile?.user_type, user?.id]);

  const chooseConsent = (choice: AnalyticsConsent) => {
    setAnalyticsConsent(choice);
    setPreferencesOpen(false);
  };

  return (
    <>
      {children}
      {configured && mounted && (consent === null || preferencesOpen) && (
        <AnalyticsConsentBanner
          currentConsent={consent}
          onAccept={() => chooseConsent('granted')}
          onDecline={() => chooseConsent('denied')}
          onClose={consent === null ? undefined : () => setPreferencesOpen(false)}
        />
      )}
    </>
  );
}
