import { Metadata } from 'next';
import FacebookBrandHub from '@/components/marketing/FacebookBrandHub';

// The description previously promised "Live Harare & Bulawayo hardware price
// benchmarks" and "Diaspora homebuilding case studies". Prices come from a
// catalogue rather than a live feed, and the case study on this page was
// invented, so both have been removed.
export const metadata: Metadata = {
  title: 'ZimEstimate Community | Zimbabwe Construction Costs',
  description: 'Harare material price reference and the Zimbabwe construction cost estimator behind it — see what a build needs, stage by stage, before you commit.',
};

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-8 sm:px-6 lg:px-8">
      <FacebookBrandHub />
    </main>
  );
}
