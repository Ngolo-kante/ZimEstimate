// ─── Quotes for a quick estimate ──────────────────────────────────────────────
// Reuses the existing RFQ tables rather than building a parallel quote system.
//
// rfq_requests.project_id was NOT NULL against projects, so there was no way to
// ask a supplier to price a borehole. Migration 043 makes that column nullable,
// adds quick_boq_id, and constrains rows to exactly one owner.

import { supabase } from '@/lib/supabase';
import { createRfqRequestForQuickBoq } from '@/lib/services/rfq';
import type { BOQItem } from '@/lib/quick-projects/engine/types';

export type QuoteStatus = 'open' | 'quoted' | 'accepted' | 'expired' | 'cancelled';

export interface QuickQuoteRequest {
  id: string;
  status: QuoteStatus;
  createdAt: string;
  expiresAt: string;
  itemCount: number;
}

export interface QuoteSummary {
  /** Sent, nobody has priced it yet. This is the "am I still waiting?" number. */
  open: number;
  /** At least one supplier has come back. */
  quoted: number;
  total: number;
}

export async function listQuickQuotes(
  quickBoqId: string,
): Promise<{ requests: QuickQuoteRequest[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('rfq_requests')
    .select('id, status, created_at, expires_at, rfq_items(count)')
    .eq('quick_boq_id', quickBoqId)
    .order('created_at', { ascending: false });

  if (error) return { requests: [], error: new Error(error.message) };

  const requests = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string; status: QuoteStatus; created_at: string; expires_at: string;
      rfq_items?: Array<{ count: number }>;
    };
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      itemCount: r.rfq_items?.[0]?.count ?? 0,
    };
  });

  return { requests, error: null };
}

/**
 * Counts that answer "where are my quotes?".
 *
 * Expired and cancelled requests are counted in neither bucket: telling someone
 * they are waiting on a request that lapsed a fortnight ago is worse than
 * telling them nothing.
 */
export function summariseQuotes(requests: QuickQuoteRequest[]): QuoteSummary {
  const open = requests.filter((r) => r.status === 'open').length;
  const quoted = requests.filter((r) => r.status === 'quoted' || r.status === 'accepted').length;
  return { open, quoted, total: requests.length };
}

/**
 * Creates the request and, where a matching supplier can be found, actually
 * notifies them of it.
 *
 * Used to just write rfq_requests and rfq_items directly — a real database
 * row with no recipient attached to it and no notification queued, so a
 * request that looked identical to a full project's sat there reaching
 * nobody. Now goes through the same matching, recipient and notification
 * pipeline createRfqRequest already uses for full projects, via the RPC both
 * now share.
 */
export async function createQuickQuoteRequest(
  quickBoqId: string,
  items: BOQItem[],
  options: { notes?: string; requiredBy?: string | null } = {},
): Promise<{ id: string | null; error: Error | null }> {
  const priceable = items.filter((i) => i.included !== false && !i.owned);
  if (priceable.length === 0) {
    return { id: null, error: new Error('This estimate has no items to quote.') };
  }

  const { rfq, error } = await createRfqRequestForQuickBoq({
    quickBoqId,
    notes: options.notes ?? null,
    requiredBy: options.requiredBy ?? null,
    items: priceable.map((item) => ({
      // NOT NULL on rfq_items. Quick BOQ items carry a stable generated id
      // rather than a catalogue key, which is the closest honest equivalent.
      material_id: item.id,
      material_name: item.description,
      quantity: item.quantity,
      unit: item.unit,
    })),
  });

  if (error || !rfq) {
    return { id: null, error: error ?? new Error('Could not create the request.') };
  }

  return { id: rfq.id, error: null };
}
