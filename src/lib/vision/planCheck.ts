// ─── Checking a scan against the sizes printed on the plan ───────────────────
// The plan reader's own "95% confident" is a number it makes up: in the week
// to 2026-10-17 every read scored 75–95 whether or not its sizes were right.
// This is a measured check instead. Most plans print each room's name with
// its size ("BEDROOM 2 / 3.6 x 4.0m") or area ("11,97 m²"); the PDF's text or the label reader
// (roomLabels.ts) finds them, and each is compared with the scan's room at
// the same spot. The result is "7 of 8 printed sizes match", a list of the
// rooms that differ, and printed rooms the scan left out.

import type { DetectedRoom, PlanBox } from './types';

export interface PrintedRoom {
  name: string;
  /** Printed size, when the plan gives one ("3.6 x 4.0m")… */
  width?: number;
  length?: number;
  /** …or the printed floor area ("11,97 m²"), as drawing programs stamp rooms. */
  area?: number;
  /** Where the label sits, as a percentage of the plan image (0–100). */
  at: { x: number; y: number };
}

export interface PrintedSizes {
  /** 'pdf-text': read from the PDF's own text, exact. 'ocr': read from the image. */
  source: 'pdf-text' | 'ocr';
  rooms: PrintedRoom[];
}

export interface PrintedSizeCheck {
  /** Printed sizes found on the plan. */
  printed: number;
  /** Printed sizes the scan has a room for with the same size. */
  matched: number;
  /** Those rooms: their size is confirmed by the plan itself. */
  matchedRoomIds: string[];
  /** Scan rooms whose size differs from the one printed in them. */
  differences: Array<{ room: DetectedRoom; printed: PrintedRoom }>;
  /** Printed rooms with no scan room at their label. */
  missing: PrintedRoom[];
}

const normalise = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** "Ensuite 2" and "Ensuite 2 (Bedroom 2)" are the same room. */
export const sameName = (a: string, b: string) => {
  const x = normalise(a);
  const y = normalise(b);
  return x.length > 0 && y.length > 0 && (x.startsWith(y) || y.startsWith(x));
};

const hasSize = (p: PrintedRoom): p is PrintedRoom & { width: number; length: number } =>
  typeof p.width === 'number' && typeof p.length === 'number';

/** Same size either way round, to the 10 cm a plan prints, or 3% on big rooms. */
export function sameSize(a: { width: number; length: number }, b: { width: number; length: number }): boolean {
  const [a1, a2] = [a.width, a.length].sort((x, y) => x - y);
  const [b1, b2] = [b.width, b.length].sort((x, y) => x - y);
  const close = (x: number, y: number) => Math.abs(x - y) <= Math.max(0.12, Math.max(x, y) * 0.03);
  return close(a1, b1) && close(a2, b2);
}

/** How far a label sits outside a box, in percent of the image; 0 inside. */
const distance = (box: PlanBox, at: { x: number; y: number }) =>
  Math.hypot(Math.max(box.x - at.x, 0, at.x - box.x - box.width), Math.max(box.y - at.y, 0, at.y - box.y - box.height));

const contains = (box: PlanBox, at: { x: number; y: number }) =>
  box.width > 0 && box.height > 0 && at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + box.height;

