// ─── Admin overview ───────────────────────────────────────────────────────────
// GET /api/admin/overview — what an admin needs to run the site, from stored
// records only: how much is being created and by whom, whether people come
// back, what is waiting on an admin, and how current the public prices are.
// Counts are of saved records, not page visits (there is no visit tracking).

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { createServiceRoleClient } from '@/lib/supabase';
import { getBestPrice } from '@/lib/materials';
import { loadServerCatalog } from '@/lib/catalog/serverCatalog';
import { MANUAL_PRICE_SOURCE, selectPublishedObservation, type PublishedObservation } from '@/lib/pricing/publishedPrice';
import { estimateName } from '@/lib/quick-projects/savedEstimate';
import { QUICK_TYPE_LABELS } from '@/lib/quick-projects/typeLabels';

const DAY = 24 * 60 * 60 * 1000;
const WEEKS = 8;

/** Counts per week for the last WEEKS weeks, oldest first; each week ends today-ish. */
function weekly(dates: string[], now: number): number[] {
  const counts = new Array(WEEKS).fill(0);
  for (const date of dates) {
    const age = now - new Date(date).getTime();
    if (!Number.isFinite(age) || age < 0) continue;
    const week = Math.floor(age / (7 * DAY));
    if (week < WEEKS) counts[WEEKS - 1 - week] += 1;
  }
  return counts;
}

const within = (date: string | null | undefined, days: number, now: number) =>
  Boolean(date) && now - new Date(date as string).getTime() <= days * DAY;

const COST_CATEGORY_LABELS: Record<string, string> = {
  substructure: 'Foundations',
  superstructure: 'Walls & frame',
  roofing: 'Roofing',
  finishing: 'Finishing',
  exterior: 'Exterior',
  labor: 'Labour',
  project_fees: 'Professional & council fees',
};

/**
 * Estimated value across every saved full-build BOQ, by stage. Read a page at
 * a time: the API hands back at most 1,000 rows per request, and a total cut
 * off at 1,000 lines would look plausible and be wrong.
 */
