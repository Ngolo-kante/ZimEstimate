import { expect, test } from '@playwright/test';
import { jsPDF } from 'jspdf';

for (const method of ['Upload Floor Plan', 'Photo Quote']) {
  test(`${method} opens the chosen tool with project details, without creating an empty project`, async ({ page }) => {
    let projectWrites = 0;
    await page.route('**/rest/v1/projects*', async route => {
      if (route.request().method() === 'POST') projectWrites++;
      await route.fulfill({ json: [] });
    });
    await page.goto('/projects/new');
    await page.getByRole('button', { name: /^House A full build/ }).click();
    await page.getByRole('button', { name: /^New house Building from scratch/i }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /Budget-focused/i }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByPlaceholder('e.g., Borrowdale 4-Bed House').fill('Family home');
    await page.getByPlaceholder('e.g., Harare, Zimbabwe').fill('Harare');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(method, 'i') }).click();
    await page.getByRole('button', { name: 'Continue to estimate' }).click();
    await expect(page).toHaveURL(method === 'Photo Quote' ? /\/ai\/boq-scanner$/ : /\/ai\/vision-takeoff$/);
    await expect(page.getByText(method === 'Photo Quote' ? 'For Family home · Harare' : 'Family home', { exact: true })).toBeVisible();
    expect(projectWrites).toBe(0);
    if (method === 'Photo Quote') {
      await page.route('**/api/vision/scan-boq', route => route.fulfill({ json: { success: true, data: { title: 'Supplier quotation', items: [{ description: 'Cement', quantity: 10, unit: 'bags', unitPriceUsd: 12, confidence: 45 }] } } }));
      const pdf = new jsPDF();
      pdf.text('Cement: 10 bags at $12', 10, 20);
      await page.locator('input[type=file]').first().setInputFiles({
        name: 'quote.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf.output('arraybuffer')),
      });
      await page.getByRole('button', { name: 'Scan document' }).click();
      await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('Family home');
      await expect(page.getByRole('textbox', { name: 'Project location' })).toHaveValue('Harare');
      await expect(page.getByRole('document', { name: 'Scanned PDF reference' })).toBeVisible();
      await expect(page.getByText('1 to check')).toBeVisible();
    }
  });
}
