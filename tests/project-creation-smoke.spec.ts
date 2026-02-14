import { expect, test } from '@playwright/test';

const E2E_EMAIL = process.env.PLAYWRIGHT_E2E_EMAIL || process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.PLAYWRIGHT_E2E_PASSWORD || process.env.E2E_USER_PASSWORD;
const HAS_E2E_CREDS = Boolean(E2E_EMAIL && E2E_PASSWORD);

test.describe('Project creation smoke', () => {
  test.skip(!HAS_E2E_CREDS, 'Set PLAYWRIGHT_E2E_EMAIL and PLAYWRIGHT_E2E_PASSWORD to run auth smoke tests.');

  test('new project appears immediately on dashboard and project views open quickly', async ({ page }) => {
    const projectName = `E2E Smoke ${Date.now()}`;
    const location = 'Harare, Zimbabwe';

    await page.addInitScript(() => {
      localStorage.setItem('sidebar_collapsed', 'false');
    });

    await page.goto('/auth/login?redirect=/projects/new');

    await page.getByPlaceholder('you@example.com').fill(E2E_EMAIL!);
    await page.getByPlaceholder('Enter your password').fill(E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('**/projects/new', { timeout: 20_000 });

    await page.locator('.tile', { hasText: 'New House' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('.tile', { hasText: 'Budget-Focused' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByPlaceholder('e.g., Borrowdale 4-Bed House').fill(projectName);
    await page.getByPlaceholder('e.g., Harare, Zimbabwe').fill(location);
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('.tile', { hasText: 'Upload Floor Plan' }).click();
    await page.getByRole('button', { name: 'Create Project' }).click();

    await page.waitForURL(/\/projects(\?|$)/, { timeout: 25_000 });

    // Immediate feedback check: at least one project card with the new name should appear quickly.
    const anyProjectCard = page.locator('.project-card', { hasText: projectName }).first();
    await expect(anyProjectCard).toBeVisible({ timeout: 5_000 });

    // Transition check: optimistic card should disappear, real card should remain.
    const optimisticCard = page.locator('.project-card.creating', { hasText: projectName });
    const realProjectCard = page.locator('.project-card:not(.creating)', { hasText: projectName }).first();
    await expect(optimisticCard).toHaveCount(0, { timeout: 25_000 });
    await expect(realProjectCard).toBeVisible({ timeout: 25_000 });

    await page.locator('.project-link', { hasText: projectName }).first().click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+/i, { timeout: 20_000 });

    await expect(page.getByRole('heading', { name: projectName }).first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Budget Planner' }).click();
    await expect(page.getByRole('heading', { name: 'Budget Planner' }).first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Procurement Hub' }).click();
    await expect(page.getByRole('heading', { name: 'Procurement Hub' }).first()).toBeVisible({ timeout: 5_000 });
  });
});
