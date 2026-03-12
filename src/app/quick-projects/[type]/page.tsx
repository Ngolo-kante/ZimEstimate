'use client';

import { notFound } from 'next/navigation';
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

  if (!Object.keys(PROJECT_TITLES).includes(type)) {
    notFound();
  }

  // UserType includes 'builder' | 'supplier' | 'admin'; treat 'builder' as contractor-eligible
  const isContractor = profile?.user_type === 'builder';

  async function handleSave(items: BOQItem[], answers: Answers, labor: LaborConfig) {
    await createQuickBOQ({
      projectType: type as ProjectType,
      answers,
      boqItems: items,
      labor,
      currency: 'USD',
    });
  }

  return (
    <div className="quick-project-page">
      {/* Breadcrumb */}
      <nav className="quick-project-nav">
        <Link href="/quick-projects" className="quick-project-back">
          <ArrowLeft size={16} />
          Quick Projects
        </Link>
        <span className="quick-project-nav__sep">/</span>
        <span>{PROJECT_TITLES[type]}</span>
      </nav>

      <header className="quick-project-header">
        <h1>{PROJECT_TITLES[type]}</h1>
        <p className="quick-project-header__desc">
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
  );
}
