import { ROOM_TYPES, PIXELS_PER_METER } from '@/app/boq/new/components/room-builder/types';
import type { RoomInstance } from '@/app/boq/new/components/room-builder/types';
import type { VisionAnalysisResult, DetectedRoom } from '@/lib/vision/types';

/**
 * Turns a floor plan analysis into rooms the BOQ wizard already understands.
 *
 * The wizard costs from projectDetails.floorPlanSize and draws from
 * detailedRooms — the same two things the interactive room builder writes. So
 * an uploaded plan does not need a parallel path through the estimate: it
 * needs to produce those two, and everything downstream is already built.
 */

/** A detected name mapped onto the wizard's own room vocabulary. */
const NAME_PATTERNS: Array<{ test: RegExp; key: string }> = [
  { test: /\b(master|bed\s*room|bedroom|bed\s*\d)\b/i, key: 'bedrooms' },
  { test: /\b(en[\s-]?suite|bath|shower|wc|toilet)\b/i, key: 'bathrooms' },
  { test: /\b(kitchen|kitchenette)\b/i, key: 'kitchen' },
  { test: /\b(pantry|scullery|larder)\b/i, key: 'pantry' },
  { test: /\b(lounge|living|family|sitting|tv\s*room)\b/i, key: 'livingRoom' },
  { test: /\b(dining|dinning)\b/i, key: 'diningRoom' },
  { test: /\b(veranda|verandah|porch|patio|stoep)\b/i, key: 'veranda' },
  { test: /\b(double\s*garage)\b/i, key: 'garage2' },
  { test: /\b(garage|carport)\b/i, key: 'garage1' },
  { test: /\b(passage|hall|corridor|lobby)\b/i, key: 'passage' },
];

/** Unrecognised names keep their label and fall back to a neutral type. */
const FALLBACK_TYPE = 'livingRoom';

export function roomTypeFromName(name: string): string {
  const match = NAME_PATTERNS.find((pattern) => pattern.test.test(name));
  return match ? match.key : FALLBACK_TYPE;
}

/**
 * Estimates how wide and tall the plan is in metres.
 *
 * Room positions arrive as percentages of the image, but the room builder's
 * canvas works in metres. A room that is 4m wide and covers 25% of the image
 * implies a 16m plan, so each room gives one estimate of the overall extent
 * and the median of those is used — the median rather than the mean because a
 * single badly-read room should not stretch the whole layout.
 */
function planExtentMetres(rooms: DetectedRoom[]): { width: number; height: number } {
  const widths: number[] = [];
  const heights: number[] = [];

  rooms.forEach((room) => {
    if (room.position.width > 1 && room.dimensions.width > 0) {
      widths.push(room.dimensions.width / (room.position.width / 100));
    }
    if (room.position.height > 1 && room.dimensions.length > 0) {
      heights.push(room.dimensions.length / (room.position.height / 100));
    }
  });

  const median = (values: number[], fallback: number) => {
    if (values.length === 0) return fallback;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  return { width: median(widths, 20), height: median(heights, 20) };
}

export interface MappedPlan {
  rooms: RoomInstance[];
  /** Summed from the room dimensions, not from the model's own total. */
  totalArea: number;
  doors: number;
  windows: number;
  confidence: number;
}

export function planToWizardRooms(result: VisionAnalysisResult): MappedPlan {
  const extent = planExtentMetres(result.rooms);

  const rooms: RoomInstance[] = result.rooms.map((room, index) => {
    const type = roomTypeFromName(room.name);
    const typeConfig = ROOM_TYPES.find((entry) => entry.key === type);

    return {
      id: room.id || `plan-room-${index}`,
      type,
      // The drawing's own name is kept. "Master Bedroom" is more use to
      // somebody checking the estimate than the generic "Bedroom" the type
      // would give, and the type is still there to drive costing.
      label: room.name?.trim() || typeConfig?.label || `Room ${index + 1}`,
      length: round1(room.dimensions.length),
      width: round1(room.dimensions.width),
      // Per-room door and window counts are not something the analysis
      // reports — it returns totals for the whole plan. Inventing a
      // distribution across rooms would put numbers in the estimate that
      // nothing measured, so each room starts at the builder's own default of
      // one door, and the real totals are carried separately.
      doors: 1,
      windows: 1,
      x: Math.round((room.position.x / 100) * extent.width * PIXELS_PER_METER),
      y: Math.round((room.position.y / 100) * extent.height * PIXELS_PER_METER),
      materialId: 'brick-common',
    };
  });

  // Summed from the dimensions actually used, so the area shown always agrees
  // with the rooms listed beneath it. result.totalArea is the model's own
  // figure and can disagree with the sum of its own rooms.
  const totalArea = rooms.reduce((sum, room) => sum + room.length * room.width, 0);

  return {
    rooms,
    totalArea: round1(totalArea),
    doors: result.doors ?? 0,
    windows: result.windows ?? 0,
    confidence: result.confidence ?? 0,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
