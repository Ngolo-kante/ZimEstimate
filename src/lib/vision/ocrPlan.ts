// ─── Reading the words printed on a plan (server side) ───────────────────────
// Tesseract (open source, Apache-2.0) on our own server: no AI service, no
// limits, no cost per plan. It read every word of the sample plan in 0.16 s.
// roomLabels.ts turns the words into rooms. Runs while the AI readers do, and
// is used only if none of them answers.
//
// On the server rather than in the browser so visitors on mobile data never
// download the ~6 MB of recognition files.

import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { roomsFromWords, type LabelledRoom, type OcrWord } from './roomLabels';
import type { ReadingCopy } from './readingCopy';

const OCR_TIMEOUT_MS = 20_000;
let worker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  // One per server instance, reused across requests; recreated after a failure.
  worker ??= createWorker('eng', 1, {
    langPath: path.join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
    cachePath: path.join(os.tmpdir(), 'zimestimate-ocr'),
    gzip: true,
  }).catch((error) => { worker = null; throw error; });
  return worker;
}

export async function readPlanLabels(copy: ReadingCopy): Promise<LabelledRoom[]> {
  const run = async () => {
    // Small text reads better a little larger and in grey.
    const scale = copy.width < 1_400 ? 2 : 1;
    const image = await sharp(copy.buffer).resize({ width: copy.width * scale }).grayscale().png().toBuffer();
    const ocr = await getWorker();
    const { data } = await ocr.recognize(image, {}, { blocks: true });
    const words: OcrWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            words.push({ text: word.text, x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 });
          }
        }
      }
    }
    return roomsFromWords(words, { width: copy.width * scale, height: copy.height * scale });
  };
  return Promise.race([
    run(),
    new Promise<LabelledRoom[]>((_, reject) => setTimeout(() => reject(new Error('OCR took too long')), OCR_TIMEOUT_MS)),
  ]);
}
