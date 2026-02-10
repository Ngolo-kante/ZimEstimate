import { defineConfig } from '@playwright/test';

// Avoid NO_COLOR/FORCE_COLOR conflict warnings in Playwright's web server.
delete process.env.NO_COLOR;

const host = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 3000);

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  use: {
    baseURL: `http://${host}:${port}`,
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --hostname ${host} --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
