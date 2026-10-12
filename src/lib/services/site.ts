// The site view of a project or quick estimate: what someone invited to it
// can see and do. Everything goes through database functions or server routes
// that check the share (migrations 058 and 061); invitees have no direct
// access to project or quick-estimate tables, so budgets, prices, savings,
// purchases and documents never reach them.

import { supabase } from '@/lib/supabase';
import type { AccessLevel, QuickBoqShare } from '@/lib/database.types';

export type SiteAccess = 'owner' | 'edit' | 'view';

/** A full build, or a quick estimate (borehole, solar, septic…). */
export type SiteTarget = { kind: 'project'; id: string } | { kind: 'quick'; id: string };

export interface SiteProjectSummary {
  id: string;
  name: string;
  location: string | null;
  status: string;
  access_level: 'edit' | 'view';
  owner_name: string;
  updated_at: string;
}

export interface SiteQuickSummary {
  id: string;
  name: string;
  project_type: string;
  location: string | null;
  access_level: 'edit' | 'view';
  owner_name: string;
  updated_at: string;
}

export interface SiteTask { id: string; title: string; is_completed: boolean; completed_at: string | null; note?: string | null; completed_by?: string | null }
export interface SiteStage { id: string; name: string; category: string; status: string; tasks: SiteTask[] }
export interface SiteMaterial { id: string; name: string; category: string; unit: string; quantity: number; used: number }
export interface SiteUsage { id: string; usage_date: string; quantity_used: number; notes: string | null; material_name: string; unit: string; recorded_by: string }

export interface SiteView {
  access: SiteAccess;
  project: { id: string; name: string; location: string | null; status: string; usage_tracking_enabled: boolean; owner_name: string };
  /** Full builds: stages, each with its tasks. */
  stages: SiteStage[];
  /** Quick estimates: one fixed list of steps for the job type. */
  steps: SiteTask[];
  materials: SiteMaterial[];
  recent_usage: SiteUsage[];
}

export interface SitePhoto { id: string; url: string | null; caption: string | null; stageId: string | null; createdAt: string; uploadedBy: string }

const rpc = (name: string, args?: Record<string, unknown>) => supabase.rpc(name as never, args as never);

export async function getSiteProjects(): Promise<SiteProjectSummary[]> {
  const { data, error } = await rpc('get_site_projects');
  if (error) return [];
  return (data as SiteProjectSummary[] | null) ?? [];
}

export async function getSiteQuickEstimates(): Promise<SiteQuickSummary[]> {
  const { data, error } = await rpc('get_quick_site_projects');
  if (error) return [];
  return (data as SiteQuickSummary[] | null) ?? [];
}

/** 'owner', 'edit', 'view', or null when this account has no access. */
export async function getSiteAccess(target: SiteTarget): Promise<SiteAccess | null> {
  const { data, error } = target.kind === 'project'
    ? await rpc('site_access', { p_project_id: target.id })
    : await rpc('quick_site_access', { p_quick_boq_id: target.id });
  if (error) return null;
  return (data as SiteAccess | null) ?? null;
}

interface QuickSiteViewRow {
  access: SiteAccess;
  estimate: { id: string; name: string; project_type: string; location: string | null; owner_name: string };
  steps: SiteTask[];
  materials: SiteMaterial[];
  recent_usage: SiteUsage[];
}

export async function getSiteView(target: SiteTarget): Promise<SiteView | null> {
  if (target.kind === 'project') {
    const { data, error } = await rpc('get_site_view', { p_project_id: target.id });
    if (error || !data) return null;
    return { steps: [], ...(data as Omit<SiteView, 'steps'>) };
  }
  const { data, error } = await rpc('get_quick_site_view', { p_quick_boq_id: target.id });
  if (error || !data) return null;
  const row = data as QuickSiteViewRow;
  return {
    access: row.access,
    project: {
      id: row.estimate.id,
      name: row.estimate.name,
      location: row.estimate.location,
      status: '',
      usage_tracking_enabled: true,
      owner_name: row.estimate.owner_name,
    },
    stages: [],
    steps: row.steps,
    materials: row.materials,
    recent_usage: row.recent_usage,
  };
}

