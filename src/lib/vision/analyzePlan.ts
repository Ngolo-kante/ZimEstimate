import type { VisionAnalysisResult } from './types';
import { wordsFromTextItems, type PdfWords } from './pdfWords';

/* The server's readers have 52 s, then may fall back to the printed labels;
   its route allows 60. Waiting a little longer than that means the browser
   never gives up on an answer that is about to arrive. */
export const PLAN_ANALYSIS_TIMEOUT_MS = 63_000;

/* Plans come as A1 and A3 sheets: at 1,600 px wide an A1 sheet's room labels
   were a few pixels tall. 2,400 px on the long side keeps them legible in
   the editor, where this image is shown, and the server still sends the
   readers at most 2,000 px. */
const PAGE_LONG_SIDE_PX = 2_400;

/* Vercel refuses a request body over 4.5 MB. The PDF, its page image and its
   words travel together, so the image gets what the PDF leaves, with room
   to spare; a large PDF gets a smaller, plainer image rather than a failed
   upload. */
const UPLOAD_LIMIT_BYTES = 4_200_000;

async function pageImageWithin(canvas: HTMLCanvasElement, budget: number): Promise<Blob | null> {
  const encode = (source: HTMLCanvasElement, quality: number) =>
    new Promise<Blob | null>((resolve) => source.toBlob(resolve, 'image/jpeg', quality));
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await encode(canvas, quality);
    if (!blob || blob.size <= budget) return blob;
  }
  // Still too large: the page at the old 1,600 px, which every reader handled.
  const scale = 1_600 / Math.max(canvas.width, canvas.height);
  const small = document.createElement('canvas');
  small.width = Math.round(canvas.width * scale);
  small.height = Math.round(canvas.height * scale);
  small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
  const blob = await encode(small, 0.7);
  return blob && blob.size <= budget ? blob : null;
}

/**
 * The first page of a PDF: a JPEG for the readers that take images only
 * (the backup AI readers and the label reader) and for the editor, and the
 * words printed on it, for checking the scan's sizes (pdfWords.ts). Either is
 * null if it cannot be had — the PDF is still read by the main reader.
 */
async function readFirstPage(file: File): Promise<{ image: Blob | null; words: PdfWords | null }> {
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
      let words: PdfWords | null = null;
      try {
        const text = await page.getTextContent();
        words = wordsFromTextItems(text.items.filter((item) => 'str' in item), {
          width: base.width,
          height: base.height,
          toViewport: (x, y) => base.convertToViewportPoint(x, y),
        });
      } catch {
        // A scanned PDF has no text; the label reader reads the image instead.
      }
      const viewport = page.getViewport({ scale: Math.min(4, PAGE_LONG_SIDE_PX / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return { image: null, words };
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const wordsBytes = words ? JSON.stringify(words).length : 0;
      const image = await pageImageWithin(canvas, UPLOAD_LIMIT_BYTES - file.size - wordsBytes);
      return { image, words };
    } finally {
      await loadingTask.destroy();
      worker.destroy();
    }
  } catch {
    return { image: null, words: null };
  }
}

type AnalyzePlanOptions = {
  accessToken?: string;
  signal?: AbortSignal;
  onPreviewImage?: (image: Blob) => void;
  /** Called when the readers were busy and the plan is being read again. */
  onRetry?: () => void;
};

/* A busy spell on the free AI readers usually passes within seconds; 6 of the
   7 failed uploads in the week to 2026-10-17 were "busy". One quiet retry
   before telling the person to come back later. */
export const BUSY_RETRY_DELAY_MS = 10_000;

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

export async function analyzePlanFile(
  file: File,
  { accessToken, signal, onPreviewImage, onRetry }: AnalyzePlanOptions = {},
): Promise<VisionAnalysisResult> {
  const controller = new AbortController();
  let timeout: number | null = null;
  const cancel = () => controller.abort('cancelled');
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (file.type === 'application/pdf') {
      const { image: copy, words } = await readFirstPage(file);
      if (copy) {
        formData.append('readingCopy', copy, 'page-1.jpg');
        if (!signal?.aborted) onPreviewImage?.(copy);
      }
      if (words && words.words.length > 0) formData.append('pdfText', JSON.stringify(words));
    }
    if (signal?.aborted) controller.abort('cancelled');
    timeout = window.setTimeout(() => controller.abort('timeout'), PLAN_ANALYSIS_TIMEOUT_MS);

    const send = () => fetch('/api/vision/analyze', {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: formData,
      cache: 'no-store',
      signal: controller.signal,
    });
    let response = await send();
    if (response.status === 503) {
      // Busy or out of allowance for the moment: wait, then one more try, on
      // a fresh time limit so the retry gets the full window.
      onRetry?.();
      if (timeout !== null) window.clearTimeout(timeout);
      await wait(BUSY_RETRY_DELAY_MS, controller.signal);
      timeout = window.setTimeout(() => controller.abort('timeout'), PLAN_ANALYSIS_TIMEOUT_MS);
      response = await send();
    }
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
