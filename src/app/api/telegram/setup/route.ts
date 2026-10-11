// ─── Register the Telegram webhook ────────────────────────────────────────────
// POST /api/telegram/setup with "Authorization: Bearer <CRON_SECRET>".
// Run once after TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are set (and
// again if either changes). Tells Telegram to send the bot's messages to
// /api/telegram/webhook with the secret, and names the bot's commands.

import { NextResponse } from 'next/server';
import { telegramApi } from '@/lib/server/messaging';
import { getSiteUrl } from '@/lib/siteUrl';

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first.' }, { status: 400 });
  }
  try {
    const webhook = await telegramApi('setWebhook', {
      url: `${getSiteUrl()}/api/telegram/webhook`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    });
    await telegramApi('setMyCommands', {
      commands: [{ command: 'stop', description: 'Stop ZimEstimate reminders here' }],
    });
    const me = await telegramApi('getMe', {});
    return NextResponse.json({ webhook, bot: me });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Telegram setup failed.' }, { status: 502 });
  }
}
