import type { Metadata } from 'next';
import {
  ArrowRight,
  Blueprint,
  Buildings,
  Calculator,
  CheckCircle,
  CurrencyDollar,
  Hammer,
  HouseLine,
  MapPin,
  Ruler,
} from '@phosphor-icons/react/dist/ssr';
import MainLayout from '@/components/layout/MainLayout';
import HeroBudgetWidget from '@/components/home/HeroBudgetWidget';
import TrackedLink from '@/components/analytics/TrackedLink';
import { estimateStageReach } from '@/lib/estimators/stageBudgetEstimator';
import { getSiteUrl } from '@/lib/siteUrl';
import styles from './page.module.css';

const PAGE_PATH = '/cost-to-build-a-house-in-zimbabwe';
const PAGE_TITLE = 'Cost to Build a House in Zimbabwe | Free Calculator';
const PAGE_DESCRIPTION =
  'Estimate materials and labour for building a house in Zimbabwe. Compare floor areas, explore construction stages, and create a detailed BOQ.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  keywords: [
    'cost to build a house in Zimbabwe',
    'Zimbabwe construction cost calculator',
    'house building costs Zimbabwe',
    'bill of quantities Zimbabwe',
    'building materials calculator Zimbabwe',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_ZW',
    url: PAGE_PATH,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: '/screenshots/home.png',
        width: 1280,
        height: 720,
        alt: 'ZimEstimate construction budget calculator for Zimbabwe',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ['/screenshots/home.png'],
  },
};

const examplePlans = [
  { area: 80, label: 'Compact home', note: 'A practical smaller footprint' },
  { area: 120, label: 'Family home', note: 'A common three-bedroom starting point' },
  { area: 200, label: 'Larger home', note: 'More rooms and living space' },
].map((plan) => ({
  ...plan,
  estimate: estimateStageReach({
    budgetUsd: 1,
    floorAreaM2: plan.area,
    locationType: 'urban',
    wallHeightM: 3,
    cementTypes: ['cement_425'],
    includeLabor: true,
  }),
}));

const stageDetails = [
  {
    number: '01',
    title: 'Site preparation & foundation',
    description: 'Setting out, excavation, concrete, foundation brickwork, filling and the ground-floor slab.',
  },
  {
    number: '02',
    title: 'Walls & structural frame',
    description: 'External and internal walls, lintels, columns and the structural materials that form the shell.',
  },
  {
    number: '03',
    title: 'Roofing',
    description: 'Roof structure, covering, ridges, flashings, gutters and associated materials.',
  },
  {
    number: '04',
    title: 'Interior & finishing',
    description: 'Openings, plaster, ceilings, flooring, paint, plumbing and electrical allowances.',
  },
  {
    number: '05',
    title: 'External work',
    description: 'Drainage, paths and a planning allowance for essential work beyond the house footprint.',
  },
];

const costFactors = [
  {
    icon: Ruler,
    title: 'Floor area and shape',
    description: 'More floor area needs more material. Complex corners and long wall runs can also increase quantities.',
  },
  {
    icon: MapPin,
    title: 'Location and transport',
    description: 'Supplier access, delivery distance and site conditions change the landed cost of materials.',
  },
  {
    icon: HouseLine,
    title: 'Specification',
    description: 'Wall height, brick and cement choices, roof form, fittings and finishes all move the final figure.',
  },
  {
    icon: Hammer,
    title: 'Labour and site conditions',
    description: 'Ground conditions, access, workmanship and programme affect labour and preliminaries separately.',
  },
];

