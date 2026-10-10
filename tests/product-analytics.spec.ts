import { expect, test } from '@playwright/test';

const configured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
const consentKey = 'zimestimate_analytics_consent';

test.describe('Product analytics consent', () => {
  // PostHog filters automated browsers. Simulate a visitor only in this local test;
  // ingestion is intercepted below, so no test events reach an analytics service.
  test.use({ userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    });
  });

  test('privacy choices are hidden when analytics is disabled', async ({ page }) => {
    test.skip(configured, 'Run without NEXT_PUBLIC_POSTHOG_KEY to check disabled analytics.');
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Privacy choices' })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: 'Analytics preferences' })).toHaveCount(0);
  });

  test('requests and persistence require consent, including across tabs and reloads', async ({ page, context }) => {
    test.skip(!configured, 'Run with a dummy NEXT_PUBLIC_POSTHOG_KEY and local NEXT_PUBLIC_POSTHOG_HOST.');
    const analyticsHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    const requests: string[] = [];
    await context.route(`${analyticsHost}/**`, async (route) => {
      requests.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    const sdkStorage = () => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('ph_')));
    const banner = page.getByRole('complementary', { name: 'Analytics preferences' });
    await page.goto('/cost-to-build-a-house-in-zimbabwe?budget=12345');
    await expect(banner).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(requests).toEqual([]);
    expect(await sdkStorage()).toEqual([]);

    await page.getByRole('button', { name: 'Decline', exact: true }).click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(banner).toHaveCount(0);
    expect(requests).toEqual([]);
    expect(await sdkStorage()).toEqual([]);

    await page.getByRole('button', { name: 'Privacy choices' }).click();
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
    await expect(banner).toHaveCount(0);
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await sdkStorage()).not.toEqual([]);
    const firstRequestCount = requests.length;
    await page.reload();
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(firstRequestCount);
    await expect(banner).toHaveCount(0);

    const secondTab = await context.newPage();
    await secondTab.goto('/home');
    await secondTab.getByRole('button', { name: 'Privacy choices' }).click();
    await expect(secondTab.getByRole('complementary', { name: 'Analytics preferences' })).toBeVisible();
    await page.getByRole('button', { name: 'Privacy choices' }).click();
    await page.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect.poll(sdkStorage).toEqual([]);
    await expect.poll(() => secondTab.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('ph_')))).toEqual([]);
    await expect(secondTab.getByRole('button', { name: 'Close analytics preferences' })).toBeVisible();
    expect(await secondTab.evaluate((key) => localStorage.getItem(key), consentKey)).toBe('denied');

    await secondTab.close();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterWithdrawal = requests.length;
    await page.getByRole('link', { name: 'Adjust this plan' }).first().click();
    await expect(page.getByLabel('Floor Plan Size (m2)')).toHaveValue('80');
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(afterWithdrawal);
    expect(await sdkStorage()).toEqual([]);
  });
});
