import { NextResponse } from 'next/server';
import { getRuntimeEnvironment } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'zimestimate-web',
      environment: getRuntimeEnvironment(),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
