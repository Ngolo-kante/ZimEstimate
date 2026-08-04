'use client';

import { notFound, useRouter } from 'next/navigation';
import { use } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
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

  async function handleSave(items: BOQItem[], answers: Answers, labor: LaborConfig) {
    try {
      // createQuickBOQ reports failure by returning an error, not by throwing —
      // ignoring it meant a signed-out user was told the estimate saved and then
      // sent to an empty list.
      const { boq, error } = await createQuickBOQ({
        projectType: type as ProjectType,
        answers,
        boqItems: items,
        labor,
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
      router.push(boq ? `/projects/quick/${boq.id}` : '/projects');
    } catch (err) {
      console.error('Failed to save quick BOQ:', err);
      showError('Failed to save estimate. Please try again.');
    }
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-8">
          <Link href="/quick-projects" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
            <ArrowLeft size={16} />
            Quick Projects
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">{PROJECT_TITLES[type]}</span>
        </nav>

        <header className="mb-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">{PROJECT_TITLES[type]}</h1>
          <p className="text-lg text-slate-500">
            Answer a few questions to get your customised Bill of Quantities.
          </p>
        </header>

        {/* Solar uses the extended SolarQuickWizard directly */}
        {type === 'solar' ? (
          <SolarQuickWizard
            onChange={() => {}}
            isContractor={isContractor}
            onSave={(output) =>
              handleSave(output.boqItems ?? [], output.answers as unknown as Answers, {
                enabled: false,
                method: 'percentage',
                percentage: 25,
              })
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
