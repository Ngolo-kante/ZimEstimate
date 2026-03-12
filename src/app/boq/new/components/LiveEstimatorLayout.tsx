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
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.2fr),1fr] lg:gap-12">
          <div className="py-6 pb-28 lg:py-8 lg:pb-8 max-w-2xl w-full">{leftControls}</div>

          <div className="hidden lg:block">
            <div className="sticky top-24 py-8 h-[calc(100vh-8rem)]">
              {heroIllustration ? (
                heroIllustration
              ) : (
                <div className="w-full h-full rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-col text-slate-400">
                  <div className="p-4 bg-white shadow-sm rounded-xl mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Visual Guide</span>
                  </div>
                  <p className="text-sm font-medium">Educational render will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
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
