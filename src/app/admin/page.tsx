'use client';

// Admin overview: the first page an admin lands on. What needs attention,
// whether the site is growing and being used, how current the public prices
// are, and the latest work people have created. Everything comes from
// /api/admin/overview, which counts stored records — not page visits.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/lib/supabase';
import CostDonut, { SERIES_COLORS } from '@/components/ui/CostDonut';

type Metrics = {
  projects: number; projects30d: number; activeProjects: number;
  quickEstimates: number; quickEstimates30d: number; sharedEstimateLinks: number;
  users: number; users30d: number; activeUsers7d: number; activeUsers30d: number;
  builders: number; suppliers: number; contractors: number; paidUsers: number;
  invites: number; acceptedInvites: number; quoteRequests30d: number;
  openTickets: number; pendingApplications: number; pendingPriceReviews: number;
};
type Overview = {
  updatedAt: string;
  metrics: Metrics;
  trends: { weeks: number; projects: number[]; quickEstimates: number[]; signups: number[] };
  quickByType: { type: string; label: string; count: number }[];
  priceHealth: { manual: number; scraped: number; reference: number; unpriced: number; total: number };
  costSplit: { category: string; label: string; totalUsd: number; projects: number }[];
  recent: { id: string; kind: string; name: string; detail: string; owner: string; created_at: string }[];
};

const n = (value: number | undefined) => (value == null ? '—' : value.toLocaleString());

function Stat({ label, value, note }: { label: string; value: number | undefined; note: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-slate-950">{n(value)}</div>
      <div className="mt-1 text-sm text-slate-600">{note}</div>
    </div>
  );
}

