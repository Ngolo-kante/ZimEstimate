'use client';

import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import {
  Lightning,
  Drop,
  Toilet,
  CirclesThree,
  Rows,
  Path,
  ArrowRight,
  Timer,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

// ─── Project Types ────────────────────────────────────────────────────────────

const PROJECT_TYPES: Array<{
  id: string;
  title: string;
  description: string;
  icon: Icon;
  minutes: number;
  color: string;
}> = [
  {
    id: 'septic',
    title: 'Septic Tank',
    description: 'Brick-built, precast rings, or poly tank. Includes soakaway and full pipework BOQ.',
    icon: Toilet,
    minutes: 5,
    color: 'amber',
  },
  {
    id: 'solar',
    title: 'Solar System',
    description: 'Full off-grid or hybrid solar sizing with appliance checklist. Generates panel, inverter and battery BOQ.',
    icon: Lightning,
    minutes: 7,
    color: 'yellow',
  },
  {
    id: 'water',
    title: 'Water Tank',
    description: 'Poly tank installation with optional borehole pump and municipal connection.',
    icon: Drop,
    minutes: 5,
    color: 'blue',
  },
  {
    id: 'borehole',
    title: 'Borehole Drilling',
    description: 'Drilling, casing, pump, and rising main BOQ. Includes optional pump test and mobilization.',
    icon: CirclesThree,
    minutes: 4,
    color: 'teal',
  },
  {
    id: 'fencing',
    title: 'Fencing & Boundary Walls',
    description: 'Precast panels, brick walls, palisade, mesh, or electric fence with gates.',
    icon: Rows,
    minutes: 4,
    color: 'green',
  },
  {
    id: 'paving',
    title: 'Paving & Driveways',
    description: 'Interlocking bricks, concrete slabs, or cobblestones with sub-base and kerbing options.',
    icon: Path,
    minutes: 4,
    color: 'stone',
  },
];

// ─── Color Map ────────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, { card: string; icon: string; badge: string }> = {
  amber: { card: 'project-card--amber', icon: 'project-card__icon--amber', badge: 'project-card__badge--amber' },
  yellow:{ card: 'project-card--yellow',icon: 'project-card__icon--yellow',badge: 'project-card__badge--yellow' },
  blue:  { card: 'project-card--blue',  icon: 'project-card__icon--blue',  badge: 'project-card__badge--blue'  },
  teal:  { card: 'project-card--teal',  icon: 'project-card__icon--teal',  badge: 'project-card__badge--teal'  },
  green: { card: 'project-card--green', icon: 'project-card__icon--green', badge: 'project-card__badge--green' },
  stone: { card: 'project-card--stone', icon: 'project-card__icon--stone', badge: 'project-card__badge--stone' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuickProjectsPage() {
  return (
    <MainLayout>
      <div className="quick-projects-page">
        {/* Header */}
        <div className="quick-projects-header">
          <h1 className="quick-projects-title">Quick Projects</h1>
          <p className="quick-projects-subtitle">
            Answer a few questions and get a full Bill of Quantities in minutes.
            No account needed to start — sign in to save or export.
          </p>
        </div>

        {/* Grid */}
        <div className="project-type-grid reveal">
          {PROJECT_TYPES.map((pt, i) => {
            const Icon = pt.icon;
            const colors = COLOR_CLASSES[pt.color] ?? COLOR_CLASSES.blue;
            return (
              <Link
                key={pt.id}
                href={`/quick-projects/${pt.id}`}
                className={`project-card ${colors.card}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={`project-card__icon-wrap ${colors.icon}`}>
                  <Icon size={28} weight="duotone" />
                </div>
                <div className="project-card__body">
                  <h3 className="project-card__title">{pt.title}</h3>
                  <p className="project-card__desc">{pt.description}</p>
                </div>
                <div className="project-card__footer">
                  <span className={`project-card__badge ${colors.badge}`}>
                    <Timer size={12} />
                    ~{pt.minutes} min
                  </span>
                  <ArrowRight size={16} className="project-card__arrow" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="quick-projects-footer">
          Need a full house construction BOQ?{' '}
          <Link href="/boq/new" className="quick-projects-footer__link">
            Use the manual BOQ builder →
          </Link>
        </p>
      </div>
    </MainLayout>
  );
}
