// ─── Telegram bot webhook ─────────────────────────────────────────────────────
// Telegram calls this for every message to the bot. Registered by
// /api/telegram/setup with a secret that Telegram echoes back in the
// X-Telegram-Bot-Api-Secret-Token header; anything without it is ignored.
//
//   /start <code>  links this chat to the account that made the code
//   /stop          stops reminders to this chat
//
// Always answers 200: a non-200 makes Telegram retry the same update.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase';
import { sendTelegram } from '@/lib/server/messaging';

function validSecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const given = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ ok: true });

  const update = await request.json().catch(() => null) as {
    message?: { chat?: { id?: number; type?: string }; text?: string };
  } | null;
  const chatId = update?.message?.chat?.id;
  const text = (update?.message?.text || '').trim();
  if (!chatId || update?.message?.chat?.type !== 'private') return NextResponse.json({ ok: true });

  const db = createServiceRoleClient();
  const reply = (message: string) => sendTelegram(String(chatId), message).catch(() => undefined);

  if (/^\/stop\b/.test(text)) {
    await db.from('profiles').update({ telegram_chat_id: null } as never).eq('telegram_chat_id', String(chatId));
    await reply('Done — ZimEstimate will not send reminders here any more. Connect again from Settings any time.');
    return NextResponse.json({ ok: true });
  }

  const code = /^\/start\s+([A-Za-z0-9_-]{8,64})$/.exec(text)?.[1];
  if (!code) {
    await reply('Hi! To get your ZimEstimate reminders here, open ZimEstimate → Settings → Connect Telegram.');
    return NextResponse.json({ ok: true });
  }

  const { data } = await db
    .from('profiles')
    .select('id, full_name, telegram_link_expires_at')
    .eq('telegram_link_token', code)
    .maybeSingle();
  const profile = data as { id: string; full_name: string | null; telegram_link_expires_at: string | null } | null;
  if (!profile || !profile.telegram_link_expires_at || new Date(profile.telegram_link_expires_at) < new Date()) {
    await reply('That link has expired. Open ZimEstimate → Settings → Connect Telegram to get a new one.');
    return NextResponse.json({ ok: true });
  }

  // One account per chat: release it from any other account first.
  await db.from('profiles').update({ telegram_chat_id: null } as never).eq('telegram_chat_id', String(chatId)).neq('id', profile.id);
  await db.from('profiles')
    .update({ telegram_chat_id: String(chatId), telegram_link_token: null, telegram_link_expires_at: null } as never)
    .eq('id', profile.id);
  await reply(`Connected${profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! Your ZimEstimate project reminders will arrive here. Send /stop to turn them off.`);
  return NextResponse.json({ ok: true });
}
