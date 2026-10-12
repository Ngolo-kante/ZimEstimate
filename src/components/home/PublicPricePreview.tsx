'use client';

// Three everyday materials on the home page, priced by the same rule as the
// public price list: an admin's published price, else a recent approved
// scrape, else the catalog reference price (lib/pricing/publishedPrice.ts).
//
// Starts from the reference price so the strip is never empty — it used to
// render "Price unavailable" until the request came back, and stayed that
// way if it never did — then swaps in a newer price once loaded.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBestPrice } from '@/lib/materials';
import { getBatchPrices } from '@/lib/services/prices';

const featured = [
  { id: 'cement-325', name: 'Standard cement', unit: '50kg bag' },
  { id: 'brick-common', name: 'Common brick', unit: 'each' },
  { id: 'rebar-12', name: 'Y12 rebar', unit: '6m length' },
];

type Shown = { priceUsd: number; label: string; date: Date | null };

function referencePrices(): Record<string, Shown> {
  const prices: Record<string, Shown> = {};
  for (const item of featured) {
    const best = getBestPrice(item.id);
    // No date yet: the server and the browser can be in different time zones,
    // and a date that differs between them breaks hydration.
    if (best) prices[item.id] = { priceUsd: best.priceUsd, label: 'Reference price', date: null };
  }
  return prices;
}

const usd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 1 ? 3 : 2, maximumFractionDigits: value < 1 ? 3 : 2 })}`;

export default function PublicPricePreview() {
  const [prices, setPrices] = useState<Record<string, Shown>>(referencePrices);

  useEffect(() => {
    let active = true;
    getBatchPrices(featured.map((item) => item.id))
      .then((live) => {
        if (!active) return;
        setPrices((current) => {
          const next = { ...current };
          for (const [id, price] of live) {
            next[id] = {
              priceUsd: price.priceUsd,
              label: price.source === 'manual' ? 'Updated by ZimEstimate' : price.source === 'scraped' ? 'Supplier listing' : 'Reference price',
              date: price.lastUpdated,
            };
          }
          return next;
        });
      })
      // Keep the reference prices if the lookup fails.
      .catch(() => {});
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
          {featured.map((item) => {
            const price = prices[item.id];
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                <div className="mt-1 text-xs text-slate-500">Per {item.unit}</div>
                <div className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{price ? usd(price.priceUsd) : '—'}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {price ? `${price.label}${price.date ? ` · ${price.date.toLocaleDateString()}` : ''}` : 'Price unavailable'}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Indicative USD prices. Check supplier quotes before buying.</p>
      </div>
    </section>
  );
}
