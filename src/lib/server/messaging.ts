// ─── SMS, WhatsApp and Telegram ───────────────────────────────────────────────
//
// One place for every non-email channel, used by the reminder sweep, the
// notification queue and the "send me a test" button in Settings.
//
// SMS: SMSPoP (smspop.co.zw), a Zimbabwean gateway — about $0.02–0.03 a
//   message to Econet and NetOne, paid by EcoCash/Paynow. Twilio is kept as a
//   fallback but costs about $0.32 a message to Zimbabwe.
// WhatsApp: Meta's Cloud API directly (no reseller markup). A business may
//   only start a conversation with an approved template, so reminders go out
//   as the template named in WHATSAPP_TEMPLATE_NAME with two variables:
//   {{1}} a title, {{2}} the message. Free-text sends, which is what this
//   did before, are refused by Meta outside a 24-hour reply window.
// Telegram: the Bot API, free. People connect from Settings (see
//   /api/telegram/link and the webhook), so nobody has to find a chat ID.

const GRAPH = (process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0').replace(/\/+$/, '');

export type MessagingChannel = 'sms' | 'whatsapp' | 'telegram';

export function channelStatus(): Record<MessagingChannel, boolean> {
  return {
    sms: Boolean(
      (process.env.SMSPOP_API_TOKEN && process.env.SMSPOP_SENDER_ID) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM),
    ),
    whatsapp: Boolean(
      (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM),
    ),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  };
}

/**
 * To international format, reading local Zimbabwean numbers as +263.
 * "0771 234 567" → "+263771234567". This used to prefix "+" to whatever was
 * typed, turning the usual local form into "+0771234567", which no gateway
 * can deliver to.
 */
export function toInternationalPhone(raw: string): string {
  const cleaned = (raw || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('263')) return `+${cleaned}`;
  if (/^0\d{9}$/.test(cleaned)) return `+263${cleaned.slice(1)}`;
  if (/^7\d{8}$/.test(cleaned)) return `+263${cleaned}`;
  return `+${cleaned}`;
}

async function failure(response: Response, provider: string): Promise<Error> {
  const detail = await response.text().catch(() => '');
  return new Error(`${provider} refused the message (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
}

async function sendTwilio(to: string, from: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio is not configured.');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!response.ok) throw await failure(response, 'Twilio');
}

export async function sendSms(phone: string, text: string): Promise<void> {
  const to = toInternationalPhone(phone);
  if (!to) throw new Error('No phone number for SMS.');

  if (process.env.SMSPOP_API_TOKEN && process.env.SMSPOP_SENDER_ID) {
    const response = await fetch('https://smspop.co.zw/api/campaigns', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SMSPOP_API_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `ZimEstimate ${new Date().toISOString().slice(0, 16)}`,
        message: text.slice(0, 2000),
        sender_id: process.env.SMSPOP_SENDER_ID,
        contact_import_method: 'manual',
        manual_contacts: to.replace(/^\+/, ''),
      }),
    });
    if (!response.ok) throw await failure(response, 'SMSPoP');
    // A 200 can still carry a number SMSPoP would not send to: it only
    // reaches Econet and NetOne, and ignores anything else as invalid.
    const result = await response.json().catch(() => null) as { data?: { summary?: { sent?: number; invalid?: number; failed?: number } } } | null;
    const summary = result?.data?.summary;
    if (summary && !summary.sent) {
      throw new Error(summary.invalid
        ? 'SMSPoP could not send to this number (it reaches Econet and NetOne numbers only).'
        : 'SMSPoP did not send the message.');
    }
    return;
  }

  const twilioFrom = process.env.TWILIO_SMS_FROM;
  if (twilioFrom) return sendTwilio(to, twilioFrom, text);
  throw new Error('SMS is not set up yet.');
}

/** WhatsApp template variables may not hold newlines, tabs or long runs of spaces. */
function templateText(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max) || '-';
}

export async function sendWhatsApp(phone: string, message: { title: string; body: string }): Promise<void> {
  const to = toInternationalPhone(phone);
  if (!to) throw new Error('No phone number for WhatsApp.');

  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    const response = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME || 'zimestimate_reminder',
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: templateText(message.title, 120) },
              { type: 'text', text: templateText(message.body, 900) },
            ],
          }],
        },
      }),
    });
    if (!response.ok) throw await failure(response, 'WhatsApp');
    return;
  }

  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (twilioFrom && process.env.TWILIO_ACCOUNT_SID) {
    const from = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;
    return sendTwilio(`whatsapp:${to}`, from, `${message.title}\n\n${message.body}`);
  }
  throw new Error('WhatsApp is not set up yet.');
}

export async function telegramApi(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram is not set up yet.');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await failure(response, 'Telegram');
  return response.json();
}

export async function sendTelegram(chatId: string, text: string): Promise<void> {
  if (!chatId?.trim()) throw new Error('Telegram is not connected for this account.');
  await telegramApi('sendMessage', { chat_id: chatId.trim(), text: text.slice(0, 4000), disable_web_page_preview: true });
}
