// ─── Which Gemini models the AI features call, and how ───────────────────────
//
// One list for every feature (plan reader, BOQ/quote scanner, quote matcher,
// describe-your-project, "Why?" on a BOQ line), because model names age out
// and all of them have to move together.
//
// Measured on 2026-10-13 with a six-room plan, during a Google capacity spike:
//   - gemini-flash-lite-latest and gemini-3.5-flash-lite now "think" before
//     answering: 73 s to reply "OK", and no reply to a plan within 60 s. The
//     old chain led with flash-lite-latest on a 20 s limit, so it always timed
//     out and fell to gemini-flash-latest — which answered 503 "high demand".
//     That is the "busy right now" every upload got.
//   - gemini-3.1-flash-lite with thinking off read the plan correctly in 4.5 s
//     when it had capacity; minutes later it too answered 503.
//   - Every full Flash model answered 503 within a second or two, except 3.8
//     (59 s). 2.5-flash and 2.5-flash-lite are retired (404 for new keys).
// So there is no single model that works: the caller tries several fast ones
// in turn — a busy model refuses within a second — and goes round again while
// time allows (lib/ai/gemini.ts).
//
// Newer models take `thinkingLevel`; 3.1-flash-lite takes `thinkingBudget: 0`
// (3.5 and the -latest aliases reject that with 400). Thinking is kept to the
// minimum everywhere: these are reading tasks, and thinking is what made the
// replies take a minute.

export type GeminiModelChoice = {
  model: string;
  /** The thinkingConfig this model accepts for the least thinking. */
  thinking?: { thinkingBudget: number } | { thinkingLevel: 'minimal' | 'low' };
  /** Longest a single attempt may take; the caller's deadline can cut it shorter. */
  timeoutMs: number;
  /**
   * How many more times to ask this model when it answers "busy", before
   * moving to the next one. For a model whose answers are worth a short wait.
   */
  busyRetries?: number;
  /** The pause before each of those, in milliseconds. */
  busyRetryMs?: number;
};

const FAST: GeminiModelChoice[] = [
  { model: 'gemini-3.1-flash-lite', thinking: { thinkingBudget: 0 }, timeoutMs: 22_000 },
  { model: 'gemini-3.1-flash-lite-preview', thinking: { thinkingBudget: 0 }, timeoutMs: 22_000 },
  { model: 'gemini-3-flash-preview', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3.5-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-flash-latest', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3.6-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3.7-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
];

/**
 * Extra capacity: each model has its own free-tier allowance, so a model at
 * the end of the list is a second chance when the ones before it are busy.
 * 3.5-flash-lite thinks for a minute unless told `minimal`; with it, it read
 * plans in 2 s (2026-10-18).
 */
const MORE: GeminiModelChoice[] = [
  { model: 'gemini-3.5-flash-lite', thinking: { thinkingLevel: 'minimal' }, timeoutMs: 18_000 },
  { model: 'gemini-3.8-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
];

/**
 * The fast models, for a second reading of a plan that is compared with the
 * first (lib/vision/planCheck.ts). They answer in a few seconds and do not
 * draw on the allowance of the model that gives the main reading.
 */
export const PLAN_SECOND_READING_MODELS: GeminiModelChoice[] = [
  { model: 'gemini-3.5-flash-lite', thinking: { thinkingLevel: 'minimal' }, timeoutMs: 12_000 },
  { model: 'gemini-3.1-flash-lite', thinking: { thinkingBudget: 0 }, timeoutMs: 12_000 },
];

/** Models tried, in order, by every AI feature. */
export const GEMINI_MODELS: GeminiModelChoice[] = [...FAST, ...MORE];

/**
 * The plan reader's own order, from a benchmark of 72 readings on 2026-10-18
 * (four drawn plans and two phone photos, room sizes checked to 15 cm):
 *   gemini-3.5-flash       44/44 sizes right, 6/6 answered, ~10 s
 *   gemini-3.8-flash       35/36, 5/6 answered (one timeout), ~20 s
 *   gemini-3.5-flash-lite  42/44, 6/6, ~2 s
 *   gemini-3.1-flash-lite  42/44, 6/6, ~3 s
 * Accuracy first, then the fast Lite models for when 3.5 Flash is busy (a busy
 * model refuses within a second, so trying several costs little). Retired or
 * blocked for this key: gemini-2.5-flash (404), gemma-4-31b-it (timed out).
 *
 * Which model answers changes the reading. On 2026-11-11, thirty reads of ten
 * real uploads: one two-storey PDF came back as 90 m² from 3.5 Flash and as
 * 76 and 108 m² from 3.5 Flash-Lite, and a small screenshot as 151 against
 * 163 and 182. Flash was busy for 8 of the 30, and every one of those went
 * straight to a Lite model. A brief busy spell passes within seconds, so
 * when Flash refuses at once it is asked one more time, a moment later,
 * before a Lite model is (lib/ai/gemini.ts).
 */
export const PLAN_READER_MODELS: GeminiModelChoice[] = [
  { model: process.env.GEMINI_PLAN_MODEL?.trim() || 'gemini-3.5-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 24_000, busyRetries: 1, busyRetryMs: 1_200 },
  { model: 'gemini-3.5-flash-lite', thinking: { thinkingLevel: 'minimal' }, timeoutMs: 15_000 },
  { model: 'gemini-3.1-flash-lite', thinking: { thinkingBudget: 0 }, timeoutMs: 15_000 },
  { model: 'gemini-3.8-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3-flash-preview', thinking: { thinkingLevel: 'low' }, timeoutMs: 22_000 },
  { model: 'gemini-3.1-flash-lite-preview', thinking: { thinkingBudget: 0 }, timeoutMs: 15_000 },
  { model: 'gemini-flash-latest', thinking: { thinkingLevel: 'low' }, timeoutMs: 22_000 },
  { model: 'gemini-3.6-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 22_000 },
  { model: 'gemini-3.7-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 22_000 },
];
