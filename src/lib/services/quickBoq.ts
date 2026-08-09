// ─── Quick BOQ Service ────────────────────────────────────────────────────────
// CRUD for quick_boqs table. Follows the same pattern as projects.ts.

import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/lib/database.types';
import type { BOQItem, LaborConfig, ProjectType, QuickBOQ } from '@/lib/quick-projects/engine/types';
import type { ComplianceStatus } from '@/lib/quick-projects/compliance';

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
  target_date: string | null;
  funds_saved_usd: number;
  compliance: Json;
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
    targetDate: row.target_date ?? null,
    fundsSavedUsd: Number(row.funds_saved_usd) || 0,
    compliance: (row.compliance ?? {}) as Record<string, ComplianceStatus>,
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
    targetDate?: string | null;
    fundsSavedUsd?: number;
    compliance?: Record<string, ComplianceStatus>;
  }
): Promise<{ boq: QuickBOQ | null; error: Error | null }> {
  const update: QuickBoqUpdate = {};
  if (patch.boqItems !== undefined) update.boq_items = toJson(patch.boqItems);
  if (patch.markupPct !== undefined) update.markup_pct = patch.markupPct;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.projectId !== undefined) update.project_id = patch.projectId ?? null;
  if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
  if (patch.fundsSavedUsd !== undefined) update.funds_saved_usd = patch.fundsSavedUsd;
  if (patch.compliance !== undefined) update.compliance = patch.compliance as unknown as Json;
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
// Save a finished BOQ before redirecting to auth, and restore it on the way
// back — otherwise signing in to save costs the user the estimate they were
// trying to save.
//
// localStorage, not sessionStorage. Email confirmation is required on this
// project, so creating an account means leaving for an inbox and often
// returning in a different tab, where sessionStorage is already gone.

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
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Unavailable during SSR, and in private browsing on some engines.
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
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    // Deliberately does NOT clear. This is read from a useState initialiser,
    // and React StrictMode invokes those twice in development — a read that
    // cleared as a side effect handed the data to the first call and null to
    // the second, so the restore silently did nothing. Call
    // clearQuickBOQSession from an effect once the value is safely in state.
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set when a signed-out user presses Save, so the save can complete itself once
 * they are back. Session-scoped rather than local: a pending save is only
 * meaningful for the trip through sign-in, and should not outlive the tab.
 */
export const PENDING_QUICK_SAVE_KEY = 'zimestimate_quick_pending_save';

/**
 * Gate a save behind sign-in, preserving the work.
 *
 * Returns the sign-in URL when the caller should navigate away, otherwise null.
 *
 * Every screen that can save had to grow its own copy of this, and the two
 * budget explorers never did: their Save Project buttons called onSave
 * directly, createQuickBOQ returned "Not authenticated", and the page showed
 * nothing at all. A signed-out user pressed Save and the app did not respond —
 * which reads as broken rather than as "you need an account".
 */
export function gateSaveBehindSignIn(params: {
  isAuthenticated: boolean;
  projectType: ProjectType;
  answers: Record<string, unknown>;
  boqItems: BOQItem[];
  labor: LaborConfig;
  markupPct?: number;
  currency?: 'USD' | 'ZWG';
  /** Where to come back to. Defaults to this project's wizard. */
  returnTo?: string;
}): string | null {
  if (params.isAuthenticated) return null;

  persistQuickBOQSession({
    projectType: params.projectType,
    answers: params.answers,
    boqItems: params.boqItems,
    labor: params.labor,
    markupPct: params.markupPct ?? 0,
    currency: params.currency ?? 'USD',
  });

  // Resume the save on the way back, rather than making them find and press
  // Save a second time having already pressed it once.
  try {
    sessionStorage.setItem(PENDING_QUICK_SAVE_KEY, params.projectType);
  } catch {
    /* private browsing — the redirect still works, the resume just will not */
  }

  const destination = params.returnTo ?? `/quick-projects/${params.projectType}`;
  return `/auth/login?redirect=${encodeURIComponent(destination)}`;
}

/** Drop a restored session once its contents are held in component state. */
export function clearQuickBOQSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}
