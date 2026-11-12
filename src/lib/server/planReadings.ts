import { createHash } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase';
import { PLAN_SAMPLES_BUCKET, shouldKeepPlanSamples } from '@/lib/server/planSamples';
import type { VisionAnalysisResult } from '@/lib/vision/types';

/**
 * The reading of a plan, remembered for a while, so that the same file gives
 * the same answer.
 *
 * The AI readers do not: the same model, asked twice about the same plan at
 * temperature 0, gave one house 92, 92 and then 119 m² (2026-11-12). A person
 * who uploads their plan a second time, on another day or another phone, and
 * sees another price has no reason to trust either. So a full reading is kept
 * against the file's own fingerprint and given again for the same bytes.
 * "Read this plan again" asks for a new one, which then replaces it.
 *
 * Kept beside the plan samples, in the same private bucket and on the live
 * site only, with nothing that identifies the uploader: the fingerprint of
 * the file and what the reader made of it. Deleted after
 * PLAN_READING_KEEP_DAYS by the daily job (prunePlanReadings).
 */

/** Change this when a new reading would differ in kind: readings kept under an older one are not used. */
export const PLAN_READING_VERSION = 'v2';
export const PLAN_READING_KEEP_DAYS = 30;

const folder = () => `readings/${PLAN_READING_VERSION}`;

export function planFingerprint(bytes: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

export interface KeptReading {
  readAt: string;
  data: VisionAnalysisResult;
}

/** The kept reading, if it is one and is still within its time. */
export function usableReading(raw: unknown, now = new Date()): VisionAnalysisResult | null {
  const kept = raw as Partial<KeptReading> | null;
  if (!kept || typeof kept.readAt !== 'string' || !kept.data || !Array.isArray(kept.data.rooms) || kept.data.rooms.length === 0) return null;
  const readAt = new Date(kept.readAt).getTime();
  const age = now.getTime() - readAt;
  if (Number.isNaN(readAt) || age < 0 || age > PLAN_READING_KEEP_DAYS * 24 * 60 * 60 * 1000) return null;
  return kept.data;
}

/**
 * Only a full reading by the main reader is worth giving again. One read
 * from the printed labels, or by a backup model while the main one was busy,
 * is the best that could be had at the time; the next upload should try for
 * better rather than repeat it.
 */
export function worthRemembering(data: VisionAnalysisResult, mainModel: string): boolean {
  return data.source === 'ai' && data.rooms.length > 0 && data.reader?.provider === 'gemini' && data.reader.model === mainModel;
}

/** Never throws: a reading that cannot be recalled is simply read again. */
export async function recallPlanReading(fingerprint: string): Promise<VisionAnalysisResult | null> {
  if (!shouldKeepPlanSamples()) return null;
  try {
    const { data, error } = await createServiceRoleClient().storage.from(PLAN_SAMPLES_BUCKET).download(`${folder()}/${fingerprint}.json`);
    if (error || !data) return null;
    return usableReading(JSON.parse(await data.text()));
  } catch {
    return null;
  }
}

/** Never throws: remembering a reading must not affect the person's result. */
export async function rememberPlanReading(fingerprint: string, data: VisionAnalysisResult): Promise<void> {
  if (!shouldKeepPlanSamples()) return;
  try {
    const kept: KeptReading = { readAt: new Date().toISOString(), data };
    await createServiceRoleClient().storage.from(PLAN_SAMPLES_BUCKET).upload(`${folder()}/${fingerprint}.json`, JSON.stringify(kept), {
      contentType: 'application/json',
      upsert: true,
    });
  } catch (error) {
    console.error('Could not remember plan reading', error instanceof Error ? error.message : error);
  }
}

/** Deletes kept readings past their time, and all those kept under an older version. */
export async function prunePlanReadings(now = new Date()): Promise<{ removed: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { removed: 0 };
  const bucket = createServiceRoleClient().storage.from(PLAN_SAMPLES_BUCKET);
  const cutoff = now.getTime() - PLAN_READING_KEEP_DAYS * 24 * 60 * 60 * 1000;
  const expired: string[] = [];
  try {
    const { data: versions } = await bucket.list('readings', { limit: 100 });
    for (const version of versions ?? []) {
      for (let offset = 0; ; offset += 1000) {
        const { data: files, error } = await bucket.list(`readings/${version.name}`, { limit: 1000, offset });
        if (error || !files || files.length === 0) break;
        for (const file of files) {
          const kept = new Date(file.updated_at ?? file.created_at ?? 0).getTime();
          if (version.name !== PLAN_READING_VERSION || kept < cutoff) expired.push(`readings/${version.name}/${file.name}`);
        }
        if (files.length < 1000) break;
      }
    }
    for (let i = 0; i < expired.length; i += 100) await bucket.remove(expired.slice(i, i + 100));
  } catch (error) {
    console.error('Could not prune plan readings', error instanceof Error ? error.message : error);
  }
  return { removed: expired.length };
}
