// Subscription expiry cron job
// Called daily by Vercel Cron: "0 8 * * *"
// Checks for expiring subscriptions and sends notifications

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  // Validate cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const results = { notified: 0, expired: 0, errors: 0 };

  try {
    // 1. Find subscriptions expiring in the next 3 days (excluding basic)
    const { data: expiringRaw, error: expiringError } = await supabase
      .from('supplier_subscriptions')
      .select('id, supplier_id, plan_id, current_period_end')
      .eq('status', 'active')
      .neq('plan_id', 'basic')
      .eq('cancel_at_period_end', false)
      .lte('current_period_end', threeDaysFromNow.toISOString())
      .gte('current_period_end', now.toISOString());
    const expiring = expiringRaw as Array<{ id: string; supplier_id: string; plan_id: string; current_period_end: string }> | null;

    if (expiringError) {
      logger.error('cron/subscriptions: failed to query expiring subscriptions', { error: expiringError });
      results.errors++;
    } else {
      for (const sub of expiring ?? []) {
        try {
          // Get supplier user_id to send notification
          const { data: supplierRaw } = await supabase
            .from('suppliers')
            .select('user_id, name')
            .eq('id', sub.supplier_id)
            .single();
          const supplier = supplierRaw as { user_id: string | null; name: string } | null;

          if (supplier?.user_id) {
            // Queue expiry notification (using existing notification queue pattern)
            await supabase.from('notification_deliveries').insert({
              user_id: supplier.user_id,
              channel: 'email',
              template_key: 'subscription_expiring_soon',
              payload: {
                planName: sub.plan_id,
                expiryDate: new Date(sub.current_period_end).toLocaleDateString(),
              },
              status: 'queued',
            } as never);
            results.notified++;
          }
        } catch (err) {
          logger.error('cron/subscriptions: failed to notify supplier', { err, supplierId: sub.supplier_id });
          results.errors++;
        }
      }
    }

    // 2. Find subscriptions that have passed their period_end and are still 'active'
    //    (for Paynow/manual plans that don't auto-renew via webhook)
    const { data: expiredRaw, error: expiredError } = await supabase
      .from('supplier_subscriptions')
      .select('id, supplier_id, plan_id')
      .eq('status', 'active')
      .neq('plan_id', 'basic')
      .eq('cancel_at_period_end', true)
      .lt('current_period_end', now.toISOString());
    const expired = expiredRaw as Array<{ id: string; supplier_id: string; plan_id: string }> | null;

    if (expiredError) {
      logger.error('cron/subscriptions: failed to query expired subscriptions', { error: expiredError });
      results.errors++;
    } else {
      for (const sub of expired ?? []) {
        const { error: updateError } = await supabase
          .from('supplier_subscriptions')
          .update({ status: 'cancelled', updated_at: now.toISOString() } as never)
          .eq('id', sub.id);

        if (updateError) {
          logger.error('cron/subscriptions: failed to cancel expired subscription', { error: updateError });
          results.errors++;
        } else {
          results.expired++;
        }
      }
    }

    logger.error('cron/subscriptions: completed', { results });
    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    logger.error('cron/subscriptions: unexpected error', { err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
