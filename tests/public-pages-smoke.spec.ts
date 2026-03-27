import { expect, test } from '@playwright/test';

test.describe('Public launch surfaces', () => {
  test('home page exposes primary launch navigation and trust links', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    // Hero heading rendered client-side via AnimatedHero
    await expect(page.getByRole('heading', { name: /One operating screen/i })).toBeVisible({ timeout: 10000 });

    // Primary CTA is a Button with onClick (router.push), not an <a> link
    await expect(page.getByRole('button', { name: 'Create Estimate Now' })).toBeVisible();

    // Footer trust links
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Support' })).toBeVisible();
  });

  test('public marketplace and supplier directory load without auth', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { name: /marketplace/i }).first()).toBeVisible();

    await page.goto('/marketplace/suppliers');
    // Heading is "Supplier Directory" (singular)
    await expect(page.getByRole('heading', { name: /supplier/i }).first()).toBeVisible();
  });

  test('privacy, terms, and support pages render', async ({ page }) => {
    for (const route of ['/privacy', '/terms', '/support']) {
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
    }
  });
});
