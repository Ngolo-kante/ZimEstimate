import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepPlanSample, sampleTakenAt, shouldKeepPlanSamples } from './planSamples';

afterEach(() => vi.unstubAllEnvs());

describe('keeping copies of uploaded plans', () => {
  it('only collects on the live site', () => {
    // Local development and preview deployments would otherwise mix test
    // uploads into the samples.
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(shouldKeepPlanSamples()).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'development');
    expect(shouldKeepPlanSamples()).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(shouldKeepPlanSamples()).toBe(true);
  });

  it('does nothing, and does not throw, when it should not collect', async () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    await expect(keepPlanSample({ bytes: new ArrayBuffer(4), mimeType: 'image/png' }, { outcome: 'read' })).resolves.toBeUndefined();
  });

  it('reads a sample\'s age from its name, which the daily clean-up relies on', () => {
    const stamp = new Date('2025-10-01T08:30:15.123Z').toISOString().replace(/[:.]/g, '-');
    expect(sampleTakenAt(`${stamp}_3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png`)?.toISOString()).toBe('2025-10-01T08:30:15.123Z');
  });

  it('never treats an unrecognised file name as old enough to delete', () => {
    expect(sampleTakenAt('notes.txt')).toBeNull();
    expect(sampleTakenAt('2025-13-99T99-99-99-999Z_x.png')).toBeNull();
  });
});
