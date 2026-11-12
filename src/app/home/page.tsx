import Link from 'next/link';
import {
  ArrowRight,
  BookOpenText,
  Calculator,
  CheckCircle,
  FileText,
  Lightning,
  PencilLine,
  ShieldCheck,
  Tag,
  UploadSimple,
  UserPlus,
} from '@phosphor-icons/react/dist/ssr';
import MainLayout from '@/components/layout/MainLayout';
import HeroBudgetWidget from '@/components/home/HeroBudgetWidget';
import DescribeProject from '@/components/estimate/DescribeProject';
import SignedInEntryRedirect from '@/components/home/SignedInEntryRedirect';
import FeatureShowcase from '@/components/home/FeatureShowcase';
import styles from './home.module.css';

/* The six stages every estimate is priced in, in building order: the same
   six the budget check beside them fills in. */
const BUILD_STAGES = ['Foundation', 'Walls', 'Roof', 'Finishes', 'Plumbing & power', 'Outside'];

const estimateStarts = [
  {
    title: 'Answer guided questions',
    category: 'Guided build',
    description: 'Answer guided questions and create a complete construction BOQ.',
    detail: 'Best for a full house or detailed build',
    href: '/boq/new?method=manual&fresh=1',
    icon: PencilLine,
    recommended: true,
  },
  {
    title: 'Upload a floor plan',
    category: 'Floor plan',
    description: 'Let AI read room sizes, doors, and windows, then generate the quantities.',
    detail: 'PDF, PNG, JPG or WEBP',
    href: '/ai/vision-takeoff',
    icon: UploadSimple,
  },
  {
    title: 'Scan an existing quote',
    category: 'Document scan',
    description: 'Turn a photographed supplier quote or BOQ into a project you can manage.',
    detail: 'Figures are read from the document',
    href: '/ai/boq-scanner',
    icon: FileText,
  },
  {
    title: 'Estimate a smaller project',
    category: 'Focused build',
    description: 'Generate a focused BOQ for solar, water, boreholes, septic, fencing, or paving.',
    detail: 'Typically takes 4-7 minutes',
    href: '/quick-projects',
    icon: Lightning,
  },
];

export default function HomePage() {
  return (
    <MainLayout fullWidth>
      <SignedInEntryRedirect />
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Construction estimates · Zimbabwe</p>
              <h1 id="home-heading">Know the cost before you <em>lay a brick.</em></h1>
              <p className={styles.heroLead}>
                Every material and every stage of your build, listed and priced for
                Zimbabwe. See how far your money goes before you spend any of it.
              </p>

              <div className={styles.heroActions}>
                <Link href="/estimate" className={styles.primaryButton}>
                  <Calculator size={20} weight="bold" aria-hidden="true" />
                  Start your BOQ
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </Link>
                <Link href="/ai/vision-takeoff" className={styles.secondaryButton}>
                  <UploadSimple size={19} weight="bold" aria-hidden="true" />
                  Upload your plan
                  <ArrowRight size={16} weight="bold" className={styles.secondaryArrow} aria-hidden="true" />
                </Link>
              </div>

              <Link href="/contractors" className={styles.heroTextLink}>
                Looking for a builder? Find a contractor
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </Link>

              <div className={styles.heroAssurances} aria-label="Estimate benefits">
                <span><CheckCircle size={17} weight="fill" aria-hidden="true" /> Start without an account</span>
                <span><ShieldCheck size={17} weight="fill" aria-hidden="true" /> Your project stays private</span>
              </div>

              <ol className={styles.stageLine} aria-label="Every estimate is priced in six stages">
                {BUILD_STAGES.map((stage, index) => (
                  <li key={stage}>
                    <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    {stage}
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.heroBudget}>
              <HeroBudgetWidget />
            </div>
          </div>
        </section>

        <section className={styles.startSection} aria-labelledby="start-heading">
          <div className={styles.sectionInner}>
            <div className={styles.startHeader}>
              <div>
                <span className={styles.sectionIndex}>01 · Start from what you have</span>
                <h2 id="start-heading">What are you starting with?</h2>
              </div>
              <p>Choose a guided build, bring an existing plan or document, or price a smaller project in minutes.</p>
            </div>

            {/* The quickest way in, moved up from the bottom of the page: say
                what you are building and land in the right estimator. */}
            <div className={styles.describeRow}>
              <DescribeProject label="Not sure? Describe your project in a sentence" tone="light" />
            </div>

            <div className={styles.startGrid}>
              {estimateStarts.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.startCard}
                  >
                    <div className={styles.startCardTopline}>
                      <span className={styles.startCardRank}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.startCardCategory}>{item.category}</span>
                      {item.recommended && (
                        <span className={styles.startCardBadge}>Best for full builds</span>
                      )}
                    </div>
                    <div className={styles.startCardBody}>
                      <div className={styles.startCardIcon}>
                        <Icon size={26} weight="duotone" aria-hidden="true" />
                      </div>
                      <div className={styles.startCardCopy}>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>
                    </div>
                    <div className={styles.startCardFooter}>
                      <span className={styles.startCardDetail}>{item.detail}</span>
                      <span className={styles.startCardArrow} aria-hidden="true">
                        <ArrowRight size={16} weight="bold" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

          </div>
        </section>

        <FeatureShowcase />

        <section className={styles.closingSection} aria-labelledby="closing-heading">
          <div className={`${styles.closingInner} ${styles.closingGrid}`}>
            <div>
              <span className={styles.eyebrow}>03 · Your turn</span>
              <h2 id="closing-heading">Put the first reliable number on your project.</h2>
              <p>No account needed to start. Sign in when you want to save it.</p>
              <Link href="/estimate" className={styles.closingButton}>
                <Calculator size={20} weight="bold" aria-hidden="true" />
                Start your BOQ
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </Link>
            </div>

            {/* Before people commit: what a house costs, and what materials
                cost now. Describe-your-project moved up to the start section. */}
            <div className={styles.closingPanel}>
              <span className={styles.closingPanelTitle}>Before you start</span>
              <div className={styles.closingGuides}>
                <Link href="/cost-to-build-a-house-in-zimbabwe" className={styles.closingGuide}>
                  <BookOpenText size={22} weight="duotone" aria-hidden="true" />
                  <span>
                    <strong>What does a house cost in Zimbabwe?</strong>
                    <span>Typical costs by size, stage and finish.</span>
                  </span>
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Link>
                <Link href="/market-insights" className={styles.closingGuide}>
                  <Tag size={22} weight="duotone" aria-hidden="true" />
                  <span>
                    <strong>Material prices today</strong>
                    <span>Cement, bricks, steel, roofing and more.</span>
                  </span>
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          {/* Contractors are a smaller audience than people building; a line,
              not a band of its own. */}
          <div className={`${styles.closingInner} ${styles.contractorLine}`}>
            <span>Are you a contractor or builder?</span>
            <Link href="/contractor/register">
              <UserPlus size={17} aria-hidden="true" /> Register so homeowners can find you
              <ArrowRight size={15} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
