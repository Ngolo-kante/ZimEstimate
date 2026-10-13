// ─── Calling Gemini without being stopped by one busy model ──────────────────
//
// Every AI feature goes through here. It calls the REST API directly (the
// SDK this replaced cannot set the thinking options the current models need)
// and works through GEMINI_MODELS:
//
//   - busy (503/500/502/504), rate-limited (429) or too slow → the next model;
//   - retired or unknown to this key (404) → the next model;
//   - rejected settings (400 about thinking) → the same model, once, without them;
//   - a bad key (401/403) or a request it will never accept (other 400) → stop;
//   - a reply that fails the caller's check (unparseable JSON) → the next model.
//
// After a full round with time left it pauses briefly and goes round again —
// Google's capacity spikes come and go within seconds. It never runs past the
// caller's deadline, so a route with a 60-second limit always answers.

import { GEMINI_MODELS, type GeminiModelChoice } from '@/lib/vision/model';

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiCallError extends Error {
  constructor(message: string, readonly status?: number, name = 'GeminiCallError') {
    super(message);
    this.name = name;
  }
}

export type GeminiRequest = {
  parts: GeminiPart[];
  /** responseMimeType, temperature, maxOutputTokens… (thinking is set per model). */
  generationConfig?: Record<string, unknown>;
  /** Give up after this long in total. Keep it under the route's maxDuration. */
  deadlineMs: number;
  /** Return false to treat a reply as unusable and try the next model. */
  accept?: (text: string) => boolean;
  /** For tests and special cases; defaults to GEMINI_MODELS. */
  models?: GeminiModelChoice[];
  /** For tests. */
  fetchImpl?: typeof fetch;
  /** Stops the search early, e.g. when another reader has already answered. */
  signal?: AbortSignal;
};

export type GeminiResult = { text: string; model: string; attempts: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The model's answer, without any "thought" parts. */
function replyText(body: unknown): string {
  const parts = (body as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] })
    ?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
}

export async function generateWithFailover(request: GeminiRequest): Promise<GeminiResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new GeminiCallError('GOOGLE_GEMINI_API_KEY environment variable is not set', 500);

  const doFetch = request.fetchImpl ?? fetch;
  const models = request.models ?? GEMINI_MODELS;
  const started = Date.now();
  const remaining = () => request.deadlineMs - (Date.now() - started);
  const retired = new Set<string>();
  let lastError: GeminiCallError | null = null;
  let attempts = 0;

  const stopped = () => request.signal?.aborted === true;

  for (let round = 0; remaining() > 2_500 && !stopped(); round += 1) {
    if (round > 0) {
      // A short, growing pause between rounds; never more than the time left.
      await sleep(Math.min(800 * round, Math.max(0, remaining() - 2_500)));
    }
    let triedThisRound = 0;

    for (const choice of models) {
      if (stopped()) break;
      if (retired.has(choice.model)) continue;
      const budget = Math.min(choice.timeoutMs, remaining() - 500);
      if (budget < 2_000) break;
      triedThisRound += 1;

      let thinking = choice.thinking;
      for (let settings = 0; settings < 2; settings += 1) {
        attempts += 1;
        let response: Response;
        try {
          response = await doFetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(choice.model)}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: request.parts }],
                generationConfig: { ...(request.generationConfig ?? {}), ...(thinking ? { thinkingConfig: thinking } : {}) },
              }),
              signal: request.signal ? AbortSignal.any([AbortSignal.timeout(budget), request.signal]) : AbortSignal.timeout(budget),
            },
          );
        } catch (error) {
          const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
          lastError = new GeminiCallError(timedOut ? `${choice.model} timed out` : `${choice.model}: ${String(error)}`, undefined, timedOut ? 'AbortError' : 'GeminiCallError');
          console.error('Gemini attempt failed', { model: choice.model, reason: lastError.message.slice(0, 200) });
          break;
        }

        if (response.ok) {
          const text = replyText(await response.json().catch(() => null));
          if (text && (!request.accept || request.accept(text))) {
            return { text, model: choice.model, attempts };
          }
          lastError = new GeminiCallError(`${choice.model} returned an unusable reply`, 502);
          break;
        }

        const status = response.status;
        const message = await response.text().then((t) => t.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '');
        lastError = new GeminiCallError(`${choice.model} answered ${status}: ${message}`, status);
        console.error('Gemini attempt failed', { model: choice.model, status, message: message.slice(0, 160) });

        if (status === 400 && thinking && /thinking|invalid argument/i.test(message)) {
          thinking = undefined; // This model no longer takes those settings; ask it plainly.
          continue;
        }
        if (status === 404) retired.add(choice.model);
        if (status === 401 || status === 403 || (status === 400 && !/thinking/i.test(message))) {
          throw lastError; // Our key or our request — no other model will fix it.
        }
        break; // Busy, rate-limited, retired: next model.
      }
      if (remaining() <= 2_500) break;
    }

    if (triedThisRound === 0) break;
  }

  if (stopped()) throw new GeminiCallError('Stopped: another reader answered first.', undefined, 'AbortError');
  throw lastError ?? new GeminiCallError('No model could be reached in time.', 504, 'AbortError');
}
