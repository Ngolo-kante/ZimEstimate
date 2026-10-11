import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBudgetBand } from './productAnalytics';

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  register_once: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthog }));

describe('getBudgetBand', () => {
  it.each([
    [9_999, 'under_10k'],
    [10_000, '10k_25k'],
    [24_999, '10k_25k'],
    [25_000, '25k_50k'],
    [50_000, '50k_100k'],
    [100_000, '100k_plus'],
  ])('groups %i without exposing an exact budget', (value, expected) => {
    expect(getBudgetBand(value)).toBe(expected);
  });
});

describe('anonymous product analytics', () => {
  let analytics: typeof import('./productAnalytics');
  let browser: EventTarget & { localStorage: Storage; location: URL };

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    browser = Object.assign(new EventTarget(), {
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      } as unknown as Storage,
      location: new URL('https://example.test/quick-budget?budget=12345'),
    });
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', { referrer: 'https://search.example.test/?q=private' });
    analytics = await import('./productAnalytics');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('initializes without cookies or persistent browser storage', () => {
    analytics.initProductAnalytics();
    expect(posthog.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
      persistence: 'memory',
      disable_persistence: true,
      person_profiles: 'never',
      autocapture: false,
      disable_session_recording: true,
    }));
    expect(browser.localStorage.getItem).not.toHaveBeenCalled();
    expect(browser.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('records page views immediately but never identifies an account', () => {
    analytics.capturePageView('/quick-budget');
    analytics.identifyAnalyticsUser('user-123', { signup_method: 'email' });
    expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
      path: '/quick-budget',
      landing_page: '/quick-budget',
    });
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('removes query strings and fragments from URL properties', () => {
    analytics.initProductAnalytics();
    const beforeSend = posthog.init.mock.calls[0][1].before_send;
    const event = {
      event: '$pageview',
      properties: {
        $current_url: 'https://example.test/quick-budget?budget=12345#private',
        $referrer: '/auth/callback?token=private#access_token=private',
        $set_once: { $initial_current_url: 'https://example.test/?email=private' },
        budget_band: '10k_25k',
      },
    };
    expect(beforeSend(event).properties).toEqual({
      $current_url: 'https://example.test/quick-budget',
      $referrer: '/auth/callback',
      $set_once: { $initial_current_url: 'https://example.test/' },
      budget_band: '10k_25k',
    });
  });

  it('counts a shared-link arrival once per tab lifecycle', () => {
    analytics.recordSharedLinkArrival('solar');
    analytics.recordSharedLinkArrival('solar');
    const opened = posthog.capture.mock.calls.filter(([event]) => event === 'shared_link_opened');
    expect(opened).toEqual([['shared_link_opened', { estimate: 'solar' }]]);
  });

  it('resets the anonymous in-memory identity after sign-out', () => {
    analytics.initProductAnalytics();
    analytics.resetAnalyticsIdentity();
    expect(posthog.reset).toHaveBeenCalledWith();
    expect(posthog.register_once).toHaveBeenCalled();
  });

  it('never interrupts application actions when the analytics SDK throws', () => {
    posthog.capture.mockImplementation(() => { throw new Error('SDK unavailable'); });
    posthog.reset.mockImplementation(() => { throw new Error('SDK unavailable'); });
    expect(() => analytics.captureProductEvent('signup_started')).not.toThrow();
    expect(() => analytics.capturePageView('/home')).not.toThrow();
    expect(() => analytics.resetAnalyticsIdentity()).not.toThrow();
  });
});
