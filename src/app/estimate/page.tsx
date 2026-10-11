import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Blueprint,
  BookOpen,
  Buildings,
  Calculator,
  Cylinder,
  Drop,
  FileMagnifyingGlass,
  GridFour,
  HardHat,
  HouseLine,
  ListChecks,
  Rows,
  Scales,
  SolarPanel,
  SquaresFour,
  Storefront,
  Toilet,
} from '@phosphor-icons/react/dist/ssr';
import type { Icon } from '@phosphor-icons/react';
import DescribeProject from '@/components/estimate/DescribeProject';
import MainLayout from '@/components/layout/MainLayout';
import styles from './estimate.module.css';

export const metadata: Metadata = {
  title: 'Start an estimate | ZimEstimate',
  description: 'House builds, solar, boreholes, water tanks, septic tanks, fencing, paving and budget checks — pick where to start. No account needed.',
};

/**
 * Every way into the site, grouped by what the visitor is trying to do.
 *
 * It used to list seven large cards, which left out most of what the site
 * prices — boreholes, water tanks, septic tanks, fencing and paving had no
 * door from here at all. Small tiles in four groups fit all of it, and on a
 * phone several rows show at once instead of one card per screen.
 *
 * Deliberately not listed: the "Price Outlook" page, whose figures are
 * hard-coded rather than calculated.
 */

type Tile = { title: string; detail: string; href: string; icon: Icon };
type Group = { id: string; title: string; note: string; tone: 'blue' | 'amber' | 'green' | 'slate'; tiles: Tile[] };

const groups: Group[] = [
  {
    id: 'house',
    title: 'Build a house',
    note: 'A full bill of quantities, or just the stage you are on.',
    tone: 'blue',
    tiles: [
      { title: 'Full house estimate', detail: 'Every stage, foundations to finishes', href: '/boq/new?method=manual&fresh=1&preset=full_house', icon: HouseLine },
      { title: 'Estimate by stage', detail: 'Only the stages you are ready for', href: '/boq/new?method=manual&fresh=1&preset=building_in_stages', icon: Buildings },
      { title: 'Read my floor plan', detail: 'Upload a plan, get rooms and sizes', href: '/ai/vision-takeoff', icon: Blueprint },
      { title: 'Start from a template', detail: 'Common house plans, ready to price', href: '/templates', icon: SquaresFour },
      { title: 'Cost to build a house', detail: 'A guide to typical costs by stage', href: '/cost-to-build-a-house-in-zimbabwe', icon: BookOpen },
    ],
  },
  {
    id: 'projects',
    title: 'Price a project',
    note: 'Answer a few questions, get a priced list of materials.',
    tone: 'amber',
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
    id: 'budget',
    title: 'What can my budget buy?',
    note: 'Type what you have to spend and see how far it goes.',
    tone: 'green',
    tiles: [
      { title: 'House build', detail: 'Which stage your money reaches', href: '/quick-budget', icon: Calculator },
      { title: 'Solar', detail: 'The system your budget buys', href: '/quick-budget?mode=solar', icon: SolarPanel },
      { title: 'Borehole', detail: 'Depth and pump it covers', href: '/quick-budget?mode=borehole', icon: Drop },
      { title: 'Fencing', detail: 'How many metres it covers', href: '/quick-budget?mode=fencing', icon: Rows },
      { title: 'Paving', detail: 'How many square metres', href: '/quick-budget?mode=paving', icon: GridFour },
    ],
  },
  {
    id: 'more',
    title: 'More',
    note: 'Already have a quote, or ready to build.',
    tone: 'slate',
    tiles: [
      { title: 'Check a builder\'s quote', detail: 'Each price against the market', href: '/ai/quote-check', icon: Scales },
      { title: 'Scan a BOQ', detail: 'Turn a photo into a project', href: '/ai/boq-scanner', icon: FileMagnifyingGlass },
      { title: 'Find a builder', detail: 'Contractors and trades near you', href: '/contractors', icon: HardHat },
      { title: 'Buy materials', detail: 'Compare supplier prices', href: '/marketplace', icon: Storefront },
    ],
  },
];

const total = groups.reduce((sum, group) => sum + group.tiles.length, 0);

export default function EstimateServicesPage() {
  return (
    <MainLayout fullWidth>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Start an estimate</span>
              <h1>What do you need to work out?</h1>
              <p>Pick the closest match. You can change quantities, prices and materials before saving.</p>
              <DescribeProject />
            </div>
            <div className={styles.heroNote}>
              <ListChecks size={22} weight="duotone" aria-hidden="true" />
              <div>
                <strong>No account needed to start</strong>
                <span>Sign in only when you want to save your work.</span>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.directory} aria-label={`${total} ways to begin`}>
          {groups.map((group) => (
            <div key={group.id} className={`${styles.group} ${styles[group.tone]}`}>
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
                          <TileIcon size={20} weight="duotone" aria-hidden="true" />
                        </span>
                        <span className={styles.tileText}>
                          <strong>{tile.title}</strong>
                          <span>{tile.detail}</span>
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
