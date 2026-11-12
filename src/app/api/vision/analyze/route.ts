// Vision Analysis API Route
// POST /api/vision/analyze
// Accepts floor plan image and returns structured room data

import { after, NextRequest, NextResponse } from 'next/server';
import { looksMultiStorey, notAFloorPlan, otherDrawingKind, statedFloorArea } from '@/lib/vision/planFacts';
import { analyzeFloorPlan, analysisFromLabels, PlanReadError, readSecondTime, withRooms } from '@/lib/vision/gemini-client';
import { makeReadingCopy, type ReadingCopy } from '@/lib/vision/readingCopy';
import { readPlanWords } from '@/lib/vision/ocrPlan';
import { isIdentity, toSourceBox, toSourcePoint, type PlanTransform } from '@/lib/vision/planImage';
import { parsePdfWords } from '@/lib/vision/pdfWords';
import { areasFromWords, roomsFromWords, type LabelledArea, type LabelledRoom } from '@/lib/vision/roomLabels';
import { summariseSecondReading, withPrintedSizes, type PrintedSizes } from '@/lib/vision/planCheck';
import { failureStatus, type PlanFailureCode, type PlanPartial, type WrongSheet } from '@/lib/vision/planFailure';
import { PLAN_READER_MODELS } from '@/lib/vision/model';
import type { DetectedRoom, VisionAnalysisResult } from '@/lib/vision/types';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { keepPlanSample } from '@/lib/server/planSamples';
import { planFingerprint, recallPlanReading, rememberPlanReading, worthRemembering } from '@/lib/server/planReadings';

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
/** How long it may wait for the second reading, which is only there to compare. */
const SECOND_READING_GRACE_MS = 6_000;
/** The second reading's own limit: it must never outlast the first. */
const SECOND_READING_DEADLINE_MS = 30_000;
/** With this many sizes printed in a PDF's own text, the plan checks itself and needs no second reading. */
const PRINTED_SIZES_ENOUGH = 3;
/**
 * A total read off a picture is believed only this far above what the rooms
 * add up to. Rooms leave out the walls (a real 90 m² plan's rooms add up to
 * about 70), but a misread digit ("190" for "90") must not price a house.
 */
const OCR_TOTAL_MAX_RATIO = 1.6;

/** What the words on a plan say: its labelled rooms and areas, and all its text. */
type PlanText = { rooms: LabelledRoom[]; areas: LabelledArea[]; text: string };
const NO_TEXT: PlanText = { rooms: [], areas: [], text: '' };

const within = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/** A failed read, with the code the screen chooses its way forward by (planFailure.ts). */
function failed(message: string, code: PlanFailureCode, extra: { sheet?: WrongSheet; partial?: PlanPartial; status?: number } = {}) {
  return NextResponse.json(
    { success: false, error: message, code, ...(extra.sheet ? { sheet: extra.sheet } : {}), ...(extra.partial ? { partial: extra.partial } : {}) },
    { status: extra.status ?? failureStatus(code) },
  );
}

