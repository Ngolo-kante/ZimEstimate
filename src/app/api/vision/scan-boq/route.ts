// ─── BOQ scan API ─────────────────────────────────────────────────────────────
// POST /api/vision/scan-boq
// Accepts a photo of a written bill of quantities and returns its line items.
//
// Mirrors /api/vision/analyze deliberately: same rate limit, same CSRF and auth
// gates, same file validation. Two endpoints doing near-identical intake work
// differently is how one of them ends up without a size check.

import { NextRequest, NextResponse } from 'next/server';
import { extractBoqFromImage } from '@/lib/vision/boq-scan';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // No requireAuth: scanning a document is free to try, matching Vision
    // Takeoff and every other estimate path in the app — only saving the
    // project it produces needs an account. Each scan is still a paid model
    // call, so the rate limit below (not auth) is what actually bounds cost.
    const rateLimit = enforceRateLimit(request, {
      keyPrefix: 'vision:scan-boq',
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Scanning is not configured on this server.' },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Please upload a PNG, JPG or PDF.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'That file is over 10MB. Try a smaller photo.' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const result = await extractBoqFromImage(base64, file.type);

    // rawResponse is for our logs, not the browser: it is the model's unparsed
    // output and has no use on the client.
    const { rawResponse, ...data } = result;
    if (data.notABoq) console.warn('BOQ scan found nothing usable. Raw:', rawResponse);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('BOQ scan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not read that document. Please try again.',
      },
      { status: 500 },
    );
  }
}
