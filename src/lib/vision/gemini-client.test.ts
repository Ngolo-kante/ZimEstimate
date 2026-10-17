import { describe, expect, it } from 'vitest';
import { classifyGeminiError, isUsablePlanResponse, toAnalysisResult } from './gemini-client';
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
