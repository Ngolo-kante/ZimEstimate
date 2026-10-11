import posthog from 'posthog-js';

export const ANALYTICS_CONSENT_KEY = 'zimestimate_analytics_consent';

export type AnalyticsConsent = 'granted' | 'denied';

export type ProductAnalyticsEvent =
  | 'seo_landing_viewed'
  | 'budget_entered'
  | 'calculator_started'
  | 'calculator_customized'
  | 'boq_cta_clicked'
  | 'boq_started'
  | 'signup_started'
  | 'signup_completed'
  // Whether WhatsApp sharing brings people in: a share sent, and a shared
  // link opened by someone else.
  | 'estimate_shared'
  | 'shared_link_opened'
  | 'estimate_saved'
  | 'pdf_exported'
  | 'ai_scan_used';

type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;
let consentFallback: AnalyticsConsent | undefined;

export function isProductAnalyticsConfigured(): boolean {
  return Boolean(postHogKey);
}

export function initProductAnalytics(): void {
  if (initialized || typeof window === 'undefined' || !postHogKey || getAnalyticsConsent() !== 'granted') return;

  safelyRunAnalytics(() => {
    posthog.init(postHogKey, {
      api_host: postHogHost,
      defaults: '2026-05-30',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_capture_url_hashes: true,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      opt_out_capturing_persistence_type: 'localStorage',
      persistence: 'localStorage+cookie',
      person_profiles: 'identified_only',
      before_send: (event) => {
        if (!event || getAnalyticsConsent() !== 'granted') return null;
        return {
          ...event,
          properties: sanitizeUrlProperties(event.properties),
          $set: event.$set ? sanitizeUrlProperties(event.$set) : event.$set,
          $set_once: event.$set_once ? sanitizeUrlProperties(event.$set_once) : event.$set_once,
        };
      },
    });

    initialized = true;
    posthog.opt_in_capturing({ captureEventName: false });
    registerAcquisitionContext();
  });
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  if (consentFallback) return consentFallback;

  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
    consentFallback = undefined;
  } catch {
    // Honour the choice for this page even when browser storage is blocked.
    consentFallback = consent;
  }

  syncAnalyticsConsent();
  window.dispatchEvent(new Event('zimestimate:analytics-consent-changed'));
}

export function subscribeToAnalyticsConsent(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
    consentFallback = undefined;
    syncAnalyticsConsent();
    callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('zimestimate:analytics-consent-changed', callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('zimestimate:analytics-consent-changed', callback);
  };
}

function syncAnalyticsConsent(): void {
  if (getAnalyticsConsent() === 'granted') {
    initProductAnalytics();
    if (!initialized) return;
    safelyRunAnalytics(() => {
      if (!posthog.has_opted_in_capturing()) {
        posthog.opt_in_capturing({ captureEventName: false });
      }
      registerAcquisitionContext();
    });
    flushSharedLinkArrival();
  } else {
    if (initialized) safelyRunAnalytics(() => posthog.opt_out_capturing());
    try {
      window.localStorage.removeItem('zimestimate_first_landing_page');
      // Declining discards a held shared-link arrival; it is never sent.
      window.sessionStorage?.removeItem(SHARED_ARRIVAL_KEY);
    } catch {
      // Storage is optional; the consent guard still prevents event capture.
    }
  }
}

/* ── Shared-link arrivals ─────────────────────────────────────────────────
   Someone opening a shared estimate is nearly always a first-time visitor
   who has not answered the consent banner yet — and before consent nothing
   is captured. Recorded the ordinary way, that event would almost never
   arrive, and the one number that says whether WhatsApp sharing works would
   read as zero. So the arrival is held in this tab's session storage and
   sent only if, and once, the visitor accepts. Nothing leaves the browser
   without consent; declining discards it; closing the tab forgets it. */
const SHARED_ARRIVAL_KEY = 'zimestimate_shared_arrival';
const SHARED_ARRIVAL_COUNTED_KEY = 'zimestimate_shared_arrival_counted';

export function recordSharedLinkArrival(estimate: string): void {
  if (typeof window === 'undefined') return;
  try {
    // A reload of the same shared link is not a second arrival.
    if (window.sessionStorage.getItem(SHARED_ARRIVAL_COUNTED_KEY)) return;
    window.sessionStorage.setItem(SHARED_ARRIVAL_KEY, estimate);
  } catch {
    return;
  }
  flushSharedLinkArrival();
}

