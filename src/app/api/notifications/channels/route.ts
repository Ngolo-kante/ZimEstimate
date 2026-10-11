// GET /api/notifications/channels → which reminder channels this deployment
// can send on, so Settings offers only those. Says nothing about credentials.

import { NextResponse } from 'next/server';
import { channelStatus } from '@/lib/server/messaging';

export function GET() {
  return NextResponse.json({ ...channelStatus(), email: Boolean(process.env.RESEND_API_KEY) });
}
