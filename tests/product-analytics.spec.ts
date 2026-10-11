import { expect, test } from '@playwright/test';

const configured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

test.describe('Anonymous product analytics', () => {
  // PostHog filters automated browsers. Ingestion is intercepted below, so no
  // test event reaches the analytics service.
  test.use({ userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    });
  });

  test('never renders an analytics banner or privacy-choice button', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Privacy choices' })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Analytics preferences' })).toHaveCount(0);
  });

  test('captures without creating PostHog browser storage', async ({ page, context }) => {
    test.skip(!configured, 'Run with a dummy NEXT_PUBLIC_POSTHOG_KEY and local NEXT_PUBLIC_POSTHOG_HOST.');
    const analyticsHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    const requests: string[] = [];
    await context.route(`${analyticsHost}/**`, async (route) => {
      requests.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/cost-to-build-a-house-in-zimbabwe?budget=12345');
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const posthogKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('ph_')));
    expect(posthogKeys).toEqual([]);
    await expect(page.getByRole('complementary', { name: 'Analytics preferences' })).toHaveCount(0);
  });
});
