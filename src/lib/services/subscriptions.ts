// Subscription service for ZimEstimate
// Handles supplier subscription plans, feature gating, and payment history

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { mapSupabaseError } from '@/lib/services/supabase-helpers';
import type {
  SubscriptionPlan,
  SubscriptionPlanId,
  SubscriptionPlanFeatures,
  SupplierSubscription,
  SubscriptionPayment,
  PaymentProvider,
  PaymentStatus,
  Currency,
} from '@/lib/database.types';

// ── Plan helpers ──────────────────────────────────────────────────────────────

export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_usd', { ascending: true });

  if (error) {
    logger.error('subscriptions: failed to fetch plans', { error });
    return [];
  }

  return (data ?? []) as unknown as SubscriptionPlan[];
}

// ── Supplier subscription ─────────────────────────────────────────────────────

export async function getSupplierSubscription(
  supplierId: string
): Promise<SupplierSubscription | null> {
  const { data, error } = await supabase
    .from('supplier_subscriptions')
    .select('*')
    .eq('supplier_id', supplierId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error('subscriptions: failed to fetch subscription', { error, supplierId });
    }
    return null;
  }

  return data as unknown as SupplierSubscription;
}

export async function getSupplierPlan(supplierId: string): Promise<SubscriptionPlanId> {
  const subscription = await getSupplierSubscription(supplierId);
  if (!subscription || subscription.status === 'cancelled') return 'basic';
  return subscription.plan_id;
}

// ── Feature gating ────────────────────────────────────────────────────────────

const PLAN_HIERARCHY: Record<SubscriptionPlanId, number> = {
  basic: 0,
  pro: 1,
  premium: 2,
};

const FEATURE_REQUIRED_PLAN: Record<keyof SubscriptionPlanFeatures, SubscriptionPlanId> = {
  priority_search: 'pro',
  advanced_analytics: 'pro',
  contact_requests: 'pro',
  verified_badge: 'pro',
  featured_listing: 'premium',
  api_access: 'premium',
  product_packages: 'premium',
};

export async function requirePlanFeature(
  supplierId: string,
  feature: keyof SubscriptionPlanFeatures
): Promise<{ allowed: boolean; requiredPlan: SubscriptionPlanId }> {
  const currentPlan = await getSupplierPlan(supplierId);
  const requiredPlan = FEATURE_REQUIRED_PLAN[feature];
  const allowed = PLAN_HIERARCHY[currentPlan] >= PLAN_HIERARCHY[requiredPlan];
  return { allowed, requiredPlan };
}

export async function checkProductLimit(
  supplierId: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null }> {
  const planId = await getSupplierPlan(supplierId);

  if (planId === 'basic') {
    const limit = 10;
    return { allowed: currentCount < limit, limit };
  }

  // Pro and Premium: unlimited
  return { allowed: true, limit: null };
}

// ── Subscription management ───────────────────────────────────────────────────

export async function upsertSubscription(
  supplierId: string,
  planId: SubscriptionPlanId,
  provider: PaymentProvider,
  providerSubscriptionId?: string
): Promise<{ success: boolean; subscription?: SupplierSubscription; error?: string }> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { data, error } = await supabase
    .from('supplier_subscriptions')
    .upsert(
      {
        supplier_id: supplierId,
        plan_id: planId,
        status: 'active',
        payment_provider: provider,
        provider_subscription_id: providerSubscriptionId ?? null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        updated_at: now.toISOString(),
      } as never,
      { onConflict: 'supplier_id' }
    )
    .select()
    .single();

  if (error) {
    logger.error('subscriptions: failed to upsert subscription', { error, supplierId, planId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  // Auto-set verification_status to 'verified' when upgrading to paid plan
  if (planId === 'pro' || planId === 'premium') {
    await supabase
      .from('suppliers')
      .update({ verification_status: 'verified' } as never)
      .eq('id', supplierId)
      .eq('verification_status', 'unverified');
  }

  return { success: true, subscription: data as unknown as SupplierSubscription };
}

export async function cancelSubscription(
  supplierId: string,
  atPeriodEnd = true
): Promise<{ success: boolean; error?: string }> {
  if (atPeriodEnd) {
    const { error } = await supabase
      .from('supplier_subscriptions')
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() } as never)
      .eq('supplier_id', supplierId);

    if (error) {
      logger.error('subscriptions: failed to schedule cancellation', { error, supplierId });
      return { success: false, error: mapSupabaseError(error)?.message };
    }
    return { success: true };
  }

  // Immediate cancellation
  const { error } = await supabase
    .from('supplier_subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() } as never)
    .eq('supplier_id', supplierId);

  if (error) {
    logger.error('subscriptions: failed to cancel subscription', { error, supplierId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }
  return { success: true };
}

// ── Payment history ───────────────────────────────────────────────────────────

export async function recordPayment(
  subscriptionId: string,
  supplierId: string,
  data: {
    amount: number;
    currency: Currency;
    provider: PaymentProvider;
    providerPaymentId?: string;
    status: PaymentStatus;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
  }
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  const { data: payment, error } = await supabase
    .from('subscription_payments')
    .insert({
      subscription_id: subscriptionId,
      supplier_id: supplierId,
      amount: data.amount,
      currency: data.currency,
      payment_provider: data.provider,
      provider_payment_id: data.providerPaymentId ?? null,
      status: data.status,
      billing_period_start: data.billingPeriodStart ?? null,
      billing_period_end: data.billingPeriodEnd ?? null,
    } as never)
    .select('id')
    .single();

  if (error) {
    // Ignore duplicate payment (unique constraint on provider_payment_id)
    if (error.code === '23505') {
      logger.error('subscriptions: duplicate payment ignored', {
        providerPaymentId: data.providerPaymentId,
      });
      return { success: true };
    }
    logger.error('subscriptions: failed to record payment', { error, supplierId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  return { success: true, paymentId: (payment as unknown as { id: string } | null)?.id };
}

export async function getPaymentHistory(
  supplierId: string,
  limit = 20
): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('subscriptions: failed to fetch payment history', { error, supplierId });
    return [];
  }

  return (data ?? []) as unknown as SubscriptionPayment[];
}
