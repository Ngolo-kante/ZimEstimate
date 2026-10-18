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
/** "BEDROOM2" is how the reader often returns "BEDROOM 2": the name, number attached. */
const nameWord = (t: string) => clean(t).replace(/(?<=[A-Z])\d+$/, '');

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

/** No room in a house is this long; a larger number is a misread. */
const MAX_ROOM_SIDE_M = 12;

/**
 * A metre value from a printed number: "4.5", "4,5", "4500" (mm).
 *
 * Text recognition often drops the decimal point: "3.5m x 3.0m" comes back as
 * "35m x 30m". Taken at face value that made a 9 m² kitchen 1,050 m² and a 90
 * m² house cost $100,000. A whole number that is too long for a room but
 * becomes a room size with the point put back is read that way; anything still
 * too long is dropped rather than priced.
 */
function metres(raw: string, unit?: string): number | null {
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  let m = unit === 'mm' || (!unit && n >= 300) ? n / 1000 : n;
  const wholeNumber = !/[.,]/.test(raw);
  if (m > MAX_ROOM_SIDE_M && wholeNumber && unit !== 'mm' && n < 300 && n / 10 >= 0.8 && n / 10 <= MAX_ROOM_SIDE_M) m = n / 10;
  return m >= 0.8 && m <= MAX_ROOM_SIDE_M ? Math.round(m * 100) / 100 : null;
}

const DIMENSION = /(\d{1,5}(?:[.,]\d{1,3})?)\s*(mm|m)?\s*[x×X*]\s*(\d{1,5}(?:[.,]\d{1,3})?)\s*(mm|m)?/g;

/**
 * True when words start..end sit in a run of more than six closely spaced
 * words: a sentence in the drawing's notes ("New 2.400 x 1.900 ensuite in
 * the north-east corner…"), not a room's label. Labels on one baseline are
 * far apart, so a row of rooms' sizes is not mistaken for prose.
 */
function inProse(line: Line, start: number, end: number): boolean {
  const ws = line.words;
  const close = (i: number) => ws[i + 1].x0 - ws[i].x1 < (ws[i].y1 - ws[i].y0) * 1.5;
  let first = start;
  while (first > 0 && close(first - 1)) first--;
  let last = end;
  while (last < ws.length - 1 && close(last)) last++;
  return last - first + 1 > 6;
}

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
    if (inProse(line, start, end)) continue;
    // A door's size (0.9 x 2.1 m, the standard 900 x 2100) printed by a
    // room name is not that room's size.
    const [short, long] = [a, b].sort((p, q) => p - q);
    if (short <= 1.0 && long >= 2.0 && long <= 2.4) continue;
    found.push({ text: match[0], box: box(line.words.slice(start, end + 1)), width: a, length: b });
  }
  return found;
}

/** Room names in one line: a room word, with the words that belong to it. */
function namesIn(line: Line): Span[] {
  const names: Span[] = [];
  const ws = line.words;
  for (let i = 0; i < ws.length; i += 1) {
    if (!NAME_WORDS.has(nameWord(ws[i].text))) continue;
    let j = i;
    while (j + 1 < ws.length) {
      const next = clean(ws[j + 1].text);
      const gap = ws[j + 1].x0 - ws[j].x1;
      if (gap > (ws[j].y1 - ws[j].y0) * 2.5) break;
      if (NAME_WORDS.has(nameWord(ws[j + 1].text)) || QUALIFIERS.has(next)) { j += 1; continue; }
      break;
    }
    const part = ws.slice(i, j + 1);
    names.push({ text: part.map((w) => w.text.replace(/(?<=[A-Za-z])(\d+)$/, ' $1')).join(' ').trim(), box: box(part) });
    i = j;
  }
  return names;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bWc\b/, 'WC').replace(/\bTv\b/, 'TV');

export function roomsFromWords(words: OcrWord[], image: { width: number; height: number }): LabelledRoom[] {
  const lines = toLines(words.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0));
  return pairWithNames(lines.flatMap(namesIn), lines.flatMap(dimensionsIn), lines)
    .map(({ name, size }) => ({
      name: titleCase(name.text),
      width: size.width,
      length: size.length,
      at: { x: cx(name.box) / image.width, y: cy(name.box) / image.height },
    }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
}

const AREA = /^(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:m²|m2|sqm|sq\.?\s?m)$/i;

/** Floor areas in one line: "11,972m²", "17.5 m2". A drawing program's room stamp. */
function areasIn(line: Line): Array<Span & { area: number }> {
  const found: Array<Span & { area: number }> = [];
  line.words.forEach((w, i) => {
    // The unit is sometimes its own word: "17.5" "m²".
    const next = line.words[i + 1];
    const joined = next && /^(m²|m2|sqm)$/i.test(next.text.trim()) ? `${w.text}${next.text}` : w.text;
    const match = joined.trim().match(AREA);
    if (!match || inProse(line, i, joined !== w.text ? i + 1 : i)) return;
    // A comma here is a decimal comma: no room is thousands of square metres.
    const area = Number(match[1].replace(',', '.'));
    if (area >= 1 && area <= 150) found.push({ text: joined, box: next && joined !== w.text ? box([w, next]) : w, area });
  });
  return found;
}

export type LabelledArea = { name: string; area: number; at: { x: number; y: number } };

/**
 * Room names with a printed floor area instead of a size — how ArchiCAD and
 * similar programs stamp rooms ("BEDROOM 2 / 11,97 m²"). Most of the PDF plans
 * uploaded in October 2026 were labelled this way. Used to check a scan, not
 * to make rooms: an area alone does not say the room's shape.
 */
export function areasFromWords(words: OcrWord[], image: { width: number; height: number }): LabelledArea[] {
  const lines = toLines(words.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0));
  return pairWithNames(lines.flatMap(namesIn), lines.flatMap(areasIn), lines)
    .map(({ name, size }) => ({ name: titleCase(name.text), area: size.area, at: { x: cx(name.box) / image.width, y: cy(name.box) / image.height } }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
}

/** Each printed figure goes to the room name just above it, or beside it on its line. */
function pairWithNames<T extends Span>(names: Span[], sizes: T[], lines: Line[]): Array<{ name: Span; size: T }> {
  // The height of the label text itself. Averaging every line let the specks
  // a reader picks out of walls and hatching shrink it, and a size printed a
  // normal line below its name then looked too far away to belong to it.
  const labelHeights = [...names, ...sizes].map((span) => span.box.y1 - span.box.y0).sort((a, b) => a - b);
  const lineHeight = labelHeights.length
    ? labelHeights[Math.floor(labelHeights.length / 2)]
    : lines.length ? lines.reduce((s, l) => s + l.h, 0) / lines.length : 20;

  const used = new Set<number>();
  const pairs: Array<{ name: Span; size: T }> = [];
  for (const size of [...sizes].sort((a, b) => cy(a.box) - cy(b.box))) {
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
    pairs.push({ name: names[best], size });
  }
  return pairs;
}
