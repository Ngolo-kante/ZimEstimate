// Gemini Vision API Client
// Floor plan analysis, through the shared caller that works past a busy model
// (lib/ai/gemini.ts).

import { readWithFirstAvailable, type ImageInput } from '@/lib/ai/planReaders';
import { generateWithFailover, type GeminiPart } from '@/lib/ai/gemini';
import { PLAN_SECOND_READING_MODELS } from './model';
import type { PlanFailureCode } from './planFailure';
import type { LabelledRoom } from './roomLabels';
import { VisionAnalysisResult, DetectedRoom, DetectedWall } from './types';

/** Plan reads get this long in total — inside the route's 60-second limit. */
const PLAN_READ_DEADLINE_MS = 52_000;

// Floor plan analysis prompt
const FLOOR_PLAN_PROMPT = `You are an expert architectural floor plan analyzer. Analyze this floor plan image and extract detailed room information.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation, just the JSON object.

Extract and return the following information in this exact JSON format:
{
  "rooms": [
    {
      "name": "Room Name",
      "width": 5.2,
      "length": 4.0,
      "x": 10,
      "y": 15,
      "w": 30,
      "h": 25,
      "dimensionSource": "printed",
      "wallType": "external"
    }
  ],
  "doors": 8,
  "windows": 12,
  "confidence": 85
}

Rules for extraction:
1. "name" - Identify room types: Living Room, Bedroom 1/2/3, Kitchen, Bathroom, Toilet, Corridor, Garage, etc.
2. "width" and "length" - Dimensions in METERS. Prefer printed dimensions or a visible scale. If neither exists, estimate from the plan geometry, keep the rooms proportionally consistent, and lower the confidence score. Never replace a visible dimension with a typical room size.
3. "dimensionSource" - For EACH room, use "printed" only when its numerical dimensions are printed on the plan, "scaled" when derived using a visible scale, and "estimated" when inferred from geometry without a scale. Never call an inferred size printed.
4. "x", "y", "w", "h" - Position and size as PERCENTAGE of the image (0-100). This is for overlay rendering.
5. "wallType" - "external" for perimeter walls, "internal" for partition walls.
6. "doors" - Count all door symbols/openings.
7. "windows" - Count all window symbols.
8. "confidence" - Your confidence in the accuracy (0-100):
   - 90-100: Clear technical drawing with dimensions marked
   - 70-89: Clear layout but some dimensions estimated
   - 50-69: Blurry or partial plan, significant estimation
   - Below 50: Very unclear, mostly guesswork

If the image is not a floor plan, return: {"error": "This does not appear to be a floor plan", "confidence": 0}`;

// Parse Gemini response into structured data
function parseGeminiResponse(text: string): {
  rooms: Array<{
    name: string;
    width: number;
    length: number;
    x: number;
    y: number;
    w: number;
    h: number;
    dimensionSource?: string;
    wallType: 'external' | 'internal';
  }>;
  doors: number;
  windows: number;
  confidence: number;
  error?: string;
} {
  try {
    // Remove any markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    // Some readers wrap the JSON in a sentence; take the outermost object.
    if (!cleanedText.startsWith('{')) {
      const first = cleanedText.indexOf('{');
      const last = cleanedText.lastIndexOf('}');
      if (first >= 0 && last > first) cleanedText = cleanedText.slice(first, last + 1);
    }

    const parsed = JSON.parse(cleanedText);
    if (!Array.isArray(parsed?.rooms)) throw new SyntaxError('No rooms in reply');
    return parsed;
  } catch (e) {
    console.error('Failed to parse plan reader response:', e instanceof Error ? e.message : e);
    return {
      rooms: [],
      doors: 0,
      windows: 0,
      confidence: 0,
      error: 'Failed to parse AI response',
    };
  }
}

/** Few rooms in a house have a side longer than this; a garage or a long verandah may. */
const LONG_ROOM_SIDE_M = 12;

/**
 * Do not present a model's omitted or invented default dimensions as a read plan.
 *
 * Nor a reply whose rooms are mostly too long to be rooms. On 2026-11-12 a
 * backup model gave one 158 m² house every room 15 to 27 m wide ("Master
 * Bedroom 25 x 4", "Toilet 18 x 1"): it had written each room's place on the
 * page where its width belongs. That came to 877 m², each side still under
 * the 40 m limit. One or two long rooms are allowed; more than a quarter of
 * them is a misreading, and the next model is asked.
 */
