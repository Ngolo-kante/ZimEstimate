// ─── Facts a plan states about itself ────────────────────────────────────────
// Drawings often print the house's floor area in the title ("GROUND FLOOR PLAN
// (area=90sqm)", "TOTAL FLOOR AREA: 120 m²"). Adding up the rooms misses the
// walls and any room the reader skipped: on real uploads the same 90 m² plan
// came back as 69, 71 and 87 m². A stated total is exact, so it is used for
// the slab, roof and labour when the plan gives one.
//
// A stair means more than one floor. The BOQ prices one floor, so a plan with
// a stair is flagged for review rather than quietly priced at half its size
// (a real 270 m² two-storey upload came back as 129 m², then 55 m²).

const AREA_UNIT = String.raw`(?:sq\.?\s*m(?:etres?|eters?)?|sqm|m²|m2|square\s*met(?:re|er)s?)`;
const NUMBER = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)`;

/** "area=90sqm", "Floor area: 120 m²", "TOTAL AREA 145,5 m2", "Gross area = 210 sq m". */
// Not the stand, roof or a wall: "Stand area 600 m²" is the plot.
const NOT_THE_HOUSE = String.raw`(?<!\b(?:stand|plot|site|erf|land|yard|garden|paving|roof|wall|window|room)\s*)`;
const STATED_AREA = new RegExp(String.raw`\b${NOT_THE_HOUSE}(total|gross|floor|plinth|built[\s-]*up|house|building)?\s*(?:floor\s+)?area\s*(?:[:=]|is)?\s*${NUMBER}\s*${AREA_UNIT}(?![a-z])`, 'gi');

/** Smallest and largest whole-house areas worth believing. */
const MIN_HOUSE_M2 = 20;
const MAX_HOUSE_M2 = 2000;

/**
 * The floor area a plan states for the whole house, or null.
 *
 * Room stamps also say "Area: 11.97 m²", so a figure only counts when it is at
 * least as large as the rooms read add up to (less a little for rounding).
 * The largest qualifying figure wins: titles state the whole floor.
 */
export function statedFloorArea(text: string, roomAreaM2: number): number | null {
  let best: number | null = null;
  for (const match of text.matchAll(STATED_AREA)) {
    const value = Number(match[2].replace(',', '.'));
    if (!Number.isFinite(value) || value < MIN_HOUSE_M2 || value > MAX_HOUSE_M2) continue;
    if (value < roomAreaM2 * 0.9) continue;
    if (best === null || value > best) best = value;
  }
  return best;
}

const STAIR = /\bstair(?:s|case|way|well)?\b/i;
const UPPER_FLOOR = /\b(?:first|upper|second)\s+floor\b|\bdouble[\s-]*stor(?:e)?y\b/i;

/** True when the plan's words or room names show more than one floor. */
export function looksMultiStorey(text: string, roomNames: string[]): boolean {
  return STAIR.test(text) || UPPER_FLOOR.test(text) || roomNames.some((name) => STAIR.test(name) || UPPER_FLOOR.test(name));
}

// ─── Drawings that are not floor plans ───────────────────────────────────────
// People also upload the other sheets of a drawing set: on the first night of
// ads, a septic tank detail and an engineer's column schedule. The readers
// spent their whole 52 s on each and answered "took too long". A PDF says
// what it is in its text, so these are turned back at once with a pointer to
// the right page. Only when the text names no room at all and clearly names
// something else: some real plans carry their room names as drawn lines, not
// text, and must still be read.

const ROOM_NAME = /\b(?:lounge|living|sitting|dining|kitchen|bed(?:room|rm)?s?|bath(?:room)?|toilet|w\.?c|shower|en[\s-]?suite|study|office|garage|verand(?:ah?)|patio|porch|passage|corridor|hall|store|pantry|laundry|scullery|foyer|lobby|family)\b/i;

const OTHER_DRAWINGS: { kind: string; pattern: RegExp }[] = [
  { kind: 'septic', pattern: /\b(?:septic|soak\s?away|absorption\s+pit)\b/i },
  { kind: 'structural', pattern: /\b(?:col(?:umn)?s?\s*(?:c\d|r\.?c\.?|detail|schedule)|r\.?c\.?\s+detail|reinforcement|\d+y1[0-6]\b|y1[0-6][-\s]\d|links?\b.*\bspacing|footing\s+schedule|bar\s+bending)/i },
  { kind: 'elevations', pattern: /\b(?:elevations?|sections?)\b/i },
];

/** Why this PDF is not a floor plan, in words for the person; null if it may be one. */
export function notAFloorPlan(text: string): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 20 || ROOM_NAME.test(text)) return null;
  const kind = OTHER_DRAWINGS.find((drawing) => drawing.pattern.test(text))?.kind;
  if (kind === 'septic') return 'This looks like a septic tank drawing, not a house floor plan. For a septic tank estimate, use Quick Projects → Septic. For the house, upload the floor plan page, the one with the rooms.';
  if (kind === 'structural') return "This looks like an engineer's structural drawing (columns or reinforcement), not a floor plan. Upload the floor plan page, the one with the room names and sizes.";
  if (kind === 'elevations') return 'This page shows the outside views or sections of the house, not the floor plan. Upload the floor plan page, the one with the room names and sizes.';
  return null;
}
