import type { VisionAnalysisResult } from './types';

/* The server's readers have 52 s, then may fall back to the printed labels;
   its route allows 60. Waiting a little longer than that means the browser
   never gives up on an answer that is about to arrive. */
export const PLAN_ANALYSIS_TIMEOUT_MS = 63_000;

/**
 * A JPEG of a PDF's first page, about 1,600 px wide, for the readers that
 * take images only (the backup AI readers and the label reader). Null if it
 * cannot be made — the PDF is still read by the main reader.
 */
async function firstPageAsImage(file: File): Promise<Blob | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const worker = pdfjs.PDFWorker.create({
      port: new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' }),
    });
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), worker });
    try {
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, 1600 / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    } finally {
      await loadingTask.destroy();
      worker.destroy();
    }
  } catch {
    return null;
  }
}

type AnalyzePlanOptions = {
  accessToken?: string;
  signal?: AbortSignal;
  onPreviewImage?: (image: Blob) => void;
};

export async function analyzePlanFile(
  file: File,
  { accessToken, signal, onPreviewImage }: AnalyzePlanOptions = {},
): Promise<VisionAnalysisResult> {
  const controller = new AbortController();
  let timeout: number | null = null;
  const cancel = () => controller.abort('cancelled');
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (file.type === 'application/pdf') {
      const copy = await firstPageAsImage(file);
      if (copy) {
        formData.append('readingCopy', copy, 'page-1.jpg');
        if (!signal?.aborted) onPreviewImage?.(copy);
      }
    }
    if (signal?.aborted) controller.abort('cancelled');
    timeout = window.setTimeout(() => controller.abort('timeout'), PLAN_ANALYSIS_TIMEOUT_MS);

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
    if (timeout !== null) window.clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
