import { expect, test, Page } from '@playwright/test';

test.describe('Manual Builder Wizard', () => {
  test('renders new sections and enforces required fields', async ({ page }) => {
    await page.goto('/boq/new?method=manual');

    await expect(page.getByRole('heading', { name: 'Project Details', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Floor Plan Details', level: 3 })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Location Type' }).first()).toBeVisible();
    await expect(page.locator('label', { hasText: 'Specific Location' }).first()).toBeVisible();
    await expect(page.locator('label', { hasText: 'Floor Plan Size' }).first()).toBeVisible();
    await expect(page.locator('label', { hasText: 'Building Type' }).first()).toBeVisible();
    await expect(page.getByText('Optional Room Inputs')).toBeVisible();

    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.scrollIntoViewIfNeeded();
    await continueButton.click({ force: true });
    await expect(page.getByRole('heading', { name: 'Project Details', level: 2 })).toBeVisible();

    await page.getByPlaceholder('e.g. Borrowdale 4-Bedroom House').fill('Test Project');
    await page.getByTestId('location-type-urban').click();
    await page.getByPlaceholder('e.g. 240').fill('240');
    await page.getByTestId('building-type-single_storey').click();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Define Project Scope')).toBeVisible();
  });
});

async function completeStep1(page: Page) {
  await page.getByPlaceholder('e.g. Borrowdale 4-Bedroom House').fill('Wizard Project');
  await page.getByTestId('location-type-urban').click();
  await page.getByPlaceholder('e.g. 240').fill('240');
  await page.getByTestId('building-type-single_storey').click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function goToStep4(page: Page) {
  await completeStep1(page);
  await expect(page.getByRole('heading', { name: 'Define Project Scope', level: 2 })).toBeVisible();
  await page.getByText('Entire House').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Labor Options', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Start Building BOQ' }).click();
}

async function addFirstMaterial(page: Page) {
  const addButton = page.getByRole('button', { name: /Add Material/i }).first();
  await expect(addButton).toBeVisible();
  await addButton.click();
  const dropdown = page.getByTestId('material-dropdown').first();
  await dropdown.click();
  const searchInput = page.getByTestId('material-search-input');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('cement');
  await page.getByText('Standard Cement 32.5N').click();
  await page.getByPlaceholder('0.00').fill('10');
  await page.getByRole('button', { name: /^Add$/ }).click();
}

test.describe('BOQ Pricing', () => {
  test('shows pricing columns and variance updates', async ({ page }) => {
    await page.goto('/boq/new?method=manual');
    await goToStep4(page);
    await addFirstMaterial(page);

    const materialsList = page.locator('.materials-list');
    await expect(materialsList.getByText('Average Price').first()).toBeVisible();
    await expect(materialsList.getByText('Actual Price').first()).toBeVisible();
    await expect(materialsList.getByText('Var (Absolute)').first()).toBeVisible();
    await expect(materialsList.getByText('Var %').first()).toBeVisible();

    const row = page.locator('[data-testid="boq-row"]').first();
    const avgText = (await row.locator('[data-testid="boq-average-price"]').first().textContent()) || '';
    const avgValue = Number(avgText.replace('$', '').trim());
    const nextActual = (avgValue + 5).toFixed(2);

    await row.locator('[data-testid="boq-actual-price"]').fill(nextActual);

    const varText = (await row.locator('[data-testid="boq-var-abs"]').textContent()) || '';
    const varPctText = (await row.locator('[data-testid="boq-var-pct"]').textContent()) || '';
    expect(varText).toContain('+5.00');
    const expectedPct = ((5 / avgValue) * 100).toFixed(1);
    expect(varPctText).toContain(`+${expectedPct}%`);
  });

  test('shows update banner when price versions differ and keeps actual price on update', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('boq_price_version_draft', '2000-01-01');
    });

    await page.goto('/boq/new?method=manual');
    await goToStep4(page);
    await addFirstMaterial(page);

    await expect(page.getByText('Average prices have been updated this week.')).toBeVisible();

    const row = page.locator('[data-testid="boq-row"]').first();
    const avgText = (await row.locator('[data-testid="boq-average-price"]').first().textContent()) || '';
    const avgValue = Number(avgText.replace('$', '').trim());
    const customActual = (avgValue + 7).toFixed(2);
    await row.locator('[data-testid="boq-actual-price"]').fill(customActual);

    await page.getByRole('button', { name: 'Update Prices' }).click();
    await expect(page.getByText('Average prices have been updated this week.')).toBeHidden();
    await expect(row.locator('[data-testid="boq-actual-price"]')).toHaveValue(customActual);
  });
});
