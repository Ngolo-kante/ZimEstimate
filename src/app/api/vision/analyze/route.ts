// Vision Analysis API Route
// POST /api/vision/analyze
// Accepts floor plan image and returns structured room data

import { after, NextRequest, NextResponse } from 'next/server';
import { analyzeFloorPlan, analysisFromLabels } from '@/lib/vision/gemini-client';
import { makeReadingCopy, type ReadingCopy } from '@/lib/vision/readingCopy';
import { readPlanLabels } from '@/lib/vision/ocrPlan';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { keepPlanSample } from '@/lib/server/planSamples';

/* The readers share a 52-second deadline (lib/ai/planReaders.ts); this is
   that plus the upload. Without it the platform default decided, and a user
   could wait on a request the reader had already abandoned. */
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Held for keeping a copy of the plan once the response has gone — see
  // planSamples.ts. Failed reads are kept too: they are the most useful.
  let upload: { bytes: ArrayBuffer; mimeType: string } | null = null;

  try {
    // No requireAuth: reading a floor plan is free to try, same as the manual
    // builder and quick projects. Only saving the resulting project needs an
    // account. Rate limiting below is IP-based and is what actually bounds
    // cost, not the auth check that used to sit here.
    const rateLimit = await enforceRateLimit(request, {
      keyPrefix: 'vision:analyze',
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload PNG, JPG, or PDF.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    upload = { bytes: arrayBuffer, mimeType: file.type };
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // An image copy for the readers that cannot take a PDF: made here from an
    // uploaded image, or sent by the browser, which renders a PDF's first page.
    const sentCopy = formData.get('readingCopy');
    let copy: ReadingCopy | null = null;
    if (file.type !== 'application/pdf') copy = await makeReadingCopy(arrayBuffer);
    else if (sentCopy instanceof File && sentCopy.size > 0 && sentCopy.size < 8 * 1024 * 1024) copy = await makeReadingCopy(await sentCopy.arrayBuffer());

    // The printed labels are read at the same time, in case no AI reader answers.
    const labels = copy
      ? readPlanLabels(copy).catch((error) => { console.error('Label reading failed', error instanceof Error ? error.message : error); return []; })
      : Promise.resolve([]);

    let result;
    try {
      result = await analyzeFloorPlan(
        { mimeType: file.type, base64 },
        copy ? { mimeType: copy.mimeType, base64: copy.base64 } : undefined,
      );
    } catch (readError) {
      // Every AI reader busy or failed: use the names and sizes printed on
      // the plan if there are enough of them to be worth reviewing.
      const fromLabels = await labels;
      if (fromLabels.length < 2) throw readError;
      console.info('Plan read from its labels', { rooms: fromLabels.length });
      result = analysisFromLabels(fromLabels);
    }
    const { rawResponse: _rawResponse, ...data } = result;
    void _rawResponse;

    const kept = upload;
    after(() => keepPlanSample(kept, {
      outcome: data.source === 'labels' ? 'read-from-labels' : 'read',
      rooms: data.rooms.length,
      totalArea: data.totalArea,
      confidence: data.confidence,
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Vision analysis error:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
    if (upload) {
      const kept = upload;
      after(() => keepPlanSample(kept, { outcome: 'failed', error: message }));
    }
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      // The reader's own messages: "took too long" is a timeout, "busy" or
      // "limit" a temporary outage; everything else a plain failure.
      { status: /took too long/i.test(message) ? 504 : /busy|limit/i.test(message) ? 503 : 500 }
    );
  }
}
