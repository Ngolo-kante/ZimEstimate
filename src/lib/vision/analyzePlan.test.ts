import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analysisProgress, analyzePlanFile, BUSY_RETRY_DELAY_MS, PDF_PREPARE_TIMEOUT_MS,
  PLAN_ANALYSIS_TIMEOUT_MS, PLAN_TIMEOUT_MESSAGE, planResponseError,
  shouldResizePhoto, withTimeLimit,
} from './analyzePlan';

const pdf = vi.hoisted(() => ({ destroy: vi.fn(async () => {}), workerDestroy: vi.fn() }));
vi.mock('pdfjs-dist', () => ({
  PDFWorker: { create: () => ({ destroy: pdf.workerDestroy }) },
  getDocument: () => ({ promise: new Promise(() => {}), destroy: pdf.destroy }),
}));

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// An unsupported type avoids browser preparation in the request lifecycle tests.
const file = () => new File(['plan'], 'plan.bin', { type: 'application/octet-stream' });

describe('bounded preparation', () => {
  it('returns a completed operation and clears its deadline', async () => {
    vi.useFakeTimers();
    await expect(withTimeLimit(Promise.resolve('ready'), 20)).resolves.toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a stalled operation', async () => {
    vi.useFakeTimers();
    const pending = expect(withTimeLimit(new Promise(() => {}), 20)).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(20);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects failures and both early and later cancellation', async () => {
    const controller = new AbortController();
    const pending = expect(withTimeLimit(new Promise(() => {}), 20_000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await pending;
    await expect(withTimeLimit(Promise.resolve(1), 20, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(withTimeLimit(Promise.reject(new Error('failed')), 20)).rejects.toThrow('failed');
  });
  it('destroys a stalled PDF worker and posts the original without preview data', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, data: { rooms: [] } }));
    vi.stubGlobal('fetch', fetcher);
    const phases: string[] = [];
    const pending = analyzePlanFile(new File(['pdf'], 'plan.pdf', { type: 'application/pdf' }), { onPhase: phase => phases.push(phase) });
    await vi.advanceTimersByTimeAsync(PDF_PREPARE_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ rooms: [] });
    expect(pdf.destroy).toHaveBeenCalled();
    expect(terminate).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Plan preview was skipped.', expect.anything());
    const body = fetcher.mock.calls[0][1].body as FormData;
    expect(body.get('readingCopy')).toBeNull();
    expect(body.get('pdfText')).toBeNull();
    expect(body.get('file')).toBeInstanceOf(File);
    expect(phases).toEqual(['preparing', 'reading']);
  });
});

describe('photo resizing decision', () => {
  it('keeps PDFs and small images intact', () => {
    expect(shouldResizePhoto('application/pdf', 8_000_000, 5000, 5000)).toBe(false);
    expect(shouldResizePhoto('image/png', 3_000_000, 2400, 1800)).toBe(false);
  });
  it('shrinks large bytes or either long dimension', () => {
    expect(shouldResizePhoto('image/jpeg', 3_000_001, 1200, 800)).toBe(true);
    expect(shouldResizePhoto('image/png', 100, 2401, 800)).toBe(true);
    expect(shouldResizePhoto('image/png', 100, 800, 2401)).toBe(true);
  });
});

describe('progress estimate', () => {
  it('starts at 12, keeps creeping, and never reaches 100', () => {
    expect(analysisProgress(0)).toBeCloseTo(12);
    let previous = analysisProgress(0);
    for (let seconds = 1; seconds <= 200; seconds++) {
      const progress = analysisProgress(seconds);
      expect(progress).toBeGreaterThan(previous);
      expect(progress).toBeLessThan(100);
      previous = progress;
    }
    expect(analysisProgress(1_000_000)).toBeLessThan(100);
  });
});

describe('request lifecycle and readable errors', () => {
  it('uses actionable timeout and size messages', () => {
    expect(planResponseError(504)).toBe(PLAN_TIMEOUT_MESSAGE);
    expect(planResponseError(413)).toMatch(/too large.*smaller/i);
  });
  it.each([413, 504])('handles a non-JSON %s error', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>', { status })));
    await expect(analyzePlanFile(file())).rejects.toThrow(planResponseError(status));
  });
  it('times out even when fetch ignores cancellation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const pending = expect(analyzePlanFile(file())).rejects.toThrow(PLAN_TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(PLAN_ANALYSIS_TIMEOUT_MS);
    await pending;
  });
  it('includes stalled response bodies in the request deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) }));
    const pending = expect(analyzePlanFile(file())).rejects.toThrow(PLAN_TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(PLAN_ANALYSIS_TIMEOUT_MS);
    await pending;
  });
  it('retries a 503 once with a fresh deadline, retaining both callbacks', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const onRetry = vi.fn();
    const onPhase = vi.fn();
    const pending = expect(analyzePlanFile(file(), { onRetry, onPhase })).rejects.toThrow(PLAN_TIMEOUT_MESSAGE);
    await vi.advanceTimersByTimeAsync(BUSY_RETRY_DELAY_MS);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual(['preparing', 'reading', 'retrying', 'reading']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(PLAN_ANALYSIS_TIMEOUT_MS);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels a stalled PDF immediately and terminates its worker', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const pending = expect(analyzePlanFile(new File(['pdf'], 'plan.pdf', { type: 'application/pdf' }), { signal: controller.signal })).rejects.toThrow(/cancelled/i);
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await pending;
    expect(terminate).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels during the retry delay without sending again', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const pending = expect(analyzePlanFile(file(), { signal: controller.signal })).rejects.toThrow(/cancelled/i);
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await pending;
    expect(fetcher).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shrinks photos to 2400 pixels and retries JPEG quality when needed', async () => {
    vi.stubGlobal('Image', class {
      src = '';
      naturalWidth = 4800;
      naturalHeight = 3200;
      decode = async () => {};
    });
    const toBlob = vi.fn()
      .mockImplementationOnce((done: (blob: Blob) => void) => done(new Blob([new Uint8Array(3_500_001)])))
      .mockImplementationOnce((done: (blob: Blob) => void) => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
    const canvas = { width: 0, height: 0, getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }), toBlob };
    vi.stubGlobal('document', { createElement: () => canvas });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, data: { rooms: [] } }));
    vi.stubGlobal('fetch', fetcher);
    await analyzePlanFile(new File(['photo'], 'floor-plan.png', { type: 'image/png' }));
    expect([canvas.width, canvas.height]).toEqual([2400, 1600]);
    expect(toBlob.mock.calls.map(call => call[2])).toEqual([0.85, 0.7]);
    const upload = (fetcher.mock.calls[0][1].body as FormData).get('file') as File;
    expect(upload.name).toBe('floor-plan.jpg');
    expect(upload.type).toBe('image/jpeg');
  });
  it('sends the original photo when decoding fails', async () => {
    vi.stubGlobal('Image', class {
      src = '';
      decode = async () => { throw new Error('decode failed'); };
    });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, data: { rooms: [] } }));
    vi.stubGlobal('fetch', fetcher);
    const original = new File(['photo'], 'plan.png', { type: 'image/png' });
    await analyzePlanFile(original);
    expect((fetcher.mock.calls[0][1].body as FormData).get('file')).toBe(original);
  });
  it('cancels without starting a request, including an already aborted signal', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(analyzePlanFile(file(), { signal: controller.signal })).rejects.toThrow(/cancelled/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
