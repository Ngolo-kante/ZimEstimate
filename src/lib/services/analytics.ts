import { supabase } from '@/lib/supabase';
import type {
  Project,
  ProjectStatus,
  ProjectStage,
  PurchaseRecord,
  RfqRecipient,
  RfqQuote,
  Supplier,
} from '@/lib/database.types';
import { getPriceWithTrend } from '@/lib/services/prices';
import { materials } from '@/lib/materials';

// TYPE-002 FIX: Removed `as any` cast - use supabase directly with proper types
// PERF-001: Added query limits to prevent unbounded result sets

export interface SpendTimelinePoint {
  month: string;
  spendUsd: number;
}

export interface SupplierSpendRow {
  name: string;
  spendUsd: number;
  sharePct: number;
}

export interface PriceTrendRow {
  materialKey: string;
  name: string;
  priceUsd: number;
  changePct: number;
  trend: 'up' | 'down' | 'stable';
  history: { date: Date; price: number }[];
}

export interface ProjectComparisonRow {
  id: string;
  name: string;
  status: ProjectStatus;
  spendUsd: number;
  budgetUsd: number;
  completionPct: number;
}

export interface BuilderAnalyticsData {
  project: Project | null;
  spendUsd: number;
  budgetUsd: number;
  varianceUsd: number;
  completionPct: number;
  spendTimeline: SpendTimelinePoint[];
  supplierSpend: SupplierSpendRow[];
  priceTrends: PriceTrendRow[];
  projectComparisons: ProjectComparisonRow[];
}

export interface SupplierAnalyticsData {
  supplier: Supplier | null;
  responseRate: number;
  acceptanceRate: number;
  avgResponseHours: number;
  revenueUsd: number;
  ratingBreakdown: Array<{ stars: number; sharePct: number }>;
  quoteHistory: Array<{ rfqId: string; status: string; submittedAt: string | null; totalUsd: number | null }>;
  revenueTimeline: Array<{ month: string; revenueUsd: number }>;
  platformBenchmarks: { responseRate: number; acceptanceRate: number };
}

function buildMonthBuckets(monthCount: number): Array<{ key: string; label: string }> {
  const buckets: Array<{ key: string; label: string }> = [];
  const now = new Date();

  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    buckets.push({ key, label });
  }

  return buckets;
}

function computeCompletion(stages: ProjectStage[]): number {
  if (!stages || stages.length === 0) return 0;
  const applicable = stages.filter((stage) => stage.is_applicable);
  const target = applicable.length > 0 ? applicable : stages;
  const completed = target.filter((stage) => stage.status === 'completed').length;
  return Math.round((completed / target.length) * 1000) / 10;
}

function computeSpend(records: PurchaseRecord[]): number {
  return records.reduce((sum, record) => sum + Number(record.quantity) * Number(record.unit_price_usd), 0);
}

