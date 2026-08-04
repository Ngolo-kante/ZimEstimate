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