export function isUsablePlanResponse(text: string): boolean {
  const parsed = parseGeminiResponse(text);
  const measured = !parsed.error && parsed.rooms.length > 0 && parsed.rooms.every((room) =>
    typeof room.name === 'string' && room.name.trim().length > 0 &&
    typeof room.width === 'number' && Number.isFinite(room.width) && room.width >= 0.8 && room.width <= 40 &&
    typeof room.length === 'number' && Number.isFinite(room.length) && room.length >= 0.8 && room.length <= 40,
  );
  if (!measured) return false;
  const tooLong = parsed.rooms.filter((room) => Math.max(room.width, room.length) > LONG_ROOM_SIDE_M).length;
  return tooLong <= Math.max(1, parsed.rooms.length * 0.25);
}

/**
 * The reader's own verdict that the picture is not a floor plan, which the
 * prompt asks it to give. It used to count as an unusable reply, so every
 * model in turn was asked about a satellite photo of a stand until the 52
 * seconds ran out, and the person was then told the reader was "busy".
 */
export function saysNotAFloorPlan(text: string): boolean {
  try {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first < 0 || last <= first) return false;
    const reply = JSON.parse(text.slice(first, last + 1)) as { error?: unknown; rooms?: unknown };
    const noRooms = !Array.isArray(reply.rooms) || reply.rooms.length === 0;
    return noRooms && typeof reply.error === 'string' && /\bnot\b[^.]*\bfloor\s*plan\b/i.test(reply.error);
  } catch {
    return false;
  }
}

export const NOT_A_FLOOR_PLAN_MESSAGE = 'This does not look like a floor plan. Upload the floor plan page, the one with the room names and sizes.';

// Generate unique IDs
function generateId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/* No demo fallback. There used to be one: on any error whose message
   contained "quota", "rate" or "429" it returned six invented rooms (a
   78 m² house with 85% confidence) as if read from the user's plan. And
   every error from this SDK names the endpoint, "...:generateContent" —
   which contains "rate" — so timeouts and outages all came back as the same
   fake house, presented as a real reading. A failed read now says so. */

export class PlanReadError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly code: PlanFailureCode = 'unreadable') {
    super(message);
    this.name = 'PlanReadError';
  }
}

/* Classified by HTTP status, never by searching the message text — that is
   how "generateContent" was mistaken for a rate limit. */
export function classifyGeminiError(error: unknown): PlanReadError {
  const status = (error as { status?: number })?.status;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);

  if (name === 'AbortError' || /\b(aborted|timed out|timeout)\b/i.test(message)) {
    return new PlanReadError('The plan reader took too long. Check it is the floor plan, the page with the rooms (not a septic tank, column or elevation drawing), then try again, or use the room builder.', true, 'timeout');
  }
  if (status === 429) {
    return new PlanReadError('The plan reader has reached its limit for now. Try again in a minute, or use the room builder.', true, 'busy');
  }
  if (status === 503 || status === 500 || status === 502 || status === 504) {
    return new PlanReadError('The plan reader is busy right now. Try again in a minute, or use the room builder.', true, 'busy');
  }
  if (status === 400 && /safety|blocked/i.test(message)) {
    return new PlanReadError('This image was blocked by the reader\'s safety filter. Try a different copy of the plan.', false, 'unreadable');
  }
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    // A configuration problem on our side, not something a retry or the
    // user can fix — and not a reason to try the next model blindly.
    return new PlanReadError('The plan reader is not available right now. Please use the room builder instead.', false, 'unavailable');
  }
  return new PlanReadError('We could not read that plan. Try a clearer copy, or use the room builder.', true);
}

