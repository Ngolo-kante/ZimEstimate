import type { VisionAnalysisResult } from './types';

export const PLAN_ANALYSIS_TIMEOUT_MS = 55_000;

type AnalyzePlanOptions = {
  accessToken?: string;
  signal?: AbortSignal;
};

export async function analyzePlanFile(
  file: File,
  { accessToken, signal }: AnalyzePlanOptions = {},
): Promise<VisionAnalysisResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort('timeout'), PLAN_ANALYSIS_TIMEOUT_MS);
  const cancel = () => controller.abort('cancelled');
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/vision/analyze', {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: formData,
      cache: 'no-store',
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'We could not read that plan. Try a clearer copy or use the room builder.');
    }

    return result.data as VisionAnalysisResult;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (signal?.aborted) throw new Error('Plan reading cancelled. Your file was not lost — you can try it again.');
      throw new Error('The plan reader took too long. Try a smaller image or PDF, or use the room builder instead.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
