// ─── Quick BOQ Service ────────────────────────────────────────────────────────
// CRUD for quick_boqs table. Follows the same pattern as projects.ts.

import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/lib/database.types';
import type { BOQItem, LaborConfig, ProjectType, QuickBOQ } from '@/lib/quick-projects/engine/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuickBOQInsert {
  projectType: ProjectType;
  answers: Record<string, unknown>;
  boqItems: BOQItem[];
  labor: LaborConfig;
  markupPct?: number;
  currency?: 'USD' | 'ZWG';
  projectId?: string;
}

interface DBQuickBOQ {
  id: string;
  user_id: string | null;
  project_id: string | null;
  project_type: ProjectType;
  answers: Json;
  boq_items: Json;
  labor_method: string | null;
  labor_value: number | null;
  labor_days: number | null;
  labor_workers: number | null;
  labor_enabled: boolean;
  markup_pct: number;
  currency: 'USD' | 'ZWG';
  created_at: string;
  updated_at: string;
}

type QuickBoqRow = Database['public']['Tables']['quick_boqs']['Row'];
type QuickBoqInsert = Database['public']['Tables']['quick_boqs']['Insert'];
type QuickBoqUpdate = Database['public']['Tables']['quick_boqs']['Update'];

function toJson(value: Record<string, unknown> | BOQItem[]): Json {
  return value as Json;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toQuickBOQ(row: DBQuickBOQ): QuickBOQ {
  const labor: LaborConfig = {
    enabled: row.labor_enabled,
    method: (row.labor_method as LaborConfig['method']) ?? 'percentage',
    percentage: row.labor_method === 'percentage' ? (row.labor_value ?? 25) : undefined,
    dailyRateUsd: row.labor_method === 'daily_rate' ? (row.labor_value ?? 35) : undefined,
    days: row.labor_days ?? undefined,
    workerCount: row.labor_workers ?? undefined,
  };
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    projectId: row.project_id ?? undefined,
    projectType: row.project_type,
    answers: row.answers as Record<string, unknown>,
    boqItems: row.boq_items as unknown as BOQItem[],
    labor,
    markupPct: row.markup_pct,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function laborToColumns(labor: LaborConfig) {
  return {
    labor_enabled: labor.enabled,
    labor_method: labor.method,
    labor_value:
      labor.method === 'percentage'
        ? (labor.percentage ?? 25)
        : (labor.dailyRateUsd ?? 35),
    labor_days: labor.days ?? null,
    labor_workers: labor.workerCount ?? 2,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createQuickBOQ(
  data: QuickBOQInsert
): Promise<{ boq: QuickBOQ | null; error: Error | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { boq: null, error: new Error('Not authenticated') };
  }

  const payload: QuickBoqInsert = {
    user_id: user.id,
    project_id: data.projectId ?? null,
    project_type: data.projectType,
    answers: toJson(data.answers),
    boq_items: toJson(data.boqItems),
    markup_pct: data.markupPct ?? 0,
    currency: data.currency ?? 'USD',
    ...laborToColumns(data.labor),
  };

  const { data: row, error } = await supabase
    .from('quick_boqs')
    .insert(payload as never)
    .select()
    .single();

  if (error) return { boq: null, error: new Error(error.message) };
  return { boq: toQuickBOQ(row as QuickBoqRow), error: null };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getQuickBOQ(
  id: string
): Promise<{ boq: QuickBOQ | null; error: Error | null }> {
  const { data: row, error } = await supabase
    .from('quick_boqs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return { boq: null, error: new Error(error.message) };
  return { boq: toQuickBOQ(row as QuickBoqRow), error: null };
}

export async function listQuickBOQs(
  projectType?: ProjectType
): Promise<{ boqs: QuickBOQ[]; error: Error | null }> {
  let query = supabase.from('quick_boqs').select('*').order('created_at', { ascending: false });
  if (projectType) query = query.eq('project_type', projectType);

  const { data, error } = await query;
  if (error) return { boqs: [], error: new Error(error.message) };
  return { boqs: (data as QuickBoqRow[]).map(toQuickBOQ), error: null };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateQuickBOQ(
  id: string,
  patch: {
    boqItems?: BOQItem[];
    labor?: LaborConfig;
    markupPct?: number;
    currency?: 'USD' | 'ZWG';
    projectId?: string;
  }
): Promise<{ boq: QuickBOQ | null; error: Error | null }> {
  const update: QuickBoqUpdate = {};
  if (patch.boqItems !== undefined) update.boq_items = toJson(patch.boqItems);
  if (patch.markupPct !== undefined) update.markup_pct = patch.markupPct;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.projectId !== undefined) update.project_id = patch.projectId ?? null;
  if (patch.labor !== undefined) Object.assign(update, laborToColumns(patch.labor));

  const { data: row, error } = await supabase
    .from('quick_boqs')
    .update(update as never)
    .eq('id', id)
    .select()
    .single();

  if (error) return { boq: null, error: new Error(error.message) };
  return { boq: toQuickBOQ(row as QuickBoqRow), error: null };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteQuickBOQ(
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('quick_boqs').delete().eq('id', id);
  return { error: error ? new Error(error.message) : null };
}

// ─── Session Persistence (guest mode) ─────────────────────────────────────────
// Mirrors the manual BOQ wizard pattern: save answers to sessionStorage before
// redirecting to auth, restore after login.

const SESSION_KEY = 'quick_boq_session';

export function persistQuickBOQSession(data: {
  projectType: ProjectType;
  answers: Record<string, unknown>;
  boqItems: BOQItem[];
  labor: LaborConfig;
  markupPct: number;
  currency: 'USD' | 'ZWG';
}): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage may be unavailable in SSR context
  }
}

export function restoreQuickBOQSession(): {
  projectType: ProjectType;
  answers: Record<string, unknown>;
  boqItems: BOQItem[];
  labor: LaborConfig;
  markupPct: number;
  currency: 'USD' | 'ZWG';
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SESSION_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
