'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { listQuickBOQs } from '@/lib/services/quickBoq';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  ArrowRight,
  CirclesThree,
  Drop,
  FolderOpen,
  Lightning,
  Path,
  Rows,
  Timer,
  Toilet,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import styles from './quick-projects.module.css';

interface ProjectType {
  id: string;
  title: string;
  description: string;
  icon: Icon;
  minutes: number;
  category: string;
  popular?: boolean;
  tone: 'solar' | 'water' | 'borehole' | 'septic' | 'fencing' | 'paving';
}

// Ordered by the strongest everyday homeowner entry points: power, stored
// water, water supply, sanitation, site security, then external finishes.
const PROJECT_TYPES: ProjectType[] = [
  {
    id: 'solar',
    title: 'Solar System',
    description: 'Size panels, inverter and batteries from the appliances you need to run.',
    icon: Lightning,
    minutes: 7,
    category: 'Energy',
    popular: true,
    tone: 'solar',
  },
  {
    id: 'water',
    title: 'Water Tank',
    description: 'Plan tank capacity, stand, pump and the connection to your water source.',
    icon: Drop,
    minutes: 5,
    category: 'Water storage',
    popular: true,
    tone: 'water',
  },
  {
    id: 'borehole',
    title: 'Borehole Drilling',
    description: 'Estimate drilling, casing, pump, rising main and site mobilisation.',
    icon: CirclesThree,
    minutes: 4,
    category: 'Water supply',
    tone: 'borehole',
  },
  {
    id: 'septic',
    title: 'Septic Tank',
    description: 'Compare brick-built, precast ring and poly tank systems with soakaway works.',
    icon: Toilet,
    minutes: 5,
    category: 'Sanitation',
    tone: 'septic',
  },
  {
    id: 'fencing',
    title: 'Fencing & Boundary Walls',
    description: 'Price precast, brick, palisade, mesh or electric fencing with gates.',
    icon: Rows,
    minutes: 4,
    category: 'Site security',
    tone: 'fencing',
  },
  {
    id: 'paving',
    title: 'Paving & Driveways',
    description: 'Build a BOQ for pavers, slabs or cobbles including sub-base and kerbs.',
    icon: Path,
    minutes: 4,
    category: 'External works',
    tone: 'paving',
  },
];

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

    void loadCounts();
  }, [isAuthenticated]);

  const totalSaved = Object.values(savedCounts).reduce((sum, count) => sum + count, 0);

  return (
    <MainLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>Focused estimates</span>
            <h1>Quick Projects</h1>
            <p>Choose one job, answer the essentials, and leave with a priced Bill of Quantities.</p>
          </div>

          <div className={styles.headerMeta} aria-label="Quick project summary">
            <div>
              <strong>6</strong>
              <span>Project types</span>
            </div>
            <div>
              <strong>4–7</strong>
              <span>Minutes</span>
            </div>
            <div>
              <strong>BOQ</strong>
              <span>Ready to edit</span>
            </div>
          </div>
        </header>

        <section className={styles.selector} aria-labelledby="project-selector-title">
          <div className={styles.sectionHeader}>
            <div>
              <span>Start here</span>
              <h2 id="project-selector-title">Select the job you are pricing</h2>
            </div>
            {totalSaved > 0 && (
              <Link href="/projects/quick" className={styles.savedLink}>
                <FolderOpen size={17} />
                Saved estimates ({totalSaved})
                <ArrowRight size={14} weight="bold" />
              </Link>
            )}
          </div>

          <div className={styles.grid}>
            {PROJECT_TYPES.map((project, index) => {
              const ProjectIcon = project.icon;
              const count = savedCounts[project.id] || 0;

              return (
                <Link
                  key={project.id}
                  href={`/quick-projects/${project.id}`}
                  className={`${styles.card} ${styles[project.tone]}`}
                  style={{ '--card-order': index } as CSSProperties}
                >
                  <div className={styles.cardTopline}>
                    <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.category}>{project.category}</span>
                    {project.popular && <span className={styles.popular}>Most requested</span>}
                  </div>

                  <div className={styles.cardBody}>
                    <span className={styles.iconBox} aria-hidden="true">
                      <ProjectIcon size={28} weight="duotone" />
                    </span>
                    <div>
                      <h3>{project.title}</h3>
                      <p>{project.description}</p>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <span><Timer size={15} /> About {project.minutes} min</span>
                    {count > 0 && <span><FolderOpen size={14} /> {count} saved</span>}
                    <span className={styles.openAction} aria-hidden="true">
                      <ArrowRight size={17} weight="bold" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.fullBuild} aria-labelledby="full-build-title">
          <div>
            <span>Planning more than one job?</span>
            <h2 id="full-build-title">Build a complete house estimate instead.</h2>
            <p>Use the guided builder when you need construction stages, labour and a complete project BOQ.</p>
          </div>
          <Link href="/boq/new?method=manual">
            Open Manual BOQ Builder <ArrowRight size={17} weight="bold" />
          </Link>
        </section>
      </div>
    </MainLayout>
  );
}