function buildSpendTimeline(records: PurchaseRecord[], months = 6): SpendTimelinePoint[] {
  const buckets = buildMonthBuckets(months);
  const totals = new Map<string, number>();

  records.forEach((record) => {
    if (!record.purchased_at) return;
    const date = new Date(record.purchased_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    totals.set(key, (totals.get(key) || 0) + Number(record.quantity) * Number(record.unit_price_usd));
  });

  return buckets.map((bucket) => ({
    month: bucket.label,
    spendUsd: totals.get(bucket.key) || 0,
  }));
}

function buildSupplierSpend(records: PurchaseRecord[]): SupplierSpendRow[] {
  const totals = new Map<string, number>();

  records.forEach((record) => {
    const name = record.supplier_name || 'Unknown Supplier';
    totals.set(name, (totals.get(name) || 0) + Number(record.quantity) * Number(record.unit_price_usd));
  });

  const totalSpend = Array.from(totals.values()).reduce((sum, value) => sum + value, 0) || 1;
  const rows = Array.from(totals.entries()).map(([name, spendUsd]) => ({
    name,
    spendUsd,
    sharePct: (spendUsd / totalSpend) * 100,
  }));

  return rows.sort((a, b) => b.spendUsd - a.spendUsd);
}

function buildRatingBreakdown(rating: number | null): Array<{ stars: number; sharePct: number }> {
  const baseRating = rating ?? 0;
  const weights = [5, 4, 3, 2, 1].map((star) => {
    const diff = Math.abs(star - baseRating);
    return Math.max(0.05, 1 - diff / 2.5);
  });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;

  return [5, 4, 3, 2, 1].map((star, index) => ({
    stars: star,
    sharePct: (weights[index] / total) * 100,
  }));
}

/** Fetch analytics for a builder's project portfolio. */
export async function getBuilderAnalytics(
  projectId: string,
  watchedMaterials: string[] = []
): Promise<{ data: BuilderAnalyticsData | null; error: Error | null }> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { data: null, error: new Error('Not authenticated') };
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) {
    return { data: null, error: new Error(projectError.message) };
  }

  const { data: stages } = await supabase
    .from('project_stages')
    .select('*')
    .eq('project_id', projectId);

  const { data: purchases } = await supabase
    .from('purchase_records')
    .select('*')
    .eq('project_id', projectId);

  const records = (purchases || []) as PurchaseRecord[];
  const spendUsd = computeSpend(records);
  const budgetUsd = Number(project?.budget_target_usd ?? project?.total_usd ?? 0);
  const varianceUsd = budgetUsd - spendUsd;
  const completionPct = computeCompletion((stages || []) as ProjectStage[]);
  const spendTimeline = buildSpendTimeline(records, 6);
  const supplierSpend = buildSupplierSpend(records);

  const materialMap = new Map(materials.map((m) => [m.id, m.name]));
  const priceTrends = await Promise.all(
    watchedMaterials.map(async (materialKey) => {
      const trend = await getPriceWithTrend(materialKey);
      if (!trend) return null;
      return {
        materialKey,
        name: materialMap.get(materialKey) || materialKey,
        priceUsd: trend.priceUsd,
        changePct: trend.changePercent,
        trend: trend.trend,
        history: trend.priceHistory,
      } as PriceTrendRow;
    })
  );

  const { data: otherProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', authData.user.id)
    .neq('id', projectId)
    .order('updated_at', { ascending: false })
    .limit(5);

  const comparisonProjects = (otherProjects || []) as Project[];
  const comparisonIds = comparisonProjects.map((p) => p.id);

  const { data: comparisonPurchases } = comparisonIds.length
    ? await supabase
        .from('purchase_records')
        .select('project_id, quantity, unit_price_usd')
        .in('project_id', comparisonIds)
    : { data: [] };

  const spendByProject = new Map<string, number>();
  (comparisonPurchases || []).forEach((record: { project_id: string; quantity: number; unit_price_usd: number }) => {
    spendByProject.set(
      record.project_id,
      (spendByProject.get(record.project_id) || 0) + Number(record.quantity) * Number(record.unit_price_usd)
    );
  });

  const { data: comparisonStages } = comparisonIds.length
    ? await supabase
        .from('project_stages')
        .select('*')
        .in('project_id', comparisonIds)
    : { data: [] };

  const stagesByProject = new Map<string, ProjectStage[]>();
  (comparisonStages || []).forEach((stage: ProjectStage) => {
    const list = stagesByProject.get(stage.project_id) || [];
    list.push(stage);
    stagesByProject.set(stage.project_id, list);
  });

  const projectComparisons: ProjectComparisonRow[] = comparisonProjects.map((comparison) => {
    const comparisonSpend = spendByProject.get(comparison.id) || 0;
    const comparisonBudget = Number(comparison.budget_target_usd ?? comparison.total_usd ?? 0);
    const comparisonCompletion = computeCompletion(stagesByProject.get(comparison.id) || []);
    return {
      id: comparison.id,
      name: comparison.name,
      status: comparison.status,
      spendUsd: comparisonSpend,
      budgetUsd: comparisonBudget,
      completionPct: comparisonCompletion,
    };
  });

  return {
    data: {
      project: project as Project,
      spendUsd,
      budgetUsd,
      varianceUsd,
      completionPct,
      spendTimeline,
      supplierSpend,
      priceTrends: priceTrends.filter(Boolean) as PriceTrendRow[],
      projectComparisons,
    },
    error: null,
  };
}

