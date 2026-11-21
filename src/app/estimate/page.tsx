import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowRight,
  Blueprint,
  BookOpen,
  Buildings,
  Cylinder,
  Drop,
  FileMagnifyingGlass,
  GridFour,
  HardHat,
  HouseLine,
  Rows,
  Scales,
  SolarPanel,
  SquaresFour,
  Storefront,
  Timer,
  Toilet,
} from '@phosphor-icons/react/dist/ssr';
import type { Icon } from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import styles from './estimate.module.css';

export const metadata: Metadata = {
  title: 'Start an estimate | ZimEstimate',
  description: 'Choose an estimate for a house build, solar system, borehole, water tank, septic tank, fencing or paving.',
};

/**
 * Every way into the site, grouped by what the visitor is trying to do.
 *
 * It used to list seven large cards, which left out most of what the site
 * prices — boreholes, water tanks, septic tanks, fencing and paving had no
 * door from here at all. Small tiles in three groups fit all of it, and on a
 * phone several rows show at once instead of one card per screen.
 *
 * Deliberately not listed: the "Price Outlook" page, whose figures are
 * hard-coded rather than calculated; and "What can my budget buy?", which
 * repeated the jobs above (owner, 17 Nov) and lives in the Budget Estimator.
 */

type Tile = { title: string; detail: string; href: string; icon: Icon };
type Group = { id: string; title: string; note: string; tiles: Tile[] };

const groups: Group[] = [
  {
    id: 'house',
    title: 'Build a house',
    note: 'A full bill of quantities, or just the stage you are on.',
    tiles: [
      { title: 'Full house estimate', detail: 'Every stage, foundations to finishes', href: '/boq/new?method=manual&fresh=1&preset=full_house', icon: HouseLine },
      { title: 'Estimate by stage', detail: 'Only the stages you are ready for', href: '/boq/new?method=manual&fresh=1&preset=building_in_stages', icon: Buildings },
      { title: 'Read my floor plan', detail: 'Upload a plan, get rooms and sizes', href: '/ai/vision-takeoff', icon: Blueprint },
      { title: 'Start from a template', detail: 'Common house plans, ready to price', href: '/templates', icon: SquaresFour },
    ],
  },
  {
    id: 'projects',
    title: 'Price a project',
    note: 'Answer a few questions, get a priced list of materials.',
    tiles: [
      { title: 'Solar system', detail: 'Panels, inverter and batteries', href: '/quick-projects/solar', icon: SolarPanel },
      { title: 'Borehole', detail: 'Drilling, casing and pump', href: '/quick-projects/borehole', icon: Drop },
      { title: 'Water tank', detail: 'Tank, stand and connection', href: '/quick-projects/water', icon: Cylinder },
      { title: 'Septic tank', detail: 'Tank and soakaway', href: '/quick-projects/septic', icon: Toilet },
      { title: 'Fencing & walls', detail: 'Precast, brick, palisade or mesh', href: '/quick-projects/fencing', icon: Rows },
      { title: 'Paving & driveways', detail: 'Pavers, slabs or cobbles', href: '/quick-projects/paving', icon: GridFour },
    ],
  },
  {
    id: 'more',
    title: 'More',
    note: 'Cost guides, quotes, contractors and materials.',
    tiles: [
      { title: 'Cost to build a house', detail: 'A guide to typical costs by stage', href: '/cost-to-build-a-house-in-zimbabwe', icon: BookOpen },
      { title: 'Check a builder\'s quote', detail: 'Each price against the market', href: '/ai/quote-check', icon: Scales },
      { title: 'Scan a BOQ', detail: 'Turn a photo into a project', href: '/ai/boq-scanner', icon: FileMagnifyingGlass },
      { title: 'Find a builder', detail: 'Contractors and trades near you', href: '/contractors', icon: HardHat },
      { title: 'Buy materials', detail: 'Compare supplier prices', href: '/marketplace', icon: Storefront },
    ],
  },
];

const total = groups.reduce((sum, group) => sum + group.tiles.length, 0);

export default async function EstimateServicesPage({ searchParams }: PageProps<'/estimate'>) {
  const fromProjects = (await searchParams).from === 'projects';
  return (
    <MainLayout fullWidth mobileNavy>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              {fromProjects && (
                <Link href="/projects" className={styles.backLink}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to My projects
                </Link>
              )}
              <h1>Start an estimate</h1>
              <p>Choose a project. You can adjust quantities, materials and prices before saving.</p>
            </div>
          </div>
        </header>

        <section className={styles.directory} aria-label={`${total} ways to begin`}>
          {groups.map((group) => (
            <div key={group.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <h2>{group.title}</h2>
                <p>{group.note}</p>
              </div>
              <ul className={styles.tileGrid}>
                {group.tiles.map((tile) => {
                  const TileIcon = tile.icon;
                  return (
                    <li key={tile.href}>
                      <Link href={tile.href} className={styles.tile}>
                        <span className={styles.tileIcon}>
                          <TileIcon size={22} weight="duotone" aria-hidden="true" />
                        </span>
                        <span className={styles.tileText}>
                          <strong>{tile.title}</strong>
                          <span>{tile.detail}</span>
                          {group.id === 'projects' && (
                            <span className={styles.duration}>
                              <Timer size={14} aria-hidden="true" />
                              2–3 min to get started
                            </span>
                          )}
                        </span>
                        <ArrowRight size={14} weight="bold" className={styles.tileArrow} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </MainLayout>
  );
}
