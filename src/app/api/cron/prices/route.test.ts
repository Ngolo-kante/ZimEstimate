import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const collect = vi.fn();
const sendEmail = vi.fn();
vi.mock('@/lib/pricing/zbmsCollector', async (original) => ({
  ...(await original<typeof import('@/lib/pricing/zbmsCollector')>()),
  collectZbmsPrices: (...args: unknown[]) => collect(...args),
}));
vi.mock('@/lib/server/email', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
  escapeHtml: (s: string) => s,
}));

const { GET, POST } = await import('./route');

const summary = (over: Record<string, unknown> = {}) => ({
  scrapedAt: '2026-11-23T00:00:00.000Z', dryRun: false, mapped: 2, priced: 2, written: 2,
  autoApproved: [], pending: [], materials: [], unpriced: [], failures: [], lowCoverage: false, failed: false, ...over,
});
const call = (auth?: string, query = '', method: 'GET' | 'POST' = 'GET') =>
  (method === 'GET' ? GET : POST)(new Request(`https://zimestimate.com/api/cron/prices${query}`, {
    method, headers: auth ? { authorization: auth } : {},
  }));

beforeEach(() => {
  vi.stubEnv('PRICE_COLLECT_SECRET', 'right-secret');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  collect.mockResolvedValue(summary());
  sendEmail.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllEnvs(); collect.mockReset(); sendEmail.mockReset(); });

describe('weekly price collection route', () => {
  it.each([undefined, 'Bearer wrong-secret', 'right-secret', 'Bearer right-secret-and-more'])(
    'refuses a missing or wrong secret (%s)', async (auth) => {
      const response = await call(auth);
      expect(response.status).toBe(401);
      expect(collect).not.toHaveBeenCalled();
    });

  it('refuses everyone when no secret is configured', async () => {
    vi.stubEnv('PRICE_COLLECT_SECRET', '');
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer ')).status).toBe(401);
  });

  it('falls back to CRON_SECRET', async () => {
    vi.stubEnv('PRICE_COLLECT_SECRET', '');
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    expect((await call('Bearer cron-secret')).status).toBe(200);
  });

  it('runs the collector and sends no email on a healthy run (GET and POST)', async () => {
    for (const method of ['GET', 'POST'] as const) {
      const response = await call('Bearer right-secret', '', method);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ written: 2, alert: 'not needed' });
    }
    expect(collect).toHaveBeenCalledWith({ dbUrl: 'https://db.invalid', dbKey: 'service-key', dryRun: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('emails support when prices need review', async () => {
    collect.mockResolvedValue(summary({ pending: [{ materialId: 'brick-common', oldPrice: 1, newPrice: 0.11, changePercent: -89 }] }));
    const body = await (await call('Bearer right-secret')).json();
    expect(body.alert).toBe('sent');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'support@zimestimate.com', subject: 'ZBMS price collection needs review' });
    expect(sendEmail.mock.calls[0][0].text).toContain('brick-common: 1 → 0.11 USD (-89.00%)');
  });

  it('dry run writes nothing and sends no email', async () => {
    collect.mockResolvedValue(summary({ dryRun: true, written: 0, failed: true, failures: ['x'] }));
    const body = await (await call('Bearer right-secret', '?dry=1')).json();
    expect(collect).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(body.alert).toBe('skipped (dry run)');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
