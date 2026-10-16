import { afterEach, describe, expect, it, vi } from 'vitest';

describe('production origin protection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects a browser origin when deployment allow-list configuration is absent', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const name of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_VERCEL_URL', 'VERCEL_URL']) {
      vi.stubEnv(name, '');
    }
    vi.resetModules();
    const { enforceCsrf } = await import('./security');
    const response = enforceCsrf(new Request('https://zimestimate.com/api/vision/analyze', {
      method: 'POST',
      headers: { origin: 'https://untrusted.example' },
    }));
    expect(response?.status).toBe(403);
  });
});
