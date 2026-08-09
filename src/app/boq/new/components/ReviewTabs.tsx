'use client';

import ReviewWorkspace from '@/components/boq/ReviewWorkspace';
import BOQTable from './BOQTable';

export default function ReviewTabs() {
  return (
    <ReviewWorkspace
      sourceLabel="Created manually"
      title="Review your BOQ and pricing"
      description="Check each stage, adjust quantities or prices, and save when the estimate reflects the build."
      primary={<BOQTable />}
    />
  );
}
