import type { Metadata } from 'next';
import QuickBudgetClient from './QuickBudgetClient';
import { summariseSharedEstimate } from '@/lib/og/sharedEstimate';

/**
 * The Budget Estimator, with a link preview that describes the estimate.
 *
 * The page itself is a client component (QuickBudgetClient), and only a server
 * page can set metadata from the link — so this thin wrapper exists to do
 * that. When a shared link describes an estimate, WhatsApp shows "What $2,500
 * buys in solar" with the system and its backup hours, rather than the site's
 * generic card. Without one, the site's own preview is left as it was.
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSearchParams(raw: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = toSearchParams(await searchParams);
  const summary = summariseSharedEstimate(params);
  if (!summary) return {};

  const query = params.toString();
  const image = `/api/og/estimate?${query}`;
  const title = `${summary.headline} | ZimEstimate`;

  return {
    title,
    description: summary.description,
    // A page's openGraph replaces the root layout's rather than merging with
    // it, so the site-wide fields are restated here or they would be lost.
    openGraph: {
      type: 'website',
      locale: 'en_ZW',
      siteName: 'ZimEstimate',
      url: `/quick-budget?${query}`,
      title: summary.headline,
      description: summary.description,
      images: [{ url: image, width: 1200, height: 630, alt: summary.headline }],
    },
    twitter: {
      card: 'summary_large_image',
      title: summary.headline,
      description: summary.description,
      images: [image],
    },
  };
}

export default function QuickBudgetPage() {
  return <QuickBudgetClient />;
}
