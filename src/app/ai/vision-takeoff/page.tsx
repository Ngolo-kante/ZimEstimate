'use client';

import MainLayout from '@/components/layout/MainLayout';
import VisionTakeoffWizard from '@/components/vision-takeoff/VisionTakeoffWizard';

export default function VisionTakeoffPage() {
  return (
    <MainLayout title="AI Vision Takeoff">
      <VisionTakeoffWizard />
    </MainLayout>
  );
}
