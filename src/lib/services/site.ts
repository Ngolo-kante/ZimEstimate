// The site view of a project: what someone invited to it can see and do.
// Everything goes through database functions or server routes that check
// the share (migration 058); invitees have no direct access to project
// tables, so budgets, prices, purchases and documents never reach them.

import { supabase } from '@/lib/supabase';

export type SiteAccess = 'owner' | 'edit' | 'view';

export interface SiteProjectSummary {
  id: string;
  name: string;
  location: string | null;
  status: string;
  access_level: 'edit' | 'view';
  owner_name: string;
  updated_at: string;
}

export interface SiteTask { id: string; title: string; is_completed: boolean; completed_at: string | null; note: string | null }
export interface SiteStage { id: string; name: string; category: string; status: string; tasks: SiteTask[] }
export interface SiteMaterial { id: string; name: string; category: string; unit: string; quantity: number; used: number }
export interface SiteUsage { id: string; usage_date: string; quantity_used: number; notes: string | null; material_name: string; unit: string; recorded_by: string }

export interface SiteView {
  access: SiteAccess;
  project: { id: string; name: string; location: string | null; status: string; usage_tracking_enabled: boolean; owner_name: string };
  stages: SiteStage[];
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

export async function getSiteView(projectId: string): Promise<SiteView | null> {
  const { data, error } = await rpc('get_site_view', { p_project_id: projectId });
  if (error) return null;
  return (data as SiteView | null) ?? null;
}

async function call(name: string, args: Record<string, unknown>): Promise<{ error: string | null }> {
  const { error } = await rpc(name, args);
  // The functions raise plain-language messages; pass them through.
  return { error: error ? error.message.replace(/^.*?:\s*/, '') || 'Could not save that.' : null };
}

export const siteLogUsage = (projectId: string, itemId: string, quantity: number, date: string, notes: string) =>
  call('site_log_usage', { p_project_id: projectId, p_boq_item_id: itemId, p_quantity: quantity, p_usage_date: date, p_notes: notes || null });

export const siteSetTask = (taskId: string, completed: boolean) =>
  call('site_set_task', { p_task_id: taskId, p_completed: completed });

export const siteSetStageStatus = (stageId: string, status: string) =>
  call('site_set_stage_status', { p_stage_id: stageId, p_status: status });

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function getSitePhotos(projectId: string): Promise<{ photos: SitePhoto[]; canUpload: boolean }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/photos`, { headers: await authHeader() });
    if (!response.ok) return { photos: [], canUpload: false };
    return await response.json();
  } catch {
    return { photos: [], canUpload: false };
  }
}

export async function uploadSitePhoto(projectId: string, file: File, caption: string, stageId?: string | null): Promise<{ error: string | null }> {
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  if (stageId) form.append('stageId', stageId);
  try {
    const response = await fetch(`/api/projects/${projectId}/photos`, { method: 'POST', headers: await authHeader(), body: form });
    const result = await response.json().catch(() => ({}));
    return { error: response.ok ? null : result.error || 'Could not upload the photo.' };
  } catch {
    return { error: 'Could not reach the server. Check your connection.' };
  }
}
