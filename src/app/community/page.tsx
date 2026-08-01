import { Metadata } from 'next';
import FacebookBrandHub from '@/components/marketing/FacebookBrandHub';

export const metadata: Metadata = {
  title: 'ZimEstimate Community & Facebook Brand Hub | Zimbabwe Construction Costs',
  description: 'Join the ZimEstimate community. Live Harare & Bulawayo hardware price benchmarks, WhatsApp construction alerts, and Diaspora homebuilding case studies.',
};

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-8 sm:px-6 lg:px-8">
      <FacebookBrandHub />
    </main>
  );
}
