'use client';

// Three materials on the home page, priced by the same rule as the public
// price list: an admin's published price, else a recent approved scrape,
// else the catalog reference price (lib/pricing/publishedPrice.ts).
//
// Which three is chosen in Admin → Catalog & prices (material_catalog
// featured_rank); a slot left empty keeps the default for it.
//
// Starts from the defaults' reference prices so the strip is never empty —
// it used to render "Price unavailable" until the request came back, and
// stayed that way if it never did — then swaps in the chosen materials and
// their current prices once loaded.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBestPrice, materials, type Material } from '@/lib/materials';
import { getBatchPrices } from '@/lib/services/prices';
import { featuredKeys, mergeCatalog } from '@/lib/catalog/mergeCatalog';
import { loadCatalogRows } from '@/lib/catalog/useCatalog';

const DEFAULT_KEYS = ['cement-325', 'brick-common', 'rebar-12'];
// Shorter names for the defaults than the catalog's full ones.
const SHORT_NAMES: Record<string, { name: string; unit: string }> = {
  'cement-325': { name: 'Standard cement', unit: '50kg bag' },
  'brick-common': { name: 'Common brick', unit: 'each' },
  'rebar-12': { name: 'Y12 rebar', unit: '6m length' },
};

type Card = { id: string; name: string; unit: string; priceUsd: number | null; label: string; date: Date | null };

const unitLabel = (unit: string) => unit.replace(/^per\s+/i, '');

function cardFor(material: Material | undefined, id: string): Card {
  const short = SHORT_NAMES[id];
  const best = getBestPrice(id);
  return {
    id,
    name: short?.name ?? material?.name ?? id,
    unit: short?.unit ?? unitLabel(material?.unit ?? ''),
    priceUsd: best?.priceUsd ?? null,
    label: best ? 'Reference price' : 'Price unavailable',
    // No date yet: the server and the browser can be in different time zones,
    // and a date that differs between them breaks hydration.
    date: null,
  };
}

const usd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1 ? 3 : 2, maximumFractionDigits: value < 1 ? 3 : 2 })}`;

export default function PublicPricePreview() {
  const [cards, setCards] = useState<Card[]>(() => DEFAULT_KEYS.map((id) => cardFor(materials.find((m) => m.id === id), id)));

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const rows = await loadCatalogRows();
        const catalog = mergeCatalog(materials, rows);
        const byId = new Map(catalog.filter((m) => !m.hidden).map((m) => [m.id, m]));
        const chosen = new Map(rows.filter((r) => r.featured_rank).map((r) => [r.featured_rank as number, r.material_key]));
        const picked = featuredKeys(rows);
        // Slot by slot: the admin's choice, else that slot's default unless
        // it is already shown elsewhere or hidden.
        const keys: string[] = [];
        for (const slot of [1, 2, 3]) {
          const key = chosen.get(slot);
          if (key && byId.has(key) && !keys.includes(key)) { keys.push(key); continue; }
          const fallback = [DEFAULT_KEYS[slot - 1], ...DEFAULT_KEYS].find((k) => byId.has(k) && !keys.includes(k) && !picked.includes(k));
          if (fallback) keys.push(fallback);
        }
        const live = await getBatchPrices(keys);
        if (!active) return;
        setCards(keys.map((id) => {
          const base = cardFor(byId.get(id), id);
          // An admin's own name for one of the defaults wins over the short one.
          const renamed = rows.some((r) => r.material_key === id && r.name);
          const price = live.get(id);
          return {
            ...base,
            ...(renamed ? { name: byId.get(id)!.name } : {}),
            ...(price ? {
              priceUsd: price.priceUsd,
              label: price.source === 'manual' ? 'Updated by ZimEstimate' : price.source === 'scraped' ? 'Supplier listing' : 'Reference price',
              date: price.lastUpdated,
            } : {}),
          };
        }));
      } catch {
        // Keep the reference prices already shown.
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="border-y border-slate-200 bg-white px-4 py-6 sm:px-8" aria-labelledby="featured-prices-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Price reference</p>
            <h2 id="featured-prices-heading" className="mt-1 text-xl font-bold text-slate-950">Current material prices</h2>
          </div>
          <Link href="/market-insights" className="text-sm font-semibold text-blue-700 hover:underline">See full price list →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">{card.name}</div>
              <div className="mt-1 text-xs text-slate-500">{card.unit ? `Per ${card.unit}` : ' '}</div>
              <div className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{card.priceUsd != null ? usd(card.priceUsd) : '—'}</div>
              <div className="mt-1 text-xs text-slate-500">{card.label}{card.date ? ` · ${card.date.toLocaleDateString()}` : ''}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Indicative USD prices. Check supplier quotes before buying.</p>
      </div>
    </section>
  );
}
