import Link from 'next/link';
import {
  ArrowRight,
  BookOpenText,
  Calculator,
  ChartLineUp,
  CheckCircle,
  FileText,
  Lightning,
  Package,
  PencilLine,
  ShieldCheck,
  Tag,
  UploadSimple,
  UserPlus,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import MainLayout from '@/components/layout/MainLayout';
import HeroBudgetWidget from '@/components/home/HeroBudgetWidget';
import DescribeProject from '@/components/estimate/DescribeProject';
import SignedInEntryRedirect from '@/components/home/SignedInEntryRedirect';
import HeroPriceInsights from '@/components/home/HeroPriceInsights';
import styles from './home.module.css';

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

// Each step opens the part of the product it describes; it used to be four
// cards of reading with nowhere to go.
const workflow = [
  {
    number: '01',
    title: 'Estimate',
    description: 'Build a BOQ by answering questions, from a plan, or from a quote.',
    action: 'Start your BOQ',
    href: '/estimate',
    icon: Calculator,
  },
  {
    number: '02',
    title: 'Compare prices',
    description: 'See current material prices and ask suppliers to quote.',
    action: 'See material prices',
    href: '/market-insights',
    icon: ChartLineUp,
  },
  {
    number: '03',
    title: 'Build',
    description: 'Track purchases, materials used, documents and progress by stage.',
    action: 'Open your projects',
    href: '/projects',
    icon: Package,
  },
  {
    number: '04',
    title: 'Work with your builder',
    description: 'Invite your builder to tick off tasks, log materials and send site photos. They never see your prices.',
    action: 'Invite your builder',
    href: '/projects',
    icon: UsersThree,
  },
];

export default function HomePage() {
  return (
    <MainLayout fullWidth>
      <SignedInEntryRedirect />
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <h1 id="home-heading">Construction estimates built for Zimbabwe.</h1>
              <p>
                Know what your build needs and what it could cost. Create an itemised
                estimate, compare prices, and keep your project on track.
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

              <HeroPriceInsights />

              <div className={styles.heroAssurances} aria-label="Estimate benefits">
                <span><CheckCircle size={17} weight="fill" /> Start without an account</span>
                <span><ShieldCheck size={17} weight="fill" /> Your project stays private</span>
              </div>
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
                <span className={styles.sectionIndex}>Start from what you have</span>
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

        <section className={styles.workflowSection} aria-labelledby="workflow-heading">
          <div className={styles.sectionInner}>
            <div className={styles.workflowHeader}>
              <div>
                <span className={styles.sectionIndex}>How it works</span>
                <h2 id="workflow-heading">The estimate does not end at a PDF.</h2>
              </div>
              {/* The line for people building from abroad: it sits here, not in a
                  step, because step descriptions are hidden on phones. */}
              <p>
                Quotes, purchases and site progress stay attached to the project
                that created them — even when you are building from abroad.
              </p>
            </div>

            <div className={styles.workflowSteps}>
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.number} href={item.href} className={styles.workflowStep}>
                    <div className={styles.stepTopline}>
                      <span>{item.number}</span>
                      <Icon size={22} weight="duotone" aria-hidden="true" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className={styles.stepAction}>
                      {item.action} <ArrowRight size={14} weight="bold" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.closingSection} aria-labelledby="closing-heading">
          <div className={`${styles.closingInner} ${styles.closingGrid}`}>
            <div>
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
