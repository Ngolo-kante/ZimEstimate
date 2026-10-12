'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/lib/supabase';
import { categoryInfo, getBestPrice, materials } from '@/lib/materials';
import { MANUAL_PRICE_SOURCE, selectPublishedObservation, type PublishedObservation } from '@/lib/pricing/publishedPrice';

const money = (value: number | null) => value == null ? '—' : `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1 ? 3 : 2, maximumFractionDigits: value < 1 ? 4 : 2 })}`;

export default function AdminPricesPage() {
  const { adminId, checking } = useAdminAuth();
  const [observations, setObservations] = useState<PublishedObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [usd, setUsd] = useState('');
  const [zwg, setZwg] = useState('');
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Your session expired. Please sign in again.');
    const response = await fetch('/api/admin/prices', {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load prices.');
    return data as { observations?: PublishedObservation[] };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setObservations((await request()).observations ?? []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load prices.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { if (adminId) void load(); }, [adminId, load]);

  const rows = useMemo(() => materials.map((material) => {
    const baseline = getBestPrice(material.id);
    const published = selectPublishedObservation(observations.filter((row) => row.material_key === material.id), material.unit, baseline?.priceUsd);
    return {
      material, published,
      priceUsd: published?.price_usd ?? baseline?.priceUsd ?? null,
      priceZwg: published?.price_zwg ?? baseline?.priceZwg ?? null,
      source: published?.source_name === MANUAL_PRICE_SOURCE ? 'Manual' : published ? 'Scraped' : baseline ? 'Reference' : 'Unpriced',
      updated: published?.scraped_at ?? baseline?.lastUpdated ?? null,
    };
  }), [observations]);
  const shown = rows.filter((row) => `${row.material.name} ${row.material.id} ${row.material.subcategory}`.toLowerCase().includes(search.toLowerCase()) && (category === 'all' || row.material.category === category) && (sourceFilter === 'all' || row.source === sourceFilter));

  const mutate = async (materialKey: string, action: 'publish' | 'withdraw') => {
    if (action === 'publish' && (!usd.trim() || !Number.isFinite(Number(usd)) || Number(usd) <= 0)) { setError('Enter a positive USD price.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      await request({ materialKey, action, priceUsd: usd, priceZwg: zwg });
      setEditing(null);
      await load();
      setNotice(action === 'publish' ? 'Manual price published. It now appears on public price pages.' : 'Manual price withdrawn. The approved scraped or reference price now appears.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save price.'); }
    finally { setSaving(false); }
  };

  if (checking) return <p className="p-8 text-slate-600">Checking admin access…</p>;
  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Catalog & publishing</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Material prices</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Edit any catalog price. Manual prices take priority over scraper updates until you withdraw them.</p></div>
      <div className="flex gap-2"><Link href="/admin/scraper" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Manage scrapers</Link><Link href="/market-insights" className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">View public prices ↗</Link></div>
    </header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Price coverage">
      {([['Catalog items', rows.length], ['Manual prices', rows.filter((r) => r.source === 'Manual').length], ['Scraped prices', rows.filter((r) => r.source === 'Scraped').length], ['Unpriced', rows.filter((r) => r.source === 'Unpriced').length]] as const).map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-950">{value}</div></div>)}
    </div>
    <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">Public price pages use the manual price first, then an approved scrape from the last 30 days, then the reference price. Existing saved estimates keep their own amounts.</p>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
    <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-600">Search materials<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
      <label className="text-xs font-semibold text-slate-600">Category<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="all">All categories</option>{Object.entries(categoryInfo).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600">Source<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="all">All sources</option><option>Manual</option><option>Scraped</option><option>Reference</option><option>Unpriced</option></select></label>
      <button type="button" onClick={() => void load()} className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Refresh</button>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">Showing <strong>{shown.length}</strong> of {rows.length} materials</div>
      {loading ? <p className="p-8 text-sm text-slate-500">Loading published prices…</p> : shown.length === 0 ? <p className="p-8 text-sm text-slate-500">No materials match these filters.</p> : <div className="divide-y divide-slate-100">{shown.map((row) => <div key={row.material.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr_auto] md:items-center">
        <div><div className="font-semibold text-slate-950">{row.material.name}</div><div className="text-xs text-slate-500">{row.material.id} · {row.material.unit}</div></div>
        <div className="text-xs text-slate-600">{categoryInfo[row.material.category].label}</div>
        <div><div className="text-xs text-slate-500">USD</div><div className="font-semibold tabular-nums text-slate-950">{money(row.priceUsd)}</div></div>
        <div><div className="text-xs text-slate-500">ZWG</div><div className="font-medium tabular-nums text-slate-700">{row.priceZwg == null ? '—' : row.priceZwg.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></div>
        <div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.source === 'Manual' ? 'bg-blue-100 text-blue-800' : row.source === 'Scraped' ? 'bg-emerald-100 text-emerald-800' : row.source === 'Unpriced' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{row.source}</span><div className="mt-1 text-xs text-slate-500">{row.updated ? new Date(row.updated).toLocaleDateString() : 'No date'}</div></div>
        <button type="button" onClick={() => { setEditing(row.material.id); setUsd(row.priceUsd == null ? '' : String(row.priceUsd)); setZwg(row.priceZwg == null ? '' : String(row.priceZwg)); setError(''); setNotice(''); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Edit price</button>
        {editing === row.material.id && <div className="rounded-lg bg-slate-50 p-4 md:col-span-6"><div className="mb-3 text-sm font-semibold text-slate-900">Publish price for {row.material.name} <span className="font-normal text-slate-500">({row.material.unit})</span></div><div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-600">USD price<input aria-label="USD price" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs font-semibold text-slate-600">ZWG price (optional)<input aria-label="ZWG price" inputMode="decimal" value={zwg} onChange={(e) => setZwg(e.target.value)} className="mt-1 block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
          <button type="button" disabled={saving} onClick={() => void mutate(row.material.id, 'publish')} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Publishing…' : 'Publish price'}</button>
          {row.source === 'Manual' && <button type="button" disabled={saving} onClick={() => void mutate(row.material.id, 'withdraw')} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Withdraw manual price</button>}
          <button type="button" onClick={() => setEditing(null)} className="px-2 py-2 text-sm text-slate-600">Cancel</button>
        </div></div>}
      </div>)}</div>}
    </div>
  </div>;
}
