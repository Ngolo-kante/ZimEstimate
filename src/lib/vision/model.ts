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
};

const FAST: GeminiModelChoice[] = [
  { model: process.env.GEMINI_PLAN_MODEL?.trim() || 'gemini-3.1-flash-lite', thinking: { thinkingBudget: 0 }, timeoutMs: 22_000 },
  { model: 'gemini-3.1-flash-lite-preview', thinking: { thinkingBudget: 0 }, timeoutMs: 22_000 },
  { model: 'gemini-3-flash-preview', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3.5-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-flash-latest', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3.6-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
  { model: 'gemini-3.7-flash', thinking: { thinkingLevel: 'low' }, timeoutMs: 26_000 },
];

/** Models tried, in order, by every AI feature. */
export const GEMINI_MODELS: GeminiModelChoice[] = FAST;
