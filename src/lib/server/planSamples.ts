import { createServiceRoleClient } from '@/lib/supabase';

/**
 * Copies of floor plans people upload for reading, kept to test and improve
 * the plan reader against the plans people here actually draw.
 *
 * Private bucket (migration 054): no public URLs and no policies for signed-in
 * users, so only the server's service key can read it. Nothing that
 * identifies the uploader is stored — not the account, not the IP — only the
 * file and what the reader made of it. Kept for twelve months, then deleted
 * by the daily job (prunePlanSamples), as the privacy policy says. Disclosed
 * in the privacy policy rather than at the upload box, by the owner's choice.
 *
 * Only on the live site. Local development and preview deployments would
 * otherwise mix test uploads into the samples.
 */

export const PLAN_SAMPLES_BUCKET = 'plan-samples';
export const PLAN_SAMPLE_RETENTION_DAYS = 365;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface PlanSampleOutcome {
  outcome: 'read' | 'failed';
  rooms?: number;
  totalArea?: number;
  confidence?: number;
  error?: string;
}

export function shouldKeepPlanSamples(): boolean {
  return process.env.VERCEL_ENV === 'production' && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Never throws: keeping a sample must not affect the user's result. */
export async function keepPlanSample(file: { bytes: ArrayBuffer; mimeType: string }, result: PlanSampleOutcome): Promise<void> {
  if (!shouldKeepPlanSamples()) return;
  try {
    const client = createServiceRoleClient();
    // A sortable timestamp first, so pruning can tell a file's age from its
    // name without fetching anything.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${stamp}_${crypto.randomUUID()}`;
    const ext = EXTENSIONS[file.mimeType] ?? 'bin';

    await client.storage.from(PLAN_SAMPLES_BUCKET).upload(`${base}.${ext}`, file.bytes, {
      contentType: file.mimeType,
      upsert: false,
    });
    await client.storage.from(PLAN_SAMPLES_BUCKET).upload(
      `${base}.json`,
      JSON.stringify({ ...result, mimeType: file.mimeType, sizeBytes: file.bytes.byteLength, readAt: new Date().toISOString() }),
      { contentType: 'application/json', upsert: false },
    );
  } catch (error) {
    console.error('Could not keep plan sample', error instanceof Error ? error.message : error);
  }
}

/** The age of a sample, from the timestamp its name starts with. */
export function sampleTakenAt(name: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_/.exec(name);
  if (!match) return null;
  const [, day, h, m, s, ms] = match;
  const date = new Date(`${day}T${h}:${m}:${s}.${ms}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Deletes samples past the retention period. Run from the daily job. */
export async function prunePlanSamples(now = new Date()): Promise<{ removed: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { removed: 0 };
  const client = createServiceRoleClient();
  const cutoff = now.getTime() - PLAN_SAMPLE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const expired: string[] = [];
  // Names start with the timestamp, so listing by name lists by age: stop at
  // the first page with nothing old enough.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage
      .from(PLAN_SAMPLES_BUCKET)
      .list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data || data.length === 0) break;
    const old = data.filter((file) => {
      const taken = sampleTakenAt(file.name);
      return taken !== null && taken.getTime() < cutoff;
    });
    expired.push(...old.map((file) => file.name));
    if (old.length < data.length || data.length < 1000) break;
  }

  for (let i = 0; i < expired.length; i += 100) {
    await client.storage.from(PLAN_SAMPLES_BUCKET).remove(expired.slice(i, i + 100));
  }
  return { removed: expired.length };
}
