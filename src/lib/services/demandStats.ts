// ─── Public demand stats ──────────────────────────────────────────────────────
// Aggregate marketplace activity, readable without an account. Backed by the
// public_demand_stats() definer function (migration 038) because rfq_requests,
// contact_requests and projects are RLS-locked to their owners and would all
// count zero for an anonymous visitor.

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface DemandStats {
  quoteRequests30d: number;
  contactRequests30d: number;
  projects30d: number;
  listedContractors: number;
  activeSuppliers: number;
}

/**
 * Returns null rather than zeroes when the figures cannot be read, so callers
 * can tell "no data" apart from "genuinely nothing happened" and render
 * nothing instead of an accidental "0 buyers this month".
 *
 * Also returns null when the function is missing, which is what a deploy that
 * has not run migration 038 yet looks like — the register pages must still work.
 */
export async function getDemandStats(): Promise<DemandStats | null> {
  const { data, error } = await supabase.rpc('public_demand_stats' as never);

  if (error) {
    // PGRST202 is "function not found", which is exactly what a deploy that has
    // not run migration 038 yet looks like. Expected, not broken — logging it
    // as an error on every page view would just be noise.
    if (error.code !== 'PGRST202') {
      logger.error('Fetch demand stats failed', { error: error.message });
    }
    return null;
  }

  // The function returns a single row; supabase-js hands back an array.
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        quote_requests_30d: number;
        contact_requests_30d: number;
        projects_30d: number;
        listed_contractors: number;
        active_suppliers: number;
      }
    | undefined;

  if (!row) return null;

  return {
    quoteRequests30d: row.quote_requests_30d ?? 0,
    contactRequests30d: row.contact_requests_30d ?? 0,
    projects30d: row.projects_30d ?? 0,
    listedContractors: row.listed_contractors ?? 0,
    activeSuppliers: row.active_suppliers ?? 0,
  };
}
