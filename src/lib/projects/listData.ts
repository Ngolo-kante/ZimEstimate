import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// The older hand-maintained tables omit Relationships. Supply that metadata
// locally so these queries retain their real Row/Insert types in supabase-js.
type ListTable = 'project_opens' | 'project_stages' | 'boq_items' | 'purchase_records';
type ListDatabase = {
    public: {
        Tables: { [K in ListTable]: Database['public']['Tables'][K] & { Relationships: [] } };
        Views: Record<never, never>;
        Functions: Record<never, never>;
    };
};
export const projectListDb = supabase as unknown as SupabaseClient<ListDatabase>;
