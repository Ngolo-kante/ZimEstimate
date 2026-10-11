import posthog from 'posthog-js';

export type ProductAnalyticsEvent =
  | 'seo_landing_viewed'
  | 'budget_entered'
  | 'calculator_started'
  | 'calculator_customized'
  | 'boq_cta_clicked'
  | 'boq_started'
  | 'signup_started'
  | 'signup_completed'
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
let firstLandingPage: string | null = null;
const countedSharedArrivals = new Set<string>();

export function isProductAnalyticsConfigured(): boolean {
  return Boolean(postHogKey);
}

/**
 * Anonymous, non-persistent analytics.
 *
 * Nothing is written to cookies, localStorage, or an account profile. The
 * in-memory visitor ID lasts only until the tab is reloaded, which trades some
 * cross-visit accuracy for a quieter first visit with no analytics banner.
 */
export function initProductAnalytics(): void {
  if (initialized || typeof window === 'undefined' || !postHogKey) return;

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
      persistence: 'memory',
      disable_persistence: true,
      person_profiles: 'never',
      before_send: (event) => {
        if (!event) return null;
        return {
          ...event,
          properties: sanitizeUrlProperties(event.properties),
          $set: event.$set ? sanitizeUrlProperties(event.$set) : event.$set,
          $set_once: event.$set_once ? sanitizeUrlProperties(event.$set_once) : event.$set_once,
        };
      },
    });

    initialized = true;
    registerAcquisitionContext();
  });
}

export function recordSharedLinkArrival(estimate: string): void {
  if (!estimate || countedSharedArrivals.has(estimate)) return;
  countedSharedArrivals.add(estimate);
  captureProductEvent('shared_link_opened', { estimate });
}

export function captureProductEvent(
  event: ProductAnalyticsEvent,
  properties: AnalyticsProperties = {}
): void {
  initProductAnalytics();
  if (!initialized) return;

  safelyRunAnalytics(() => posthog.capture(event, properties));
}

export function capturePageView(pathname: string): void {
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

/** Account identities are deliberately not attached to anonymous traffic. */
export function identifyAnalyticsUser(
  _userId: string,
  _properties: AnalyticsProperties = {}
): void {
  void _userId;
  void _properties;
  // Kept as a no-op so signup flows do not depend on the analytics policy.
}

export function resetAnalyticsIdentity(): void {
  if (!initialized) return;
  safelyRunAnalytics(() => {
    posthog.reset();
    registerAcquisitionContext();
  });
}

function safelyRunAnalytics(action: () => void): void {
  try {
    action();
  } catch {
    // Optional analytics must never interrupt signup, navigation or sign-out.
  }
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
  firstLandingPage ??= window.location.pathname;
  return firstLandingPage;
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
