// Admin analytics service for ZimEstimate
// Revenue metrics, user management, supplier performance — admin only

import { supabase } from '@/lib/supabase';
import { createServiceRoleClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { mapSupabaseError } from '@/lib/services/supabase-helpers';
import { logAuditEvent } from '@/lib/services/audit';
import type {
  SubscriptionPlanId,
  SubscriptionPayment,
  UserType,
  UserTier,
} from '@/lib/database.types';

// ── Revenue metrics ───────────────────────────────────────────────────────────

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  subscribersByPlan: Record<SubscriptionPlanId, number>;
  totalActiveSubscribers: number;
  recentPayments: SubscriptionPayment[];
  churnCount30d: number;
  newSubscriptions30d: number;
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [subsResult, paymentsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('supplier_subscriptions').select('plan_id, status, created_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('subscription_payments')
      .select('*')
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const subs: Array<{ plan_id: string; status: string; created_at: string }> = subsResult.data ?? [];
  const payments = paymentsResult.data ?? [];

  const subscribersByPlan: Record<SubscriptionPlanId, number> = {
    basic: 0,
    pro: 0,
    premium: 0,
  };

  let mrr = 0;
  let churnCount30d = 0;
  let newSubscriptions30d = 0;

  for (const sub of subs) {
    if (sub.status === 'active') {
      const planId = sub.plan_id as SubscriptionPlanId;
      subscribersByPlan[planId] = (subscribersByPlan[planId] ?? 0) + 1;
      if (planId === 'pro') mrr += 15;
      if (planId === 'premium') mrr += 35;
    }
    if (sub.status === 'cancelled' && sub.created_at >= thirtyDaysAgo) {
      churnCount30d++;
    }
    if (sub.created_at >= thirtyDaysAgo && sub.plan_id !== 'basic') {
      newSubscriptions30d++;
    }
  }

  const totalActiveSubscribers = subscribersByPlan.pro + subscribersByPlan.premium;

  return {
    mrr,
    arr: mrr * 12,
    subscribersByPlan,
    totalActiveSubscribers,
    recentPayments: payments as unknown as SubscriptionPayment[],
    churnCount30d,
    newSubscriptions30d,
  };
}

// ── User management ───────────────────────────────────────────────────────────

export interface UserListRow {
  id: string;
  email: string;
  full_name: string | null;
  user_type: UserType;
  tier: UserTier;
  is_suspended: boolean;
  created_at: string;
}

export async function listAllUsers(options?: {
  search?: string;
  userType?: UserType;
  page?: number;
  pageSize?: number;
}): Promise<{ users: UserListRow[]; total: number }> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, user_type, tier, is_suspended, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (options?.search) {
    query = query.or(
      `email.ilike.%${options.search}%,full_name.ilike.%${options.search}%`
    );
  }

  if (options?.userType) {
    query = query.eq('user_type', options.userType);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error('admin-analytics: failed to list users', { error });
    return { users: [], total: 0 };
  }

  return {
    users: (data ?? []) as unknown as UserListRow[],
    total: count ?? 0,
  };
}

export async function suspendUser(
  userId: string,
  adminId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Use service role to update another user's profile
  const adminClient = createServiceRoleClient();

  const { error } = await adminClient
    .from('profiles')
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_by: adminId,
      suspension_reason: reason ?? null,
    } as never)
    .eq('id', userId);

  if (error) {
    logger.error('admin-analytics: failed to suspend user', { error, userId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  await logAuditEvent({
    userId: adminId,
    action: 'user.suspended',
    resourceType: 'profile',
    resourceId: userId,
    metadata: { reason },
  });

  return { success: true };
}

export async function reactivateUser(
  userId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createServiceRoleClient();

  const { error } = await adminClient
    .from('profiles')
    .update({
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
    } as never)
    .eq('id', userId);

  if (error) {
    logger.error('admin-analytics: failed to reactivate user', { error, userId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  await logAuditEvent({
    userId: adminId,
    action: 'user.reactivated',
    resourceType: 'profile',
    resourceId: userId,
  });

  return { success: true };
}

// ── Support ticket helpers ─────────────────────────────────────────────────────

export async function getAllTickets(options?: {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('support_tickets')
    .select('*, profiles!user_id(email, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (options?.status) query = query.eq('status', options.status);
  if (options?.priority) query = query.eq('priority', options.priority);

  const { data, error, count } = await query;

  if (error) {
    logger.error('admin-analytics: failed to load tickets', { error });
    return { tickets: [], total: 0 };
  }

  return { tickets: data ?? [], total: count ?? 0 };
}

export async function getTicketReplies(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_replies')
    .select('*, profiles!author_id(email, full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('admin-analytics: failed to load ticket replies', { error, ticketId });
    return [];
  }

  return data ?? [];
}

export async function addTicketReply(
  ticketId: string,
  authorId: string,
  body: string,
  isInternal = false
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('ticket_replies')
    .insert({ ticket_id: ticketId, author_id: authorId, body, is_internal: isInternal } as never);

  if (error) {
    logger.error('admin-analytics: failed to add ticket reply', { error, ticketId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  // Update ticket updated_at and status if still open
  await supabase
    .from('support_tickets')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() } as never)
    .eq('id', ticketId)
    .eq('status', 'open');

  return { success: true };
}

export async function updateTicketStatus(
  ticketId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'resolved') update.resolved_at = new Date().toISOString();

  const { error } = await supabase
    .from('support_tickets')
    .update(update as never)
    .eq('id', ticketId);

  if (error) {
    logger.error('admin-analytics: failed to update ticket status', { error, ticketId });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  return { success: true };
}

// ── Product packages ──────────────────────────────────────────────────────────

export async function getAllPackages() {
  const { data, error } = await supabase
    .from('product_packages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('admin-analytics: failed to load packages', { error });
    return [];
  }

  return data ?? [];
}

export async function upsertPackage(
  adminId: string,
  pkg: {
    id?: string;
    name: string;
    description?: string;
    items: object[];
    discount_pct: number;
    total_usd?: number;
    is_active?: boolean;
    supplier_id?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    ...pkg,
    created_by: adminId,
    updated_at: new Date().toISOString(),
  };

  const { error } = pkg.id
    ? await supabase.from('product_packages').update(payload as never).eq('id', pkg.id)
    : await supabase.from('product_packages').insert(payload as never);

  if (error) {
    logger.error('admin-analytics: failed to upsert package', { error });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  return { success: true };
}

// ── Audit logs ────────────────────────────────────────────────────────────────

export async function getAuditLogs(options?: {
  resourceType?: string;
  userId?: string;
  fromDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('system_audit_logs')
    .select('*, profiles!user_id(email, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (options?.resourceType) query = query.eq('resource_type', options.resourceType);
  if (options?.userId) query = query.eq('user_id', options.userId);
  if (options?.fromDate) query = query.gte('created_at', options.fromDate);

  const { data, error, count } = await query;

  if (error) {
    logger.error('admin-analytics: failed to load audit logs', { error });
    return { logs: [], total: 0 };
  }

  return { logs: data ?? [], total: count ?? 0 };
}

// ── Supplier agreements ────────────────────────────────────────────────────────

export async function getAllAgreements(options?: { search?: string; page?: number }) {
  const page = options?.page ?? 1;
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('supplier_agreements')
    .select('*, suppliers!supplier_id(name, contact_email)', { count: 'exact' })
    .order('accepted_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    logger.error('admin-analytics: failed to load agreements', { error });
    return { agreements: [], total: 0 };
  }

  return { agreements: data ?? [], total: count ?? 0 };
}
