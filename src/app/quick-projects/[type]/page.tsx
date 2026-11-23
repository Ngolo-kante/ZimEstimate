'use client';

import { notFound, useRouter } from 'next/navigation';
import { use } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import QuickProjectWizard from '@/components/quick-projects/QuickProjectWizard';
import SolarQuickWizard from '@/components/quick-projects/SolarQuickWizard';
import { septicFlow } from '@/lib/quick-projects/septic/flow';
import { waterFlow } from '@/lib/quick-projects/water/flow';
import { boreholeFlow } from '@/lib/quick-projects/borehole/flow';
import { fencingFlow } from '@/lib/quick-projects/fencing/flow';
import { pavingFlow } from '@/lib/quick-projects/paving/flow';
import type { ProjectType } from '@/lib/quick-projects/engine/types';
import { useAuth } from '@/components/providers/AuthProvider';
import { createQuickBOQ } from '@/lib/services/quickBoq';
import { useToast } from '@/components/ui/Toast';
import MainLayout from '@/components/layout/MainLayout';
import type { BOQItem, LaborConfig, Answers } from '@/lib/quick-projects/engine/types';

const FLOWS: Record<string, typeof septicFlow> = {
  septic:   septicFlow,
  water:    waterFlow,
  borehole: boreholeFlow,
  fencing:  fencingFlow,
  paving:   pavingFlow,
};

const PROJECT_TITLES: Record<string, string> = {
  septic:   'Septic Tank Construction',
  solar:    'Solar System Installation',
  water:    'Water Tank Installation',
  borehole: 'Borehole Drilling',
  fencing:  'Fencing & Boundary Walls',
  paving:   'Paving & Driveways',
};

export default function QuickProjectPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const { profile } = useAuth();
  const router = useRouter();
  const { success, error: showError } = useToast();

  if (!Object.keys(PROJECT_TITLES).includes(type)) {
    notFound();
  }

  // 'builder' is the default user_type for every new signup, so treating it as
  // contractor-eligible showed a "Contractor Markup — Contractor only" field to
  // homeowners estimating their own house, and offered a client-facing view to
  // people with no client. Migration 037 makes contractor a real role, so this
  // can now test for it.
  const isContractor = profile?.user_type === 'contractor';

  async function handleSave(items: BOQItem[], answers: Answers, labor: LaborConfig, markupPct: number) {
    try {
      // createQuickBOQ reports failure by returning an error, not by throwing —
      // ignoring it meant a signed-out user was told the estimate saved and then
      // sent to an empty list.
      const { boq, error } = await createQuickBOQ({
        projectType: type as ProjectType,
        answers,
        boqItems: items,
        labor,
        markupPct,
        currency: 'USD',
      });

      if (error) {
        showError(error.message || 'Failed to save estimate. Please try again.');
        return;
      }

      success(`${PROJECT_TITLES[type]} estimate saved successfully!`);
      // Straight to the saved estimate, not to a list. Saving from the manual
      // builder and saving here used to land on two different pages with
      // different tab sets, which is what made the app feel like two apps.
      router.push(boq ? `/projects?saved=${boq.id}` : '/projects');
    } catch (err) {
      console.error('Failed to save quick BOQ:', err);
      showError('Failed to save estimate. Please try again.');
    }
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 max-[640px]:-mx-4 max-[640px]:pt-2 md:py-8 animate-fade-in">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm font-medium text-[var(--color-worksheet-caption)] mb-4">
          {/* On phones this is the same 44px "<" back button as the project pages. */}
          <Link
            href="/quick-projects"
            aria-label="Back to Quick Projects"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-[var(--color-navbar-link)] transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-link-strong)] max-[640px]:w-11 max-[640px]:justify-center max-[640px]:rounded-[10px] max-[640px]:border max-[640px]:border-[var(--color-border)] max-[640px]:bg-[var(--color-surface)] max-[640px]:text-[var(--color-heading)] max-[640px]:active:bg-[var(--color-selected-surface)]"
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
            <span className="max-[640px]:sr-only">Quick Projects</span>
          </Link>
          <span className="hidden text-[var(--color-breadcrumb-separator)] sm:inline" aria-hidden="true">/</span>
          <span className="hidden text-[var(--color-worksheet-title)] sm:inline" aria-current="page">{PROJECT_TITLES[type]}</span>
        </nav>

        <header className="mb-6 text-left">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-worksheet-title)] mb-1">{PROJECT_TITLES[type]}</h1>
          <p className="text-sm sm:text-base text-[var(--color-worksheet-caption)]">
            Answer a few questions to get your customised Bill of Quantities.
          </p>
        </header>

        {/* Solar uses the extended SolarQuickWizard directly */}
        {type === 'solar' ? (
          <SolarQuickWizard
            onChange={() => {}}
            isContractor={isContractor}
            onSave={(output) =>
              handleSave(output.boqItems ?? [], output.answers as unknown as Answers, output.labor, output.markupPct)
            }
          />
        ) : (
          <QuickProjectWizard
            flow={FLOWS[type]}
            isContractor={isContractor}
            onSave={handleSave}
          />
        )}
      </div>
    </MainLayout>
  );
}
