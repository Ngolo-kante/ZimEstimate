'use client';

// Catalog & prices: every material the public sees, with its price and where
// that price came from, and everything an admin can change about it —
// publish or withdraw a price, edit the name and description, add a product,
// hide one, see its price history, update many prices at once, and choose
// the three prices on the home page.
//
// Reads /api/admin/prices (prices + catalog edits); writes through
// /api/admin/prices and /api/admin/catalog, both audit-logged.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { supabase } from '@/lib/supabase';
import { categoryInfo, getBestPrice, materials, type Material, type MaterialCategory } from '@/lib/materials';
import { MANUAL_PRICE_SOURCE, selectPublishedObservation, type PublishedObservation } from '@/lib/pricing/publishedPrice';
import { featuredKeys, mergeCatalog, type CatalogRow } from '@/lib/catalog/mergeCatalog';

type Source = 'Manual' | 'Scraped' | 'Reference' | 'Unpriced';
type Row = { material: Material; priceUsd: number | null; priceZwg: number | null; source: Source; updated: string | null };
type HistoryRow = PublishedObservation & { location?: string | null };
type Panel = { id: string; mode: 'price' | 'details' | 'history' } | null;
type Details = { name: string; description: string; category: MaterialCategory; subcategory: string; unit: string };
type BulkLine = { line: number; key: string; usd: string; zwg: string; material?: Material; current: number | null; error?: string };

const money = (value: number | null) =>
  value == null ? '—' : `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1 ? 3 : 2, maximumFractionDigits: value < 1 ? 4 : 2 })}`;
const SOURCE_STYLE: Record<Source, string> = {
  Manual: 'bg-blue-100 text-blue-800',
  Scraped: 'bg-emerald-100 text-emerald-800',
  Reference: 'bg-slate-100 text-slate-700',
  Unpriced: 'bg-amber-100 text-amber-800',
};
const SOURCE_LABEL: Record<Source, string> = { Manual: 'Set by admin', Scraped: 'Supplier scrape', Reference: 'Reference', Unpriced: 'No price' };
const emptyDetails: Details = { name: '', description: '', category: 'cement', subcategory: '', unit: '' };
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900';

/** "code, usd, zwg" per line; a header row and blank lines are skipped. */
function parseBulk(text: string, byKey: Map<string, Material>, currentOf: (id: string) => number | null): BulkLine[] {
  return text.split(/\r?\n/).map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter(({ raw }) => raw && !/^(material|code|key)/i.test(raw))
    .map(({ raw, line }) => {
      const [key = '', usd = '', zwg = ''] = raw.split(/\t|,/).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      const material = byKey.get(key);
      const value = Number(usd.replace(/[$\s]/g, ''));
      const error = !material ? 'Unknown material code' : !(value > 0) ? 'Price must be a positive number' : undefined;
      return { line, key, usd, zwg, material, current: material ? currentOf(material.id) : null, error };
    });
}

