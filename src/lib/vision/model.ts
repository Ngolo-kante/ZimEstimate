// ─── Which Gemini model the vision features call ─────────────────────────────
//
// One place, because model names age out and both callers have to move
// together. Pinning 'gemini-2.0-flash' quietly stopped working: the API now
// answers it with 429 and `limit: 0` — not a used-up allowance but no free-tier
// allocation at all — while 'gemini-2.5-flash' answers 404 "no longer available
// to new users". Vision Takeoff had been failing on that for anyone without
// billing enabled, and the failure looks like a quota problem rather than a
// dead model name, which is why it is easy to miss.
//
// The -latest aliases track whatever Google currently serves, so they survive
// the next rotation. Overridable by env for when a specific version is wanted
// without a deploy.
export const VISION_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';

/**
 * Which models read floor plans, in the order they are tried.
 *
 * Flash-Lite first. Measured on the same plan on 2026-10-11: Flash-Lite
 * (gemini-3.5-flash-lite) read it in 1.6 seconds; full Flash
 * (gemini-3.8-flash) took 108 seconds, spending most of it "thinking", and on
 * retries answered 503 "high demand" after 43 and 75 seconds. Both returned
 * the same six rooms with the same dimensions. Full Flash stays as the
 * fallback for when Lite is unavailable.
 *
 * Each attempt has its own limit, and together they fit inside the route's
 * 60-second maximum, so a user is never left waiting on a reader that has
 * already given up. GEMINI_PLAN_MODEL overrides the first choice.
 */
export const PLAN_MODELS: { model: string; timeoutMs: number }[] = [
  { model: process.env.GEMINI_PLAN_MODEL?.trim() || 'gemini-flash-lite-latest', timeoutMs: 20_000 },
  { model: VISION_MODEL, timeoutMs: 32_000 },
];
