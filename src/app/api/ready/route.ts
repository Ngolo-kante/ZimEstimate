import { NextResponse } from 'next/server';
import { getMissingRuntimeEnv, getRuntimeEnvironment } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const missing = getMissingRuntimeEnv();
  const ready = missing.length === 0;

  return NextResponse.json(
    {
      status: ready ? 'ready' : 'not_ready',
      service: 'zimestimate-web',
      environment: getRuntimeEnvironment(),
      missing,
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