/** Fetch analytics for an individual supplier. */
export async function getSupplierAnalytics(
  supplierId: string
): Promise<{ data: SupplierAnalyticsData | null; error: Error | null }> {
  const { data: supplier, error: supplierError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .is('deleted_at', null)
    .single();

  if (supplierError) {
    return { data: null, error: new Error(supplierError.message) };
  }

  const { data: recipients } = await supabase
    .from('rfq_recipients')
    .select('*')
    .eq('supplier_id', supplierId);

  const { data: quotes } = await supabase
    .from('rfq_quotes')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('submitted_at', { ascending: false });

  const recipientRows = (recipients || []) as RfqRecipient[];
  const quoteRows = (quotes || []) as RfqQuote[];

  const responseRate = recipientRows.length > 0 ? (quoteRows.length / recipientRows.length) * 100 : 0;
  const acceptedQuotes = quoteRows.filter((quote) => quote.status === 'accepted');
  const acceptanceRate = quoteRows.length > 0 ? (acceptedQuotes.length / quoteRows.length) * 100 : 0;
  const revenueUsd = acceptedQuotes.reduce((sum, quote) => sum + Number(quote.total_usd || 0), 0);

  const recipientMap = new Map<string, Date>();
  recipientRows.forEach((recipient) => {
    if (recipient.notified_at) {
      recipientMap.set(recipient.rfq_id, new Date(recipient.notified_at));
    }
  });

  const responseTimes = quoteRows
    .map((quote) => {
      const notified = recipientMap.get(quote.rfq_id);
      if (!notified || !quote.submitted_at) return null;
      const submitted = new Date(quote.submitted_at);
      const diffHours = (submitted.getTime() - notified.getTime()) / (1000 * 60 * 60);
      return diffHours;
    })
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  const avgResponseHours = responseTimes.length > 0
    ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
    : 0;

  const ratingBreakdown = buildRatingBreakdown(Number(supplier.rating || 0));

  const quoteHistory = quoteRows.slice(0, 10).map((quote) => ({
    rfqId: quote.rfq_id,
    status: quote.status,
    submittedAt: quote.submitted_at,
    totalUsd: quote.total_usd,
  }));

  const buckets = buildMonthBuckets(6);
  const revenueTotals = new Map<string, number>();
  acceptedQuotes.forEach((quote) => {
    if (!quote.submitted_at) return;
    const date = new Date(quote.submitted_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    revenueTotals.set(key, (revenueTotals.get(key) || 0) + Number(quote.total_usd || 0));
  });

  const revenueTimeline = buckets.map((bucket) => ({
    month: bucket.label,
    revenueUsd: revenueTotals.get(bucket.key) || 0,
  }));

  // PERF-001 FIX: Use count queries instead of fetching all rows
  // This prevents loading millions of rows for simple statistics
  const { count: recipientCount } = await supabase
    .from('rfq_recipients')
    .select('id', { count: 'exact', head: true });

  const { count: quoteCount } = await supabase
    .from('rfq_quotes')
    .select('id', { count: 'exact', head: true });

  const { count: acceptedCount } = await supabase
    .from('rfq_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted');

  const platformResponseRate = recipientCount && recipientCount > 0
    ? ((quoteCount || 0) / recipientCount) * 100
    : 0;
  const platformAcceptanceRate = quoteCount && quoteCount > 0
    ? ((acceptedCount || 0) / quoteCount) * 100
    : 0;

  return {
    data: {
      supplier: supplier as Supplier,
      responseRate,
      acceptanceRate,
      avgResponseHours,
      revenueUsd,
      ratingBreakdown,
      quoteHistory,
      revenueTimeline,
      platformBenchmarks: {
        responseRate: platformResponseRate,
        acceptanceRate: platformAcceptanceRate,
      },
    },
    error: null,
  };
}
