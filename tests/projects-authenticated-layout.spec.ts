import { expect, test, type Page } from '@playwright/test';

const E2E_EMAIL = process.env.PLAYWRIGHT_E2E_EMAIL || process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.PLAYWRIGHT_E2E_PASSWORD || process.env.E2E_USER_PASSWORD;
const HAS_E2E_CREDS = Boolean(E2E_EMAIL && E2E_PASSWORD);

/** Stage switcher labels, in the order the workspace shows them. */
const STAGES = [
  { key: 'substructure', short: 'Foundation', schedule: 'Site preparation & foundation' },
  { key: 'superstructure', short: 'Structure', schedule: 'Structural walls & frame' },
  { key: 'roofing', short: 'Roof', schedule: 'Roofing' },
  { key: 'finishing', short: 'Finishes', schedule: 'Interior & finishing' },
  { key: 'services', short: 'Plumbing & electrical', schedule: 'Plumbing & electrical' },
  { key: 'exterior', short: 'External', schedule: 'External work' },
] as const;

/** Every workspace view that has a page heading, by its ?view= value. */
const VIEW_HEADINGS: Array<{ view: string; heading: string }> = [
  { view: 'boq', heading: 'Bill of Quantities' },
  { view: 'compliance', heading: 'Compliance' },
  { view: 'procurement', heading: 'Buying' },
  { view: 'usage', heading: 'Usage tracking' },
  { view: 'documents', heading: 'Documents' },
  { view: 'budget', heading: 'Budget' },
  { view: 'settings', heading: 'Settings' },
];

