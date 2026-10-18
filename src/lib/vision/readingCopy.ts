// ─── A copy of the plan sized for reading ────────────────────────────────────
// The backup AI readers (NVIDIA, OpenRouter) and the label reader (OCR) take
// an image, not a PDF, and work best on a modest one: a 1,600-px JPEG of the
// sample plan was read correctly where a 3,200-px one timed out. Uploaded
// images are prepared here (planImage.ts: cropped, straightened, evened out,
// at most 2,000 px); PDFs arrive with a copy the browser rendered from their
// first page (lib/vision/analyzePlan.ts).

import { preparePlanImage, type PlanTransform } from './planImage';

export type ReadingCopy = {
  buffer: Buffer;
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  /** How the copy relates to the image it was made from. */
  transform: PlanTransform;
  steps: string[];
};

export async function makeReadingCopy(input: ArrayBuffer | Buffer): Promise<ReadingCopy | null> {
  try {
    const prepared = await preparePlanImage(input);
    return {
      buffer: prepared.buffer,
      base64: prepared.buffer.toString('base64'),
      mimeType: 'image/jpeg',
      width: prepared.width,
      height: prepared.height,
      transform: prepared.transform,
      steps: prepared.steps,
    };
  } catch (error) {
    console.error('Could not make a reading copy of the plan', error instanceof Error ? error.message : error);
    return null;
  }
}