function flushSharedLinkArrival(): void {
  if (typeof window === 'undefined' || getAnalyticsConsent() !== 'granted') return;
  let estimate: string | null = null;
  try {
    estimate = window.sessionStorage.getItem(SHARED_ARRIVAL_KEY);
  } catch {
    return;
  }
  if (!estimate) return;

  captureProductEvent('shared_link_opened', { estimate });
  if (!initialized) return;
  try {
    window.sessionStorage.removeItem(SHARED_ARRIVAL_KEY);
    window.sessionStorage.setItem(SHARED_ARRIVAL_COUNTED_KEY, '1');
  } catch {
    // Worst case a reload counts twice; the event itself was sent.
  }
}

export function captureProductEvent(
  event: ProductAnalyticsEvent,
  properties: AnalyticsProperties = {}
): void {
  if (getAnalyticsConsent() !== 'granted') return;
  initProductAnalytics();
  if (!initialized) return;

  safelyRunAnalytics(() => posthog.capture(event, properties));
}

export function capturePageView(pathname: string): void {
  if (getAnalyticsConsent() !== 'granted') return;
  initProductAnalytics();
  if (!initialized) return;

  const pageProperties = {
    path: pathname,
    landing_page: getFirstLandingPage(),
  };

  safelyRunAnalytics(() => {
    posthog.capture('$pageview', pageProperties);

    if (pathname === '/cost-to-build-a-house-in-zimbabwe') {
      posthog.capture('seo_landing_viewed', {
        ...pageProperties,
        landing_page_type: 'house_cost_guide',
      });
    }
  });
}

export function identifyAnalyticsUser(
  userId: string,
  properties: AnalyticsProperties = {}
): void {
  if (!userId || getAnalyticsConsent() !== 'granted') return;
  initProductAnalytics();
  if (!initialized) return;

  // Deliberately omit names, email addresses and other contact information.
  safelyRunAnalytics(() => posthog.identify(userId, properties));
}

export function resetAnalyticsIdentity(): void {
  if (!initialized) return;
  safelyRunAnalytics(() => {
    posthog.reset(true);
    if (getAnalyticsConsent() === 'granted') {
      // This SDK resets consent too. Preserve the visitor's explicit choice.
      posthog.opt_in_capturing({ captureEventName: false });
      registerAcquisitionContext();
    }
  });
}

function safelyRunAnalytics(action: () => void): void {
  try {
    action();
  } catch {
    // Optional analytics must never interrupt signup, navigation or sign-out.
  }
}

export function openAnalyticsPreferences(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('zimestimate:open-analytics-preferences'));
}

export function getBudgetBand(value: number): string {
  if (value < 10_000) return 'under_10k';
  if (value < 25_000) return '10k_25k';
  if (value < 50_000) return '25k_50k';
  if (value < 100_000) return '50k_100k';
  return '100k_plus';
}

function getFirstLandingPage(): string {
  if (typeof window === 'undefined') return '';
  const storageKey = 'zimestimate_first_landing_page';

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return stored;
    const current = window.location.pathname;
    window.localStorage.setItem(storageKey, current);
    return current;
  } catch {
    return window.location.pathname;
  }
}

function registerAcquisitionContext(): void {
  if (typeof window === 'undefined' || !initialized) return;

  const params = new URLSearchParams(window.location.search);
  let referringDomain = '';
  try {
    referringDomain = document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    referringDomain = '';
  }

  posthog.register_once({
    initial_landing_page: getFirstLandingPage(),
    initial_referring_domain: referringDomain,
    initial_utm_source: params.get('utm_source') || undefined,
    initial_utm_medium: params.get('utm_medium') || undefined,
    initial_utm_campaign: params.get('utm_campaign') || undefined,
    initial_utm_content: params.get('utm_content') || undefined,
    initial_utm_term: params.get('utm_term') || undefined,
  });
}

function sanitizeUrlProperties<T extends Record<string, unknown>>(properties: T): T {
  const sanitized = { ...properties };

  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeUrlProperties(value as Record<string, unknown>) as T[keyof T];
      continue;
    }
    if (typeof value !== 'string') continue;
    if (!key.toLowerCase().includes('url') && !key.toLowerCase().includes('referrer')) continue;

    try {
      const parsed = new URL(value, window.location.origin);
      sanitized[key as keyof T] = (value.startsWith('/') && !value.startsWith('//')
        ? parsed.pathname
        : `${parsed.origin}${parsed.pathname}`) as T[keyof T];
    } catch {
      sanitized[key as keyof T] = value.split(/[?#]/)[0] as T[keyof T];
    }
  }

  return sanitized;
}
