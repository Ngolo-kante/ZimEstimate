import { describe, expect, it } from 'vitest';
import { boxForMissing, checkAgainstPrinted, printedSizeFor, sameSize, type PrintedSizes } from './planCheck';
import { areasFromWords, roomsFromWords, type OcrWord } from './roomLabels';
import { parsePdfWords, wordsFromTextItems } from './pdfWords';
import type { DetectedRoom } from './types';

const room = (id: string, name: string, width: number, length: number, position: DetectedRoom['position']): DetectedRoom => ({
  id, name, dimensions: { width, length }, area: width * length, position, wallType: 'internal', isEdited: false,
});

const rooms = [
  room('a', 'Lounge', 5, 4.5, { x: 10, y: 10, width: 40, height: 35 }),
  room('b', 'Bedroom 1', 4, 4, { x: 50, y: 10, width: 30, height: 30 }),
  room('c', 'Bedroom 2', 3.4, 4, { x: 10, y: 50, width: 26, height: 30 }),
];

describe('checking a scan against the printed sizes', () => {
  it('counts matches either way round and lists the rooms that differ', () => {
    const printed: PrintedSizes = { source: 'ocr', rooms: [
      { name: 'Lounge', width: 4.5, length: 5.0, at: { x: 30, y: 25 } },
      { name: 'Bedroom 1', width: 4.0, length: 4.0, at: { x: 65, y: 25 } },
      { name: 'Bedroom 2', width: 3.6, length: 4.0, at: { x: 22, y: 65 } },
    ] };
    const check = checkAgainstPrinted(rooms, printed)!;
    expect(check.printed).toBe(3);
    expect(check.matched).toBe(2);
    expect(check.differences.map((d) => d.room.id)).toEqual(['c']);
    expect(printedSizeFor(rooms[2], printed.rooms[2])).toEqual({ width: 3.6, length: 4 });
  });

  it('finds a printed room the scan left out, and places it to the plan scale', () => {
    const printed: PrintedSizes = { source: 'pdf-text', rooms: [
      { name: 'Lounge', width: 5, length: 4.5, at: { x: 30, y: 25 } },
      { name: 'Bedroom 1', width: 4, length: 4, at: { x: 65, y: 25 } },
      { name: 'Store', width: 3, length: 1.5, at: { x: 65, y: 65 } },
    ] };
    const check = checkAgainstPrinted(rooms, printed)!;
    expect(check.missing.map((m) => m.name)).toEqual(['Store']);
    const box = boxForMissing(printed.rooms[2], rooms, printed)!;
    expect(box.x + box.width / 2).toBeCloseTo(65, 5);
    expect(box.width).toBeGreaterThan(box.height);
  });

  it('ignores a schedule repeating a room name off the drawing', () => {
    const printed: PrintedSizes = { source: 'pdf-text', rooms: [
      { name: 'Lounge', width: 5, length: 4.5, at: { x: 30, y: 25 } },
      { name: 'Lounge', width: 5, length: 4.5, at: { x: 90, y: 97 } },
      { name: 'Kitchen', width: 3, length: 3, at: { x: 92, y: 98 } },
    ] };
    const check = checkAgainstPrinted(rooms, printed)!;
    expect(check).toMatchObject({ printed: 1, matched: 1, missing: [] });
  });

  it('checks a printed floor area', () => {
    const printed: PrintedSizes = { source: 'pdf-text', rooms: [
      { name: 'Bedroom 1', area: 16.0, at: { x: 65, y: 25 } },
      { name: 'Bedroom 2', area: 15.6, at: { x: 22, y: 65 } },
    ] };
    const check = checkAgainstPrinted(rooms, printed)!;
    expect(check.matched).toBe(1);
    expect(check.differences[0].room.id).toBe('c');
    expect(printedSizeFor(rooms[2], printed.rooms[1])).toBeNull();
  });

  it('has nothing to say without printed sizes', () => {
    expect(checkAgainstPrinted(rooms, null)).toBeNull();
    expect(checkAgainstPrinted(rooms, { source: 'ocr', rooms: [] })).toBeNull();
  });

  it('allows the 10 cm a plan rounds to', () => {
    expect(sameSize({ width: 3.0, length: 4.05 }, { width: 4.0, length: 3.0 })).toBe(true);
    expect(sameSize({ width: 3.0, length: 4.3 }, { width: 4.0, length: 3.0 })).toBe(false);
  });
});

describe('the words in a PDF plan', () => {
  const word = (text: string, x0: number, y0: number): OcrWord => ({ text, x0, y0, x1: x0 + text.length * 6, y1: y0 + 8 });

  it('reads areas stamped by drawing programs, decimal commas included', () => {
    const areas = areasFromWords([
      word('BEDROOM', 100, 100), word('2', 150, 100), word('11,972m²', 100, 112),
      word('KITCHEN', 300, 100), word('17.5', 300, 112), word('m2', 330, 112),
      word('GARAGE', 500, 100), word('9000m²', 500, 112),
    ], { width: 1000, height: 1000 });
    expect(areas).toEqual([
      { name: 'Bedroom 2', area: 11.972, at: expect.any(Object) },
      { name: 'Kitchen', area: 17.5, at: expect.any(Object) },
    ]);
  });

  it('places pdf.js text on the page and splits it into words, leaving out turned text', () => {
    const words = wordsFromTextItems([
      { str: 'BEDROOM 2', transform: [8, 0, 0, 8, 100, 700], width: 54 },
      { str: '3.600', transform: [0, 8, -8, 0, 50, 400], width: 30 },
    ], { width: 600, height: 800, toViewport: (x, y) => [x, 800 - y] });
    expect(words.words).toEqual([
      { text: 'BEDROOM', x0: 100, x1: 142, y0: 92, y1: 100 },
      { text: '2', x0: 148, x1: 154, y0: 92, y1: 100 },
    ]);
  });

  it('accepts only well-formed words from the browser', () => {
    expect(parsePdfWords('not json')).toBeNull();
    expect(parsePdfWords(JSON.stringify({ width: 0, height: 10, words: [] }))).toBeNull();
    expect(parsePdfWords(JSON.stringify({ width: 10, height: 10, words: [{ text: 'A', x0: 1, x1: 2, y0: 1, y1: 2 }, { text: 5 }] }))?.words).toHaveLength(1);
  });
});

describe('notes beside the drawing', () => {
  const sentence = (text: string, x: number, y: number): OcrWord[] => {
    let at = x;
    return text.split(' ').map((t) => { const w = { text: t, x0: at, y0: y, x1: at + t.length * 5, y1: y + 7 }; at = w.x1 + 3; return w; });
  };

  it('are not read as room labels', () => {
    const words = [
      ...sentence('BEDROOM 5', 100, 100),
      ...sentence('Former TV room converted to the fifth bedroom, 15.1 m2. Existing doors', 100, 110),
      ...sentence('ENSUITE 2', 100, 200),
      ...sentence('New 2.400 x 1.900 ensuite in the north-east corner.', 100, 210),
    ];
    expect(areasFromWords(words, { width: 1000, height: 1000 })).toEqual([]);
    expect(roomsFromWords(words, { width: 1000, height: 1000 })).toEqual([]);
  });
});