const faqs = [
  {
    question: 'How much does it cost to build a house in Zimbabwe?',
    answer:
      'There is no single reliable price for every house. Floor area, location, ground conditions, design, specification, labour and changing material prices all affect the total. Use the calculator as a planning baseline, then create a project-specific BOQ before committing funds.',
  },
  {
    question: 'Are labour costs included in these examples?',
    answer:
      'Yes. The example plan figures include a planning allowance for labour based on each stage’s materials. Professional fees, statutory approvals, utility connections and unusual site work should be budgeted separately.',
  },
  {
    question: 'What is a BOQ?',
    answer:
      'A Bill of Quantities is a structured list of construction work and materials with measured quantities. It helps you compare quotations, plan purchases and understand where the project budget is going.',
  },
  {
    question: 'Can I adjust the house size and location?',
    answer:
      'Yes. The full ZimEstimate Budget Studio lets you change floor area, choose an urban, peri-urban or rural location, and compare economy and standard build assumptions.',
  },
  {
    question: 'Should I use this estimate as a contractor quotation?',
    answer:
      'No. It is an early planning estimate, not a tender or fixed quotation. Confirm measurements, specifications, current supplier prices and labour rates with qualified local professionals before construction.',
  },
];

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export default function HouseCostZimbabwePage() {
  const siteUrl = getSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'ZimEstimate Construction Budget Calculator',
        url: `${siteUrl}/quick-budget`,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        description: PAGE_DESCRIPTION,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };

  return (
    <MainLayout fullWidth>
      <div className={styles.page}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />

        <section className={styles.hero} aria-labelledby="house-cost-heading">
          <div className={styles.blueprintGrid} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.kicker}>
                <Blueprint size={17} weight="duotone" aria-hidden="true" />
                Zimbabwe building cost guide
              </div>
              <h1 id="house-cost-heading">How much does it cost to build a house in Zimbabwe?</h1>
              <p className={styles.heroLead}>
                Start with the size of the house and the money available. Get an indicative materials and labour budget, see which construction stages it can cover, then turn it into a detailed Bill of Quantities.
              </p>
              <div className={styles.heroActions}>
                <TrackedLink
                  href="/quick-budget"
                  className={styles.primaryCta}
                  event="calculator_started"
                  eventProperties={{ source: 'house_cost_guide', placement: 'hero' }}
                >
                  Calculate your build
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </TrackedLink>
                <a href="#example-costs" className={styles.secondaryCta}>See example plans</a>
              </div>
              <ul className={styles.assurances} aria-label="Calculator details">
                <li><CheckCircle size={17} weight="fill" /> No account required</li>
                <li><CheckCircle size={17} weight="fill" /> Zimbabwe-focused assumptions</li>
                <li><CheckCircle size={17} weight="fill" /> Editable BOQ pathway</li>
              </ul>
            </div>
            <div className={styles.calculatorCard}>
              <HeroBudgetWidget />
            </div>
          </div>
        </section>

        <div className={styles.disclaimerBar}>
          <span>Planning note</span>
          <p>Estimates include a planning allowance for labour. Confirm current quantities, prices, labour rates and site requirements before building.</p>
        </div>

        <section className={styles.examples} id="example-costs" aria-labelledby="example-costs-heading">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionLabel}>Indicative starting points</span>
                <h2 id="example-costs-heading">Compare common house sizes</h2>
              </div>
              <p>Calculated from the same engine used in the Budget Studio: urban location, standard 3m walls and 42.5 cement assumptions.</p>
            </div>

            <div className={styles.planGrid}>
              {examplePlans.map((plan, index) => (
                <article className={`${styles.planCard} ${index === 1 ? styles.featuredPlan : ''}`} key={plan.area}>
                  <div className={styles.planTopline}>
                    <span>{plan.label}</span>
                    {index === 1 && <small>Useful baseline</small>}
                  </div>
                  <div className={styles.areaLockup}>
                    <strong>{plan.area}</strong>
                    <span>m²</span>
                  </div>
                  <p>{plan.note}</p>
                  <div className={styles.planTotal}>
                    <span>Indicative materials and labour</span>
                    <strong>{formatUsd(plan.estimate.estimatedTotalUsd)}</strong>
                  </div>
                  <TrackedLink
                    href={`/quick-budget?area=${plan.area}`}
                    event="calculator_started"
                    eventProperties={{ source: 'house_cost_guide', placement: 'example_plan', floor_area_m2: plan.area }}
                  >
                    Adjust this plan <ArrowRight size={15} weight="bold" />
                  </TrackedLink>
                </article>
              ))}
            </div>
            <p className={styles.dataNote}>Based on the estimator’s reference price catalogue and a stage-based labour allowance, not live quotations. Figures are rounded and exclude professional fees, approvals and utility connections.</p>
          </div>
        </section>

        <section className={styles.factors} aria-labelledby="cost-factors-heading">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeadingCompact}>
              <span className={styles.sectionLabel}>Why estimates differ</span>
              <h2 id="cost-factors-heading">Four decisions shape the budget</h2>
              <p>A useful estimate begins with clear assumptions. Change any of these and the quantities or delivered prices can change with it.</p>
            </div>
            <div className={styles.factorGrid}>
              {costFactors.map((factor) => {
                const Icon = factor.icon;
                return (
                  <article key={factor.title}>
                    <span className={styles.factorIcon}><Icon size={25} weight="duotone" /></span>
                    <h3>{factor.title}</h3>
                    <p>{factor.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.stages} aria-labelledby="stages-heading">
          <div className={styles.sectionInner}>
            <div className={styles.stageIntro}>
              <span className={styles.sectionLabel}>From ground to handover</span>
              <h2 id="stages-heading">Plan the build stage by stage</h2>
              <p>A single total hides where the money goes. ZimEstimate organises the plan into recognisable stages so you can sequence purchases and compare quotations.</p>
              <TrackedLink
                href="/boq/new?method=manual&fresh=1"
                className={styles.textLink}
                event="boq_cta_clicked"
                eventProperties={{ source: 'house_cost_guide', placement: 'stages' }}
              >
                Create a detailed BOQ <ArrowRight size={16} weight="bold" />
              </TrackedLink>
            </div>
            <ol className={styles.stageList}>
              {stageDetails.map((stage) => (
                <li key={stage.number}>
                  <span>{stage.number}</span>
                  <div>
                    <h3>{stage.title}</h3>
                    <p>{stage.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.boqBand}>
          <div className={styles.boqBandInner}>
            <div className={styles.boqIcon} aria-hidden="true"><Buildings size={34} weight="duotone" /></div>
            <div>
              <span className={styles.sectionLabel}>A budget is the beginning</span>
              <h2>Move from a rough number to a usable BOQ</h2>
              <p>Describe the house, review calculated quantities, adjust the scope and keep one working cost plan for your project.</p>
            </div>
            <TrackedLink
              href="/boq/new?method=manual&fresh=1"
              className={styles.lightCta}
              event="boq_cta_clicked"
              eventProperties={{ source: 'house_cost_guide', placement: 'boq_band' }}
            >
              Start your BOQ <ArrowRight size={17} weight="bold" />
            </TrackedLink>
          </div>
        </section>

        <section className={styles.faq} aria-labelledby="faq-heading">
          <div className={styles.faqInner}>
            <div className={styles.faqHeading}>
              <span className={styles.sectionLabel}>Practical answers</span>
              <h2 id="faq-heading">House-building cost questions</h2>
              <div className={styles.faqMarks} aria-hidden="true">
                <Calculator size={24} weight="duotone" />
                <CurrencyDollar size={24} weight="duotone" />
                <Blueprint size={24} weight="duotone" />
              </div>
            </div>
            <div className={styles.faqList}>
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.closing}>
          <div>
            <span>Ready to test your budget?</span>
            <h2>Start with your actual floor area.</h2>
          </div>
          <TrackedLink
            href="/quick-budget"
            className={styles.primaryCta}
            event="calculator_started"
            eventProperties={{ source: 'house_cost_guide', placement: 'closing' }}
          >
            Open the Budget Studio <ArrowRight size={18} weight="bold" />
          </TrackedLink>
        </section>
      </div>
    </MainLayout>
  );
}