export async function POST(request: NextRequest) {
  // Held for keeping a copy of the plan once the response has gone — see
  // planSamples.ts. Failed reads are kept too: they are the most useful.
  let upload: { bytes: ArrayBuffer; mimeType: string } | null = null;
  // What the plan's own words gave before a read failed, to carry forward.
  let partial: PlanPartial | undefined;

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

    if (!file) return failed('No file provided', 'unreadable', { status: 400 });

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return failed('Invalid file type. Please upload PNG, JPG, or PDF.', 'unreadable', { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return failed('File too large. Maximum size is 10MB.', 'too_large', { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    upload = { bytes: arrayBuffer, mimeType: file.type };

    // The same file gives the same answer: a reading already made of these
    // bytes is given again, unless the person asked for a new one
    // (planReadings.ts).
    const fingerprint = planFingerprint(arrayBuffer);
    if (formData.get('fresh') !== '1') {
      const remembered = await recallPlanReading(fingerprint);
      if (remembered) {
        const kept = upload;
        after(() => keepPlanSample(kept, { outcome: 'read', rooms: remembered.rooms.length, totalArea: remembered.totalArea, remembered: true }));
        return NextResponse.json({ success: true, data: remembered });
      }
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const isPdf = file.type === 'application/pdf';

    // An image copy for the readers that cannot take a PDF: made here from an
    // uploaded image, or sent by the browser, which renders a PDF's first page.
    const sentCopy = formData.get('readingCopy');
    let copy: ReadingCopy | null = null;
    if (!isPdf) copy = await makeReadingCopy(arrayBuffer);
    else if (sentCopy instanceof File && sentCopy.size > 0 && sentCopy.size < 8 * 1024 * 1024) copy = await makeReadingCopy(await sentCopy.arrayBuffer());

    if (copy?.steps.length) console.info('Plan image prepared', { steps: copy.steps });
    // A cropped or straightened copy is what every reader reads, the main one
    // included; positions then come back to the uploaded image (planImage.ts).
    const transform = copy && !isIdentity(copy.transform) ? copy.transform : null;
    const mainReadsCopy = !isPdf && transform !== null;

    // A PDF's own words, sent by the browser: exact, and no reading needed.
    const pdfWords = isPdf ? parsePdfWords(formData.get('pdfText')) : null;

    // Another sheet of the drawing set (septic tank, columns, elevations):
    // say so now rather than after the readers' 52 seconds.
    // The sheet's whole text when the browser sent it; else its placed words.
    const sentText = formData.get('pdfPlainText');
    const pdfText = !isPdf ? ''
      : typeof sentText === 'string' && sentText.trim() ? sentText.slice(0, 30_000)
      : pdfWords ? pdfWords.words.map((word) => word.text).join(' ') : '';
    const wrongSheet = pdfText ? notAFloorPlan(pdfText) : null;
    if (wrongSheet) {
      const kept = upload;
      after(() => keepPlanSample(kept, { outcome: 'failed', error: wrongSheet, code: 'not_floor_plan' }));
      return failed(wrongSheet, 'not_floor_plan', { sheet: otherDrawingKind(pdfText) ?? undefined });
    }

    // The words printed on the plan are read at the same time: to check the
    // scan's sizes, to learn what the plan says about itself, and in case no
    // AI reader answers. A PDF's text is exact; a picture's words are read
    // off it (ocrPlan.ts), which most uploads, being screenshots, need.
    const pdfRooms = pdfWords ? roomsFromWords(pdfWords.words, pdfWords) : [];
    const pdfAreas = pdfWords ? areasFromWords(pdfWords.words, pdfWords) : [];
    const fromPdfText = pdfRooms.length > 0 || pdfAreas.length > 0;
    const backOnSource = <T extends { at: { x: number; y: number } }>(found: T[]): T[] => transform
      ? found.map((item) => { const at = toSourcePoint({ x: item.at.x * 100, y: item.at.y * 100 }, transform); return { ...item, at: { x: at.x / 100, y: at.y / 100 } }; })
      : found;
    const words: Promise<PlanText> = fromPdfText
      ? Promise.resolve({ rooms: pdfRooms, areas: pdfAreas, text: pdfText })
      : copy
        ? readPlanWords(copy)
          .then((read) => ({
            rooms: backOnSource(roomsFromWords(read.words, read)),
            areas: backOnSource(areasFromWords(read.words, read)),
            // A PDF with no text layer still has the words in its picture.
            text: pdfText || read.words.map((word) => word.text).join(' ').slice(0, 30_000),
          }))
          .catch((error) => { console.error('Label reading failed', error instanceof Error ? error.message : error); return { ...NO_TEXT, text: pdfText }; })
        : Promise.resolve({ ...NO_TEXT, text: pdfText });

    const original = mainReadsCopy && copy ? { mimeType: copy.mimeType, base64: copy.base64 } : { mimeType: file.type, base64 };
    const stop = new AbortController();
    const reading = analyzeFloorPlan(original, copy ? { mimeType: copy.mimeType, base64: copy.base64 } : undefined, stop.signal);
    // The plan checks itself when enough sizes are printed in its own text;
    // otherwise a second reading is what there is to compare with.
    const second: Promise<DetectedRoom[] | null> = pdfRooms.length >= PRINTED_SIZES_ENOUGH
      ? Promise.resolve(null)
      : readSecondTime(original, SECOND_READING_DEADLINE_MS, stop.signal);

    // A picture of another sheet says so in its words, usually well before
    // the readers give up on it: stop them and send the person to the right
    // page. Only on words that clearly name another drawing and no room.
    const pictureOfAnotherSheet = isPdf ? null : await Promise.race([
      reading.then(() => null, () => null),
      words.then((read) => (read.text && notAFloorPlan(read.text) ? read.text : new Promise<null>(() => {}))),
    ]);
    if (pictureOfAnotherSheet) {
      stop.abort();
      void reading.catch(() => {});
      const message = notAFloorPlan(pictureOfAnotherSheet) ?? 'This does not look like a floor plan.';
      const kept = upload;
      after(() => keepPlanSample(kept, { outcome: 'failed', error: message, code: 'not_floor_plan' }));
      return failed(message, 'not_floor_plan', { sheet: otherDrawingKind(pictureOfAnotherSheet) ?? undefined });
    }

    let result: VisionAnalysisResult;
    try {
      result = await reading;
      if (transform && (mainReadsCopy || result.reader?.provider !== 'gemini')) result = onSourceImage(result, transform);
    } catch (readError) {
      stop.abort();
      // Every AI reader busy or failed: use the names and sizes printed on
      // the plan if there are enough of them to be worth reviewing.
      const read = await words;
      if (read.rooms.length < 2) {
        // Too few to stand as a reading, but not nothing: what the plan
        // prints goes back with the failure, to start the person's own entry.
        const stated = statedFloorArea(read.text, 0);
        if (read.rooms.length > 0 || (stated !== null && pdfText)) {
          partial = {
            ...(read.rooms.length > 0 ? { rooms: read.rooms.map((room) => ({ name: room.name, width: room.width, length: room.length })) } : {}),
            // Only a total from a PDF's own text: with no rooms to weigh it against, one read off a picture cannot be checked.
            ...(stated !== null && pdfText ? { statedTotalAreaM2: stated } : {}),
          };
        }
        throw readError;
      }
      console.info('Plan read from its labels', { rooms: read.rooms.length });
      result = analysisFromLabels(read.rooms);
    }

    if (result.source === 'ai' && !(result.reader?.provider === 'gemini' && result.reader.model === PLAN_READER_MODELS[0].model)) result.backupReader = true;

    const read = await within(words, LABELS_GRACE_MS, { ...NO_TEXT, text: pdfText });
    const printed: PrintedSizes['rooms'] = read.rooms.map((room) => ({ name: room.name, width: room.width, length: room.length, at: { x: room.at.x * 100, y: room.at.y * 100 } }));
    // Drawing programs stamp rooms with an area, not a size: checked too.
    for (const room of read.areas) printed.push({ name: room.name, area: room.area, at: { x: room.at.x * 100, y: room.at.y * 100 } });
    if (printed.length > 0) result.printed = { source: fromPdfText ? 'pdf-text' : 'ocr', rooms: printed };

    // A size printed on the plan beside a room's own name is that room's
    // size: it goes into the scan, so the estimate starts from the plan's
    // figure and not from whichever way the reader happened to see it.
    if (result.source !== 'labels') {
      const fitted = withPrintedSizes(result.rooms, result.printed);
      if (fitted.applied > 0) {
        console.info('Printed sizes applied', { rooms: fitted.applied });
        result = withRooms(result, fitted.rooms);
      }
    }

    // What the plan says about itself: its total floor area, and whether it
    // has a stair (more than one floor).
    const statedArea = statedFloorArea(read.text, result.totalArea);
    if (statedArea !== null && (pdfText || statedArea <= result.totalArea * OCR_TOTAL_MAX_RATIO)) {
      result.statedTotalAreaM2 = statedArea;
      result.statedTotalAreaSource = pdfText ? 'pdf-text' : 'ocr';
    }
    if (looksMultiStorey(read.text, [...result.rooms.map((room) => room.name), ...printed.map((room) => room.name)])) result.multiStorey = true;

    // The second reading, if it has come or comes shortly.
    if (result.source !== 'labels') {
      const other = await within(second, SECOND_READING_GRACE_MS, null);
      if (other && other.length > 0) {
        const onSource = transform && mainReadsCopy ? other.map((room) => ({ ...room, position: toSourceBox(room.position, transform) })) : other;
        result.secondReading = summariseSecondReading(result.rooms, onSource);
      }
    }
    stop.abort();

    const { rawResponse: _rawResponse, ...data } = result;
    void _rawResponse;

    const kept = upload;
    after(async () => {
      if (worthRemembering(data, PLAN_READER_MODELS[0].model)) await rememberPlanReading(fingerprint, data);
      await keepPlanSample(kept, {
        outcome: data.source === 'labels' ? 'read-from-labels' : 'read',
        rooms: data.rooms.length,
        totalArea: data.totalArea,
        confidence: data.confidence,
        reader: data.reader ? `${data.reader.provider}:${data.reader.model}` : undefined,
        secondAgreed: data.secondReading?.agreed,
        secondDiffered: data.secondReading?.differing.length,
      });
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Vision analysis error:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
    // The reader's own classification; anything else is a plain failure.
    const code: PlanFailureCode = error instanceof PlanReadError ? error.code : 'unreadable';
    if (upload) {
      const kept = upload;
      after(() => keepPlanSample(kept, { outcome: 'failed', error: message, code }));
    }
    return failed(message, code, { partial });
  }
}
