import { expect, test } from '@playwright/test';

function parseCurrency(raw: string): number {
  return Number(raw.replace(/[^0-9.]/g, ''));
}

test.describe('BOQ Live Estimator', () => {
  test('renders all sections and quick/detailed geometry validation behavior', async ({ page }) => {
    await page.goto('/boq/new?method=manual');

    await expect(page.getByRole('heading', { name: 'Project & Location' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Building Design' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Materials Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Project Scope' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Labor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Site Setup' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Site Conditions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review & Finalize' })).toBeVisible();

    await expect(page.getByText('Floor area is required in Quick Entry mode.')).toBeVisible();

    await page.getByRole('button', { name: 'Draw Floor Plan' }).click();
    await expect(page.getByText('Floor area is required in Quick Entry mode.')).toBeHidden();

    await page.getByRole('button', { name: 'Quick Entry' }).click();
    await expect(page.getByText('Floor area is required in Quick Entry mode.')).toBeVisible();
  });

  test('updates estimate live and supports scope/labor toggles', async ({ page }) => {
    await page.goto('/boq/new?method=manual');

    await page.getByLabel('Floor Area (m2)').fill('160');
    await page.getByLabel('Building Type').selectOption('single_storey');

    const totalLocator = page.getByTestId('live-total').first();
    await expect(totalLocator).not.toContainText('$0');

    const initialTotal = parseCurrency((await totalLocator.textContent()) || '$0');

    const scopeSection = page.locator('section', { has: page.getByRole('heading', { name: 'Project Scope' }) });
    await scopeSection.getByRole('button', { name: 'Selected Stages' }).click();
    await scopeSection.getByRole('button', { name: 'Substructure', exact: true }).click();
    await scopeSection.getByRole('button', { name: 'Superstructure', exact: true }).click();
    await scopeSection.getByRole('button', { name: 'Roofing', exact: true }).click();

    const stageScopedTotal = parseCurrency((await totalLocator.textContent()) || '$0');
    expect(stageScopedTotal).not.toBe(initialTotal);

    await page.getByRole('button', { name: 'Materials + Labor' }).click();
    const withLaborTotal = parseCurrency((await totalLocator.textContent()) || '$0');
    expect(withLaborTotal).toBeGreaterThan(stageScopedTotal);
  });

  test('opens room builder modal and unauthenticated save prompt', async ({ page }) => {
    await page.goto('/boq/new?method=manual');

    await page.getByRole('button', { name: 'Draw Floor Plan' }).click();
    await page.getByTestId('launch-floor-plan-editor').click();
    await expect(page.getByTestId('room-builder-modal')).toBeVisible();

    await page.getByRole('button', { name: 'Close floor plan' }).click();
    await expect(page.getByTestId('room-builder-modal')).toBeHidden();
    await page.getByRole('button', { name: 'Save Estimate' }).click();
    await expect(page.getByRole('heading', { name: 'Save to Dashboard' })).toBeVisible();
  });

  test('shows mobile estimate bar and opens bottom sheet details', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/boq/new?method=manual');

    await expect(page.getByText('Live Estimate')).toBeVisible();
    await page.getByRole('button', { name: 'View Details' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Estimate Breakdown')).toBeVisible();
  });
});
