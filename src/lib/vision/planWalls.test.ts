import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { maskFromPixels, planScale, roomAround, snapBox, snapEdge, type DarkMask, type PixelBox } from './planWalls';

/* A plan drawn exactly to scale: 80 px a metre, 230 mm outside walls and
   115 mm inside ones, doorways, each room's name and size printed in it,
   and a bed drawn in one. Rooms are their clear (inside) sizes. */
const PX = 80;
const MARGIN = 60;
const ROOMS: Record<string, [x: number, y: number, w: number, l: number]> = {
  Lounge: [0.23, 0.23, 5.0, 4.0],
  Kitchen: [5.345, 0.23, 3.5, 4.0],
  'Bedroom 1': [8.96, 0.23, 3.6, 4.0],
  Passage: [0.23, 4.345, 12.33, 1.2],
  'Bedroom 2': [0.23, 5.66, 4.0, 3.5],
  Bath: [4.345, 5.66, 2.4, 3.5],
  'Bedroom 3': [6.86, 5.66, 3.8, 3.5],
  Store: [10.775, 5.66, 1.785, 3.5],
};
const at = (m: number) => MARGIN + m * PX;

function truth(name: string): PixelBox {
  const [x, y, w, l] = ROOMS[name];
  return { x0: at(x), y0: at(y), x1: at(x + w), y1: at(y + l) };
}

async function drawnPlan(): Promise<DarkMask> {
  const width = Math.round(at(12.79) + MARGIN);
  const height = Math.round(at(9.39) + MARGIN);
  const rooms = Object.entries(ROOMS).map(([name, [x, y, w, l]]) =>
    `<rect x="${at(x)}" y="${at(y)}" width="${w * PX}" height="${l * PX}" fill="#fff"/>` +
    `<text x="${at(x + w / 2)}" y="${at(y + l / 2)}" font-family="Arial" font-weight="bold" font-size="15" text-anchor="middle">${name.toUpperCase()}</text>` +
    `<text x="${at(x + w / 2)}" y="${at(y + l / 2) + 18}" font-family="Arial" font-size="13" text-anchor="middle">${w} x ${l}m</text>`).join('');
  // Doorways from each room into the passage, 0.8 m wide.
  const doors = [0.8, 6.0, 10.0].map((x) => `<rect x="${at(x)}" y="${at(4.2)}" width="${0.8 * PX}" height="${0.2 * PX}" fill="#fff"/>`).join('')
    + [1.0, 5.0, 7.5, 11.2].map((x) => `<rect x="${at(x)}" y="${at(5.5)}" width="${0.8 * PX}" height="${0.2 * PX}" fill="#fff"/>`).join('');
  const bed = `<rect x="${at(9.6)}" y="${at(1.0)}" width="${1.6 * PX}" height="${2.0 * PX}" fill="none" stroke="#333" stroke-width="1"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>`
    + `<rect x="${at(0)}" y="${at(0)}" width="${12.79 * PX}" height="${9.39 * PX}" fill="#111"/>${rooms}${doors}${bed}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return maskFromPixels(new Uint8ClampedArray(data), info.width, info.height);
}

/** As the AI places them: shifted 4% of the plan and a fifth too tall. */
const roughly = (box: PixelBox, m: DarkMask): PixelBox => {
  const dx = m.width * 0.025;
  const extra = (box.y1 - box.y0) * 0.2;
  return { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 - extra / 2, y1: box.y1 + extra / 2 };
};

const expectBox = (actual: PixelBox | null, expected: PixelBox, tolerance = 2) => {
  expect(actual).not.toBeNull();
  for (const key of ['x0', 'y0', 'x1', 'y1'] as const) expect(Math.abs(actual![key] - expected[key])).toBeLessThanOrEqual(tolerance);
};

describe('walls on a plan drawn to scale', () => {
  it('snaps a roughly placed box to the inside faces of its walls', async () => {
    const m = await drawnPlan();
    for (const name of ['Lounge', 'Kitchen', 'Bedroom 2', 'Bath']) {
      expectBox(snapBox(m, roughly(truth(name), m), Math.max(m.width, m.height) * 0.06), truth(name));
    }
  });

  it('finds the room around a tap on its printed name, through the doorway and past the bed', async () => {
    const m = await drawnPlan();
    // The store's doorway takes almost half of its wall.
    for (const name of ['Lounge', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bath', 'Bedroom 3', 'Store']) {
      const room = truth(name);
      const found = roomAround(m, (room.x0 + room.x1) / 2, (room.y0 + room.y1) / 2 - 5);
      expectBox(found, room);
    }
  });

  it('finds nothing around a tap outside the house', async () => {
    const m = await drawnPlan();
    expect(roomAround(m, 10, 10)).toBeNull();
  });

  it('measures the scale from rooms of known size, despite rough boxes', async () => {
    const m = await drawnPlan();
    const known = ['Lounge', 'Kitchen', 'Bedroom 2'].map((name) => ({ box: roughly(truth(name), m), width: ROOMS[name][2], length: ROOMS[name][3] }));
    const scale = planScale(m, known)!;
    expect(Math.abs(scale - 1 / PX) / (1 / PX)).toBeLessThan(0.02);
  });

  it('will not guess a scale from one room', async () => {
    const m = await drawnPlan();
    expect(planScale(m, [{ box: truth('Lounge'), width: 5, length: 4 }])).toBeNull();
  });

  it('leaves an edge where it is when no wall is near', async () => {
    const m = await drawnPlan();
    const lounge = truth('Lounge');
    expect(snapEdge(m, true, lounge.x0 + 120, lounge.y0, lounge.y1, 1, 20)).toBeNull();
  });
});
