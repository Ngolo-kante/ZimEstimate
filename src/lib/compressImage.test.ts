import { describe, expect, it } from 'vitest';
import { prepareImageForUpload, shouldCompress } from './compressImage';

const MB = 1024 * 1024;

describe('photo compression before upload', () => {
  it('compresses phone-sized photos', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(shouldCompress({ type, size: 4 * MB }), type).toBe(true);
    }
  });

  it('leaves PDFs and other documents alone, whatever their size', () => {
    // Recompressing a PDF is not something this can do — and a plan's
    // vector drawing must reach the reader exactly as uploaded.
    expect(shouldCompress({ type: 'application/pdf', size: 9 * MB })).toBe(false);
    expect(shouldCompress({ type: 'image/heic', size: 4 * MB })).toBe(false);
  });

  it('leaves photos that are already small', () => {
    expect(shouldCompress({ type: 'image/jpeg', size: 200 * 1024 })).toBe(false);
  });

  it('hands back the very same file when there is nothing to do', async () => {
    const pdf = new File([new Uint8Array(10)], 'plan.pdf', { type: 'application/pdf' });
    await expect(prepareImageForUpload(pdf)).resolves.toBe(pdf);
  });

  it('never blocks an upload: a file it cannot read comes back unchanged', async () => {
    // Not a real JPEG. In the browser the library rejects it; here there is
    // no canvas at all. Either way the upload must go ahead with the original.
    const broken = new File([new Uint8Array(500 * 1024)], 'receipt.jpg', { type: 'image/jpeg' });
    await expect(prepareImageForUpload(broken)).resolves.toBe(broken);
  });
});