// Analyze floor plan image
export async function analyzeFloorPlan(
  original: ImageInput,
  readingCopy?: ImageInput,
  signal?: AbortSignal,
): Promise<VisionAnalysisResult> {
  try {
    // Gemini, NVIDIA and OpenRouter at once; the first usable reply wins
    // (lib/ai/planReaders.ts).
    const { text, provider, model } = await readWithFirstAvailable({
      prompt: FLOOR_PLAN_PROMPT,
      original,
      readingCopy,
      // Room lists for a large house run to a few thousand tokens; the old
      // 4,096 cap could cut a big plan's JSON off mid-way.
      maxOutputTokens: 8192,
      deadlineMs: PLAN_READ_DEADLINE_MS,
      // A reply that is not the JSON asked for, or has no rooms, is no answer;
      // "this is not a floor plan" is one.
      accept: (reply) => isUsablePlanResponse(reply) || saysNotAFloorPlan(reply),
      signal,
    });
    if (saysNotAFloorPlan(text)) {
      console.info('Plan reader: not a floor plan', { provider, model });
      throw new PlanReadError(NOT_A_FLOOR_PLAN_MESSAGE, false, 'not_floor_plan');
    }
    console.info('Plan read', { provider, model });
    return { ...toAnalysisResult(text), source: 'ai', reader: { provider, model } };
  } catch (error) {
    throw error instanceof PlanReadError ? error : classifyGeminiError(error);
  }
}

/**
 * A second reading of the same plan by a fast model, to compare with the
 * first. The reader's own "confidence" is a number it makes up, and the same
 * plan read twice often comes back with different sizes (2026-11-11: one
 * house's main bedroom as 3.5 × 3.4 m, then 5.2 × 4.1 m). Two readings that
 * give a room the same size bear each other out; where they differ, the
 * person is shown both and checks the drawing (planCheck.ts).
 *
 * One more call per upload, to the Lite models' own free allowance. Never
 * throws and never delays the first reading beyond the caller's wait: no
 * second reading simply means nothing to compare.
 */
export async function readSecondTime(original: ImageInput, deadlineMs: number, signal?: AbortSignal): Promise<DetectedRoom[] | null> {
  if (!process.env.GOOGLE_GEMINI_API_KEY) return null;
  try {
    const { text } = await generateWithFailover({
      parts: [{ text: FLOOR_PLAN_PROMPT }, { inlineData: { mimeType: original.mimeType, data: original.base64 } }] as GeminiPart[],
      generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 8192 },
      deadlineMs,
      accept: isUsablePlanResponse,
      models: PLAN_SECOND_READING_MODELS,
      signal,
    });
    return toAnalysisResult(text).rooms;
  } catch {
    return null;
  }
}

/** The same scan with these rooms: walls and total follow the rooms. */
export function withRooms(result: VisionAnalysisResult, rooms: DetectedRoom[]): VisionAnalysisResult {
  return {
    ...result,
    rooms,
    walls: generateWallsFromRooms(rooms),
    totalArea: Math.round(rooms.reduce((sum, room) => sum + room.area, 0) * 100) / 100,
  };
}

/**
 * Rooms read from the names and sizes printed on the plan, when no AI reader
 * answered. Sizes are as printed; positions are laid out from where each
 * label sits, so the room builder shows them roughly where they are.
 */
export function analysisFromLabels(labelled: LabelledRoom[]): VisionAnalysisResult {
  // Rows of labels at about the same height give the house's width in metres;
  // columns give its depth. Each room is then drawn to that scale.
  const groupBy = (key: 'x' | 'y') => {
    const groups: LabelledRoom[][] = [];
    for (const room of [...labelled].sort((a, b) => a.at[key] - b.at[key])) {
      const group = groups.find((g) => Math.abs(g[0].at[key] - room.at[key]) < 0.08);
      if (group) group.push(room); else groups.push([room]);
    }
    return groups;
  };
  const houseWidth = Math.max(...groupBy('y').map((row) => row.reduce((s, r) => s + r.width, 0)), 1);
  const houseDepth = Math.max(...groupBy('x').map((col) => col.reduce((s, r) => s + r.length, 0)), 1);

  const rooms: DetectedRoom[] = labelled.map((room) => {
    const w = Math.min(100, (room.width / houseWidth) * 100);
    const h = Math.min(100, (room.length / houseDepth) * 100);
    return {
      id: generateId(),
      name: room.name,
      dimensions: { width: room.width, length: room.length },
      area: Math.round(room.width * room.length * 100) / 100,
      position: {
        x: Math.max(0, Math.min(100 - w, room.at.x * 100 - w / 2)),
        y: Math.max(0, Math.min(100 - h, room.at.y * 100 - h / 2)),
        width: w,
        height: h,
      },
      wallType: 'internal',
      isEdited: false,
      dimensionSource: 'printed',
    };
  });

  return {
    rooms,
    walls: generateWallsFromRooms(rooms),
    totalArea: Math.round(rooms.reduce((sum, r) => sum + r.area, 0) * 100) / 100,
    doors: 0,
    windows: 0,
    // Sizes are exactly as printed, but nothing checked them against the
    // drawing: below the 90 that skips the review screen.
    confidence: 60,
    imageWidth: 100,
    imageHeight: 100,
    source: 'labels',
  };
}

