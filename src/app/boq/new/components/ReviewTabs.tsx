'use client';

import ReviewWorkspace from '@/components/boq/ReviewWorkspace';
import BOQTable from './BOQTable';
import CostOverview from './CostOverview';

export default function ReviewTabs({ projectId, onSave, isSaving }: { projectId?: string; onSave: () => void; isSaving: boolean }) {
  return (
    <ReviewWorkspace
      projectId={projectId}
      onSave={onSave}
      isSaving={isSaving}
      sourceLabel="Created manually"
      title="Review your BOQ and pricing"
      description="Check each stage, adjust quantities or prices, and save when the estimate reflects the build."
      primary={<div className="space-y-6"><CostOverview /><BOQTable /></div>}
    />
  );
}
