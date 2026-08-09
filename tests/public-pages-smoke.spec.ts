import { expect, test } from '@playwright/test';

test.describe('Public launch surfaces', () => {
  test('home page exposes primary launch navigation and trust links', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'Construction estimates built for Zimbabwe.' })
    ).toBeVisible({ timeout: 10000 });

    const hero = page.getByRole('region', { name: 'Construction estimates built for Zimbabwe.' });
    await expect(hero.getByRole('link', { name: 'Start your estimate', exact: true }))
      .toHaveAttribute('href', '/boq/new?method=manual&fresh=1');
    await expect(page.getByRole('link', { name: 'Find a contractor', exact: true }))
      .toHaveAttribute('href', '/contractors');
    await expect(hero.getByRole('link', { name: 'Quick Projects', exact: true }))
      .toHaveAttribute('href', '/quick-projects');
    await expect(hero.getByRole('link', { name: 'Register as a Contractor', exact: true }))
      .toHaveAttribute('href', '/contractor/register');
    const manualMethod = page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { name: 'Create Your BOQ' }) });
    await manualMethod.hover();
    await expect.poll(() => manualMethod.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe('none');

    await expect(page.getByRole('link', { name: /^Plan to BOQ/i }))
      .toHaveAttribute('href', '/ai/vision-takeoff');
    await expect(page.getByRole('link', { name: /^Quote to Project/i }))
      .toHaveAttribute('href', '/ai/boq-scanner');
    const methods = page.getByRole('region', { name: 'Four ways to create your BOQ.' });
    await expect(methods.getByRole('link', { name: /^Quick Project/i }))
      .toHaveAttribute('href', '/quick-projects');

    const budgetInput = page.getByRole('textbox', { name: /Your budget in US dollars/ });
    await expect(budgetInput).toHaveValue('');
    await budgetInput.fill('');
    await budgetInput.pressSequentially('25000');
    await expect(page.getByRole('link', { name: 'Customize' }))
      .toHaveAttribute('href', '/quick-budget?budget=25000');

    // Footer trust links
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contact support' })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 720 });
    const mobileWidth = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(mobileWidth.content).toBeLessThanOrEqual(mobileWidth.viewport);
  });

  test('homepage estimate CTA starts a fresh manual wizard', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zimestimate-boq-wizard', JSON.stringify({
        state: {
          currentStep: 5,
          maxStepReached: 5,
          projectDetails: { name: 'Previous draft' },
        },
        version: 1,
      }));
    });

    await page.goto('/boq/new?method=manual&fresh=1');
    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
    await page.waitForURL('/boq/new?method=manual');

    const savedStep = await page.evaluate(() => {
      const raw = localStorage.getItem('zimestimate-boq-wizard');
      return raw ? JSON.parse(raw).state.currentStep : null;
    });
    expect(savedStep).toBe(0);
  });

  test('home navigation keeps account and discovery menus usable', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');

    const exploreButton = page.getByRole('button', { name: 'Explore', exact: true });
    await exploreButton.click();
    await expect(page.getByRole('link', { name: /Market Insights/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Contractors/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(exploreButton).toHaveAttribute('aria-expanded', 'false');

    const accountButton = page.getByRole('button', { name: 'User menu' });
    await accountButton.click();
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Account' })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await accountButton.click();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  });

  test('public marketplace and supplier directory load without auth', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { name: /marketplace/i }).first()).toBeVisible();

    await page.goto('/marketplace/suppliers');
    // Heading is "Supplier Directory" (singular)
    await expect(page.getByRole('heading', { name: /supplier/i }).first()).toBeVisible();
  });

  test('contractor directory and registration are usable without auth', async ({ page }) => {
    await page.goto('/contractors');
    await expect(page.getByRole('heading', { name: 'Find the right trade for your next build.' }))
      .toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search directory' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'List your business' }))
      .toHaveAttribute('href', '/contractor/register');

    await page.goto('/contractor/register');
    await expect(page.getByRole('heading', { name: 'Build for clients with better numbers.' }))
      .toBeVisible();

    const trade = page.getByRole('checkbox', { name: 'General contractor', exact: true });
    const area = page.getByRole('checkbox', { name: 'Harare', exact: true });
    const listing = page.getByRole('checkbox', { name: /List me in the public contractor directory/ });
    await trade.check();
    await area.check();
    await listing.check();
    await expect(trade).toBeChecked();
    await expect(area).toBeChecked();
    await expect(listing).toBeChecked();
  });

  test('privacy, terms, and support pages render', async ({ page }) => {
    for (const route of ['/privacy', '/terms', '/support']) {
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
    }
  });

  test('AI Vision keeps its focused upload workflow', async ({ page }) => {
    await page.goto('/ai/vision-takeoff');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('AI VISION BOQ')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Upload Floor Plan' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Estimate steps' })).toContainText(
      'Review Estimate'
    );
    await expect(page.getByRole('link', { name: 'Use manual builder' }))
      .toHaveAttribute('href', '/boq/new?method=manual');
  });

  test('quick projects presents the most requested jobs first', async ({ page }) => {
    await page.goto('/quick-projects');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Quick Projects' })).toBeVisible();
    const projectLinks = page.locator('a[href^="/quick-projects/"]');
    await expect(projectLinks).toHaveCount(6);
    await expect(projectLinks.nth(0)).toContainText('Solar System');
    await expect(projectLinks.nth(1)).toContainText('Water Tank');
    await expect(projectLinks.nth(2)).toContainText('Borehole Drilling');
    await expect(page.getByRole('link', { name: /Open Manual BOQ Builder/ }))
      .toHaveAttribute('href', '/boq/new?method=manual');

    await page.setViewportSize({ width: 390, height: 844 });
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  });
});
