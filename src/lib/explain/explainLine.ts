import { generateWithFailover } from '@/lib/ai/gemini';
import { buildLineFacts, type ExplainLineInput, type ExplainProjectInput } from './lineFacts';

/**
 * "Why is this on my estimate?" in plain words, from the facts lineFacts.ts
 * builds and nothing else. Temperature 0, and told to say a figure is a
 * standard allowance rather than invent a calculation it was not given.
 */

export interface LineExplanation {
  /** Why this quantity: two or three sentences. */
  why: string;
  /** What it is used for on site, in one sentence. */
  onSite: string;
  /** What in the person's own choices would change it. */
  changesIt: string[];
}

function prompt(facts: string[]): string {
  return `You explain one line of a construction cost estimate for a house in Zimbabwe to the person who owns the estimate. Many are first-time builders; write simply, as a helpful quantity surveyor would.

Use ONLY these facts about the line and the estimate:
${facts.map((f) => `- ${f}`).join('\n')}

Rules:
- Explain how the quantity follows from the facts. You may do simple arithmetic with the numbers given; never introduce a measurement, rate or price that is not in the facts.
- Describe what the line covers from the calculator's words, not from the section name: the same material often appears on several lines for different parts of the work.
- If the facts do not fully explain the exact number, say which facts it is based on and that the rest is a standard allowance. Do not guess a formula.
- Do not name shops or suppliers. Do not give safety, legal or engineering sign-off advice.
- Plain English, short sentences, no markdown.

Return ONLY JSON: {"why": "2-3 sentences", "onSite": "1 sentence on what it is used for on site", "changesIt": ["up to 3 short things in their own choices that would change this line"]}`;
}

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

export function parseExplanation(raw: unknown): LineExplanation | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const why = clean(r.why, 700);
  if (!why) return null;
  return {
    why,
    onSite: clean(r.onSite, 300),
    changesIt: Array.isArray(r.changesIt) ? r.changesIt.map((c) => clean(c, 160)).filter(Boolean).slice(0, 3) : [],
  };
}

export async function explainLine(line: ExplainLineInput, project: ExplainProjectInput): Promise<LineExplanation> {
  const text = prompt(buildLineFacts(line, project));
  const readable = (reply: string) => { try { return parseExplanation(JSON.parse(reply)) !== null; } catch { return false; } };
  // Busy, slow or garbled replies try the next model (lib/ai/gemini.ts).
  const { text: reply } = await generateWithFailover({
    parts: [{ text }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 1024 },
    deadlineMs: 40_000,
    accept: readable,
  });
  return parseExplanation(JSON.parse(reply)) as LineExplanation;
}
