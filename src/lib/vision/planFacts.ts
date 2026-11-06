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
