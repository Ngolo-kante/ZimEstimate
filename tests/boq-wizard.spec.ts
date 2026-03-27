import { expect, test } from '@playwright/test';

test.describe('BOQ Live Estimator', () => {
  // All BOQ tests wait for networkidle so the Suspense boundary resolves
  // and client-side Zustand store hydrates before assertions run.

  test('renders wizard shell and first step on load', async ({ page }) => {
    await page.goto('/boq/new?method=manual');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('BOQ MANUAL BUILDER')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /What are we building/i })).toBeVisible();
    await expect(page.getByText(/Step 1 of/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();
  });

  test('selecting project type allows advancing to step 2', async ({ page }) => {
    await page.goto('/boq/new?method=manual');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('BOQ MANUAL BUILDER')).toBeVisible({ timeout: 10000 });

    // Continue without selection stays on step 1
    await page.getByRole('button', { name: /Continue/i }).click();
    await expect(page.getByRole('heading', { name: /What are we building/i })).toBeVisible();

    // Select a project type then Continue advances to step 2
    await page.getByText('Full House / Full Build').click();
    await page.getByRole('button', { name: /Continue/i }).click();

    await expect(page.getByRole('heading', { name: /Project location/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Step 2 of/i)).toBeVisible();
  });

  test('opens floor plan editor modal from Building Design step', async ({ page }) => {
    await page.goto('/boq/new?method=manual');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('BOQ MANUAL BUILDER')).toBeVisible({ timeout: 10000 });

    // Step 1: Select project type
    await page.getByText('Full House / Full Build').click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 2: Fill name and select location type
    await expect(page.getByPlaceholder(/Borrowdale Family Home/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/Borrowdale Family Home/i).fill('Test House');
    // Location type buttons contain label + hint text — match by label prefix
    await page.locator('button', { hasText: /^Urban/ }).click();
    await page.getByRole('button', { name: /Continue/i }).click();

    // Step 3: Building Design — switch to Detailed Room Plan mode to access floor plan editor
    await expect(page.getByRole('heading', { name: /Floor plan/i })).toBeVisible({ timeout: 5000 });
    await page.locator('button', { hasText: /^Detailed Room Plan/ }).click();

    // Launch and close floor plan editor
    await page.getByTestId('launch-floor-plan-editor').click();
    await expect(page.getByTestId('room-builder-modal')).toBeVisible();
    await page.getByRole('button', { name: /Close floor plan/i }).click();
    await expect(page.getByTestId('room-builder-modal')).toBeHidden();
  });

  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/boq/new?method=manual');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('BOQ MANUAL BUILDER')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /What are we building/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/i })).toBeVisible();
  });
});
