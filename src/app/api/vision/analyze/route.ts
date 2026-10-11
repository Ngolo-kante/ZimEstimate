// Vision Analysis API Route
// POST /api/vision/analyze
// Accepts floor plan image and returns structured room data

import { NextRequest, NextResponse } from 'next/server';
import { analyzeFloorPlan } from '@/lib/vision/gemini-client';
import { enforceCsrf, enforceRateLimit } from '@/lib/server/security';

/* Room for the plan reader's two attempts (20 s, then 32 s) and the upload.
   Without this the platform default decided, and a user could wait on a
   request the reader had already abandoned. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
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

    // Check for API key
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API key not configured. Please add GOOGLE_GEMINI_API_KEY to environment variables.',
        },
        { status: 500 }
      );
    }

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
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Analyze with Gemini
    const result = await analyzeFloorPlan(base64, file.type);
    const { rawResponse: _rawResponse, ...data } = result;
    void _rawResponse;

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Vision analysis error:', error);
    const message = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
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

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