export function checkAgainstPrinted(rooms: DetectedRoom[], printed: PrintedSizes | null | undefined): PrintedSizeCheck | null {
  if (!printed || printed.rooms.length === 0) return null;
  const taken = new Set<string>();
  const check: PrintedSizeCheck = { printed: 0, matched: 0, matchedRoomIds: [], differences: [], missing: [] };
  const compare = (label: PrintedRoom, room: DetectedRoom) => {
    taken.add(room.id);
    check.printed++;
    const same = hasSize(label)
      ? sameSize(room.dimensions, label)
      // An area printed to the hundredth; 4% allows for the scan's rounding.
      : Math.abs(room.dimensions.width * room.dimensions.length - (label.area ?? 0)) <= Math.max(0.5, (label.area ?? 0) * 0.04);
    if (same) { check.matched++; check.matchedRoomIds.push(room.id); }
    else check.differences.push({ room, printed: label });
  };

  const placedRooms = rooms.filter((room) => room.position.width > 0 && room.position.height > 0);
  const plan = placedRooms.length > 0 ? {
    x0: Math.min(...placedRooms.map((r) => r.position.x)), y0: Math.min(...placedRooms.map((r) => r.position.y)),
    x1: Math.max(...placedRooms.map((r) => r.position.x + r.position.width)), y1: Math.max(...placedRooms.map((r) => r.position.y + r.position.height)),
  } : null;
  // Only labels on the drawing itself: the same names printed in a room
  // schedule or a note beside it ("Master Bedroom 14.1 m2") are not rooms.
  const labels = printed.rooms.filter((label) => plan === null
    || (label.at.x >= plan.x0 - 3 && label.at.x <= plan.x1 + 3 && label.at.y >= plan.y0 - 3 && label.at.y <= plan.y1 + 3));
  const done = new Set<PrintedRoom>();

  // A scan room's box is only roughly where the room is (often 3–6% off), so
  // a label of the same name nearby is the surest pairing. Then a label
  // inside a box of another name: the smallest such box.
  for (const label of labels) {
    const room = rooms
      .filter((r) => !taken.has(r.id) && sameName(r.name, label.name) && distance(r.position, label.at) <= 8)
      .sort((a, b) => distance(a.position, label.at) - distance(b.position, label.at))[0];
    if (room) { compare(label, room); done.add(label); }
  }
  for (const label of labels) {
    if (done.has(label)) continue;
    const room = rooms
      .filter((r) => !taken.has(r.id) && contains(r.position, label.at))
      .sort((a, b) => a.position.width * a.position.height - b.position.width * b.position.height)[0];
    if (room) { compare(label, room); continue; }
    // A name the scan already has, printed twice, is a repeat, not a missing room.
    if (rooms.some((r) => sameName(r.name, label.name))) continue;
    check.printed++;
    check.missing.push(label);
  }
  return check.printed > 0 ? check : null;
}

/** The printed size in the room's own orientation: the longer side where the room's is. */
export function printedSizeFor(room: DetectedRoom, printed: PrintedRoom): { width: number; length: number } | null {
  if (!hasSize(printed)) return null;
  const long = Math.max(printed.width, printed.length);
  const short = Math.min(printed.width, printed.length);
  return room.dimensions.width >= room.dimensions.length ? { width: long, length: short } : { width: short, length: long };
}

/**
 * A box for a printed room the scan missed, centred on its label and sized
 * from the plan's scale — taken from the rooms whose printed size matched,
 * which is the best evidence there is. Null when there are too few of them.
 */
export function boxForMissing(label: PrintedRoom, rooms: DetectedRoom[], printed: PrintedSizes): PlanBox | null {
  if (!hasSize(label)) return null;
  const perMetre: Array<{ x: number; y: number }> = [];
  for (const other of printed.rooms) {
    if (!hasSize(other)) continue;
    const room = rooms.find((r) => contains(r.position, other.at) && sameSize(r.dimensions, other));
    if (room && room.dimensions.width > 0 && room.dimensions.length > 0) {
      perMetre.push({ x: room.position.width / room.dimensions.width, y: room.position.height / room.dimensions.length });
    }
  }
  if (perMetre.length < 2) return null;
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const width = median(perMetre.map((p) => p.x)) * label.width;
  const height = median(perMetre.map((p) => p.y)) * label.length;
  return {
    x: Math.max(0, Math.min(100 - width, label.at.x - width / 2)),
    y: Math.max(0, Math.min(100 - height, label.at.y - height / 2)),
    width: Math.min(100, width),
    height: Math.min(100, height),
  };
}
