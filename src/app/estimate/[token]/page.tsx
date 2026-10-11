import type { Metadata } from 'next';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import SharedArrival from '@/components/quick-projects/SharedArrival';
import { calculateLaborItems } from '@/lib/quick-projects/engine/boqEngine';
import { fetchSharedQuickEstimate } from '@/lib/quick-projects/fetchSharedEstimate';
import { estimateName, quickEstimateTotal, summariseSavedEstimate } from '@/lib/quick-projects/savedEstimate';
import { QUICK_TYPE_LABELS } from '@/lib/quick-projects/typeLabels';

/**
 * A saved estimate, opened from its share link by anyone.
 *
 * Read-only, and only the estimate: the owner, their savings towards it, their
 * target date and their compliance progress are never sent here (see
 * migration 053). Rendered on the server on every request, so a link stops
 * working the moment the owner stops sharing it.
 */

type Props = { params: Promise<{ token: string }> };

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const estimate = await fetchSharedQuickEstimate(token);
  // Shared estimates are for the people they were sent to, not for search.
  const robots = { index: false, follow: false };
  if (!estimate) return { title: 'Estimate not available | ZimEstimate', robots };

  const summary = summariseSavedEstimate(estimate);
  const image = `/api/og/estimate?saved=${token}`;
  return {
    title: `${summary.headline} | ZimEstimate`,
    description: summary.description,
    robots,
    openGraph: {
      type: 'website',
      locale: 'en_ZW',
      siteName: 'ZimEstimate',
      url: `/estimate/${token}`,
      title: summary.headline,
      description: summary.description,
      images: [{ url: image, width: 1200, height: 630, alt: summary.headline }],
    },
    twitter: { card: 'summary_large_image', title: summary.headline, description: summary.description, images: [image] },
  };
}

export default async function SharedEstimatePage({ params }: Props) {
  const { token } = await params;
  const estimate = await fetchSharedQuickEstimate(token);

  if (!estimate) {
    return (
      <MainLayout title="Shared estimate">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-[var(--color-text)]">This estimate is not available</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            The link may be mistyped, or the person who shared it has stopped sharing it.
          </p>
          <Link
            href="/quick-projects"
            className="mt-6 inline-flex rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white"
          >
            Price your own project
          </Link>
        </div>
      </MainLayout>
    );
  }

  const label = QUICK_TYPE_LABELS[estimate.projectType] ?? 'Quick';
  const name = estimateName(estimate.projectType, estimate.answers);
  const items = estimate.boqItems.filter((item) => item.included !== false && !item.owned);
  const materials = quickEstimateTotal(estimate.boqItems);
  // The same engine function the owner's estimate uses, so labour cannot be
  // worked out differently here.
  const labour = calculateLaborItems(estimate.labor, materials).reduce((sum, item) => sum + item.totalCostUsd, 0);

  const byCategory = items.reduce<Record<string, typeof items>>((groups, item) => {
    (groups[item.category] ??= []).push(item);
    return groups;
  }, {});

  return (
    <MainLayout title="Shared estimate">
      <SharedArrival estimate={`saved_${estimate.projectType}`} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          {label} estimate · shared with you
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--color-text)]">{name}</h1>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Last updated {new Date(estimate.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' '}· prices in USD at Zimbabwe market rates
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Materials', value: usd(materials) },
            { label: 'Labour', value: labour > 0 ? usd(labour) : 'Not included' },
            { label: 'Total', value: usd(materials + labour) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{stat.label}</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-[var(--color-text)]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {Object.entries(byCategory).map(([category, rows]) => (
            <div key={category} className="border-b border-[var(--color-border)] last:border-0">
              <p className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                {category}
              </p>
              <ul>
                {rows.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block text-[var(--color-text)]">{item.description}</span>
                      <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">
                        {item.quantity} {item.unit} × {usd(item.unitCostUsd)}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">{usd(item.totalCostUsd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-[var(--color-primary)] p-5 text-white">
          <p className="text-base font-bold">Planning a {label.toLowerCase()} job of your own?</p>
          <p className="mt-1 text-sm text-white/80">Answer a few questions and get your own priced list of materials — free.</p>
          <Link
            href={`/quick-projects/${estimate.projectType}`}
            className="mt-4 inline-flex rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white"
          >
            Price your own {label.toLowerCase()} project
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