async function costByCategory(db: ReturnType<typeof createServiceRoleClient>) {
  const totals = new Map<string, { totalUsd: number; projects: Set<string> }>();
  const PAGE = 1_000;
  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await db.from('boq_items')
      .select('project_id, category, total_usd')
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    for (const row of (data ?? []) as { project_id: string; category: string | null; total_usd: number | null }[]) {
      const key = row.category && COST_CATEGORY_LABELS[row.category] ? row.category : 'other';
      const entry = totals.get(key) ?? { totalUsd: 0, projects: new Set<string>() };
      entry.totalUsd += Number(row.total_usd) || 0;
      entry.projects.add(row.project_id);
      totals.set(key, entry);
    }
    if (!data || data.length < PAGE) break;
  }
  return [...totals.entries()]
    .map(([category, entry]) => ({ category, label: COST_CATEGORY_LABELS[category] ?? 'Other', totalUsd: Math.round(entry.totalUsd), projects: entry.projects.size }))
    .filter((row) => row.totalUsd > 0)
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = createServiceRoleClient();
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();

    const [projects, quick, profiles, users, projectShares, quickShares, tickets, applications, rfqs, reviews, observations, costSplit] = await Promise.all([
      db.from('projects').select('id, name, location, status, created_at, owner_id').order('created_at', { ascending: false }).limit(5000),
      db.from('quick_boqs').select('id, project_type, answers, created_at, user_id, share_token, archived_at').order('created_at', { ascending: false }).limit(5000),
      db.from('profiles').select('id, full_name, user_type, tier, created_at').limit(5000),
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from('project_shares').select('id, shared_with_user_id').limit(5000),
      db.from('quick_boq_shares').select('id, shared_with_user_id').limit(5000),
      db.from('support_tickets').select('id, status').limit(5000),
      db.from('supplier_applications').select('id, status').limit(5000),
      db.from('rfq_requests').select('id, created_at').gte('created_at', since30).limit(5000),
      db.from('pending_matches').select('id', { count: 'exact', head: true }).is('resolved_at', null),
      db.from('price_observations')
        .select('id, material_key, price_usd, price_zwg, unit, source_name, supplier_name, scraped_at, review_status')
        .in('review_status', ['auto', 'confirmed'])
        .order('scraped_at', { ascending: false })
        .limit(5000),
      costByCategory(db),
    ]);

    type ProjectRow = { id: string; name: string; location: string | null; status: string; created_at: string; owner_id: string };
    type QuickRow = { id: string; project_type: string; answers: Record<string, unknown>; created_at: string; user_id: string | null; share_token: string | null; archived_at: string | null };
    type ProfileRow = { id: string; full_name: string | null; user_type: string; tier: string; created_at: string };

    const projectRows = (projects.data ?? []) as ProjectRow[];
    const quickRows = (quick.data ?? []) as QuickRow[];
    const profileRows = (profiles.data ?? []) as ProfileRow[];
    const authUsers = users.data?.users ?? [];
    const nameOf = new Map(profileRows.map((p) => [p.id, p.full_name?.trim() || 'Unnamed user']));

    // Who is actually using it: anyone who has saved a project or estimate.
    const builders = new Set([...projectRows.map((p) => p.owner_id), ...quickRows.map((q) => q.user_id).filter(Boolean)]);

    const quickByType = Object.entries(
      quickRows.reduce<Record<string, number>>((acc, q) => { acc[q.project_type] = (acc[q.project_type] ?? 0) + 1; return acc; }, {}),
    ).map(([type, count]) => ({ type, label: QUICK_TYPE_LABELS[type] ?? type, count })).sort((a, b) => b.count - a.count);

    // Price health, by the same rule the public pages use (lib/pricing).
    const obs = (observations.data ?? []) as PublishedObservation[];
    // What the public sees: the catalog with admin edits, hidden ones left out.
    const shown = (await loadServerCatalog(db)).all.filter((m) => !m.hidden);
    const priceHealth = { manual: 0, scraped: 0, reference: 0, unpriced: 0, total: shown.length };
    for (const material of shown) {
      const baseline = getBestPrice(material.id);
      const published = selectPublishedObservation(obs.filter((o) => o.material_key === material.id), material.unit, baseline?.priceUsd, now);
      if (published?.source_name === MANUAL_PRICE_SOURCE) priceHealth.manual += 1;
      else if (published) priceHealth.scraped += 1;
      else if (baseline) priceHealth.reference += 1;
      else priceHealth.unpriced += 1;
    }

    const recent = [
      ...projectRows.slice(0, 10).map((p) => ({
        id: p.id, kind: 'Full build', name: p.name, detail: p.location || 'No location',
        owner: nameOf.get(p.owner_id) ?? 'Unknown', created_at: p.created_at,
      })),
      ...quickRows.slice(0, 10).map((q) => ({
        id: q.id, kind: QUICK_TYPE_LABELS[q.project_type] ?? 'Quick estimate', name: estimateName(q.project_type, q.answers),
        detail: typeof q.answers?.project_location === 'string' && q.answers.project_location.trim() ? q.answers.project_location : 'No location',
        owner: q.user_id ? nameOf.get(q.user_id) ?? 'Unknown' : 'Signed out', created_at: q.created_at,
      })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);

    const openTickets = ((tickets.data ?? []) as { status: string }[]).filter((t) => !['closed', 'resolved'].includes(t.status)).length;
    const pendingApplications = ((applications.data ?? []) as { status: string }[]).filter((a) => ['pending', 'under_review'].includes(a.status)).length;
    const acceptedInvites = [...(projectShares.data ?? []), ...(quickShares.data ?? [])]
      .filter((s) => (s as { shared_with_user_id: string | null }).shared_with_user_id).length;

    return NextResponse.json({
      updatedAt: new Date(now).toISOString(),
      metrics: {
        projects: projectRows.length,
        projects30d: projectRows.filter((p) => within(p.created_at, 30, now)).length,
        activeProjects: projectRows.filter((p) => p.status === 'active').length,
        quickEstimates: quickRows.length,
        quickEstimates30d: quickRows.filter((q) => within(q.created_at, 30, now)).length,
        sharedEstimateLinks: quickRows.filter((q) => q.share_token).length,
        users: profileRows.length,
        users30d: profileRows.filter((p) => within(p.created_at, 30, now)).length,
        activeUsers7d: authUsers.filter((u) => within(u.last_sign_in_at, 7, now)).length,
        activeUsers30d: authUsers.filter((u) => within(u.last_sign_in_at, 30, now)).length,
        builders: builders.size,
        suppliers: profileRows.filter((p) => p.user_type === 'supplier').length,
        contractors: profileRows.filter((p) => p.user_type === 'contractor').length,
        paidUsers: profileRows.filter((p) => !['free', 'admin'].includes(p.tier)).length,
        invites: (projectShares.data?.length ?? 0) + (quickShares.data?.length ?? 0),
        acceptedInvites,
        quoteRequests30d: rfqs.data?.length ?? 0,
        openTickets,
        pendingApplications,
        pendingPriceReviews: reviews.count ?? 0,
      },
      trends: {
        weeks: WEEKS,
        projects: weekly(projectRows.map((p) => p.created_at), now),
        quickEstimates: weekly(quickRows.map((q) => q.created_at), now),
        signups: weekly(profileRows.map((p) => p.created_at), now),
      },
      quickByType,
      priceHealth,
      costSplit,
      recent,
    });
  } catch (error) {
    console.error('Admin overview failed', error);
    return NextResponse.json({ error: 'Could not load admin overview.' }, { status: 500 });
  }
}
