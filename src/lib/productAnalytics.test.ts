import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBudgetBand } from './productAnalytics';

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  has_opted_in_capturing: vi.fn(() => true),
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

describe('product analytics consent', () => {
  let analytics: typeof import('./productAnalytics');
  let storage: Map<string, string>;
  let browser: EventTarget & { localStorage: Storage; location: URL };

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    posthog.has_opted_in_capturing.mockReturnValue(true);
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    storage = new Map();
    browser = Object.assign(new EventTarget(), {
      localStorage: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
        removeItem: vi.fn((key: string) => { storage.delete(key); }),
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

  it.each([null, 'denied'])('does not initialize the SDK or capture before consent (%s)', (consent) => {
    if (consent) storage.set(analytics.ANALYTICS_CONSENT_KEY, consent);
    analytics.initProductAnalytics();
    analytics.capturePageView('/home');
    analytics.captureProductEvent('signup_started');
    analytics.identifyAnalyticsUser('user-123');
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it('restores saved consent before recording a page view', () => {
    storage.set(analytics.ANALYTICS_CONSENT_KEY, 'granted');
    analytics.capturePageView('/quick-budget');
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(posthog.opt_in_capturing.mock.invocationCallOrder[0])
      .toBeLessThan(posthog.capture.mock.invocationCallOrder[0]);
    expect(posthog.capture).toHaveBeenCalledWith('$pageview', {
      path: '/quick-budget', landing_page: '/quick-budget',
    });
  });

  it('retains consent after sign-out resets the SDK identity', () => {
    analytics.setAnalyticsConsent('granted');
    posthog.opt_in_capturing.mockClear();
    analytics.resetAnalyticsIdentity();
    expect(posthog.reset).toHaveBeenCalledWith(true);
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
    expect(posthog.reset.mock.invocationCallOrder[0])
      .toBeLessThan(posthog.opt_in_capturing.mock.invocationCallOrder[0]);
    expect(analytics.getAnalyticsConsent()).toBe('granted');
  });

  it('stops capture and clears landing attribution when consent is withdrawn in another tab', () => {
    analytics.setAnalyticsConsent('granted');
    const onChange = vi.fn();
    const unsubscribe = analytics.subscribeToAnalyticsConsent(onChange);
    storage.set(analytics.ANALYTICS_CONSENT_KEY, 'denied');
    browser.dispatchEvent(Object.assign(new Event('storage'), { key: analytics.ANALYTICS_CONSENT_KEY }));
    analytics.captureProductEvent('signup_started');
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(storage.has('zimestimate_first_landing_page')).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('honours withdrawal even when writing browser storage fails', () => {
    analytics.setAnalyticsConsent('granted');
    vi.mocked(browser.localStorage.setItem).mockImplementation(() => { throw new Error('blocked'); });
    analytics.setAnalyticsConsent('denied');
    analytics.captureProductEvent('signup_started');
    expect(analytics.getAnalyticsConsent()).toBe('denied');
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('removes query strings and fragments from absolute, relative and nested URL properties', () => {
    analytics.setAnalyticsConsent('granted');
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
    analytics.setAnalyticsConsent('denied');
    expect(beforeSend(event)).toBeNull();
  });

  it('does not interrupt application actions if the analytics SDK throws', () => {
    analytics.setAnalyticsConsent('granted');
    const fail = () => { throw new Error('SDK unavailable'); };
    posthog.capture.mockImplementation(fail);
    posthog.identify.mockImplementation(fail);
    posthog.reset.mockImplementation(fail);
    expect(() => analytics.captureProductEvent('signup_started')).not.toThrow();
    expect(() => analytics.capturePageView('/home')).not.toThrow();
    expect(() => analytics.identifyAnalyticsUser('user-123')).not.toThrow();
    expect(() => analytics.resetAnalyticsIdentity()).not.toThrow();
  });

  it('does not interrupt consent or navigation if SDK initialization fails', () => {
    posthog.init.mockImplementation(() => { throw new Error('SDK unavailable'); });
    expect(() => analytics.setAnalyticsConsent('granted')).not.toThrow();
    expect(() => analytics.captureProductEvent('calculator_started')).not.toThrow();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  describe('shared-link arrivals', () => {
    let session: Map<string, string>;

    beforeEach(() => {
      session = new Map();
      Object.assign(browser, {
        sessionStorage: {
          getItem: vi.fn((key: string) => session.get(key) ?? null),
          setItem: vi.fn((key: string, value: string) => { session.set(key, value); }),
          removeItem: vi.fn((key: string) => { session.delete(key); }),
        } as unknown as Storage,
      });
    });

    const openedCalls = () => posthog.capture.mock.calls.filter(([event]) => event === 'shared_link_opened');

    it('holds the arrival until the visitor accepts, then sends it once', () => {
      // A recipient is nearly always new and has not answered the banner.
      analytics.recordSharedLinkArrival('solar');
      expect(posthog.capture).not.toHaveBeenCalled();
      expect(posthog.init).not.toHaveBeenCalled();

      analytics.setAnalyticsConsent('granted');
      expect(openedCalls()).toEqual([['shared_link_opened', { estimate: 'solar' }]]);
    });

    it('never sends it when the visitor declines', () => {
      analytics.recordSharedLinkArrival('house');
      analytics.setAnalyticsConsent('denied');
      analytics.setAnalyticsConsent('granted');
      expect(openedCalls()).toHaveLength(0);
    });

    it('sends straight away for a visitor who has already accepted', () => {
      storage.set(analytics.ANALYTICS_CONSENT_KEY, 'granted');
      analytics.recordSharedLinkArrival('borehole');
      expect(openedCalls()).toEqual([['shared_link_opened', { estimate: 'borehole' }]]);
    });

    it('does not count a reload of the same link as a second arrival', () => {
      storage.set(analytics.ANALYTICS_CONSENT_KEY, 'granted');
      analytics.recordSharedLinkArrival('solar');
      analytics.recordSharedLinkArrival('solar');
      expect(openedCalls()).toHaveLength(1);
    });
  });
});