test.describe('Authenticated project workspace', () => {
  test.skip(!HAS_E2E_CREDS, 'Set PLAYWRIGHT_E2E_EMAIL and PLAYWRIGHT_E2E_PASSWORD to run auth layout tests.');

  test('project list, BOQ workspace, and insights remain usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page);

    await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
    await expect(page.getByLabel('Filter by status')).toBeHidden();
    await page.getByPlaceholder('Search projects...').fill('no-matching-project-zzzz');
    await expect(page.locator('a.project-link')).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(page.getByLabel('Filter by status')).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByPlaceholder('Search projects...').clear();
    await expect(page.getByRole('navigation', { name: 'Project workspace views' }))
      .toContainText('My work');
    await expectNoDocumentOverflow(page);

    const fullProject = page.locator(
      'a.project-link[href^="/projects/"]:not([href^="/projects/quick/"])'
    ).first();
    await expect(fullProject).toBeVisible();
    const projectName = ((await fullProject.locator('h3').first().textContent()) ?? '').trim();
    await fullProject.click();
    const projectDock = page.getByRole('navigation', { name: 'Project workspace' });
    await expect(projectDock.getByRole('button', { name: 'Overview' })).toBeVisible({ timeout: 10_000 });

    // Overview: the project's own name is the page heading.
    if (projectName) {
      await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Construction progress' })).toBeVisible();
    await expectNoDocumentOverflow(page);

    await projectDock.getByRole('button', { name: 'BOQ' }).click();
    await expect(page.getByRole('heading', { name: 'Bill of Quantities' })).toBeVisible();
    await expect(page.locator('.sidebar-spine')).toBeHidden();
    const stageSwitcher = page.getByRole('navigation', { name: 'Construction stages' });
    await expect(stageSwitcher).toBeVisible();
    const structureStage = stageSwitcher.getByRole('button', { name: /^Structure,/ });
    await structureStage.click();
    await expect(structureStage).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('button', { name: /Stage schedule Structural walls & frame/ })).toBeVisible();
    await expectNoDocumentOverflow(page);

    // Every stage the project has opens, shows its own schedule, and fits.
    for (const stage of STAGES) {
      const stageButton = stageSwitcher.getByRole('button', { name: new RegExp(`^${escapeRegExp(stage.short)},`) });
      if (await stageButton.count() === 0) continue;
      await stageButton.click();
      await expect(stageButton).toHaveAttribute('aria-current', 'step');
      await expect(page.getByRole('heading', { name: 'Bill of Quantities' })).toBeVisible();
      await expect(page.getByRole('button', { name: new RegExp(`Stage schedule ${escapeRegExp(stage.schedule)}`) })).toBeVisible();
      await expectNoDocumentOverflow(page);
    }

    await projectDock.getByRole('button', { name: 'Budget' }).click();
    await expect(page.getByRole('heading', { name: 'Budget', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Budget position' })).toBeVisible();
    // Labelled "Budget spent" until the bar named what it measures against.
    await expect(page.getByRole('progressbar', { name: /^Share of the (BOQ estimate|budget limit) spent$/ })).toBeVisible();
    await expect(page.getByText('Add BOQ items to calculate a plan')).toBeVisible();
    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel('Target amount').fill('15000');
    await expect(page.getByText('Amounts to set aside')).toBeVisible();
    // Was a "Set delivery reminders" button; the reminder now waits for a target date.
    await expect(page.getByText('Choose a target and date to set a savings reminder.')).toBeVisible();
    await expectNoDocumentOverflow(page);

    await projectDock.getByRole('button', { name: 'Buy' }).click();
    // This heading was "Procurement Hub" until the view was renamed.
    await expect(page.getByRole('heading', { name: 'Buying' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Procurement overview' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Actual spend against BOQ estimate' })).toBeVisible();
    const procurementSections = page.getByRole('tablist', { name: 'Procurement sections' });
    await expect(procurementSections.getByRole('tab', { name: /Items/ })).toHaveAttribute('aria-current', 'page');
    await procurementSections.getByRole('tab', { name: /Quotes/ }).click();
    await expect(procurementSections.getByRole('tab', { name: /Quotes/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Requests for quotation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New request' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await procurementSections.getByRole('tab', { name: /Purchases/ }).click();
    await expect(procurementSections.getByRole('tab', { name: /Purchases/ })).toHaveAttribute('aria-current', 'page');
    await expectNoDocumentOverflow(page);
    await procurementSections.getByRole('tab', { name: /Items/ }).click();
    await expect(page.getByRole('textbox', { name: 'Search procurement materials' })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    await expectNoDocumentOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoDocumentOverflow(page);

    const moreHeadings: Record<string, string> = {
      'Usage tracking': 'Usage tracking',
      Compliance: 'Compliance',
      Documents: 'Documents',
      Settings: 'Settings',
    };
    for (const destination of ['Usage tracking', 'Compliance', 'Documents', 'Settings']) {
      await projectDock.getByRole('button', { name: 'More' }).click();
      await page.getByRole('dialog', { name: 'More tools' }).getByRole('button', { name: new RegExp(`^${destination}`) }).click();
      await expect(page.getByRole('heading', { level: 1, name: moreHeadings[destination], exact: true })).toBeVisible();
      await expectNoDocumentOverflow(page);

      if (destination === 'Usage tracking') {
        await visitUsageSections(page);
      }
    }

    await page.goto('/projects/dashboard');
    await expect(page.getByRole('heading', { name: 'Project insights' })).toBeVisible();
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

  for (const viewport of [
    { label: 'tablet', width: 834, height: 1112 },
    { label: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`every workspace view opens from its link and fits on ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page);
      await expectNoDocumentOverflow(page);
      // A no-match search used to make the tablet filter row even wider.
      const search = page.getByPlaceholder('Search projects...');
      await search.fill('no-matching-project-zzzz');
      await expect(page.locator('a.project-link')).toHaveCount(0);
      await expectNoDocumentOverflow(page);
      await search.clear();

      const fullProject = page.locator(
        'a.project-link[href^="/projects/"]:not([href^="/projects/quick/"])'
      ).first();
      await expect(fullProject).toBeVisible();
      const projectHref = await fullProject.getAttribute('href');
      expect(projectHref).toBeTruthy();
      const projectName = ((await fullProject.locator('h3').first().textContent()) ?? '').trim();

      // Overview has no ?view=, and its heading is the project's name.
      await page.goto(projectHref!);
      await expect(page.getByRole('heading', { name: 'Construction progress' })).toBeVisible({ timeout: 15_000 });
      if (projectName) {
        await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible();
      }
      await expectNoDocumentOverflow(page);

      for (const { view, heading } of VIEW_HEADINGS) {
        await page.goto(`${projectHref}?view=${view}`);
        await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible({ timeout: 15_000 });
        await expectNoDocumentOverflow(page);

        if (view === 'usage') {
          await visitUsageSections(page);
        }
      }

      // A stage named in the link is the stage that opens, and survives a refresh and Back.
      await page.goto(`${projectHref}?view=boq&stage=superstructure`);
      const stageSwitcher = page.getByRole('navigation', { name: 'Construction stages' });
      const structureStage = stageSwitcher.getByRole('button', { name: /^Structure,/ });
      await expect(structureStage).toHaveAttribute('aria-current', 'step', { timeout: 15_000 });
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Bill of Quantities' })).toBeVisible({ timeout: 15_000 });
      await expect(structureStage).toHaveAttribute('aria-current', 'step');
      await expectNoDocumentOverflow(page);

      const roofStage = stageSwitcher.getByRole('button', { name: /^Roof,/ });
      if (await roofStage.count() > 0) {
        await roofStage.click();
        await expect(roofStage).toHaveAttribute('aria-current', 'step');
        await expect(page).toHaveURL(/[?&]stage=roofing/);
        await page.goBack();
        await expect(structureStage).toHaveAttribute('aria-current', 'step');
        await expect(page).toHaveURL(/[?&]stage=superstructure/);
      }
    });
  }
});

async function signIn(page: Page) {
  await page.goto('/auth/login?redirect=/projects');
  await page.getByPlaceholder('you@example.com').fill(E2E_EMAIL!);
  await page.getByPlaceholder('Enter your password').fill(E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/projects', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible({ timeout: 20_000 });
}

/** Log, Materials and Ledger; switches usage tracking on first when the project has it off. */
async function visitUsageSections(page: Page) {
  const enableUsage = page.getByRole('button', { name: 'Enable usage tracking' });
  const usageTabs = page.getByRole('tablist', { name: 'Usage tracking' });
  await expect(enableUsage.or(usageTabs)).toBeVisible({ timeout: 10_000 });
  if (await enableUsage.isVisible()) {
    await enableUsage.click();
  }
  await expect(usageTabs).toBeVisible({ timeout: 10_000 });

  for (const section of [/Log/, /Materials/, /ledger/i]) {
    const tab = usageTabs.getByRole('tab', { name: section });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expectNoDocumentOverflow(page);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectNoDocumentOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}