export function toAnalysisResult(text: string): VisionAnalysisResult {
  const parsed = parseGeminiResponse(text);

  if (parsed.error) {
    return {
      rooms: [],
      walls: [],
      totalArea: 0,
      doors: 0,
      windows: 0,
      confidence: parsed.confidence || 0,
      imageWidth: 0,
      imageHeight: 0,
      rawResponse: text,
    };
  }

  // Convert parsed rooms to DetectedRoom format
  const rooms: DetectedRoom[] = parsed.rooms.map((room, index) => ({
    id: generateId(),
    name: room.name || `Room ${index + 1}`,
    dimensions: {
      width: Number.isFinite(room.width) && room.width > 0 ? room.width : 0,
      length: Number.isFinite(room.length) && room.length > 0 ? room.length : 0,
    },
    area: (Number.isFinite(room.width) && room.width > 0 ? room.width : 0) * (Number.isFinite(room.length) && room.length > 0 ? room.length : 0),
    position: {
      x: room.x || 10 + index * 15,
      y: room.y || 10 + index * 10,
      width: room.w || 20,
      height: room.h || 20,
    },
    wallType: room.wallType || 'internal',
    isEdited: false,
    dimensionSource: room.dimensionSource === 'printed' || room.dimensionSource === 'scaled' || room.dimensionSource === 'estimated'
      ? room.dimensionSource : 'unknown',
  }));

  // Asked for percentages, a reader sometimes answers in its own 0–1000 box
  // scale (Gemini's native one; seen on a PDF on 2026-10-18), and the boxes
  // then sat off the drawing. Put them back on a 0–100 scale.
  const extent = Math.max(0, ...rooms.map((room) => Math.max(room.position.x + room.position.width, room.position.y + room.position.height)));
  if (extent > 105) {
    const divisor = extent <= 1_050 ? 10 : extent / 100;
    for (const room of rooms) {
      room.position = { x: room.position.x / divisor, y: room.position.y / divisor, width: room.position.width / divisor, height: room.position.height / divisor };
    }
  }

  // Generate walls from room perimeters
  const walls: DetectedWall[] = generateWallsFromRooms(rooms);

  // Calculate total area
  const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);

  return {
    rooms,
    walls,
    totalArea,
    doors: parsed.doors || 0,
    windows: parsed.windows || 0,
    confidence: parsed.confidence || 50,
    imageWidth: 100,
    imageHeight: 100,
    rawResponse: text,
  };
}

// Generate wall segments from room definitions
function generateWallsFromRooms(rooms: DetectedRoom[]): DetectedWall[] {
  const walls: DetectedWall[] = [];

  rooms.forEach((room) => {
    const { x, y, width: w, height: h } = room.position;
    const wallHeight = 2.7; // Default wall height

    // Calculate wall lengths based on room dimensions
    const roomWidth = room.dimensions.width;
    const roomLength = room.dimensions.length;

    // Top wall
    walls.push({
      id: `wall_${room.id}_top`,
      startPoint: { x, y },
      endPoint: { x: x + w, y },
      length: roomWidth,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });

    // Right wall
    walls.push({
      id: `wall_${room.id}_right`,
      startPoint: { x: x + w, y },
      endPoint: { x: x + w, y: y + h },
      length: roomLength,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });

    // Bottom wall
    walls.push({
      id: `wall_${room.id}_bottom`,
      startPoint: { x: x + w, y: y + h },
      endPoint: { x, y: y + h },
      length: roomWidth,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });

    // Left wall
    walls.push({
      id: `wall_${room.id}_left`,
      startPoint: { x, y: y + h },
      endPoint: { x, y },
      length: roomLength,
      height: wallHeight,
      thickness: room.wallType === 'external' ? 230 : 115,
      type: room.wallType,
    });
  });

  return walls;
}

// Convert file to base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
