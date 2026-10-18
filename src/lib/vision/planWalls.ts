// ─── Finding walls on the plan, in the browser ───────────────────────────────
// The AI's room boxes are only roughly placed: 3–6% of the image off and
// about a fifth too tall, measured on the benchmark plans (2026-10-18). So a
// box cannot be measured in metres as it comes. Snapped to the walls drawn on
// the plan it can: walls are the thick dark bands, and a room's size is the
// clear space between their inner faces. This finds those bands in a dark
// mask of the uploaded image, for three jobs:
//
//   • snapping the edge of a box being dragged to the nearest wall;
//   • finding the walls around a spot someone taps, to add a room there;
//   • measuring the plan's scale from rooms whose size is known.
//
// Pure functions on a mask, so they are tested without a browser.

export interface DarkMask {
  /** 1 where the plan is dark (ink), 0 where it is paper. */
  data: Uint8Array;
  width: number;
  height: number;
  /** A few pixels at this size: the smallest room side is several times it. */
  minWall: number;
}

export interface PixelBox { x0: number; y0: number; x1: number; y1: number }

/** A dark mask from RGBA pixels, ink judged against the plan's own paper. */
export function maskFromPixels(rgba: Uint8ClampedArray, width: number, height: number): DarkMask {
  const grey = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
    const v = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
    grey[i] = v;
    histogram[grey[i]]++;
  }
  // The paper is the brightest common tone; ink is well below it. A photo's
  // grey paper then still separates from its lines.
  let seen = 0;
  let paper = 255;
  for (let v = 255; v >= 0; v--) {
    seen += histogram[v];
    if (seen >= grey.length * 0.3) { paper = v; break; }
  }
  const threshold = paper * 0.6;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < grey.length; i++) data[i] = grey[i] < threshold ? 1 : 0;
  return { data, width, height, minWall: Math.max(3, Math.round(Math.max(width, height) / 450)) };
}

