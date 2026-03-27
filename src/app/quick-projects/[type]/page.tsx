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

  // UserType includes 'builder' | 'supplier' | 'admin'; treat 'builder' as contractor-eligible
  const isContractor = profile?.user_type === 'builder';

  async function handleSave(items: BOQItem[], answers: Answers, labor: LaborConfig) {
    try {
      await createQuickBOQ({
        projectType: type as ProjectType,
        answers,
        boqItems: items,
        labor,
        currency: 'USD',
      });
      success(`${PROJECT_TITLES[type]} estimate saved successfully!`);
      router.push('/projects/quick');
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
