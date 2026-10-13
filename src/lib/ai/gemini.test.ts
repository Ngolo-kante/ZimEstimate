import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateWithFailover, GeminiCallError } from './gemini';
import type { GeminiModelChoice } from '@/lib/vision/model';

const MODELS: GeminiModelChoice[] = [
  { model: 'lite', thinking: { thinkingBudget: 0 }, timeoutMs: 5_000 },
  { model: 'flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 5_000 },
];

const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text }] } }] }), { status: 200 });
const fail = (status: number, message = 'error') => new Response(JSON.stringify({ error: { code: status, message } }), { status });

/** A fake Gemini: answers each call from the script, by model name. */
function fakeGemini(script: Record<string, Array<Response | (() => Response)>>) {
  const calls: { model: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const model = decodeURIComponent(String(url).match(/models\/([^:]+):/)![1]);
    calls.push({ model, body: JSON.parse(String(init?.body)) });
    const next = script[model]?.shift();
    if (!next) return fail(503, 'high demand');
    return typeof next === 'function' ? next() : next;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

beforeEach(() => { vi.stubEnv('GOOGLE_GEMINI_API_KEY', 'test-key'); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('calling Gemini past a busy model', () => {
  it('moves to the next model when one is busy, and returns only the answer, not the thinking', async () => {
    const { fetchImpl, calls } = fakeGemini({ lite: [fail(503, 'high demand')], flash: [ok('{"rooms":[]}')] });
    const result = await generateWithFailover({ parts: [{ text: 'x' }], deadlineMs: 20_000, models: MODELS, fetchImpl });
    expect(result).toMatchObject({ text: '{"rooms":[]}', model: 'flash', attempts: 2 });
    expect(calls.map((c) => c.model)).toEqual(['lite', 'flash']);
  });

  it('sends each model its own thinking setting', async () => {
    const { fetchImpl, calls } = fakeGemini({ lite: [ok('{}')] });
    await generateWithFailover({ parts: [{ text: 'x' }], generationConfig: { temperature: 0 }, deadlineMs: 20_000, models: MODELS, fetchImpl });
    expect(calls[0].body.generationConfig).toEqual({ temperature: 0, thinkingConfig: { thinkingBudget: 0 } });
  });

  it('goes round again when every model was busy the first time', async () => {
    const { fetchImpl, calls } = fakeGemini({ lite: [fail(503), ok('{"ok":1}')], flash: [fail(429)] });
    const result = await generateWithFailover({ parts: [{ text: 'x' }], deadlineMs: 20_000, models: MODELS, fetchImpl });
    expect(result.model).toBe('lite');
    expect(calls.map((c) => c.model)).toEqual(['lite', 'flash', 'lite']);
  });

  it('asks again without thinking settings when a model rejects them', async () => {
    const { fetchImpl, calls } = fakeGemini({ lite: [fail(400, 'Request contains an invalid argument.'), ok('{}')] });
    await generateWithFailover({ parts: [{ text: 'x' }], deadlineMs: 20_000, models: MODELS, fetchImpl });
    expect(calls[1].body.generationConfig).toEqual({});
  });

  it('skips a retired model on later rounds', async () => {
    const { fetchImpl, calls } = fakeGemini({ lite: [fail(404, 'no longer available')], flash: [fail(503), ok('{}')] });
    await generateWithFailover({ parts: [{ text: 'x' }], deadlineMs: 20_000, models: MODELS, fetchImpl });
    expect(calls.map((c) => c.model)).toEqual(['lite', 'flash', 'flash']);
  });

  it('tries the next model when the reply fails the caller’s check', async () => {
    const { fetchImpl } = fakeGemini({ lite: [ok('not json')], flash: [ok('{"fine":true}')] });
    const result = await generateWithFailover({
      parts: [{ text: 'x' }], deadlineMs: 20_000, models: MODELS, fetchImpl,
      accept: (t) => { try { JSON.parse(t); return true; } catch { return false; } },
    });
    expect(result.text).toBe('{"fine":true}');
  });

  it('stops at once on a bad key — no other model will fix it', async () => {
    const { fetchImpl, calls } = fakeGemini({ lite: [fail(403, 'API key not valid')] });
    await expect(generateWithFailover({ parts: [{ text: 'x' }], deadlineMs: 20_000, models: MODELS, fetchImpl }))
      .rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(1);
  });

  it('gives up by the deadline and reports the last status', async () => {
    const { fetchImpl } = fakeGemini({});
    const started = Date.now();
    const error = await generateWithFailover({ parts: [{ text: 'x' }], deadlineMs: 4_000, models: MODELS, fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(GeminiCallError);
    expect(error.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(4_000);
  });
});
