import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireConfig(): { url: string; anonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

let browserClient: SupabaseClient<Database> | null = null;

function getClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { url, anonKey } = requireConfig();
    browserClient = createClient<Database>(url, anonKey);
  }
  return browserClient;
}

/**
 * Shared anon client.
 *
 * Constructed lazily behind a proxy so importing this module never touches the
 * environment. `next build` collects page data by importing every route, which
 * previously threw "supabaseUrl is required" whenever the build environment did
 * not carry the Supabase vars. Consumers still use it as a normal client, and a
 * genuine misconfiguration now fails on first use with an explicit message.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

// Server-side client for authenticated requests
export const createServerClient = (accessToken?: string) => {
  const { url, anonKey } = requireConfig();
  return createClient<Database>(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
};

// Service role client — bypasses RLS. Server-side only (never expose to client).
export const createServiceRoleClient = () => {
  const { url } = requireConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
};