async function call(name: string, args: Record<string, unknown>): Promise<{ error: string | null }> {
  const { error } = await rpc(name, args);
  // The functions raise plain-language messages; pass them through.
  return { error: error ? error.message.replace(/^.*?:\s*/, '') || 'Could not save that.' : null };
}

export const siteLogUsage = (target: SiteTarget, itemId: string, quantity: number, date: string, notes: string) =>
  target.kind === 'project'
    ? call('site_log_usage', { p_project_id: target.id, p_boq_item_id: itemId, p_quantity: quantity, p_usage_date: date, p_notes: notes || null })
    : call('quick_site_log_usage', { p_quick_boq_id: target.id, p_item_id: itemId, p_quantity: quantity, p_usage_date: date, p_notes: notes || null });

/** Ticks a task (full build) or a step (quick estimate). */
export const siteSetTask = (target: SiteTarget, taskId: string, completed: boolean) =>
  target.kind === 'project'
    ? call('site_set_task', { p_task_id: taskId, p_completed: completed })
    : call('quick_site_set_step', { p_quick_boq_id: target.id, p_step_id: taskId, p_completed: completed });

export const siteSetStageStatus = (stageId: string, status: string) =>
  call('site_set_stage_status', { p_stage_id: stageId, p_status: status });

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

const apiBase = (target: SiteTarget) =>
  target.kind === 'project' ? `/api/projects/${target.id}` : `/api/quick-estimates/${target.id}`;

export async function getSitePhotos(target: SiteTarget): Promise<{ photos: SitePhoto[]; canUpload: boolean }> {
  try {
    const response = await fetch(`${apiBase(target)}/photos`, { headers: await authHeader() });
    if (!response.ok) return { photos: [], canUpload: false };
    return await response.json();
  } catch {
    return { photos: [], canUpload: false };
  }
}

export async function uploadSitePhoto(target: SiteTarget, file: File, caption: string, stageId?: string | null): Promise<{ error: string | null }> {
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  if (stageId) form.append('stageId', stageId);
  try {
    const response = await fetch(`${apiBase(target)}/photos`, { method: 'POST', headers: await authHeader(), body: form });
    const result = await response.json().catch(() => ({}));
    return { error: response.ok ? null : result.error || 'Could not upload the photo.' };
  } catch {
    return { error: 'Could not reach the server. Check your connection.' };
  }
}

// ── Inviting people to a quick estimate (the owner's side) ──────────────────
// Full builds keep theirs in services/projects.ts; these mirror them.

export async function inviteToQuickEstimate(
  quickId: string,
  email: string,
  accessLevel: AccessLevel,
): Promise<{ share: QuickBoqShare | null; linked: boolean; emailed: boolean; error: Error | null }> {
  const headers = await authHeader();
  if (!headers.Authorization) {
    return { share: null, linked: false, emailed: false, error: new Error('Please sign in again.') };
  }
  try {
    const response = await fetch(`/api/quick-estimates/${quickId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ email, accessLevel }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { share: null, linked: false, emailed: false, error: new Error(result.error || 'Could not send the invitation.') };
    }
    return { share: result.share, linked: Boolean(result.linked), emailed: Boolean(result.emailed), error: null };
  } catch {
    return { share: null, linked: false, emailed: false, error: new Error('Could not reach the server. Check your connection.') };
  }
}

export async function getQuickEstimateShares(quickId: string): Promise<{ shares: QuickBoqShare[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('quick_boq_shares')
    .select('*')
    .eq('quick_boq_id', quickId)
    .order('created_at', { ascending: false });
  if (error) return { shares: [], error: new Error(error.message) };
  return { shares: (data as QuickBoqShare[] | null) ?? [], error: null };
}

export async function updateQuickShareAccess(shareId: string, accessLevel: AccessLevel): Promise<{ share: QuickBoqShare | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('quick_boq_shares')
    .update({ access_level: accessLevel } as never)
    .eq('id', shareId)
    .select()
    .single();
  if (error) return { share: null, error: new Error(error.message) };
  return { share: data as QuickBoqShare, error: null };
}

export async function removeQuickShare(shareId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('quick_boq_shares').delete().eq('id', shareId);
  return { error: error ? new Error(error.message) : null };
}
