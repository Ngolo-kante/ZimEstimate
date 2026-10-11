import Link from 'next/link';
import {
  ArrowRight,
  Blueprint,
  Buildings,
  Calculator,
  FileMagnifyingGlass,
  HouseLine,
  Lightning,
  ListChecks,
  SolarPanel,
} from '@phosphor-icons/react/dist/ssr';
import MainLayout from '@/components/layout/MainLayout';
import type { Metadata } from 'next';
import styles from './estimate.module.css';

export const metadata: Metadata = {
  title: 'Start an estimate | ZimEstimate',
  description: 'Full house, by stage, budget checks, solar, boreholes and more — pick where to start. No account needed.',
};

const estimateOptions = [
  {
    number: '01',
    title: 'Full house estimate',
    description: 'Build a complete, itemised BOQ from foundations through finishes and external works.',
    detail: 'All construction stages',
    href: '/boq/new?method=manual&fresh=1&preset=full_house',
    icon: HouseLine,
    featured: true,
  },
  {
    number: '02',
    title: 'Estimate by stage',
    description: 'Choose only the work you are ready to cost: substructure, walls, roofing, finishes, or external works.',
    detail: 'Pick one or several stages',
    href: '/boq/new?method=manual&fresh=1&preset=building_in_stages',
    icon: Buildings,
    featured: true,
  },
  {
    number: '03',
    title: 'Check my house budget',
    description: 'See how far a budget could carry your build and which stage it is likely to reach.',
    detail: 'Fast budget reality check',
    href: '/quick-budget',
    icon: Calculator,
  },
  {
    number: '04',
    title: 'Check a solar budget',
    description: 'Compare solar system sizes, battery capacity, backup time, and the equipment your budget can cover.',
    detail: 'Panels, batteries and inverter',
    href: '/quick-budget?mode=solar',
    icon: SolarPanel,
  },
  {
    number: '05',
    title: 'Quick project estimate',
    description: 'Price a focused job such as a borehole, water tank, septic system, fence, or paving.',
    detail: 'Six focused project tools',
    href: '/quick-projects',
    icon: Lightning,
  },
  {
    number: '06',
    title: 'Read a floor plan',
    description: 'Upload a plan for room dimensions, doors, windows, and a material estimate you can verify.',
    detail: 'PDF, PNG, JPG or WebP',
    href: '/ai/vision-takeoff',
    icon: Blueprint,
  },
  {
    number: '07',
    title: 'Scan an existing quote',
    description: 'Turn a supplier quote or existing BOQ into editable line items instead of typing it again.',
    detail: 'Photos and PDF documents',
    href: '/ai/boq-scanner',
    icon: FileMagnifyingGlass,
  },
];

export default function EstimateServicesPage() {
  return (
    <MainLayout fullWidth>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Estimate desk / choose a starting point</span>
              <h1>What do you need to work out?</h1>
              <p>
                Start with the information you already have. Every route leads to an estimate you can review,
                adjust, save, and use for supplier quotations.
              </p>
            </div>
            <div className={styles.heroNote}>
              <ListChecks size={24} weight="duotone" aria-hidden="true" />
              <div>
                <strong>No account needed to start</strong>
                <span>Sign in only when you want to save your work.</span>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.directory} aria-labelledby="estimate-options-heading">
          <div className={styles.directoryHeader}>
            <div>
              <span>7 ways to begin</span>
              <h2 id="estimate-options-heading">Choose the closest match.</h2>
            </div>
            <p>You can change quantities, prices, materials, and labour before saving any result.</p>
          </div>

          <div className={styles.optionGrid}>
            {estimateOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Link
                  key={option.number}
                  href={option.href}
                  className={`${styles.optionCard} ${option.featured ? styles.featuredCard : ''}`}
                >
                  <div className={styles.cardTopline}>
                    <span>{option.number}</span>
                    {option.featured && <em>House build</em>}
                  </div>
                  <div className={styles.iconBox}>
                    <Icon size={28} weight="duotone" aria-hidden="true" />
                  </div>
                  <h3>{option.title}</h3>
                  <p>{option.description}</p>
                  <div className={styles.cardFooter}>
                    <span>{option.detail}</span>
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
