import { expect, test } from '@playwright/test';

const E2E_EMAIL = process.env.PLAYWRIGHT_E2E_EMAIL || process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.PLAYWRIGHT_E2E_PASSWORD || process.env.E2E_USER_PASSWORD;
const HAS_E2E_CREDS = Boolean(E2E_EMAIL && E2E_PASSWORD);

test.describe('Authenticated project workspace', () => {
  test.skip(!HAS_E2E_CREDS, 'Set PLAYWRIGHT_E2E_EMAIL and PLAYWRIGHT_E2E_PASSWORD to run auth layout tests.');

  test('project list, BOQ workspace, and insights remain usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auth/login?redirect=/projects');
    await page.getByPlaceholder('you@example.com').fill(E2E_EMAIL!);
    await page.getByPlaceholder('Enter your password').fill(E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/projects', { timeout: 20_000 });

    await expect(page.getByRole('heading', { name: 'My Projects' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Project workspace views' }))
      .toContainText('My Work');
    await expectNoDocumentOverflow(page);

    const fullProject = page.locator(
      'a.project-link[href^="/projects/"]:not([href^="/projects/quick/"])'
    ).first();
    await expect(fullProject).toBeVisible();
    await fullProject.click();
    const projectDock = page.getByRole('navigation', { name: 'Project workspace' });
    await expect(projectDock.getByRole('button', { name: 'Overview' })).toBeVisible({ timeout: 10_000 });
    await projectDock.getByRole('button', { name: 'BOQ' }).click();
    await expect(page.getByRole('heading', { name: 'Bill of Quantities' })).toBeVisible();
    const stageSwitcher = page.getByRole('navigation', { name: 'Construction stages' });
    await expect(stageSwitcher).toBeVisible();
    const structureStage = stageSwitcher.getByRole('button', { name: /^Structure,/ });
    await structureStage.click();
    await expect(structureStage).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('button', { name: /Stage schedule Structural Walls & Frame/ })).toBeVisible();
    await expectNoDocumentOverflow(page);

    await projectDock.getByRole('button', { name: 'Budget' }).click();
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible();
    await expectNoDocumentOverflow(page);

    await projectDock.getByRole('button', { name: 'Buy' }).click();
    await expect(page.getByRole('heading', { name: 'Procurement Hub' })).toBeVisible();
    await expectNoDocumentOverflow(page);

    for (const destination of ['Usage', 'Compliance', 'Documents', 'Settings']) {
      await projectDock.getByRole('button', { name: 'More' }).click();
      await page.getByRole('dialog', { name: 'More tools' }).getByRole('button', { name: new RegExp(`^${destination}`) }).click();
      await expectNoDocumentOverflow(page);
    }

    await page.goto('/projects/dashboard');
    await expect(page.getByRole('heading', { name: 'Project Insights' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Project workspace views' }))
      .toContainText('Insights');
    await expectNoDocumentOverflow(page);

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Settings sections' }))
      .toContainText('Notifications');
    await expect(page.getByRole('link', { name: 'Contact support' }).first())
      .toHaveAttribute('href', '/support');
    await expectNoDocumentOverflow(page);
  });
});

async function expectNoDocumentOverflow(page: import('@playwright/test').Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}
