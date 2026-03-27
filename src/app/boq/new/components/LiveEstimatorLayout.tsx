'use client';

import React, { ReactNode } from 'react';
import MobileEstimateBar from './MobileEstimateBar';

interface LiveEstimatorLayoutProps {
  leftControls: ReactNode;
  rightEstimate?: ReactNode | null;
  heroIllustration?: ReactNode | null;
}

export default function LiveEstimatorLayout({ leftControls, rightEstimate, heroIllustration }: LiveEstimatorLayoutProps) {
  if (!rightEstimate) {
    return (
      <div className="mx-auto max-w-3xl px-4 lg:px-8">
        <div className="py-6 pb-28 lg:py-8 lg:pb-8">{leftControls}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr),420px] lg:gap-8">
        <div className="py-6 pb-28 lg:py-8 lg:pb-8">{leftControls}</div>

        <div className="hidden lg:block">
          <div className="sticky top-24 py-8">{rightEstimate}</div>
        </div>
      </div>

      <MobileEstimateBar className="lg:hidden">{rightEstimate}</MobileEstimateBar>
    </div>
  );
}
