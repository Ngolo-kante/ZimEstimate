'use client';

// Three everyday prices as small tags in the hero, with the way to the full
// price list. Same rule as every price surface (lib/pricing/publishedPrice.ts):
// an admin's published price, else a recent approved scrape, else the
// catalog reference. Starts from the reference prices so it is never empty
// while the live ones load, and keeps them if the lookup fails.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Tag } from '@phosphor-icons/react';
import { getBestPrice } from '@/lib/materials';
import { getBatchPrices } from '@/lib/services/prices';
import styles from '@/app/home/home.module.css';

const ITEMS = [
  { id: 'cement-325', label: 'Cement', unit: 'bag' },
  { id: 'brick-common', label: 'Brick', unit: 'each' },
  { id: 'rebar-12', label: 'Y12 rebar', unit: '6m' },
];

const usd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HeroPriceInsights() {
  const [prices, setPrices] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(ITEMS.map((item) => [item.id, getBestPrice(item.id)?.priceUsd ?? null])));
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBatchPrices(ITEMS.map((item) => item.id))
      .then((live) => {
        if (!active) return;
        setPrices((current) => {
          const next = { ...current };
          for (const [id, price] of live) next[id] = price.priceUsd;
          return next;
        });
        const newest = Math.max(...[...live.values()].map((p) => p.lastUpdated.getTime()).filter(Number.isFinite));
        if (Number.isFinite(newest)) setUpdated(new Date(newest).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className={styles.priceInsights} aria-label="Price insights">
      <span className={styles.priceInsightsTitle}>
        <Tag size={14} weight="fill" aria-hidden="true" /> Price insights{updated ? ` · ${updated}` : ''}
      </span>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.id}>
            <span>{item.label}</span>
            <strong>{prices[item.id] != null ? usd(prices[item.id] as number) : '—'}</strong>
            <span className={styles.priceInsightsUnit}>/{item.unit}</span>
          </li>
        ))}
      </ul>
      <Link href="/market-insights" className={styles.priceInsightsLink}>
        See all price insights <ArrowRight size={13} weight="bold" aria-hidden="true" />
      </Link>
    </div>
  );
}
