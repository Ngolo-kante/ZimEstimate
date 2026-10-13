// ─── A copy of the plan sized for reading ────────────────────────────────────
// The backup AI readers (NVIDIA, OpenRouter) and the label reader (OCR) take
// an image, not a PDF, and work best on a modest one: a 1,600-px JPEG of the
// sample plan was read correctly where a 3,200-px one timed out. Uploaded
// images are resized here; PDFs arrive with a copy the browser rendered from
// their first page (lib/vision/analyzePlan.ts).

import sharp from 'sharp';

export type ReadingCopy = { buffer: Buffer; base64: string; mimeType: 'image/jpeg'; width: number; height: number };

const MAX_SIDE = 2_000;

export async function makeReadingCopy(input: ArrayBuffer | Buffer): Promise<ReadingCopy | null> {
  try {
    const { data, info } = await sharp(Buffer.from(input as ArrayBuffer))
      .rotate() // honour phone-camera orientation
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, base64: data.toString('base64'), mimeType: 'image/jpeg', width: info.width, height: info.height };
  } catch (error) {
    console.error('Could not make a reading copy of the plan', error instanceof Error ? error.message : error);
    return null;
  }
}
