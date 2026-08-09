import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Calculator,
  ChartLineUp,
  CheckCircle,
  FileText,
  Lightning,
  Package,
  PencilLine,
  ShieldCheck,
  UploadSimple,
  UserPlus,
} from '@phosphor-icons/react/dist/ssr';
import MainLayout from '@/components/layout/MainLayout';
import HeroBudgetWidget from '@/components/home/HeroBudgetWidget';
import styles from './home.module.css';

const estimateBenefits = [
  'Stage-by-stage quantities and costs',
  'Zimbabwe-focused materials and pricing',
  'Save, share, and export when you are ready',
];

const estimateStarts = [
  {
    title: 'Create Your BOQ',
    category: 'Guided build',
    description: 'Answer guided questions and create a complete construction BOQ.',
    detail: 'Best for a full house or detailed build',
    href: '/boq/new?method=manual&fresh=1',
    icon: PencilLine,
    recommended: true,
  },
  {
    title: 'Plan to BOQ',
    category: 'Floor plan',
    description: 'Let AI read room sizes, doors, and windows, then generate the quantities.',
    detail: 'PDF, PNG, JPG or WEBP',
    href: '/ai/vision-takeoff',
    icon: UploadSimple,
  },
  {
    title: 'Quote to Project',
    category: 'Document scan',
    description: 'Turn a photographed supplier quote or BOQ into a project you can manage.',
    detail: 'Figures are read from the document',
    href: '/ai/boq-scanner',
    icon: FileText,
  },
  {
    title: 'Quick Project',
    category: 'Focused build',
    description: 'Generate a focused BOQ for solar, water, boreholes, septic, fencing, or paving.',
    detail: 'Typically takes 4-7 minutes',
    href: '/quick-projects',
    icon: Lightning,
  },
];

const workflow = [
  {
    number: '01',
    title: 'Estimate',
    description: 'Build a BOQ manually, from a plan, or from a supplier quote.',
    icon: Calculator,
  },
  {
    number: '02',
    title: 'Compare',
    description: 'Review material prices and send selected items for quotation.',
    icon: ChartLineUp,
  },
  {
    number: '03',
    title: 'Build',
    description: 'Track purchases, usage, documents, and progress by stage.',
    icon: Package,
  },
];

