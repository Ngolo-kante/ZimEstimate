// ─── Describe your project ────────────────────────────────────────────────────
// POST /api/describe-project  { text }
// Reads a one-sentence description into fields (src/lib/describe) and returns
// the estimate page to open, with what was understood. Same rate limit and
// CSRF gate as the other AI endpoints; no account needed.

import { NextRequest, NextResponse } from 'next/server';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { describeProject, MAX_DESCRIPTION_LENGTH } from '@/lib/describe/describeProject';
import { routeProject } from '@/lib/describe/routeProject';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRateLimit(request, { keyPrefix: 'describe-project', limit: 15, windowMs: 60_000 });
    if (rateLimit) return rateLimit;

    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'This is not configured on this server.' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
    if (text.length < 3 || text.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Describe your project in up to ${MAX_DESCRIPTION_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const intent = await describeProject(text);
    return NextResponse.json({ success: true, data: { kind: intent.kind, route: routeProject(intent) } });
  } catch (error) {
    console.error('Describe project error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not read that right now. Pick from the list below instead.' },
      { status: 500 },
    );
  }
}