/** Eight weekly bars, oldest on the left. */
function WeeklyBars({ label, values }: { label: string; values: number[] }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, v) => sum + v, 0);
  const thisWeek = values[values.length - 1] ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <span className="text-xs text-slate-500">{total} in 8 weeks · {thisWeek} this week</span>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5" role="img" aria-label={`${label}, last 8 weeks, oldest first: ${values.join(', ')}`}>
        {values.map((value, index) => (
          <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-slate-500">{value || ''}</span>
            <div
              className={`w-full rounded-t ${index === values.length - 1 ? 'bg-blue-600' : 'bg-blue-200'}`}
              style={{ height: `${Math.max(value ? 6 : 2, (value / max) * 72)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>8 weeks ago</span><span>This week</span></div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { adminId, checking } = useAdminAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load the overview.');
      setData(body as Overview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (adminId) void load(); }, [adminId, load]);

  if (checking) return <p className="p-8 text-slate-600">Checking admin access…</p>;

  const m = data?.metrics;
  const attention = [
    { label: 'Open support tickets', value: m?.openTickets, href: '/admin/tickets', action: 'Answer tickets' },
    { label: 'Supplier applications', value: m?.pendingApplications, href: '/admin/suppliers', action: 'Review applications' },
    { label: 'Scraped prices to match', value: m?.pendingPriceReviews, href: '/admin/scraper-review', action: 'Open review queue' },
  ];
  const ph = data?.priceHealth;
  const typeMax = Math.max(1, ...(data?.quickByType.map((t) => t.count) ?? [0]));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Admin hub</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Overview</h1>
          <p className="mt-2 text-sm text-slate-600">
            How ZimEstimate is being used, from saved records. Page visits are not tracked here.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error} <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Try again</button></p>}

      {/* What is waiting on an admin */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="mb-3 text-lg font-bold text-slate-950">Needs your attention</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {attention.map((item) => {
            const waiting = (item.value ?? 0) > 0;
            return (
              <Link key={item.label} href={item.href} className={`rounded-xl border p-5 shadow-sm transition hover:shadow-md ${waiting ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{item.label}</div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-slate-950">{loading ? '…' : n(item.value)}</div>
                <div className={`mt-1 text-sm font-semibold ${waiting ? 'text-amber-900' : 'text-slate-500'}`}>{waiting ? `${item.action} →` : 'Nothing waiting'}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Growth and use */}
      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="mb-3 text-lg font-bold text-slate-950">Projects and people</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Full projects" value={m?.projects} note={`${n(m?.projects30d)} new in 30 days · ${n(m?.activeProjects)} active`} />
          <Stat label="Quick estimates" value={m?.quickEstimates} note={`${n(m?.quickEstimates30d)} new in 30 days · ${n(m?.sharedEstimateLinks)} shared by link`} />
          <Stat label="Registered users" value={m?.users} note={`${n(m?.users30d)} joined in 30 days`} />
          <Stat label="Signed in, last 7 days" value={m?.activeUsers7d} note={`${n(m?.activeUsers30d)} in the last 30 days`} />
          <Stat label="People with saved work" value={m?.builders} note="Saved at least one project or estimate" />
          <Stat label="Invites sent" value={m?.invites} note={`${n(m?.acceptedInvites)} accepted (builders, installers)`} />
          <Stat label="Quote requests" value={m?.quoteRequests30d} note="Sent to suppliers in 30 days" />
          <Stat label="Suppliers · contractors" value={m ? m.suppliers + m.contractors : undefined} note={`${n(m?.suppliers)} suppliers, ${n(m?.contractors)} contractors · ${n(m?.paidUsers)} paid`} />
        </div>
      </section>

      {/* Week by week */}
      <section aria-labelledby="trend-heading">
        <h2 id="trend-heading" className="mb-3 text-lg font-bold text-slate-950">Week by week</h2>
        {data ? (
          <div className="grid gap-3 md:grid-cols-3">
            <WeeklyBars label="Full projects created" values={data.trends.projects} />
            <WeeklyBars label="Quick estimates saved" values={data.trends.quickEstimates} />
            <WeeklyBars label="New sign-ups" values={data.trends.signups} />
          </div>
        ) : <p className="text-sm text-slate-500">{loading ? 'Loading…' : 'No data.'}</p>}
      </section>

      {/* What people are pricing, across every saved full-build BOQ */}
      <section aria-labelledby="cost-split-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="cost-split-heading" className="text-lg font-bold text-slate-950">What people are pricing</h2>
        <p className="mt-1 text-sm text-slate-600">Estimated value of every saved full-build BOQ, by stage. Quick estimates are not included.</p>
        <div className="mt-4">
          {data && data.costSplit.length === 0 && <p className="text-sm text-slate-500">No priced BOQs yet.</p>}
          {data && data.costSplit.length > 0 && (
            <CostDonut
              centerLabel="All projects"
              slices={data.costSplit.map((row, index) => ({
                label: row.label,
                value: row.totalUsd,
                color: SERIES_COLORS[index % SERIES_COLORS.length],
                note: `${row.projects.toLocaleString()} ${row.projects === 1 ? 'project' : 'projects'}`,
              }))}
            />
          )}
          {!data && <p className="text-sm text-slate-500">{loading ? 'Loading…' : 'No data.'}</p>}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Which quick estimates people save */}
        <section aria-labelledby="types-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="types-heading" className="text-lg font-bold text-slate-950">Quick estimates by type</h2>
          {data && data.quickByType.length === 0 && <p className="mt-3 text-sm text-slate-500">None saved yet.</p>}
          <ul className="mt-4 space-y-3">
            {data?.quickByType.map((t) => (
              <li key={t.type}>
                <div className="flex justify-between text-sm"><span className="font-medium text-slate-800">{t.label}</span><span className="tabular-nums text-slate-600">{t.count}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${(t.count / typeMax) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        {/* Whether public prices are current */}
        <section aria-labelledby="prices-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="prices-heading" className="text-lg font-bold text-slate-950">Public prices</h2>
            <Link href="/admin/content" className="text-sm font-semibold text-blue-700 hover:underline">Edit prices →</Link>
          </div>
          {ph && (
            <>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img"
                aria-label={`${ph.manual} set by an admin, ${ph.scraped} from suppliers in the last 30 days, ${ph.reference} reference only, ${ph.unpriced} unpriced`}>
                <div className="bg-blue-600" style={{ width: `${(ph.manual / ph.total) * 100}%` }} />
                <div className="bg-emerald-500" style={{ width: `${(ph.scraped / ph.total) * 100}%` }} />
                <div className="bg-slate-300" style={{ width: `${(ph.reference / ph.total) * 100}%` }} />
                <div className="bg-amber-400" style={{ width: `${(ph.unpriced / ph.total) * 100}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Set by an admin</dt><dd className="font-bold tabular-nums text-slate-950">{ph.manual}</dd></div>
                <div><dt className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />From suppliers, last 30 days</dt><dd className="font-bold tabular-nums text-slate-950">{ph.scraped}</dd></div>
                <div><dt className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />Reference price only</dt><dd className="font-bold tabular-nums text-slate-950">{ph.reference}</dd></div>
                <div><dt className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />No price</dt><dd className="font-bold tabular-nums text-slate-950">{ph.unpriced}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                {ph.reference} of {ph.total} materials show the built-in reference price because nothing newer exists. Publishing a price, or a fresh scrape, replaces it.
              </p>
            </>
          )}
        </section>
      </div>

      {/* Latest work */}
      <section aria-labelledby="recent-heading" className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 id="recent-heading" className="border-b border-slate-200 px-5 py-4 text-lg font-bold text-slate-950">Recently created</h2>
        {data && data.recent.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">Nothing yet.</p>}
        <ul className="divide-y divide-slate-100">
          {data?.recent.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-500">{r.kind} · {r.detail} · {r.owner}</div>
              </div>
              <span className="text-xs tabular-nums text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </section>

      {data?.updatedAt && <p className="text-xs text-slate-500">Updated {new Date(data.updatedAt).toLocaleString()}</p>}
    </div>
  );
}
