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

  test('keeps pricing primary while exposing compact review tools', async ({ page }) => {
    await page.goto('/boq/new?template=tpl-3bed-standard&finish=standard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Review your BOQ and pricing' }))
      .toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'BOQ & Pricing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compliance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();
    await expect(page.getByText('Grand Total Baseline', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Compliance' }).click();
    await expect(page.getByText('Pre-Construction Checklist')).toBeVisible();

    await page.getByRole('button', { name: 'Documents' }).click();
    await expect(page.getByRole('heading', { name: 'Project documents' })).toBeVisible();
  });

  test('review workspace has no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/boq/new?template=tpl-3bed-standard&finish=standard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Review your BOQ and pricing' }))
      .toBeVisible({ timeout: 10000 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });

  test('AI Vision reaches the shared review with editable BOQ fields', async ({ page }) => {
    await page.route('**/api/vision/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rooms: [{
              id: 'room-1',
              name: 'Living Room',
              dimensions: { width: 5, length: 4 },
              area: 20,
              position: { x: 10, y: 10, width: 45, height: 40 },
              wallType: 'external',
              isEdited: false,
            }],
            walls: [
              { id: 'wall-1', startPoint: { x: 10, y: 10 }, endPoint: { x: 55, y: 10 }, length: 5, height: 2.7, thickness: 230, type: 'external' },
              { id: 'wall-2', startPoint: { x: 55, y: 10 }, endPoint: { x: 55, y: 50 }, length: 4, height: 2.7, thickness: 230, type: 'external' },
              { id: 'wall-3', startPoint: { x: 55, y: 50 }, endPoint: { x: 10, y: 50 }, length: 5, height: 2.7, thickness: 230, type: 'external' },
              { id: 'wall-4', startPoint: { x: 10, y: 50 }, endPoint: { x: 10, y: 10 }, length: 4, height: 2.7, thickness: 230, type: 'external' },
            ],
            totalArea: 20,
            doors: 1,
            windows: 2,
            confidence: 96,
            imageWidth: 1000,
            imageHeight: 800,
          },
        }),
      });
    });

    await page.goto('/ai/vision-takeoff');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-plan.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock floor plan'),
    });

    await expect(page.getByRole('heading', { name: 'Edit Floor Plan' }))
      .toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Confirm Dimensions' }).click();
    await page.getByLabel('Project Name').fill('Vision Test House');
    await page.getByRole('button', { name: 'Continue to Configuration' }).click();
    await page.getByRole('button', { name: 'Generate BOQ' }).click();

    await expect(page.getByRole('heading', { name: 'Review your BOQ and pricing' }))
      .toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Compliance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Documents' })).toBeVisible();

    const firstRow = page.locator('.boq-table tbody tr').first();
    await firstRow.locator('button.material-name').click();
    await firstRow.locator('input[type="text"]').fill('Edited material');
    await firstRow.getByRole('button', { name: 'Save material name' }).click();
    await expect(firstRow).toContainText('Edited material');

    await firstRow.locator('.col-qty .editable').click();
    await firstRow.locator('.col-qty input').fill('12');
    await firstRow.locator('.col-qty input').press('Enter');
    await expect(firstRow.locator('.col-qty')).toContainText('12');

    await firstRow.locator('.col-unit .editable').click();
    await firstRow.locator('.col-unit input').fill('bundle');
    await firstRow.getByRole('button', { name: 'Save unit' }).click();
    await expect(firstRow.locator('.col-unit')).toContainText('bundle');

    await firstRow.locator('.col-price .editable').click();
    await firstRow.locator('.col-price input').fill('9.50');
    await firstRow.locator('.col-price input').press('Enter');
    await expect(firstRow.locator('.col-price')).toContainText('9.50');
  });
});
