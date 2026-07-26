import { NextResponse } from 'next/server';
import {
  getMissingRuntimeEnv,
  getMissingOptionalRuntimeEnv,
  getRuntimeEnvironment,
} from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const missing = getMissingRuntimeEnv();
  const missingOptional = getMissingOptionalRuntimeEnv();
  const ready = missing.length === 0;

  return NextResponse.json(
    {
      status: ready ? 'ready' : 'not_ready',
      service: 'zimestimate-web',
      environment: getRuntimeEnvironment(),
      missing,
      missingOptional,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
