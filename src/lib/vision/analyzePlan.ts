import type { VisionAnalysisResult } from './types';
import { wordsFromTextItems, type PdfWords } from './pdfWords';

/* The server's readers have 52 s, then may fall back to the printed labels;
   its route allows 60. Waiting a little longer than that means the browser
   never gives up on an answer that is about to arrive. */
export const PLAN_ANALYSIS_TIMEOUT_MS = 63_000;

export const PDF_PREPARE_TIMEOUT_MS = 20_000;
export type AnalysisPhase = 'preparing' | 'reading' | 'retrying';
export const PLAN_TIMEOUT_MESSAGE = 'Reading the plan took too long. Try a clearer image, a smaller PDF, or the manual builder.';

/** Bounds even operations that do not honour AbortSignal; always removes listeners. */
export function withTimeLimit<T>(operation: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => finish(() => reject(new DOMException('Aborted', 'AbortError')));
    const timer = setTimeout(() => finish(() => reject(new DOMException('Timed out', 'TimeoutError'))), ms);
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      settle();
    };
    operation.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

export function shouldResizePhoto(type: string, bytes: number, width: number, height: number): boolean {
  return type.startsWith('image/') && (bytes > 3_000_000 || Math.max(width, height) > 2_400);
}

export function analysisProgress(elapsed: number): number {
  return 96 - 84 * Math.exp(-Math.max(0, elapsed) / 22);
}

export function planResponseError(status: number, error?: unknown): string {
  if (status === 413) return 'That plan is too large to upload. Try a smaller image or PDF, or the manual builder.';
  if (status === 504 || status === 408) return PLAN_TIMEOUT_MESSAGE;
  if (status === 503 && !error) return 'The plan reader is busy. Please try again shortly, or use the manual builder.';
  if (typeof error === 'string' && error.trim()) return error;
  return 'We could not read that plan. Try a clearer copy or use the manual builder.';
}

async function preparePhoto(file: File, signal: AbortSignal): Promise<File> {
  const image = new Image();
  const url = URL.createObjectURL(file);
  const cleanup = () => { image.src = ''; URL.revokeObjectURL(url); };
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    image.src = url;
    await image.decode();
    if (signal.aborted || !shouldResizePhoto(file.type, file.size, image.naturalWidth, image.naturalHeight)) return file;
    const scale = Math.min(1, PAGE_LONG_SIDE_PX / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    let blob = await encode(0.85);
    if (blob && blob.size > 3_500_000) blob = await encode(0.7);
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'plan'}.jpg`, { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  } finally {
    signal.removeEventListener('abort', cleanup);
    cleanup();
  }
}

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
async function readFirstPage(file: File, signal: AbortSignal): Promise<{ image: Blob | null; words: PdfWords | null }> {
  const pdfjs = await import('pdfjs-dist');
  const data = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  const port = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' });
  let worker: ReturnType<typeof pdfjs.PDFWorker.create> | undefined;
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // Destruction itself may hang; never delay fallback or cancellation for it.
    try { void loadingTask?.destroy().catch(() => {}); } finally {
      try { worker?.destroy(); } finally { port.terminate(); }
    }
  };
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    worker = pdfjs.PDFWorker.create({ port });
    loadingTask = pdfjs.getDocument({ data, worker });
    const pdf = await loadingTask.promise;
    signal.throwIfAborted();
    const page = await pdf.getPage(1);
    signal.throwIfAborted();
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
    signal.throwIfAborted();
    const viewport = page.getViewport({ scale: Math.min(4, PAGE_LONG_SIDE_PX / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) return { image: null, words };
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    signal.throwIfAborted();
    const wordsBytes = words ? JSON.stringify(words).length : 0;
    const image = await pageImageWithin(canvas, UPLOAD_LIMIT_BYTES - file.size - wordsBytes);
    return { image, words };
  } finally {
    signal.removeEventListener('abort', cleanup);
    cleanup();
  }
}

type AnalyzePlanOptions = {
  onPhase?: (phase: AnalysisPhase) => void;
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
  const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
  const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
});

export async function analyzePlanFile(
  file: File,
  { accessToken, signal, onPreviewImage, onRetry, onPhase }: AnalyzePlanOptions = {},
): Promise<VisionAnalysisResult> {
  const preparation = new AbortController();
  const cancelPreparation = () => preparation.abort();
  signal?.addEventListener('abort', cancelPreparation, { once: true });
  try {
    signal?.throwIfAborted();
    onPhase?.('preparing');
    const formData = new FormData();
    let upload = file;
    try {
      if (file.type === 'application/pdf') {
        const { image, words } = await withTimeLimit(readFirstPage(file, preparation.signal), PDF_PREPARE_TIMEOUT_MS, signal);
        if (image) {
          formData.append('readingCopy', image, 'page-1.jpg');
          onPreviewImage?.(image);
        }
        if (words?.words.length) formData.append('pdfText', JSON.stringify(words));
      } else if (file.type.startsWith('image/')) {
        upload = await withTimeLimit(preparePhoto(file, preparation.signal), PDF_PREPARE_TIMEOUT_MS, signal);
      }
    } catch (error) {
      console.warn('Plan preview was skipped.', error);
    } finally {
      preparation.abort();
    }
    signal?.throwIfAborted();
    formData.append('file', upload);

    const send = async () => {
      const request = new AbortController();
      const cancel = () => request.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        signal?.throwIfAborted();
        onPhase?.('reading');
        return await withTimeLimit((async () => {
          const response = await fetch('/api/vision/analyze', {
            method: 'POST',
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            body: formData,
            cache: 'no-store',
            signal: request.signal,
          });
          // A busy response can be retried without waiting for its body.
          const result = response.status === 503 ? null : await response.json().catch(() => null);
          return { response, result };
        })(), PLAN_ANALYSIS_TIMEOUT_MS, signal);
      } finally {
        signal?.removeEventListener('abort', cancel);
        request.abort();
      }
    };
    let reply = await send();
    if (reply.response.status === 503) {
      onPhase?.('retrying');
      onRetry?.();
      await wait(BUSY_RETRY_DELAY_MS, signal ?? new AbortController().signal);
      reply = await send();
    }
    if (!reply.response.ok || !reply.result?.success) {
      throw new Error(planResponseError(reply.response.status, reply.result?.error));
    }
    return reply.result.data as VisionAnalysisResult;
  } catch (error) {
    if (signal?.aborted) throw new Error('Plan reading cancelled. Your file was not lost — you can try it again.');
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error(PLAN_TIMEOUT_MESSAGE);
    if (error instanceof TypeError) throw new Error('We could not upload your plan. Check your connection and try again, or use the manual builder.');
    throw error instanceof Error ? error : new Error(planResponseError(0));
  } finally {
    preparation.abort();
    signal?.removeEventListener('abort', cancelPreparation);
  }
}