export default function HomePage() {
  return (
    <MainLayout fullWidth>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="home-heading">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>ZimEstimate</span>
              <h1 id="home-heading">Construction estimates built for Zimbabwe.</h1>
              <p>
                Build a practical BOQ, test your budget, and find contractors
                from one connected workspace.
              </p>

              <div className={styles.heroActions}>
                <Link href="/boq/new?method=manual&fresh=1" className={styles.primaryButton}>
                  <Calculator size={20} weight="bold" aria-hidden="true" />
                  Start your estimate
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </Link>
                <Link href="/contractors" className={styles.secondaryButton}>
                  <Briefcase size={19} weight="bold" aria-hidden="true" />
                  Find a contractor
                  <ArrowRight size={16} weight="bold" className={styles.secondaryArrow} aria-hidden="true" />
                </Link>
                <Link href="/quick-projects" className={styles.secondaryButton}>
                  <Lightning size={18} weight="bold" aria-hidden="true" />
                  Quick Projects
                  <ArrowRight size={16} weight="bold" className={styles.secondaryArrow} aria-hidden="true" />
                </Link>
                <Link href="/contractor/register" className={styles.secondaryButton}>
                  <UserPlus size={18} weight="bold" aria-hidden="true" />
                  Register as a Contractor
                  <ArrowRight size={16} weight="bold" className={styles.secondaryArrow} aria-hidden="true" />
                </Link>
              </div>

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
                <h2 id="start-heading">Four ways to create your BOQ.</h2>
              </div>
              <p>Choose a guided build, bring an existing plan or document, or price a smaller project in minutes.</p>
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

        <section className={styles.pathways} aria-labelledby="pathways-heading">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIndex}>Choose your next move</span>
              <h2 id="pathways-heading">Begin with a number. Move toward a real build.</h2>
            </div>

            <div className={styles.pathwayGrid}>
              <article className={styles.estimatePath}>
                <div className={styles.pathImage}>
                  <Image
                    src="/substructure.webp"
                    alt="Foundation works underway on a construction site"
                    fill
                    sizes="(min-width: 900px) 48vw, 100vw"
                    className={styles.coverImage}
                  />
                </div>
                <div className={styles.estimateContent}>
                  <div className={styles.pathIconPrimary}>
                    <Calculator size={24} weight="duotone" aria-hidden="true" />
                  </div>
                  <span className={styles.pathLabel}>Primary pathway</span>
                  <h3>Build your construction estimate</h3>
                  <p>
                    Turn the project in your head into quantities, stage budgets,
                    and a BOQ you can take to site.
                  </p>
                  <ul>
                    {estimateBenefits.map((benefit) => (
                      <li key={benefit}>
                        <CheckCircle size={17} weight="fill" aria-hidden="true" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <Link href="/boq/new?method=manual&fresh=1" className={styles.pathActionPrimary}>
                    Start building your BOQ
                    <ArrowRight size={17} weight="bold" aria-hidden="true" />
                  </Link>
                </div>
              </article>

              <div className={styles.secondaryPaths}>
                <article className={styles.secondaryPath}>
                  <div className={styles.secondaryPathImage}>
                    <Image
                      src="/superstructure.webp"
                      alt="Brick house under construction"
                      fill
                      sizes="(min-width: 900px) 34vw, 100vw"
                      className={styles.coverImage}
                    />
                  </div>
                  <div className={styles.secondaryPathContent}>
                    <Briefcase size={24} weight="duotone" aria-hidden="true" />
                    <div>
                      <span className={styles.pathLabel}>People</span>
                      <h3>Find a contractor</h3>
                      <p>Search listed builders by trade and service area.</p>
                    </div>
                    <Link href="/contractors" aria-label="Browse the contractor directory">
                      Browse directory <ArrowRight size={16} weight="bold" />
                    </Link>
                  </div>
                </article>

                <article className={styles.secondaryPath}>
                  <div className={styles.secondaryPathImage}>
                    <Image
                      src="/roofing.webp"
                      alt="Roofing work representing a focused construction project"
                      fill
                      sizes="(min-width: 900px) 34vw, 100vw"
                      className={styles.coverImage}
                    />
                  </div>
                  <div className={styles.secondaryPathContent}>
                    <Lightning size={24} weight="duotone" aria-hidden="true" />
                    <div>
                      <span className={styles.pathLabel}>Focused builds</span>
                      <h3>Start a Quick Project</h3>
                      <p>Create a focused BOQ for solar, water, boreholes, septic, fencing, or paving.</p>
                    </div>
                    <Link href="/quick-projects" aria-label="Choose a quick project">
                      Choose a project <ArrowRight size={16} weight="bold" />
                    </Link>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.workflowSection} aria-labelledby="workflow-heading">
          <div className={styles.sectionInner}>
            <div className={styles.workflowHeader}>
              <div>
                <span className={styles.sectionIndex}>One working record</span>
                <h2 id="workflow-heading">The estimate does not end at a PDF.</h2>
              </div>
              <p>
                Keep decisions, quotes, purchases, and site progress attached to
                the project that created them.
              </p>
            </div>

            <div className={styles.workflowSteps}>
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.number} className={styles.workflowStep}>
                    <div className={styles.stepTopline}>
                      <span>{item.number}</span>
                      <Icon size={23} weight="duotone" aria-hidden="true" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.closingSection} aria-labelledby="closing-heading">
          <div className={styles.closingInner}>
            <h2 id="closing-heading">Put the first reliable number on your project.</h2>
            <p>No account needed to start. Sign in when you want to save it.</p>
            <Link href="/boq/new?method=manual&fresh=1" className={styles.closingButton}>
              <Calculator size={20} weight="bold" aria-hidden="true" />
              Start your estimate
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
