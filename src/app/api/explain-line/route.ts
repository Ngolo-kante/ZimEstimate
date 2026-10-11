// ─── Explain an estimate line ─────────────────────────────────────────────────
// POST /api/explain-line  { line, project }
// "Why is this on my estimate?" — a plain-words explanation of one line, from
// facts the server builds out of the estimate's own inputs and the calculator's
// assumptions (src/lib/explain). Same rate limit and CSRF gate as the other AI
// endpoints; no account needed, like the estimate itself.

import { NextRequest, NextResponse } from 'next/server';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { explainLine } from '@/lib/explain/explainLine';
import type { ExplainLineInput, ExplainProjectInput } from '@/lib/explain/lineFacts';

export const maxDuration = 60;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const positive = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
};

function readInput(body: unknown): { line: ExplainLineInput; project: ExplainProjectInput } | null {
  const l = (body as { line?: Record<string, unknown> })?.line;
  const p = (body as { project?: Record<string, unknown> })?.project ?? {};
  if (!l) return null;
  const materialName = text(l.materialName, 120);
  const quantity = positive(l.quantity, 10_000_000);
  const unitPriceUsd = positive(l.unitPriceUsd, 1_000_000);
  if (!materialName || quantity === undefined || unitPriceUsd === undefined) return null;
  return {
    line: {
      materialId: text(l.materialId, 80),
      materialName,
      quantity,
      unit: text(l.unit, 40),
      unitPriceUsd,
      stage: text(l.stage, 40),
      note: text(l.note, 300) || undefined,
      calculatedQuantity: positive(l.calculatedQuantity, 10_000_000),
    },
    project: {
      floorAreaM2: positive(p.floorAreaM2, 10_000) || undefined,
      wallHeightM: positive(p.wallHeightM, 20) || undefined,
      locationType: text(p.locationType, 20) || undefined,
      finishLevel: text(p.finishLevel, 20) || undefined,
      brickType: text(p.brickType, 40) || undefined,
      stages: Array.isArray(p.stages) ? p.stages.map((s) => text(s, 40)).filter(Boolean).slice(0, 8) : undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRateLimit(request, { keyPrefix: 'explain-line', limit: 20, windowMs: 60_000 });
    if (rateLimit) return rateLimit;

    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'Explanations are not configured on this server.' }, { status: 500 });
    }

    const input = readInput(await request.json().catch(() => null));
    if (!input) return NextResponse.json({ success: false, error: 'That line could not be read.' }, { status: 400 });

    const explanation = await explainLine(input.line, input.project);
    return NextResponse.json({ success: true, data: explanation });
  } catch (error) {
    console.error('Explain line error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not explain this line right now. Please try again in a minute.' },
      { status: 500 },
    );
  }
}
