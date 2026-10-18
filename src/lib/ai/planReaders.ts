// ─── Reading an image with whichever free AI service answers first ───────────
//
// Measured on 2026-10-13, during a Google capacity spike, with a six-room plan:
//   - Gemini (lib/ai/gemini.ts) — 4 to 43 s depending on load, sometimes
//     every model busy;
//   - NVIDIA's free google/gemma-4-31b-it — all six rooms right in 35–54 s;
//     its free Llama 3.2 11B Vision was unreliable (unreadable or timed out);
//   - OpenRouter's free Gemma 4 — "rate-limited upstream" every time.
// Asked one after another they would not fit in a 60-second request, so they
// are asked at the same time and the first usable answer wins; the others
// are cancelled. OpenRouter, the least available, joins only if nothing has
// answered after a few seconds, to save its small daily allowance.
//
// NVIDIA and OpenRouter need an image (not a PDF): they get the reading copy
// (lib/vision/readingCopy.ts). Each joins only when its key is set.

import { generateWithFailover, GeminiCallError, type GeminiPart } from './gemini';
import { PLAN_READER_MODELS } from '@/lib/vision/model';
import { visionChat } from './openaiCompatible';

export type ImageInput = { mimeType: string; base64: string };

export type ReadRequest = {
  prompt: string;
  /** What the user uploaded — Gemini reads PDFs as well as images. */
  original: ImageInput;
  /** A JPEG of the plan for readers that only take images. */
  readingCopy?: ImageInput;
  maxOutputTokens: number;
  deadlineMs: number;
  accept: (text: string) => boolean;
};

export type ReadResult = { text: string; provider: 'gemini' | 'nvidia' | 'openrouter'; model: string };

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Slow (about a minute) but accurate when they answer, per the 2026-10-18
// benchmark; they mostly matter when every Gemini model is busy. NVIDIA's
// Nemotron VL failed every request there; on OpenRouter it worked.
const NVIDIA_MODELS = ['google/gemma-4-31b-it', 'meta/llama-3.2-90b-vision-instruct'];
const OPENROUTER_MODELS = ['nvidia/nemotron-3.5-super-vl:free', 'dots-studio/dots-3-note-preview:free', 'google/gemma-4-31b-it:free'];
const OPENROUTER_JOINS_AFTER_MS = 8_000;

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

export async function readWithFirstAvailable(request: ReadRequest): Promise<ReadResult> {
  const started = Date.now();
  const remaining = () => request.deadlineMs - (Date.now() - started);
  const done = new AbortController();
  const errors: unknown[] = [];

  const usable = (text: string) => {
    if (!request.accept(text)) throw new GeminiCallError('Reply was not usable', 502);
    return text;
  };

  const readers: Promise<ReadResult>[] = [];

  if (process.env.GOOGLE_GEMINI_API_KEY) readers.push(
    generateWithFailover({
      parts: [{ text: request.prompt }, { inlineData: { mimeType: request.original.mimeType, data: request.original.base64 } }] as GeminiPart[],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: request.maxOutputTokens },
      deadlineMs: request.deadlineMs,
      accept: request.accept,
      signal: done.signal,
      models: PLAN_READER_MODELS,
    }).then((r) => ({ text: r.text, provider: 'gemini' as const, model: r.model })),
  );

  const image = request.readingCopy;
  if (image && process.env.NVIDIA_API_KEY) {
    const apiKey = process.env.NVIDIA_API_KEY;
    readers.push((async () => {
      let last: unknown;
      for (const model of NVIDIA_MODELS) {
        if (done.signal.aborted || remaining() < 4_000) break;
        try {
          const text = await visionChat({ url: NVIDIA_URL, apiKey, model, prompt: request.prompt, image, maxTokens: request.maxOutputTokens, timeoutMs: remaining() - 1_000, signal: done.signal });
          return { text: usable(text), provider: 'nvidia' as const, model };
        } catch (error) { last = error; }
      }
      throw last ?? new GeminiCallError('NVIDIA reader did not answer', 504, 'AbortError');
    })());
  }

  if (image && process.env.OPENROUTER_API_KEY) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    readers.push((async () => {
      await sleep(OPENROUTER_JOINS_AFTER_MS, done.signal);
      let last: unknown;
      for (const model of OPENROUTER_MODELS) {
        if (done.signal.aborted || remaining() < 4_000) break;
        try {
          const text = await visionChat({
            url: OPENROUTER_URL, apiKey, model, prompt: request.prompt, image, maxTokens: request.maxOutputTokens,
            timeoutMs: remaining() - 1_000, signal: done.signal,
            headers: { 'HTTP-Referer': 'https://zimestimate.com', 'X-Title': 'ZimEstimate' },
          });
          return { text: usable(text), provider: 'openrouter' as const, model };
        } catch (error) { last = error; }
      }
      throw last ?? new GeminiCallError('OpenRouter reader did not answer', 504, 'AbortError');
    })());
  }

  try {
    // Prefer Gemini's classified failure when it was configured.
    const winner = await Promise.any(readers.map((p, i) => p.catch((error) => { errors[i] = error; throw error; })));
    done.abort();
    return winner;
  } catch {
    done.abort();
    // Report Gemini's failure: its errors carry the status the plan reader
    // turns into a plain message ("busy", "took too long"…).
    throw errors[0] ?? new GeminiCallError('No reader answered in time.', 504, 'AbortError');
  }
}
