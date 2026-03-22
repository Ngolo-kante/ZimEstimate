'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { listQuickBOQs } from '@/lib/services/quickBoq';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Lightning,
  Drop,
  Toilet,
  CirclesThree,
  Rows,
  Path,
  ArrowRight,
  Timer,
  FolderOpen,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

// ─── Project Types ────────────────────────────────────────────────────────────

const PROJECT_TYPES: Array<{
  id: string;
  title: string;
  description: string;
  icon: Icon;
  minutes: number;
  gradient: string;
  iconBg: string;
  iconColor: string;
}> = [
  {
    id: 'septic',
    title: 'Septic Tank',
    description: 'Brick-built, precast rings, or poly tank. Includes soakaway and full pipework BOQ.',
    icon: Toilet,
    minutes: 5,
    gradient: 'from-amber-50 to-orange-50/20 hover:border-amber-200',
    iconBg: 'bg-amber-100/80',
    iconColor: 'text-amber-600',
  },
  {
    id: 'solar',
    title: 'Solar System',
    description: 'Full off-grid or hybrid solar sizing with appliance checklist. Generates panel, inverter and battery BOQ.',
    icon: Lightning,
    minutes: 7,
    gradient: 'from-yellow-50 to-amber-50/20 hover:border-yellow-200',
    iconBg: 'bg-yellow-100/80',
    iconColor: 'text-yellow-600',
  },
  {
    id: 'water',
    title: 'Water Tank',
    description: 'Poly tank installation with optional borehole pump and municipal connection.',
    icon: Drop,
    minutes: 5,
    gradient: 'from-blue-50 to-sky-50/20 hover:border-blue-200',
    iconBg: 'bg-blue-100/80',
    iconColor: 'text-blue-600',
  },
  {
    id: 'borehole',
    title: 'Borehole Drilling',
    description: 'Drilling, casing, pump, and rising main BOQ. Includes optional pump test and mobilization.',
    icon: CirclesThree,
    minutes: 4,
    gradient: 'from-teal-50 to-emerald-50/20 hover:border-teal-200',
    iconBg: 'bg-teal-100/80',
    iconColor: 'text-teal-600',
  },
  {
    id: 'fencing',
    title: 'Fencing & Boundary Walls',
    description: 'Precast panels, brick walls, palisade, mesh, or electric fence with gates.',
    icon: Rows,
    minutes: 4,
    gradient: 'from-green-50 to-emerald-50/20 hover:border-green-200',
    iconBg: 'bg-green-100/80',
    iconColor: 'text-green-600',
  },
  {
    id: 'paving',
    title: 'Paving & Driveways',
    description: 'Interlocking bricks, concrete slabs, or cobblestones with sub-base and kerbing options.',
    icon: Path,
    minutes: 4,
    gradient: 'from-stone-50 to-slate-50/20 hover:border-stone-200',
    iconBg: 'bg-stone-100/80',
    iconColor: 'text-stone-600',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuickProjectsPage() {
  const { isAuthenticated } = useAuth();
  const [savedCounts, setSavedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isAuthenticated) return;
    async function loadCounts() {
      const { boqs } = await listQuickBOQs();
      const counts: Record<string, number> = {};
      for (const boq of boqs) {
        counts[boq.projectType] = (counts[boq.projectType] || 0) + 1;
      }
      setSavedCounts(counts);
    }
    loadCounts();
  }, [isAuthenticated]);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 animate-fade-in">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <span className="text-blue-600 text-sm font-bold tracking-wider uppercase mb-2 block">UTILITIES & ADD-ONS</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-4">Quick Projects</h1>
          <p className="text-lg text-slate-500 leading-relaxed">
            Answer a few questions and get a full Bill of Quantities in minutes.
            No account needed to start — sign in to save or export.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROJECT_TYPES.map((pt, i) => {
            const Icon = pt.icon;
            const count = savedCounts[pt.id] || 0;
            return (
              <Link
                key={pt.id}
                href={`/quick-projects/${pt.id}`}
                className={`group relative flex flex-col p-8 rounded-[2rem] border border-slate-200/60 bg-gradient-to-br ${pt.gradient} shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={`w-14 h-14 rounded-2xl ${pt.iconBg} ${pt.iconColor} flex flex-shrink-0 items-center justify-center mb-6 shadow-sm border border-white/40 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
                  <Icon size={32} weight="duotone" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{pt.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">{pt.description}</p>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/60 border border-slate-200/60 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm">
                      <Timer size={14} className="text-slate-400" />
                      ~{pt.minutes} min
                    </span>
                    {count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/60 text-xs font-semibold text-blue-600">
                        <FolderOpen size={12} />
                        {count} saved
                      </span>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-200/60 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors">
                    <ArrowRight size={14} weight="bold" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Saved estimates link */}
        {Object.values(savedCounts).some((c) => c > 0) && (
          <div className="mt-8 text-center">
            <Link
              href="/projects/quick"
              className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors"
            >
              <FolderOpen size={18} />
              View all saved estimates ({Object.values(savedCounts).reduce((a, b) => a + b, 0)})
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-20 text-center flex flex-col items-center justify-center border-t border-slate-200 pt-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex flex-shrink-0 items-center justify-center text-slate-400 mb-4 border border-slate-200">
             <Rows size={32} weight="duotone" />
          </div>
          <p className="text-slate-500 font-medium mb-3">
            Need a full house construction BOQ?
          </p>
          <Link href="/boq/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-slate-900/10">
            Use the Manual BOQ Builder <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
