// ─── Rooms from the words printed on a plan ──────────────────────────────────
// Most house plans print each room's name with its size under it —
// "LOUNGE / 5.0 x 4.5m". Text recognition (OCR) reads those words and where
// they sit; this turns them into rooms. It needs no AI service, so it still
// works when every AI reader is busy: the last thing tried before telling
// someone to use the room builder.
//
// It finds sizes ("5.0 x 4.5m", "4.2x3.8m", "5000 x 4500" in millimetres),
// finds room names (a list of the rooms Zimbabwean house plans use), and
// pairs each name with the size printed nearest below it — or beside it on
// the same line. A plan with no printed sizes gives nothing, honestly.

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number };
export type LabelledRoom = {
  name: string;
  width: number;
  length: number;
  /** Where the name sits, as a fraction of the image (0–1), for laying rooms out. */
  at: { x: number; y: number };
};

const ROOM_WORDS = [
  'LOUNGE', 'LIVING', 'SITTING', 'FAMILY', 'TV', 'DINING', 'KITCHEN', 'SCULLERY', 'PANTRY', 'LAUNDRY',
  'BEDROOM', 'BED', 'BEDRM', 'MASTER', 'GUEST', 'BATHROOM', 'BATH', 'TOILET', 'WC', 'W.C', 'SHOWER',
  'ENSUITE', 'EN-SUITE', 'EN', 'STUDY', 'OFFICE', 'GARAGE', 'CARPORT', 'VERANDAH', 'VERANDA', 'PATIO',
  'PORCH', 'STOEP', 'FOYER', 'ENTRANCE', 'ENTRY', 'LOBBY', 'PASSAGE', 'CORRIDOR', 'HALL', 'STORE',
  'STOREROOM', 'LINEN', 'CLOSET', 'WIR', 'ROBE', 'PLAYROOM', 'MAID', 'MAIDS', 'SERVANT', 'GYM', 'PRAYER',
];
const QUALIFIERS = new Set(['ROOM', 'AREA', 'SUITE', '1', '2', '3', '4', '5', '6', 'ONE', 'TWO', 'THREE', 'FOUR', 'MAIN', "MAID'S"]);
const NAME_WORDS = new Set(ROOM_WORDS);

type Line = { words: OcrWord[]; y: number; h: number };
type Span = { text: string; box: OcrWord };

