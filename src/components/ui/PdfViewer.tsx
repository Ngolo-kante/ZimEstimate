'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowSquareOut, Warning } from '@phosphor-icons/react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFWorker, RenderTask } from 'pdfjs-dist';

/**
 * Renders a PDF in the page, on every phone.
 *
 * Plans and documents used to be previewed in an <iframe>, which relies on the
 * browser's own PDF viewer — and Chrome on Android has none. On most phones
 * here the preview was simply blank. This draws each page itself with
 * Mozilla's PDF.js, so it looks the same everywhere.
 *
 * One page is drawn at a time, at the width of its container. Large drawings
 * are what people upload, and a phone that tries to hold every page of an A1
 * plan as a full-resolution canvas runs out of memory.
 *
 * PDF.js is loaded only when a viewer actually opens — it is too large to put
 * in every page's bundle for a feature most visits never use.
 */

type Source = string | Blob;

interface PdfViewerProps {
  /** A https URL (such as a signed storage link) or the file itself. */
  source: Source;
  title: string;
  /** CSS height of the viewing area. */
  height?: string;
}

/* The app's Content-Security-Policy allows fetching https: but not blob:, so
   a blob: URL that works in development would fail in production. A Blob is
   read directly instead; a URL string is only ever an https link.
   (PDF.js 6 has no eval code path at all, so the policy's lack of
   'unsafe-eval' needs no special handling.) */
/* One worker for the life of the page, passed to every document explicitly.
   Left to PDF.js, the worker belongs to the first document and is torn down
   when that document is closed — so closing one preview and opening another
   (or React's development double-mount) failed with "the worker is being
   destroyed". PDF.js only destroys workers it created itself. */
let sharedWorker: PDFWorker | null = null;

async function startLoading(source: Source): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await import('pdfjs-dist');
  if (!sharedWorker || sharedWorker.destroyed) {
    sharedWorker = pdfjs.PDFWorker.create({
      port: new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' }),
    });
  }
  const data = typeof source === 'string' ? undefined : new Uint8Array(await source.arrayBuffer());
  return pdfjs.getDocument({ ...(data ? { data } : { url: source as string }), worker: sharedWorker });
}

/* Phones cap how large a canvas can be, and a dense drawing at 3x pixel ratio
   blows straight past it — the page then renders blank. Clamp the pixel area. */
const MAX_CANVAS_PIXELS = 16_000_000;

const ZOOM_STEPS = [1, 1.5, 2, 3];

export default function PdfViewer({ source, title, height = '70vh' }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);

  // Load (and reload whenever the source changes).
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    const open = async () => {
      try {
        task = await startLoading(source);
        if (cancelled) {
          void task.destroy();
          return;
        }
        const opened = await task.promise;
        if (cancelled) return;
        setDoc(opened);
        setPage(1);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void open();

    return () => {
      cancelled = true;
      // Frees the worker's copy of the document — a large plan is many MB.
      void task?.destroy();
    };
  }, [source]);

  // Track the container's width, so pages fit it on any screen and on rotate.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Draw the current page.
  useEffect(() => {
    if (!doc || !width || !canvasRef.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;

    const draw = async () => {
      setRendering(true);
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const unscaled = pdfPage.getViewport({ scale: 1 });
        const cssScale = (width / unscaled.width) * ZOOM_STEPS[zoomIndex];
        let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const area = unscaled.width * unscaled.height * (cssScale * pixelRatio) ** 2;
        if (area > MAX_CANVAS_PIXELS) pixelRatio *= Math.sqrt(MAX_CANVAS_PIXELS / area);

        const viewport = pdfPage.getViewport({ scale: cssScale * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;

        task = pdfPage.render({ canvas, viewport });
        await task.promise;
      } catch (error) {
        // A cancelled render is expected when the page or zoom changes mid-draw.
        if (!cancelled && (error as { name?: string })?.name !== 'RenderingCancelledException') {
          setFailed(true);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    void draw();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width, zoomIndex]);

  const pageCount = doc?.numPages ?? 0;
  const openHref = typeof source === 'string' ? source : null;

  if (failed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
        style={{ minHeight: '12rem' }}
      >
        <Warning size={28} className="text-amber-600" />
        <p className="text-sm text-[var(--color-text-secondary)]">This PDF could not be shown here.</p>
        {openHref && (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline"
          >
            Open it in a new tab <ArrowSquareOut size={14} />
          </a>
        )}
      </div>
    );
  }

  const controlClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition hover:border-[var(--color-accent)] disabled:opacity-40 disabled:hover:border-[var(--color-border)]';

  return (
    <div className="flex w-full flex-col gap-2" aria-label={title} role="document">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={controlClass}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <CaretLeft size={16} />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
            {pageCount ? `Page ${page} of ${pageCount}` : 'Loading…'}
          </span>
          <button
            type="button"
            className={controlClass}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={!pageCount || page >= pageCount}
            aria-label="Next page"
          >
            <CaretRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={controlClass}
            onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            <MagnifyingGlassMinus size={16} />
          </button>
          <button
            type="button"
            className={controlClass}
            onClick={() => setZoomIndex((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
          >
            <MagnifyingGlassPlus size={16} />
          </button>
          {openHref && (
            <a
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              className={controlClass}
              aria-label="Open the original in a new tab"
            >
              <ArrowSquareOut size={16} />
            </a>
          )}
        </div>
      </div>

      {/* Scrolls in both directions once zoomed past the container's width. */}
      <div
        ref={containerRef}
        className="relative w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-slate-100"
        style={{ height }}
      >
        <canvas ref={canvasRef} className="mx-auto block bg-white" />
        {rendering && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] shadow">
              Loading page…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
