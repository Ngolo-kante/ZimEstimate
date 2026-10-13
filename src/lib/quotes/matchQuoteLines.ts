import { materials } from '@/lib/materials';
import { generateWithFailover } from '@/lib/ai/gemini';
import type { LineMatch, QuoteLine } from './marketCheck';

/**
 * Says which catalogue item each quote line is, and how its unit relates.
 *
 * The only AI step in checking a quote, and deliberately narrow: it does not
 * see or produce any price. Quotes describe the same thing many ways — "PPC
 * Surebuild", "cement 42.5R", "Y12 bars", "brickforce 9 inch" — which is what
 * a model is good at and string matching is not. Everything it returns is
 * checked: an id that is not in the catalogue is dropped, and a unit factor
 * outside a sane range is treated as "cannot compare".
 */

const CATALOGUE = materials.map((m) => `${m.id} | ${m.name} | ${m.unit}${m.specifications ? ` | ${m.specifications}` : ''}`).join('\n');
const IDS = new Set(materials.map((m) => m.id));

function prompt(lines: QuoteLine[]): string {
  return `You match lines from a Zimbabwe construction quote to a catalogue of materials.

For each quote line, decide:
1. "materialId": the catalogue id that is the SAME product — same material, grade and size where those are stated. If no catalogue item is the same product, use null. Do not pick a merely similar item: "cement 42.5R" is not "cement 32.5N"; "Y16" is not "Y12".
2. "unitFactor": how many catalogue units ONE quote unit equals, worked out only from sizes written in the quote line and the catalogue unit. Examples: quote "bags" of 50 kg cement vs catalogue "per 50kg bag" -> 1. Quote "3.6m sheet" vs catalogue "per sheet" of a "3m length" -> 1.2. Quote "lengths" of 6 m bar vs catalogue "per length" of 6 m -> 1. If the sizes needed are not stated, or the units measure different things (e.g. tonnes vs cubes), use null. Never guess a factor.

Catalogue (id | name | unit | specification):
${CATALOGUE}

Quote lines (index | description | unit):
${lines.map((l, i) => `${i} | ${l.description} | ${l.unit}`).join('\n')}

Return ONLY JSON: {"matches":[{"index":0,"materialId":"id-or-null","unitFactor":1}]} with one entry per quote line.`;
}

/** Keeps only answers that refer to real catalogue items and sensible factors. */
export function sanitiseMatches(raw: unknown, lineCount: number): LineMatch[] {
  const result: LineMatch[] = Array.from({ length: lineCount }, () => ({ materialId: null, unitFactor: null }));
  const matches = (raw as { matches?: unknown })?.matches;
  if (!Array.isArray(matches)) return result;
  for (const m of matches) {
    const index = Number((m as { index?: unknown }).index);
    if (!Number.isInteger(index) || index < 0 || index >= lineCount) continue;
    const id = (m as { materialId?: unknown }).materialId;
    const factor = Number((m as { unitFactor?: unknown }).unitFactor);
    const materialId = typeof id === 'string' && IDS.has(id) ? id : null;
    result[index] = {
      materialId,
      // 0.05–50 covers real pack and length conversions; anything outside it
      // is a misreading, and a wrong factor would invent an overcharge.
      unitFactor: materialId && Number.isFinite(factor) && factor >= 0.05 && factor <= 50 ? factor : null,
    };
  }
  return result;
}

export async function matchQuoteLines(lines: QuoteLine[]): Promise<LineMatch[]> {
  if (lines.length === 0) return [];
  // Busy, slow or garbled replies try the next model (lib/ai/gemini.ts).
  const { text } = await generateWithFailover({
    parts: [{ text: prompt(lines) }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4096 },
    deadlineMs: 45_000,
    accept: (reply) => { try { JSON.parse(reply); return true; } catch { return false; } },
  });
  return sanitiseMatches(JSON.parse(text), lines.length);
}