const box = (ws: OcrWord[], text = ws.map((w) => w.text).join(' ')): OcrWord => ({
  text,
  x0: Math.min(...ws.map((w) => w.x0)),
  y0: Math.min(...ws.map((w) => w.y0)),
  x1: Math.max(...ws.map((w) => w.x1)),
  y1: Math.max(...ws.map((w) => w.y1)),
});
const cx = (b: OcrWord) => (b.x0 + b.x1) / 2;
const cy = (b: OcrWord) => (b.y0 + b.y1) / 2;
const clean = (t: string) => t.toUpperCase().replace(/[^A-Z0-9.'\-]/g, '');

/** Words on roughly the same baseline, left to right. */
function toLines(words: OcrWord[]): Line[] {
  const lines: Line[] = [];
  for (const w of [...words].sort((a, b) => cy(a) - cy(b))) {
    const h = Math.max(1, w.y1 - w.y0);
    const line = lines.find((l) => Math.abs(l.y - cy(w)) < Math.max(l.h, h) * 0.6);
    if (line) {
      line.words.push(w);
      line.y = (line.y * (line.words.length - 1) + cy(w)) / line.words.length;
      line.h = Math.max(line.h, h);
    } else {
      lines.push({ words: [w], y: cy(w), h });
    }
  }
  lines.forEach((l) => l.words.sort((a, b) => a.x0 - b.x0));
  return lines;
}

/** A metre value from a printed number: "4.5", "4,5", "4500" (mm). */
function metres(raw: string, unit?: string): number | null {
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const m = unit === 'mm' || (!unit && n >= 300) ? n / 1000 : n;
  return m >= 0.8 && m <= 40 ? Math.round(m * 100) / 100 : null;
}

const DIMENSION = /(\d{1,5}(?:[.,]\d{1,3})?)\s*(mm|m)?\s*[x×X*]\s*(\d{1,5}(?:[.,]\d{1,3})?)\s*(mm|m)?/g;

/** Sizes in one line, with the words they came from. */
function dimensionsIn(line: Line): Array<Span & { width: number; length: number }> {
  // Rebuild the line's text, remembering which word each character came from,
  // so a size split over "3.6" + "x4.5m" is found and placed.
  let text = '';
  const owner: number[] = [];
  line.words.forEach((w, i) => {
    if (i > 0) { text += ' '; owner.push(i); }
    const t = w.text.replace(/[×]/g, 'x');
    text += t;
    for (let k = 0; k < t.length; k += 1) owner.push(i);
  });
  const found: Array<Span & { width: number; length: number }> = [];
  for (const match of text.matchAll(DIMENSION)) {
    const a = metres(match[1], match[2] ?? match[4]);
    const b = metres(match[3], match[4] ?? match[2]);
    if (a === null || b === null) continue;
    const start = owner[match.index ?? 0];
    const end = owner[(match.index ?? 0) + match[0].length - 1];
    found.push({ text: match[0], box: box(line.words.slice(start, end + 1)), width: a, length: b });
  }
  return found;
}

/** Room names in one line: a room word, with the words that belong to it. */
function namesIn(line: Line): Span[] {
  const names: Span[] = [];
  const ws = line.words;
  for (let i = 0; i < ws.length; i += 1) {
    if (!NAME_WORDS.has(clean(ws[i].text))) continue;
    let j = i;
    while (j + 1 < ws.length) {
      const next = clean(ws[j + 1].text);
      const gap = ws[j + 1].x0 - ws[j].x1;
      if (gap > (ws[j].y1 - ws[j].y0) * 2.5) break;
      if (NAME_WORDS.has(next) || QUALIFIERS.has(next)) { j += 1; continue; }
      break;
    }
    const part = ws.slice(i, j + 1);
    names.push({ text: part.map((w) => w.text).join(' '), box: box(part) });
    i = j;
  }
  return names;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bWc\b/, 'WC').replace(/\bTv\b/, 'TV');

export function roomsFromWords(words: OcrWord[], image: { width: number; height: number }): LabelledRoom[] {
  const usable = words.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0);
  const lines = toLines(usable);
  const names = lines.flatMap(namesIn);
  const sizes = lines.flatMap(dimensionsIn);
  const lineHeight = lines.length ? lines.reduce((s, l) => s + l.h, 0) / lines.length : 20;

  const used = new Set<number>();
  const rooms: LabelledRoom[] = [];
  // Each size goes to the name just above it (or beside it on its line).
  for (const size of sizes.sort((a, b) => cy(a.box) - cy(b.box))) {
    let best = -1;
    let bestScore = Infinity;
    names.forEach((name, i) => {
      if (used.has(i)) return;
      const dy = cy(size.box) - cy(name.box);
      const dx = Math.abs(cx(size.box) - cx(name.box));
      const sameLine = Math.abs(dy) < lineHeight * 0.6;
      if (!sameLine && (dy <= 0 || dy > lineHeight * 4.5)) return;
      if (dx > Math.max(name.box.x1 - name.box.x0, size.box.x1 - size.box.x0) * 1.6 + lineHeight * 2) return;
      const score = (sameLine ? lineHeight : dy) + dx * 0.5;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best < 0) continue;
    used.add(best);
    const name = names[best];
    rooms.push({
      name: titleCase(name.text),
      width: size.width,
      length: size.length,
      at: { x: cx(name.box) / image.width, y: cy(name.box) / image.height },
    });
  }
  return rooms.sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
}
