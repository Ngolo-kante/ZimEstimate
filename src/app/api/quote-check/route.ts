// ─── Quote check API ──────────────────────────────────────────────────────────
// POST /api/quote-check
// Takes the lines of a builder's or supplier's quote (already read off the
// page by /api/vision/scan-boq, and checked by the person) and says, line by
// line, whether each price is above, within or below the market range.
//
// The model only matches each line to a catalogue item; every price in the
// answer comes from the quote or the catalogue (src/lib/quotes/marketCheck.ts).
// Same rate limit and CSRF gate as the other AI endpoints, and no account
// needed, like every other way into an estimate.

import { NextRequest, NextResponse } from 'next/server';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';
import { checkLine, summariseCheck, type QuoteLine } from '@/lib/quotes/marketCheck';
import { matchQuoteLines } from '@/lib/quotes/matchQuoteLines';

const MAX_LINES = 100;

/* Room for the matcher's two attempts. */
export const maxDuration = 60;

function readLines(body: unknown): QuoteLine[] | null {
  const raw = (body as { lines?: unknown })?.lines;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) return null;
  const lines: QuoteLine[] = [];
  for (const item of raw) {
    const description = typeof item?.description === 'string' ? item.description.trim().slice(0, 200) : '';
    const unit = typeof item?.unit === 'string' ? item.unit.trim().slice(0, 40) : '';
    const quantity = Number(item?.quantity);
    const price = item?.unitPriceUsd === null || item?.unitPriceUsd === undefined || item?.unitPriceUsd === ''
      ? null
      : Number(item.unitPriceUsd);
    if (!description || !Number.isFinite(quantity) || quantity < 0) return null;
    if (price !== null && (!Number.isFinite(price) || price < 0)) return null;
    lines.push({ description, quantity, unit, unitPriceUsd: price });
  }
  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRateLimit(request, {
      keyPrefix: 'quote-check',
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const csrf = enforceCsrf(request);
    if (csrf) return csrf;

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'Quote checking is not configured on this server.' }, { status: 500 });
    }

    const lines = readLines(await request.json().catch(() => null));
    if (!lines) {
      return NextResponse.json(
        { success: false, error: `Send between 1 and ${MAX_LINES} lines, each with a description and quantity.` },
        { status: 400 },
      );
    }

    const matches = await matchQuoteLines(lines);
    const checked = lines.map((line, i) => checkLine(line, matches[i]));
    return NextResponse.json({ success: true, data: { lines: checked, summary: summariseCheck(checked) } });
  } catch (error) {
    console.error('Quote check error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not check the quote right now. Please try again in a minute.' },
      { status: 500 },
    );
  }
}
