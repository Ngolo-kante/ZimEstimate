// Vision Analysis API Route
// POST /api/vision/analyze
// Accepts floor plan image and returns structured room data

import { after, NextRequest, NextResponse } from 'next/server';
import { analyzeFloorPlan, analysisFromLabels } from '@/lib/vision/gemini-client';
import { makeReadingCopy, type ReadingCopy } from '@/lib/vision/readingCopy';
import { readPlanLabels } from '@/lib/vision/ocrPlan';
import { isIdentity, toSourceBox, toSourcePoint, type PlanTransform } from '@/lib/vision/planImage';
import { parsePdfWords } from '@/lib/vision/pdfWords';
import { areasFromWords, roomsFromWords, type LabelledRoom } from '@/lib/vision/roomLabels';
import type { PrintedSizes } from '@/lib/vision/planCheck';
import type { VisionAnalysisResult } from '@/lib/vision/types';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { keepPlanSample } from '@/lib/server/planSamples';

/* The readers share a 52-second deadline (lib/ai/planReaders.ts); this is
   that plus the upload. Without it the platform default decided, and a user
   could wait on a request the reader had already abandoned. */
export const maxDuration = 60;
export const runtime = 'nodejs';

/** Positions on the prepared reading copy, put back on the uploaded image. */
function onSourceImage(result: VisionAnalysisResult, t: PlanTransform): VisionAnalysisResult {
  return {
    ...result,
    rooms: result.rooms.map((room) => ({ ...room, position: toSourceBox(room.position, t) })),
    walls: result.walls.map((wall) => ({ ...wall, startPoint: toSourcePoint(wall.startPoint, t), endPoint: toSourcePoint(wall.endPoint, t) })),
  };
}

/** How long the answer may wait for the label reader once a reader has answered. */
const LABELS_GRACE_MS = 3_000;

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

    if (copy?.steps.length) console.info('Plan image prepared', { steps: copy.steps });
    // A cropped or straightened copy is what every reader reads, the main one
    // included; positions then come back to the uploaded image (planImage.ts).
    const transform = copy && !isIdentity(copy.transform) ? copy.transform : null;
    const mainReadsCopy = file.type !== 'application/pdf' && transform !== null;

    // A PDF's own words, sent by the browser: exact, and no reading needed.
    const pdfWords = file.type === 'application/pdf' ? parsePdfWords(formData.get('pdfText')) : null;

    // The printed labels are read at the same time: to check the scan's sizes,
    // and in case no AI reader answers.
    const pdfRooms = pdfWords ? roomsFromWords(pdfWords.words, pdfWords) : [];
    const pdfAreas = pdfWords ? areasFromWords(pdfWords.words, pdfWords) : [];
    const labels: Promise<LabelledRoom[]> = pdfRooms.length > 0
      ? Promise.resolve(pdfRooms)
      : copy
        ? readPlanLabels(copy)
          .then((found) => transform
            ? found.map((room) => { const at = toSourcePoint({ x: room.at.x * 100, y: room.at.y * 100 }, transform); return { ...room, at: { x: at.x / 100, y: at.y / 100 } }; })
            : found)
          .catch((error) => { console.error('Label reading failed', error instanceof Error ? error.message : error); return []; })
        : Promise.resolve([]);

    let result: VisionAnalysisResult;
    try {
      result = await analyzeFloorPlan(
        mainReadsCopy && copy ? { mimeType: copy.mimeType, base64: copy.base64 } : { mimeType: file.type, base64 },
        copy ? { mimeType: copy.mimeType, base64: copy.base64 } : undefined,
      );
      if (transform && (mainReadsCopy || result.reader?.provider !== 'gemini')) result = onSourceImage(result, transform);
    } catch (readError) {
      // Every AI reader busy or failed: use the names and sizes printed on
      // the plan if there are enough of them to be worth reviewing.
      const fromLabels = await labels;
      if (fromLabels.length < 2) throw readError;
      console.info('Plan read from its labels', { rooms: fromLabels.length });
      result = analysisFromLabels(fromLabels);
    }
    const printed: PrintedSizes['rooms'] = (await Promise.race([
      labels,
      new Promise<LabelledRoom[]>((resolve) => setTimeout(() => resolve([]), LABELS_GRACE_MS)),
    ])).map((room) => ({ name: room.name, width: room.width, length: room.length, at: { x: room.at.x * 100, y: room.at.y * 100 } }));
    // Drawing programs stamp rooms with an area, not a size: checked too.
    for (const room of pdfAreas) printed.push({ name: room.name, area: room.area, at: { x: room.at.x * 100, y: room.at.y * 100 } });
    if (printed.length > 0) result.printed = { source: pdfRooms.length > 0 || pdfAreas.length > 0 ? 'pdf-text' : 'ocr', rooms: printed };

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
