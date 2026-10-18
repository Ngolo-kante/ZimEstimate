// ─── The words printed in a PDF plan ─────────────────────────────────────────
// A plan exported from a drawing program carries its text: room names and
// sizes, exactly as drawn, with their positions. Reading that text is exact
// where reading the picture of it is a guess, and costs nothing. Of the 11
// PDFs uploaded in the week to 2026-10-17, 6 had a text layer. The browser
// takes the words from the first page (lib/vision/analyzePlan.ts) and sends
// them with the plan; the server turns them into rooms with roomsFromWords.

import type { OcrWord } from './roomLabels';

export interface PdfWords {
  /** The page size the positions are measured in. */
  width: number;
  height: number;
  words: OcrWord[];
}

const MAX_WORDS = 6_000;

type TextItem = { str: string; transform: number[]; width: number };

/** Words from pdf.js text items, positioned on the page as it is drawn (y down). */
export function wordsFromTextItems(
  items: TextItem[],
  page: { width: number; height: number; toViewport: (x: number, y: number) => number[] },
): PdfWords {
  const words: OcrWord[] = [];
  for (const item of items) {
    if (!item.str?.trim() || words.length >= MAX_WORDS) continue;
    const [a, b, c, d, e, f] = item.transform;
    // Text running up or down the sheet (dimension strings along a wall) is
    // never a room label; leave it out rather than mis-place it.
    if (Math.abs(b) > Math.abs(a) * 0.05 || Math.abs(c) > Math.abs(d) * 0.05) continue;
    const [x, baseline] = page.toViewport(e, f);
    const size = Math.hypot(c, d);
    const perChar = item.width / Math.max(1, item.str.length);
    let offset = 0;
    for (const part of item.str.split(/(\s+)/)) {
      if (part.trim()) {
        words.push({
          text: part,
          x0: x + offset * perChar,
          x1: x + (offset + part.length) * perChar,
          y0: baseline - size,
          y1: baseline,
        });
      }
      offset += part.length;
    }
  }
  return { width: page.width, height: page.height, words };
}

/** The words the browser sent, checked; null if missing or malformed. */
export function parsePdfWords(raw: unknown): PdfWords | null {
  if (typeof raw !== 'string' || raw.length > 1_500_000) return null;
  try {
    const value = JSON.parse(raw) as Partial<PdfWords>;
    const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
    if (!finite(value.width) || !finite(value.height) || value.width <= 0 || value.height <= 0 || !Array.isArray(value.words)) return null;
    const words = value.words.slice(0, MAX_WORDS).filter((w): w is OcrWord =>
      typeof w?.text === 'string' && w.text.length <= 80 && finite(w.x0) && finite(w.x1) && finite(w.y0) && finite(w.y1));
    return { width: value.width, height: value.height, words };
  } catch {
    return null;
  }
}
