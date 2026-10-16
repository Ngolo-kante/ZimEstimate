import { describe, expect, it } from 'vitest';
import { roomsFromWords, type OcrWord } from './roomLabels';

const w = (text: string, x0: number, y0: number, width = text.length * 12, height = 24): OcrWord =>
  ({ text, x0, y0, x1: x0 + width, y1: y0 + height });
const IMAGE = { width: 1000, height: 1400 };

describe('rooms from the words printed on a plan', () => {
  it('reads the sample plan exactly as OCR returned it, sizes split over words included', () => {
    // What Tesseract gave for output/demo-assets/demo-floor-plan.png.
    const words = [
      w('LOUNGE', 238, 269), w('KITCHEN', 675, 269),
      w('5.0', 244, 300), w('x', 278, 304, 8), w('4.5m', 294, 300),
      w('3.6', 684, 300), w('x4.5m', 718, 300),
      w('BEDROOM', 215, 719), w('1', 357, 719, 10), w('BEDROOM', 655, 719), w('2', 795, 719, 10),
      w('4.2x4.0m', 244, 750), w('3.6', 684, 750), w('x4.0m', 718, 750),
      w('BEDROOM', 215, 1129), w('3', 355, 1129, 10), w('BATHROOM', 657, 1129),
      w('4.2x3.8m', 244, 1160), w('2.4', 684, 1160), w('x3.8m', 718, 1160),
    ];
    const rooms = roomsFromWords(words, IMAGE);
    expect(rooms.map((r) => `${r.name} ${r.width}x${r.length}`)).toEqual([
      'Lounge 5x4.5', 'Kitchen 3.6x4.5', 'Bedroom 1 4.2x4', 'Bedroom 2 3.6x4', 'Bedroom 3 4.2x3.8', 'Bathroom 2.4x3.8',
    ]);
  });

  it('puts back a decimal point the text reader dropped, and drops sizes no room has', () => {
    // "3.5m x 3.0m" read as "35m x 30m" once made a 9 m² kitchen 1,050 m².
    const rooms = roomsFromWords([
      w('KITCHEN', 100, 100), w('35m', 100, 130), w('x', 150, 130, 8), w('30m', 162, 130),
      w('GARAGE', 500, 100), w('250', 500, 130), w('x', 550, 130, 8), w('30', 562, 130),
    ], IMAGE);
    expect(rooms).toEqual([expect.objectContaining({ name: 'Kitchen', width: 3.5, length: 3 })]);
  });

  it('reads a room number stuck to its name, and a size printed a line below among wall specks', () => {
    const rooms = roomsFromWords([
      w('BEDROOM2', 100, 100), w('3.5mx3.0m', 100, 130),
      // Specks from walls and hatching, each a sliver of a line on its own.
      w('|', 400, 300, 4, 6), w('/', 420, 320, 4, 6), w('_', 440, 340, 4, 6), w('7', 460, 360, 4, 6),
      w('BATHROOM', 500, 500), w('2.5m', 500, 542), w('x', 550, 542, 8), w('1.8m', 562, 542),
    ], IMAGE);
    expect(rooms.map((r) => `${r.name} ${r.width}x${r.length}`)).toEqual(['Bedroom 2 3.5x3', 'Bathroom 2.5x1.8']);
  });

  it('keeps a genuine large room as printed', () => {
    const rooms = roomsFromWords([w('LOUNGE', 100, 100), w('12.0', 100, 130), w('x', 150, 130, 8), w('6.5', 162, 130)], IMAGE);
    expect(rooms).toMatchObject([{ name: 'Lounge', width: 12, length: 6.5 }]);
  });

  it('reads millimetres and the × sign', () => {
    const rooms = roomsFromWords([w('GARAGE', 100, 100), w('6000', 100, 130), w('×', 160, 130, 8), w('3500', 172, 130)], IMAGE);
    expect(rooms).toMatchObject([{ name: 'Garage', width: 6, length: 3.5 }]);
  });

  it('keeps two-word names together', () => {
    const rooms = roomsFromWords([w('MASTER', 100, 100), w('BEDROOM', 180, 100), w('4.5', 120, 130), w('x', 160, 130, 8), w('4.0', 172, 130)], IMAGE);
    expect(rooms[0].name).toBe('Master Bedroom');
  });

  it('pairs a size printed beside the name on the same line', () => {
    const rooms = roomsFromWords([w('KITCHEN', 100, 100), w('3.6x4.5', 200, 100)], IMAGE);
    expect(rooms).toMatchObject([{ name: 'Kitchen', width: 3.6, length: 4.5 }]);
  });

  it('ignores numbers that are not room sizes, and names far from any size', () => {
    const rooms = roomsFromWords([
      w('SCALE', 50, 1350), w('1:100', 120, 1350),
      w('LOUNGE', 100, 100),
      w('VERANDAH', 600, 100), w('2.4x1200', 600, 900), // far below, and 1,200 m is not a room
    ], IMAGE);
    expect(rooms).toEqual([]);
  });

  it('gives nothing for a plan with no printed sizes', () => {
    expect(roomsFromWords([w('LOUNGE', 100, 100), w('KITCHEN', 400, 100)], IMAGE)).toEqual([]);
  });
});