export default function AdminCatalogPage() {
  const { adminId, checking } = useAdminAuth();
  const [observations, setObservations] = useState<PublishedObservation[]>([]);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [usd, setUsd] = useState('');
  const [zwg, setZwg] = useState('');
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);

  const call = useCallback(async (path: string, body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Your session expired. Please sign in again.');
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await call('/api/admin/prices');
      setObservations(data.observations ?? []);
      setCatalogRows(data.catalogRows ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load prices.');
    } finally {
      setLoading(false);
    }
  }, [call]);
  useEffect(() => { if (adminId) void load(); }, [adminId, load]);

  const catalog = useMemo(() => mergeCatalog(materials, catalogRows), [catalogRows]);
  const byKey = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);
  const featured = useMemo(() => featuredKeys(catalogRows), [catalogRows]);
  const edited = useMemo(() => new Set(catalogRows.filter((r) => !r.is_custom && (r.name || r.description !== null || r.category || r.subcategory)).map((r) => r.material_key)), [catalogRows]);

  const rows: Row[] = useMemo(() => catalog.map((material) => {
    const baseline = getBestPrice(material.id);
    const published = selectPublishedObservation(observations.filter((o) => o.material_key === material.id), material.unit, baseline?.priceUsd);
    return {
      material,
      priceUsd: published?.price_usd ?? baseline?.priceUsd ?? null,
      priceZwg: published?.price_zwg ?? baseline?.priceZwg ?? null,
      source: published?.source_name === MANUAL_PRICE_SOURCE ? 'Manual' : published ? 'Scraped' : baseline ? 'Reference' : 'Unpriced',
      updated: published?.scraped_at ?? baseline?.lastUpdated ?? null,
    };
  }), [catalog, observations]);
  const priceOf = useCallback((id: string) => rows.find((r) => r.material.id === id)?.priceUsd ?? null, [rows]);

  const shown = rows.filter((row) => {
    const haystack = `${row.material.name} ${row.material.id} ${row.material.subcategory} ${row.material.specifications ?? ''}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (category !== 'all' && row.material.category !== category) return false;
    if (sourceFilter === 'Hidden') return Boolean(row.material.hidden);
    if (sourceFilter === 'Added') return Boolean(row.material.custom);
    if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
    return true;
  });

  const run = async (work: () => Promise<unknown>, done: string) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await work();
      await load();
      setNotice(done);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change was not saved.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openPanel = async (row: Row, mode: 'price' | 'details' | 'history') => {
    if (panel?.id === row.material.id && panel.mode === mode) { setPanel(null); return; }
    setPanel({ id: row.material.id, mode });
    setError('');
    setNotice('');
    if (mode === 'price') {
      setUsd(row.priceUsd == null ? '' : String(row.priceUsd));
      setZwg(row.priceZwg == null ? '' : String(row.priceZwg));
    } else if (mode === 'details') {
      const m = row.material;
      setDetails({ name: m.name, description: m.specifications ?? '', category: m.category, subcategory: m.subcategory, unit: m.unit });
    } else {
      setHistory(null);
      try { setHistory((await call(`/api/admin/prices?history=${encodeURIComponent(row.material.id)}`)).history ?? []); }
      catch { setHistory([]); }
    }
  };

  const publish = (materialKey: string) => {
    if (!(Number(usd) > 0)) { setError('Enter a positive USD price.'); return; }
    void run(() => call('/api/admin/prices', { action: 'publish', materialKey, priceUsd: usd, priceZwg: zwg }), 'Price published. It now shows on the public price list and home page.')
      .then((ok) => { if (ok) setPanel(null); });
  };
  const withdraw = (materialKey: string) =>
    void run(() => call('/api/admin/prices', { action: 'withdraw', materialKey }), 'Your price was withdrawn. The scraped or reference price shows again.')
      .then((ok) => { if (ok) setPanel(null); });
  const saveDetails = (materialKey?: string) =>
    run(() => call('/api/admin/catalog', { action: 'save', materialKey, ...details }), materialKey ? 'Details saved.' : 'Product added.');
  const catalogAction = (action: 'hide' | 'show' | 'reset', materialKey: string, done: string) =>
    void run(() => call('/api/admin/catalog', { action, materialKey }), done).then((ok) => { if (ok) setPanel(null); });
  const feature = (slot: number, materialKey: string) =>
    void run(() => call('/api/admin/catalog', { action: 'feature', slot, materialKey: materialKey || null }), `Home page slot ${slot} updated.`);

  const addProduct = async () => {
    const result = await run(async () => {
      const added = await call('/api/admin/catalog', { action: 'save', ...details });
      if (newPrice.trim()) await call('/api/admin/prices', { action: 'publish', materialKey: added.materialKey, priceUsd: newPrice, priceZwg: '' });
    }, 'Product added. It now appears in the price list, marketplace and the BOQ "add item" picker.');
    if (result) { setAdding(false); setDetails(emptyDetails); setNewPrice(''); }
  };

  const bulkLines = useMemo(() => parseBulk(bulkText, byKey, priceOf), [bulkText, byKey, priceOf]);
  const bulkGood = bulkLines.filter((l) => !l.error);
  const publishBulk = () =>
    void run(async () => {
      const result = await call('/api/admin/prices', { action: 'bulk', rows: bulkGood.map((l) => ({ materialKey: l.key, priceUsd: l.usd, priceZwg: l.zwg })) });
      if (result.failed?.length) throw new Error(`${result.published} published; ${result.failed.length} were refused.`);
    }, `${bulkGood.length} price${bulkGood.length === 1 ? '' : 's'} published.`).then((ok) => { if (ok) { setBulkOpen(false); setBulkText(''); } });

  const downloadCsv = () => {
    const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = ['material_code,price_usd,price_zwg,name,unit,source',
      ...rows.filter((r) => !r.material.hidden).map((r) => [r.material.id, r.priceUsd ?? '', r.priceZwg ?? '', quote(r.material.name), quote(r.material.unit), SOURCE_LABEL[r.source]].join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `zimestimate-prices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (checking) return <p className="p-8 text-slate-600">Checking admin access…</p>;

  const visible = rows.filter((r) => !r.material.hidden);
  const count = (source: Source) => visible.filter((r) => r.source === source).length;
  const detailsForm = (isNew: boolean, unitLocked: boolean) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Name
        <input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} maxLength={120} className={inputClass} />
      </label>
      <label className="text-xs font-semibold text-slate-600">How it is sold (unit)
        <input value={details.unit} onChange={(e) => setDetails({ ...details, unit: e.target.value })} disabled={unitLocked} maxLength={40}
          placeholder="e.g. per 50kg bag, each, per m²" className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`} />
        {unitLocked && <span className="mt-1 block font-normal text-slate-500">Fixed for built-in materials — estimates calculate quantities in this unit.</span>}
      </label>
      <label className="text-xs font-semibold text-slate-600">Category
        <select value={details.category} onChange={(e) => setDetails({ ...details, category: e.target.value as MaterialCategory })} className={inputClass}>
          {Object.entries(categoryInfo).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">Type (optional)
        <input value={details.subcategory} onChange={(e) => setDetails({ ...details, subcategory: e.target.value })} maxLength={80} placeholder="e.g. Portland, Cement bricks" className={inputClass} />
      </label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Description (optional)
        <textarea value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} maxLength={500} rows={2}
          placeholder="Brand, size, grade — what a buyer needs to know" className={inputClass} />
      </label>
      {isNew && (
        <label className="text-xs font-semibold text-slate-600">First price in USD (optional)
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} inputMode="decimal" className={inputClass} />
        </label>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Catalog & prices</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Materials and their prices</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Everything the public price list shows. Your prices win over supplier scrapes until you withdraw them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setAdding(!adding); setBulkOpen(false); setDetails(emptyDetails); setNewPrice(''); }} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">+ Add product</button>
          <button type="button" onClick={() => { setBulkOpen(!bulkOpen); setAdding(false); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Update many prices</button>
          <button type="button" onClick={downloadCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Download prices (CSV)</button>
          <Link href="/market-insights" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">View public list ↗</Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Price coverage">
        {([
          ['Shown to the public', visible.length],
          ['Set by an admin', count('Manual')],
          ['Supplier scrape', count('Scraped')],
          ['Reference only', count('Reference')],
          ['No price', count('Unpriced')],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-950">{loading ? '…' : value}</div>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {adding && (
        <section aria-labelledby="add-heading" className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <h2 id="add-heading" className="mb-1 text-lg font-bold text-slate-950">Add a product</h2>
          <p className="mb-4 text-sm text-slate-600">It appears in the price list, the marketplace and the BOQ “add item” picker for its category. Automatic estimates do not include it.</p>
          {detailsForm(true, false)}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={saving || details.name.trim().length < 2 || !details.unit.trim()} onClick={() => void addProduct()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add product'}</button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </section>
      )}

      {bulkOpen && (
        <section aria-labelledby="bulk-heading" className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <h2 id="bulk-heading" className="mb-1 text-lg font-bold text-slate-950">Update many prices</h2>
          <p className="mb-3 text-sm text-slate-600">
            One material per line: <code className="rounded bg-white px-1">material code, USD price, ZWG price (optional)</code>.
            Easiest: download the prices, change them in Excel or Google Sheets, then paste the rows or choose the file.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv,text/plain" aria-label="Choose a CSV file"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void file.text().then(setBulkText); e.target.value = ''; }}
              className="text-sm text-slate-700" />
          </div>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} aria-label="Prices to publish"
            placeholder={'cement-325, 12.10\nbrick-common, 0.12, 3.4'} className={`${inputClass} font-mono`} />
          {bulkLines.length > 0 && (
            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Material</th><th className="px-3 py-2">Now</th><th className="px-3 py-2">New</th><th className="px-3 py-2">Change</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulkLines.map((l) => {
                    const next = Number(l.usd.replace(/[$\s]/g, ''));
                    const change = l.current && next > 0 ? ((next - l.current) / l.current) * 100 : null;
                    return (
                      <tr key={l.line} className={l.error ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-slate-500">{l.line}</td>
                        <td className="px-3 py-2">{l.material ? l.material.name : <span className="font-mono text-red-700">{l.key || '(blank)'}</span>}{l.error && <div className="text-xs text-red-700">{l.error}</div>}</td>
                        <td className="px-3 py-2 tabular-nums">{money(l.current)}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold">{l.error ? '—' : money(next)}</td>
                        <td className={`px-3 py-2 tabular-nums ${change !== null && Math.abs(change) >= 30 ? 'font-semibold text-amber-700' : 'text-slate-600'}`}>
                          {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(0)}%`}{change !== null && Math.abs(change) >= 30 ? ' — check' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving || bulkGood.length === 0} onClick={publishBulk} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Publishing…' : `Publish ${bulkGood.length} price${bulkGood.length === 1 ? '' : 's'}`}
            </button>
            {bulkLines.length > bulkGood.length && <span className="text-sm text-red-700">{bulkLines.length - bulkGood.length} line{bulkLines.length - bulkGood.length === 1 ? '' : 's'} will be skipped</span>}
            <button type="button" onClick={() => setBulkOpen(false)} className="px-3 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </section>
      )}

      <section aria-labelledby="home-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="home-heading" className="text-lg font-bold text-slate-950">Prices on the home page</h2>
        <p className="mt-1 text-sm text-slate-600">The three materials in the “Current material prices” strip. Empty slots use cement, common brick and Y12 rebar.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((slot) => (
            <label key={slot} className="text-xs font-semibold text-slate-600">Slot {slot}
              <select value={featured[slot - 1] ?? ''} disabled={saving || loading} onChange={(e) => feature(slot, e.target.value)} className={inputClass}>
                <option value="">Default</option>
                {visible.map((r) => <option key={r.material.id} value={r.material.id}>{r.material.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-600">Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, code or description" className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-slate-600">Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="all">All categories</option>
            {Object.entries(categoryInfo).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Show
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={inputClass}>
            <option value="all">Everything</option>
            <option value="Manual">Set by an admin</option>
            <option value="Scraped">Supplier scrape</option>
            <option value="Reference">Reference only</option>
            <option value="Unpriced">No price</option>
            <option value="Added">Products you added</option>
            <option value="Hidden">Hidden</option>
          </select>
        </label>
        <button type="button" onClick={() => void load()} className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Refresh</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">Showing <strong>{shown.length}</strong> of {rows.length} materials</div>
        {loading ? <p className="p-8 text-sm text-slate-500">Loading prices…</p> : shown.length === 0 ? <p className="p-8 text-sm text-slate-500">No materials match these filters.</p> : (
          <ul className="divide-y divide-slate-100">
            {shown.map((row) => {
              const m = row.material;
              const open = panel?.id === m.id ? panel.mode : null;
              const slot = featured.indexOf(m.id) + 1;
              return (
                <li key={m.id} className={`px-4 py-4 ${m.hidden ? 'bg-slate-50' : ''}`}>
                  <div className="grid gap-3 md:grid-cols-[minmax(220px,2.4fr)_1fr_1fr_1.1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-semibold ${m.hidden ? 'text-slate-500' : 'text-slate-950'}`}>{m.name}</span>
                        {m.custom && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Added</span>}
                        {edited.has(m.id) && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Edited</span>}
                        {m.hidden && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Hidden</span>}
                        {slot > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Home page {slot}</span>}
                      </div>
                      <div className="text-xs text-slate-500">{m.id} · {m.unit} · {categoryInfo[m.category]?.label ?? m.category}</div>
                      {m.specifications && <div className="mt-0.5 truncate text-xs text-slate-500" title={m.specifications}>{m.specifications}</div>}
                    </div>
                    <div><div className="text-xs text-slate-500">USD</div><div className="font-semibold tabular-nums text-slate-950">{money(row.priceUsd)}</div></div>
                    <div><div className="text-xs text-slate-500">ZWG</div><div className="font-medium tabular-nums text-slate-700">{row.priceZwg == null ? '—' : row.priceZwg.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></div>
                    <div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${SOURCE_STYLE[row.source]}`}>{SOURCE_LABEL[row.source]}</span>
                      <div className="mt-1 text-xs text-slate-500">{row.updated ? new Date(row.updated).toLocaleDateString() : 'No date'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {(['price', 'details', 'history'] as const).map((mode) => (
                        <button key={mode} type="button" onClick={() => void openPanel(row, mode)} aria-expanded={open === mode}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${open === mode ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 text-slate-700'}`}>
                          {mode === 'price' ? 'Price' : mode === 'details' ? 'Details' : 'History'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {open === 'price' && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-4">
                      <div className="mb-3 text-sm font-semibold text-slate-900">Publish a price for {m.name} <span className="font-normal text-slate-500">({m.unit})</span></div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs font-semibold text-slate-600">USD price<input aria-label="USD price" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
                        <label className="text-xs font-semibold text-slate-600">ZWG price (optional)<input aria-label="ZWG price" inputMode="decimal" value={zwg} onChange={(e) => setZwg(e.target.value)} className="mt-1 block w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
                        <button type="button" disabled={saving} onClick={() => publish(m.id)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Publishing…' : 'Publish price'}</button>
                        {row.source === 'Manual' && <button type="button" disabled={saving} onClick={() => withdraw(m.id)} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Withdraw my price</button>}
                        <button type="button" onClick={() => setPanel(null)} className="px-2 py-2 text-sm text-slate-600">Cancel</button>
                      </div>
                    </div>
                  )}

                  {open === 'details' && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-4">
                      {detailsForm(false, !m.custom)}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button type="button" disabled={saving || details.name.trim().length < 2} onClick={() => void saveDetails(m.id).then((ok) => { if (ok) setPanel(null); })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save details'}</button>
                        {m.hidden
                          ? <button type="button" disabled={saving} onClick={() => catalogAction('show', m.id, `${m.name} is shown again.`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Show again</button>
                          : <button type="button" disabled={saving} onClick={() => catalogAction('hide', m.id, `${m.name} is hidden from public lists and pickers.`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Hide from public</button>}
                        {m.custom
                          ? <button type="button" disabled={saving} onClick={() => catalogAction('reset', m.id, `${m.name} was removed.`)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Remove product</button>
                          : edited.has(m.id) && <button type="button" disabled={saving} onClick={() => catalogAction('reset', m.id, `${m.name} is back to its original details.`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Undo my edits</button>}
                        <button type="button" onClick={() => setPanel(null)} className="px-2 py-2 text-sm text-slate-600">Cancel</button>
                      </div>
                    </div>
                  )}

                  {open === 'history' && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-4">
                      {history === null ? <p className="text-sm text-slate-500">Loading history…</p> : history.length === 0 ? (
                        <p className="text-sm text-slate-500">No prices recorded yet — it shows the {row.source === 'Unpriced' ? 'no price' : 'reference price'}.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs uppercase text-slate-500">
                            <tr><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">USD</th><th className="py-1 pr-3">From</th><th className="py-1">Status</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {history.map((h) => (
                              <tr key={h.id}>
                                <td className="py-1.5 pr-3 tabular-nums text-slate-600">{new Date(h.scraped_at).toLocaleDateString()}</td>
                                <td className="py-1.5 pr-3 tabular-nums font-semibold text-slate-900">{money(h.price_usd)}{h.unit && h.unit !== m.unit ? <span className="ml-1 text-xs font-normal text-amber-700">({h.unit})</span> : null}</td>
                                <td className="py-1.5 pr-3 text-slate-700">{h.source_name === MANUAL_PRICE_SOURCE ? 'You (admin)' : h.supplier_name || h.source_name || 'Scraper'}</td>
                                <td className="py-1.5 text-slate-600">{h.review_status === 'rejected' ? (h.source_name === MANUAL_PRICE_SOURCE ? 'Withdrawn' : 'Rejected') : h.review_status === 'pending' ? 'Awaiting review' : 'Approved'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
