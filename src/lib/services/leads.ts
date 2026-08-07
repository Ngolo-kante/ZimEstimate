// Leads service for ZimEstimate
// Handles contact requests and combined leads summary for suppliers

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { mapSupabaseError } from '@/lib/services/supabase-helpers';
import type {
  ContactRequest,
  ContactRequestInsert,
  ContactRequestStatus,
} from '@/lib/database.types';

export interface LeadsSummary {
  totalRfqs: number;
  pendingRfqs: number;
  totalContactRequests: number;
  newContactRequests: number;
}

export interface GetContactRequestsOptions {
  status?: ContactRequestStatus;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export async function getContactRequests(
  supplierId: string,
  options: GetContactRequestsOptions = {}
): Promise<ContactRequest[]> {
  let query = supabase
    .from('contact_requests')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.fromDate) {
    query = query.gte('created_at', options.fromDate);
  }
  if (options.toDate) {
    query = query.lte('created_at', options.toDate);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('leads: failed to fetch contact requests', { error, supplierId });
    return [];
  }

  return (data ?? []) as unknown as ContactRequest[];
}

/**
 * The contractor-side twin of getContactRequests.
 *
 * A separate function rather than an owner-agnostic one: the two callers know
 * perfectly well which kind of listing they are, and passing
 * {supplierId?, contractorId?} into one function would just move the "exactly
 * one of these" problem into TypeScript, where it is weaker than the CHECK
 * constraint already enforcing it in the database.
 */
export async function getContractorEnquiries(
  contractorId: string,
  options: GetContactRequestsOptions = {}
): Promise<ContactRequest[]> {
  let query = supabase
    .from('contact_requests')
    .select('*')
    .eq('contractor_id', contractorId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('leads: failed to fetch contractor enquiries', { error, contractorId });
    return [];
  }

  return (data ?? []) as unknown as ContactRequest[];
}

export async function updateContactRequestStatus(
  requestId: string,
  status: ContactRequestStatus
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('contact_requests')
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq('id', requestId);

  if (error) {
    logger.error('leads: failed to update contact request', { error, requestId, status });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  return { success: true };
}

export async function createContactRequest(
  data: ContactRequestInsert
): Promise<{ success: boolean; request?: ContactRequest; error?: string }> {
  const { data: request, error } = await supabase
    .from('contact_requests')
    .insert(data as never)
    .select()
    .single();

  if (error) {
    logger.error('leads: failed to create contact request', { error });
    return { success: false, error: mapSupabaseError(error)?.message };
  }

  return { success: true, request: request as unknown as ContactRequest };
}

export async function getLeadsSummary(supplierId: string): Promise<LeadsSummary> {
  // Fetch RFQ counts from rfq_recipients
  const { data: rfqRaw, error: rfqError } = await supabase
    .from('rfq_recipients')
    .select('status')
    .eq('supplier_id', supplierId);

  if (rfqError) {
    logger.error('leads: failed to fetch RFQ summary', { error: rfqError, supplierId });
  }

  const rfqData = (rfqRaw ?? []) as Array<{ status: string }>;
  const totalRfqs = rfqData.length;
  const pendingRfqs = rfqData.filter((r) => r.status === 'notified' || r.status === 'viewed').length;

  // Fetch contact request counts
  const { data: crRaw, error: crError } = await supabase
    .from('contact_requests')
    .select('status')
    .eq('supplier_id', supplierId);

  if (crError) {
    logger.error('leads: failed to fetch contact request summary', { error: crError, supplierId });
  }

  const crData = (crRaw ?? []) as Array<{ status: string }>;
  const totalContactRequests = crData.length;
  const newContactRequests = crData.filter((r) => r.status === 'new').length;

  return { totalRfqs, pendingRfqs, totalContactRequests, newContactRequests };
}
