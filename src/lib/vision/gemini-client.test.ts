import { describe, expect, it } from 'vitest';
import { classifyGeminiError, isUsablePlanResponse, saysNotAFloorPlan, toAnalysisResult } from './gemini-client';
import { dimensionNeedsReview, dimensionSourceLabel } from './dimensionSource';

/**
 * The bug these guard: errors were classified by searching the message for
 * "rate", and every error from this SDK names its endpoint, ":generateContent".
 * So any failure looked like a rate limit — and a rate limit returned six
 * invented rooms as if they had been read from the user's plan.
 */

const fetchError = (status: number, message = '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent') =>
  Object.assign(new Error(message), { status });

describe('classifying plan reader errors', () => {
  it('does not mistake "generateContent" for a rate limit', () => {
    const error = classifyGeminiError(new Error('Error fetching from https://x/models/m:generateContent: something odd'));
    expect(error.message).not.toMatch(/limit/i);
  });

  it('reads a real rate limit from its status, as retryable', () => {
    const error = classifyGeminiError(fetchError(429));
    expect(error.message).toMatch(/limit/i);
    expect(error.retryable).toBe(true);
  });

  it('treats "high demand" as busy and worth trying the next model', () => {
    const error = classifyGeminiError(fetchError(503));
    expect(error.message).toMatch(/busy/i);
    expect(error.retryable).toBe(true);
  });

  it('recognises a timeout', () => {
    const error = classifyGeminiError(Object.assign(new Error('Request aborted when fetching'), { name: 'AbortError' }));
    expect(error.message).toMatch(/took too long/i);
    expect(error.retryable).toBe(true);
  });

  it('does not retry a configuration problem on the next model', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(classifyGeminiError(fetchError(status)).retryable, String(status)).toBe(false);
    }
  });

  it('names a safety block as such', () => {
    const error = classifyGeminiError(fetchError(400, 'Candidate was blocked due to SAFETY'));
    expect(error.message).toMatch(/safety/i);
    expect(error.retryable).toBe(false);
  });
});

describe('accepting a plan reader reply', () => {
  it('requires measured room dimensions before treating a reply as usable', () => {
    expect(isUsablePlanResponse('{"rooms":[{"name":"Kitchen","width":3.6,"length":4.5}]}')).toBe(true);
    expect(isUsablePlanResponse('{"rooms":[{"name":"Kitchen"}]}')).toBe(false);
    expect(isUsablePlanResponse('{"rooms":[{"name":"Kitchen","width":0,"length":4.5}]}')).toBe(false);
  });

  it('takes the reader at its word that a picture is not a floor plan', () => {
    expect(saysNotAFloorPlan('{"error": "This does not appear to be a floor plan", "confidence": 0}')).toBe(true);
    expect(saysNotAFloorPlan('```json\n{"error":"Not a floor plan: satellite image","rooms":[]}\n```')).toBe(true);
    // Rooms were read, or the failure is something else: not that verdict.
    expect(saysNotAFloorPlan('{"error":"not a floor plan","rooms":[{"name":"Kitchen","width":3,"length":3}]}')).toBe(false);
    expect(saysNotAFloorPlan('{"error":"Image too blurry"}')).toBe(false);
    expect(saysNotAFloorPlan('not json')).toBe(false);
    expect(isUsablePlanResponse('{"error": "This does not appear to be a floor plan", "confidence": 0}')).toBe(false);
  });

  it('turns away a reply whose rooms are mostly too long to be rooms', () => {
    // A real reply: each room's place on the page written where its width belongs.
    const misread = { rooms: [
      { name: 'Master Bedroom', width: 25, length: 4 }, { name: 'Ensuite', width: 18, length: 3.57 },
      { name: 'Toilet', width: 18, length: 1 }, { name: 'Kitchen', width: 24, length: 4 },
    ] };
    expect(isUsablePlanResponse(JSON.stringify(misread))).toBe(false);
    // One long room in a house is believable: a verandah along the front.
    const house = { rooms: [
      { name: 'Lounge', width: 5.8, length: 5.4 }, { name: 'Kitchen', width: 3.9, length: 4 },
      { name: 'Bedroom 1', width: 3.9, length: 3.1 }, { name: 'Verandah', width: 14, length: 1.7 },
    ] };
    expect(isUsablePlanResponse(JSON.stringify(house))).toBe(true);
    expect(isUsablePlanResponse('{"rooms":[{"name":"Hall","width":14,"length":9}]}')).toBe(true);
  });

  it('keeps each room dimension origin visible and treats an omitted origin as unconfirmed', () => {
    const result = toAnalysisResult(JSON.stringify({ rooms: [
      { name: 'Kitchen', width: 3.6, length: 4.5, dimensionSource: 'printed' },
      { name: 'Lounge', width: 5, length: 4, dimensionSource: 'estimated' },
      { name: 'Bedroom', width: 3, length: 3 },
    ] }));
    expect(result.rooms.map((room) => room.dimensionSource)).toEqual(['printed', 'estimated', 'unknown']);
    expect(dimensionNeedsReview(result.rooms[0].dimensionSource)).toBe(false);
    expect(dimensionNeedsReview(result.rooms[1].dimensionSource)).toBe(true);
    expect(dimensionSourceLabel(result.rooms[2].dimensionSource)).toBe('Source unconfirmed');
  });

  it('does not silently turn a missing measurement into a 4 m room', () => {
    const reply = '{"rooms":[{"name":"Kitchen","length":4.5}]}';
    expect(isUsablePlanResponse(reply)).toBe(false);
    expect(toAnalysisResult(reply).rooms[0].dimensions.width).toBe(0);
  });
});

describe('room positions on the wrong scale', () => {
  it('reads 0–1000 boxes as percentages', () => {
    const result = toAnalysisResult(JSON.stringify({
      rooms: [
        { name: 'Bedroom 2', width: 4, length: 3.5, x: 692, y: 281, w: 140, h: 105 },
        { name: 'Kitchen', width: 4, length: 3.5, x: 139, y: 202, w: 130, h: 105 },
      ],
      doors: 4, windows: 6, confidence: 90,
    }));
    expect(result.rooms[0].position).toEqual({ x: 69.2, y: 28.1, width: 14, height: 10.5 });
  });

  it('leaves percentages alone', () => {
    const result = toAnalysisResult(JSON.stringify({
      rooms: [{ name: 'Lounge', width: 5, length: 4.5, x: 6, y: 6, w: 42, h: 44 }],
      doors: 1, windows: 1, confidence: 90,
    }));
    expect(result.rooms[0].position).toEqual({ x: 6, y: 6, width: 42, height: 44 });
  });
});