const dark = (m: DarkMask, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.width && y < m.height && m.data[y * m.width + x] === 1;

/**
 * Where an edge should sit: the inner face of the wall nearest `at`, or
 * null when there is no wall within `radius`.
 *
 * `vertical` edges run up the plan at x = at, spanning y = from..to; the
 * others run across it. `inside` is the side the room is on (+1: larger
 * coordinates). A wall is a band of pixels dark along most of the span — a
 * doorway leaves a gap, so half is enough; a room's label is far too short.
 */
export function snapEdge(m: DarkMask, vertical: boolean, at: number, from: number, to: number, inside: 1 | -1, radius: number): number | null {
  const lo = Math.max(0, Math.round(Math.min(from, to)));
  const hi = Math.min((vertical ? m.height : m.width) - 1, Math.round(Math.max(from, to)));
  if (hi - lo < 4) return null;
  // Ignore the corners, where the crossing walls are.
  const pad = Math.round((hi - lo) * 0.1);
  const limit = vertical ? m.width : m.height;
  const covered = (c: number) => {
    let n = 0;
    let total = 0;
    for (let t = lo + pad; t <= hi - pad; t++) {
      total++;
      if (vertical ? dark(m, c, t) : dark(m, t, c)) n++;
    }
    return total > 0 && n / total >= 0.5;
  };
  const start = Math.max(0, Math.round(at - radius));
  const end = Math.min(limit - 1, Math.round(at + radius));
  let best: number | null = null;
  let bestDistance = Infinity;
  let c = start;
  while (c <= end) {
    if (!covered(c)) { c++; continue; }
    // Follow the band past the search window, so a thick wall is measured whole.
    let a = c;
    while (a > 0 && covered(a - 1)) a--;
    let b = c;
    while (b < limit - 1 && covered(b + 1)) b++;
    // Any thickness: a hatched wall is drawn as two thin outlines, and the
    // one facing the room is the face wanted.
    const face = inside === 1 ? b + 1 : a;
    const distance = Math.abs(face - at);
    if (distance < bestDistance) { bestDistance = distance; best = face; }
    c = b + 1;
  }
  return best;
}

/** Each edge of a box moved to the wall it is near, if there is one. */
export function snapBox(m: DarkMask, box: PixelBox, radius: number): PixelBox {
  const left = snapEdge(m, true, box.x0, box.y0, box.y1, 1, radius);
  const right = snapEdge(m, true, box.x1, box.y0, box.y1, -1, radius);
  const top = snapEdge(m, false, box.y0, box.x0, box.x1, 1, radius);
  const bottom = snapEdge(m, false, box.y1, box.x0, box.x1, -1, radius);
  const snapped = { x0: left ?? box.x0, x1: right ?? box.x1, y0: top ?? box.y0, y1: bottom ?? box.y1 };
  return snapped.x1 - snapped.x0 > 4 && snapped.y1 - snapped.y0 > 4 ? snapped : box;
}

/**
 * The walls around a point: rays go out each way to the first wall, several
 * side by side so one passing through a doorway is outvoted. A wall is where
 * a line across the ray is nearly all ink; the room's printed name, which
 * the tap often lands on, has gaps between its letters and is walked
 * through. Null when a side has no wall.
 */
export function roomAround(m: DarkMask, x: number, y: number): PixelBox | null {
  const px = Math.round(x);
  const py = Math.round(y);
  const long = Math.max(m.width, m.height);
  const half = Math.max(8, Math.round(long * 0.02));
  // Solid to one side at least: a wall that ends at a doorway still is.
  const lineAt = (cx: number, cy: number, alongX: boolean) => {
    let before = 0;
    let after = 0;
    for (let t = 1; t <= half; t++) {
      if (alongX ? dark(m, cx - t, cy) : dark(m, cx, cy - t)) before++;
      if (alongX ? dark(m, cx + t, cy) : dark(m, cx, cy + t)) after++;
    }
    return Math.max(before, after) / half >= 0.85;
  };
  /**
   * The distance to the wall along rays from the given starting points. With
   * `span` (the room's other side, roughly), the nearest hit whose line is
   * solid ink along a good part of the span: a store's doorway left 44% of
   * its wall, and a bed or cupboard is drawn in hairlines. Otherwise the
   * median hit.
   */
  const reach = (starts: Array<[number, number]>, dx: number, dy: number, span?: [number, number]): number | null => {
    const hits: number[] = [];
    for (const [x0, y0] of starts) {
      let sx = Math.round(x0);
      let sy = Math.round(y0);
      while (sx >= 0 && sy >= 0 && sx < m.width && sy < m.height) {
        // The wall crosses the ray: a horizontal ray meets an upright line.
        if (dark(m, sx, sy) && lineAt(sx, sy, dx === 0)) { hits.push(Math.abs(dx ? sx - px : sy - py)); break; }
        sx += dx;
        sy += dy;
      }
    }
    if (hits.length < (span ? 2 : 3)) return null;
    hits.sort((a, b) => a - b);
    if (span) {
      const [a, b] = span;
      const pad = Math.round((b - a) * 0.1);
      const tolerance = Math.max(2, Math.round(long * 0.004));
      for (const hit of hits) {
        // A stub of wall met by one ray alone is not the room's side.
        if (hits.filter((other) => Math.abs(other - hit) <= tolerance).length < 2) continue;
        const at = dx ? px + dx * hit : py + dy * hit;
        let n = 0;
        let total = 0;
        for (let t = Math.round(a + pad); t <= Math.round(b - pad); t++) {
          total++;
          // Two pixels deep: furniture is drawn in hairlines, walls are not.
          if (dx ? dark(m, at, t) && dark(m, at + dx, t) : dark(m, t, at) && dark(m, t, at + dy)) n++;
        }
        if (total > 0 && n / total >= 0.35) return hit;
      }
    }
    return hits[Math.floor(hits.length / 2)];
  };
  const around = (rowsAt: number[], columnsAt: number[], rough?: PixelBox) => {
    const left = reach(rowsAt.map((ry) => [px, ry]), -1, 0, rough && [rough.y0, rough.y1]);
    const right = reach(rowsAt.map((ry) => [px, ry]), 1, 0, rough && [rough.y0, rough.y1]);
    const up = reach(columnsAt.map((cx) => [cx, py]), 0, -1, rough && [rough.x0, rough.x1]);
    const down = reach(columnsAt.map((cx) => [cx, py]), 0, 1, rough && [rough.x0, rough.x1]);
    if (left === null || right === null || up === null || down === null) return null;
    return { x0: px - left + 1, x1: px + right, y0: py - up + 1, y1: py + down };
  };
  // A rough box from rays close together, then rays spread across each side
  // of it: a doorway can then block at most one or two of the five.
  const near = Math.max(4, Math.round(long * 0.012));
  const rough = around([-2, -1, 0, 1, 2].map((k) => py + k * near), [-2, -1, 0, 1, 2].map((k) => px + k * near));
  if (!rough) return null;
  const spread = (a: number, b: number) => [0.15, 0.32, 0.5, 0.68, 0.85].map((f) => a + (b - a) * f);
  const box = around(spread(rough.y0, rough.y1), spread(rough.x0, rough.x1), rough) ?? rough;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  // A cupboard-sized box is a misread; one spanning most of the sheet found no walls.
  if (w < m.minWall * 4 || h < m.minWall * 4 || w > m.width * 0.8 || h > m.height * 0.8) return null;
  return box;
}

/**
 * Metres per mask pixel, from rooms whose size is known: each room's box,
 * snapped to its walls, against its size (the longer side to the longer
 * side). The median, so one badly placed box does not set the scale. Plans
 * are drawn to one scale both ways. Null with fewer than two rooms, or when
 * they disagree by more than 15%.
 */
export function planScale(m: DarkMask, known: Array<{ box: PixelBox; width: number; length: number }>): number | null {
  const radius = Math.max(m.width, m.height) * 0.04;
  const ratios: number[] = [];
  for (const room of known) {
    if (room.width <= 0 || room.length <= 0) continue;
    const snapped = snapBox(m, room.box, radius);
    const sides = [snapped.x1 - snapped.x0, snapped.y1 - snapped.y0].sort((a, b) => a - b);
    const metres = [room.width, room.length].sort((a, b) => a - b);
    if (sides[0] <= 0) continue;
    ratios.push(metres[0] / sides[0], metres[1] / sides[1]);
  }
  if (ratios.length < 4) return null;
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  // Half the readings must agree with the median, or the boxes are too rough to trust.
  const agreeing = ratios.filter((r) => Math.abs(r - median) / median <= 0.15).length;
  return agreeing >= ratios.length / 2 ? median : null;
}
