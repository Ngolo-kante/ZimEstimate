/**
 * Shrinks a phone photo before it is uploaded.
 *
 * A photo of a receipt, plan or quote straight off a phone is 3–8 MB, and data
 * here costs around $3–3.50 a GB — so each upload cost the user real money,
 * took a long time on a weak signal, and failed more often. Most of that is
 * resolution nobody needs: a 4000-pixel photo of an A4 receipt. Scaled to a
 * couple of thousand pixels it is still perfectly legible at a fraction of
 * the size.
 *
 * Never blocks an upload. Anything that is not a photo (PDFs especially) is
 * passed through untouched, and if compression fails or does not help, the
 * original file is used.
 */

export type ImagePurpose =
  /** An AI will read text and dimensions from it: keep more detail. */
  | 'reading'
  /** Kept as a record — receipts, documents: legible is enough. */
  | 'record';

const SETTINGS: Record<ImagePurpose, { maxWidthOrHeight: number; maxSizeMB: number; initialQuality: number }> = {
  reading: { maxWidthOrHeight: 2400, maxSizeMB: 1.5, initialQuality: 0.85 },
  record: { maxWidthOrHeight: 2000, maxSizeMB: 0.8, initialQuality: 0.8 },
};

const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/* Below this a photo is already small enough that recompressing it would only
   cost quality. */
const SKIP_BELOW_BYTES = 400 * 1024;

export function shouldCompress(file: { type: string; size: number }): boolean {
  return COMPRESSIBLE.has(file.type) && file.size > SKIP_BELOW_BYTES;
}

export async function prepareImageForUpload(file: File, purpose: ImagePurpose = 'record'): Promise<File> {
  if (!shouldCompress(file)) return file;

  try {
    // Loaded only when a photo is actually chosen, not with every page.
    const { default: imageCompression } = await import('browser-image-compression');
    const compressed = await imageCompression(file, {
      ...SETTINGS[purpose],
      /* Off: the library's worker loads its own code from cdn.jsdelivr.net,
         which this site's Content-Security-Policy blocks — and an upload
         should not depend on a third-party CDN. On the page it takes a few
         hundred milliseconds per photo. */
      useWebWorker: false,
      // Keep the camera's date and orientation data with the photo.
      preserveExif: true,
    });

    if (compressed.size >= file.size) return file;
    // Same name and type as the original, so nothing downstream can tell the
    // difference except the size.
    return new File([compressed], file.name, { type: compressed.type || file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
