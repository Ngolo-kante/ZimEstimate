// ─── Reading a written BOQ ────────────────────────────────────────────────────
// Turns a photo of a bill of quantities — handwritten on site, or printed by a
// quantity surveyor — into line items the app can manage.
//
// Deliberately a different job from analyzeFloorPlan, which derives quantities
// the user does not have by measuring a drawing. Here the numbers already
// exist on the page; the model's job is to read them faithfully and not to
// improve them. That difference drives everything below: no inference, no
// filling gaps, and confidence reported per line so a smudged "40" can be
// checked against the paper the user is holding.
//
// Raw OCR would only get halfway. Tesseract or Cloud Vision return text and
// coordinates, leaving "40 bags cement @ $10" to be parsed into fields across
// every builder's handwriting and column layout. A vision model returns the
// fields directly, which is why this reuses the Gemini client already here
// rather than adding an OCR vendor.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { VISION_MODEL } from './model';

export interface ScannedBoqItem {
  /** Exactly as written on the page, before any catalogue matching. */
  description: string;
  quantity: number;
  unit: string;
  /** Null when the document lists quantities only, which is common for a BOQ. */
  unitPriceUsd: number | null;
  /** 0–100. Low means the text was unclear, not that the number is wrong. */
  confidence: number;
  /** What made it uncertain, for the reviewer: "smudged", "unit ambiguous". */
  note?: string;
}

export interface ScannedBoq {
  /** Whatever the document calls itself, if anything. */
  title: string | null;
  /** Present on supplier quotes, usually absent on a builder's BOQ. */
  supplierName: string | null;
  documentDate: string | null;
  currency: 'USD' | 'ZWG' | null;
  items: ScannedBoqItem[];
  /** Mean of the line confidences — a document-level "how much to trust this". */
  confidence: number;
  /** Set when the image could be read but holds no BOQ at all. */
  notABoq: boolean;
  rawResponse?: string;
}

const BOQ_SCAN_PROMPT = `You are reading a construction Bill of Quantities from Zimbabwe. It may be handwritten on site, or printed by a quantity surveyor or supplier.

Transcribe what is on the page. Do NOT estimate, infer, correct, or complete anything. If a figure is unreadable, say so with low confidence rather than guessing a plausible number. A wrong number that looks confident is far worse than an honest "unclear" — the person reading your output is holding the original and can fix it in seconds.

Return ONLY valid JSON. No markdown, no code fences, no explanation.

{
  "title": "what the document calls itself, or null",
  "supplierName": "supplier or company name if this is a quote, else null",
  "documentDate": "YYYY-MM-DD if a date is shown, else null",
  "currency": "USD" or "ZWG" or null,
  "notABoq": false,
  "items": [
    {
      "description": "the material or work item exactly as written",
      "quantity": 40,
      "unit": "bags",
      "unitPriceUsd": 10.50,
      "confidence": 95,
      "note": "only when something is unclear"
    }
  ]
}

Rules:
- Keep the wording as written. "Cement 32.5N" stays "Cement 32.5N"; do not normalise it to a catalogue name.
- unitPriceUsd is null when the document shows quantities but no prices. Many BOQs do. Do not invent prices.
- If prices are in ZWG, set currency to "ZWG" and put the ZWG figure in unitPriceUsd unchanged. Do not convert.
- Units stay as written: bags, cubes, m2, m3, each, pockets, tonnes, rolls, sheets.
- Ignore subtotal, VAT and grand total rows. Those are computed, not line items.
- confidence is about legibility, not correctness: 95+ for clear print, 70–90 for clear handwriting, below 60 for anything smudged, crossed out, or ambiguous.
- If the image contains no bill of quantities at all — a photo of a wall, a receipt for lunch, a blank page — set notABoq to true and return an empty items array.`;

let genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY environment variable is not set');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/** Strips the code fences the model adds despite being asked not to. */
function parseJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

const asNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Normalised, and defended against a model that returns something unexpected.
 *
 * A row with no description or no quantity is dropped rather than shown as a
 * blank line the user has to work out how to fix.
 */
export function normaliseScannedBoq(raw: unknown): ScannedBoq {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(r.items) ? r.items : [];

  const items: ScannedBoqItem[] = rawItems
    .map((entry): ScannedBoqItem | null => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const description = typeof item.description === 'string' ? item.description.trim() : '';
      const quantity = asNumber(item.quantity);
      if (!description || quantity === null || quantity <= 0) return null;

      const price = asNumber(item.unitPriceUsd);
      const confidence = asNumber(item.confidence);

      return {
        description,
        quantity,
        unit: typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'each',
        // A price of 0 is treated as "not priced" rather than free.
        unitPriceUsd: price !== null && price > 0 ? price : null,
        // Unstated confidence is treated as needing review, not as certainty.
        confidence: confidence === null ? 50 : Math.max(0, Math.min(100, confidence)),
        note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
      };
    })
    .filter((item): item is ScannedBoqItem => item !== null);

  const currency = r.currency === 'ZWG' ? 'ZWG' : r.currency === 'USD' ? 'USD' : null;

  return {
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : null,
    supplierName: typeof r.supplierName === 'string' && r.supplierName.trim() ? r.supplierName.trim() : null,
    documentDate: typeof r.documentDate === 'string' && r.documentDate.trim() ? r.documentDate.trim() : null,
    currency,
    items,
    // Averaged over the lines rather than taken from the model, so the
    // document-level figure cannot disagree with the rows beneath it.
    confidence: items.length
      ? Math.round(items.reduce((sum, i) => sum + i.confidence, 0) / items.length)
      : 0,
    // Trust the flag, but an empty result means the same thing in practice.
    notABoq: r.notABoq === true || items.length === 0,
  };
}

/**
 * Retried on the two failures that mean "ask again", not "stop asking".
 *
 * 503 is the model being busy and 429 is a rate limit with a retry delay
 * attached; both cleared on a second attempt in testing. Everything else — a
 * bad key, a dead model name, an unreadable file — is permanent, and retrying
 * it just makes the user wait three times as long for the same error.
 */
async function generateWithRetry(
  imageBase64: string,
  mimeType: string,
  attempts = 3,
): Promise<string> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: VISION_MODEL });
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await model.generateContent([
        BOQ_SCAN_PROMPT,
        { inlineData: { mimeType, data: imageBase64 } },
      ]);
      return result.response.text();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transient = message.includes('[503') || message.includes('[429');
      if (!transient || attempt === attempts - 1) throw error;

      // 1s, then 3s. Long enough for a demand spike to clear, short enough that
      // someone holding their phone over a document does not give up.
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1000 : 3000));
    }
  }

  throw lastError;
}

export async function extractBoqFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ScannedBoq> {
  const text = await generateWithRetry(imageBase64, mimeType);

  try {
    return { ...normaliseScannedBoq(parseJson(text)), rawResponse: text };
  } catch {
    // Returned as an empty, honest result rather than thrown. The caller shows
    // "we could not read this" and keeps the upload, which is more useful than
    // a stack trace and a lost file.
    console.error('Failed to parse BOQ scan response. Raw text:', text);
    return {
      title: null,
      supplierName: null,
      documentDate: null,
      currency: null,
      items: [],
      confidence: 0,
      notABoq: true,
      rawResponse: text,
    };
  }
}
