import { expect, test } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

test('contractor markup survives saving, reopening, changing it to zero, and reopening again', async ({ page }) => {
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const user = { id: '36f4d23f-e9df-45fb-b1d7-27aedcc8d6ef', email: 'contractor@example.invalid', aud: 'authenticated', role: 'authenticated' };
  const estimateId = 'ac46432e-c114-4a07-a3ba-eb23055890df';
  const sessionKey = `sb-${api.hostname.split('.')[0]}-auth-token`;
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: expires, role: user.role })).toString('base64url');
  const session = { user, expires_at: expires, expires_in: 3600, access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, refresh_token: 'fixture', token_type: 'bearer' };
  const item = { id: 'pipe', category: 'Materials', description: 'Pipe', quantity: 10, unit: 'm', unitCostUsd: 100, totalCostUsd: 1000, included: true, owned: false, optional: false };
  await page.addInitScript(({ sessionKey, session, item }) => {
    localStorage.setItem(sessionKey, JSON.stringify(session));
    if (location.pathname === '/quick-projects/water') {
      localStorage.setItem('quick_boq_session', JSON.stringify({
        projectType: 'water', answers: {}, boqItems: [item], markupPct: 0, currency: 'USD',
        labor: { enabled: false, method: 'percentage', percentage: 25 },
      }));
    }
  }, { sessionKey, session, item });

  let persisted: Record<string, unknown> | undefined;
  await page.route(`${api.origin}/**`, async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname.endsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (pathname.endsWith('/profiles')) return route.fulfill({ json: { ...user, tier: 'pro', user_type: 'contractor' } });
    if (pathname.endsWith('/quick_boqs')) {
      if (method === 'POST') persisted = { id: estimateId, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...route.request().postDataJSON() };
      if (method === 'PATCH') persisted = { ...persisted, ...route.request().postDataJSON() };
      return route.fulfill({ json: method !== 'GET' || searchParams.has('id') ? persisted : persisted ? [persisted] : [] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/quick-projects/water');
  const markup = page.locator('#markup-pct');
  await markup.fill('10');
  const grandTotal = page.getByText('Grand Total', { exact: true }).locator('..');
  await expect(grandTotal).toContainText('$1,100');
  await page.getByRole('button', { name: 'Save BOQ' }).click();
  await expect.poll(() => persisted?.markup_pct).toBe(10);
  await expect(page).toHaveURL(/\/projects(?:\?|$)/);
  await page.goto(`/projects/quick/${estimateId}`);
  await expect(markup).toHaveValue('10');
  await expect(grandTotal).toContainText('$1,100');
  await markup.fill('0');
  await page.getByRole('button', { name: 'Save BOQ' }).click();
  await expect.poll(() => persisted?.markup_pct).toBe(0);
  await page.reload();
  await expect(markup).toHaveValue('0');
  await expect(grandTotal).toContainText('$1,000');
});

test('adding a Marketplace material writes only its BOQ line', async ({ page }) => {
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const project = { id: '213472ae-d625-4997-bf75-79cb505e4a26', name: 'Foundation draft', status: 'draft', total_usd: 1000, total_zwg: 27000 };
  const writes: string[] = [];
  await page.route(`${api.origin}/**`, route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname.endsWith('/projects')) {
      if (method === 'PATCH') writes.push('project total');
      return route.fulfill({ json: searchParams.has('id') ? project : [project] });
    }
    if (pathname.endsWith('/boq_items') && method === 'POST') {
      const line = route.request().postDataJSON();
      expect(line.project_id).toBe(project.id);
      writes.push('BOQ line');
      return route.fulfill({ status: 201, json: { ...line, id: '09e2834b-ab2c-48d6-a33c-6ee765784124' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/marketplace');
  await page.locator('.material-card').first().click();
  await page.getByRole('button', { name: 'Add to Estimate' }).click();
  const picker = page.getByRole('dialog', { name: 'Add to Project' });
  await picker.getByText(project.name, { exact: true }).click();
  await picker.getByRole('button', { name: 'Add to Project' }).click();
  await expect(page.getByText(/added to Foundation draft/).first()).toBeVisible();
  expect(writes).toEqual(['BOQ line']);
});
