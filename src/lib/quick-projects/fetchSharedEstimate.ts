import { createServerClient } from '@/lib/supabase';
import { isShareToken, toSharedQuickEstimate, type SharedQuickEstimate } from './savedEstimate';

/**
 * Looks up a shared estimate by its link token, as an anonymous visitor.
 *
 * Uses the public key only: get_shared_quick_boq does its own check (the
 * exact token) and returns the estimate alone, so nothing here needs the
 * service role. Null for an unknown, revoked or mangled link.
 */
export async function fetchSharedQuickEstimate(token: string): Promise<SharedQuickEstimate | null> {
  if (!isShareToken(token)) return null;
  try {
    const client = createServerClient();
    const { data, error } = await client.rpc('get_shared_quick_boq' as never, { p_token: token } as never);
    if (error) return null;
    return toSharedQuickEstimate(data);
  } catch {
    return null;
  }
}
