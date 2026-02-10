import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NotificationDelivery } from '@/lib/database.types';
import { enforceCsrf, enforceRateLimit, sanitizeNumber } from '@/lib/server/security';
import { requireAdmin } from '@/lib/server/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const whatsappApiUrl = process.env.WHATSAPP_API_URL;
const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;
const whatsappToken = process.env.WHATSAPP_TOKEN;

async function sendWhatsAppMessage(payload: Record<string, unknown>) {
  if (!whatsappApiUrl || !whatsappPhoneId || !whatsappToken) {
    throw new Error('WhatsApp API not configured');
  }

  const to = (payload.contact_phone || payload.to) as string | undefined;
  const body = (payload.body || payload.message) as string | undefined;
  if (!to || !body) {
    throw new Error('Missing WhatsApp destination or message');
  }

  const response = await fetch(`${whatsappApiUrl}/${whatsappPhoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whatsappToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'WhatsApp API error');
  }
}

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, {
    keyPrefix: 'notifications:dispatch',
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const csrf = enforceCsrf(request);
  if (csrf) return csrf;

  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase service role credentials' }, { status: 500 });
  }

  const payload = await request.json().catch(() => ({}));
  const mock = Boolean((payload as { mock?: boolean }).mock);
  const limit = sanitizeNumber((payload as { limit?: number }).limit, { min: 1, max: 100, fallback: 25 });

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: deliveries, error } = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const delivery of (deliveries || []) as NotificationDelivery[]) {
    try {
      if (mock) {
        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'sent' });
        continue;
      }

      if (delivery.channel === 'whatsapp') {
        const payload = (delivery.payload || {}) as Record<string, unknown>;
        await sendWhatsAppMessage(payload);
        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'sent' });
      } else {
        await supabase
          .from('notification_deliveries')
          .update({ status: 'failed', last_error: 'Channel not configured' })
          .eq('id', delivery.id);
        results.push({ id: delivery.id, status: 'failed', error: 'Channel not configured' });
      }
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Dispatch failed';
      await supabase
        .from('notification_deliveries')
        .update({ status: 'failed', last_error: message })
        .eq('id', delivery.id);
      results.push({ id: delivery.id, status: 'failed', error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
