'use client';

import { type CSSProperties, type ComponentType } from 'react';
import { useReveal } from '@/hooks/useReveal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Scan,
  Camera,
  NotePencil,
  Calculator,
  ArrowRight,
  ChartLine,
  Package,
  CurrencyDollar,
  Wallet,
  ChartLineUp,
  Stack,
  CheckCircle,
  Storefront,
  DownloadSimple,
  ShieldCheck,
  FileText,
} from '@phosphor-icons/react';

type IconType = ComponentType<{ size?: number; weight?: 'regular' | 'duotone' | 'fill' | 'light' | 'bold' | 'thin' }>;

const workflows: Array<{
  id: string;
  icon: IconType;
  title: string;
  label: string;
  href: string;
}> = [
    {
      id: 'vision',
      icon: Scan,
      title: 'Vision AI Takeoff',
      label: 'HIGH PRECISION',
      href: '/ai/vision-takeoff',
    },
    {
      id: 'scanner',
      icon: Camera,
      title: 'Smart Quote Scanner',
      label: 'FIELD READY',
      href: '/ai/quote-scanner',
    },
    {
      id: 'manual',
      icon: NotePencil,
      title: 'Manual Builder',
      label: 'PRO CONTROL',
      href: '/boq/new?method=manual',
    },
    {
      id: 'budget-checker',
      icon: Calculator,
      title: 'Budget Check',
      label: 'FEASIBILITY',
      href: '/quick-budget',
    },
  ];

const signals: Array<{
  icon: IconType;
  label: string;
  value: string;
  subtext: string;
}> = [
    {
      icon: ChartLine,
      label: 'MARKET ACCURACY',
      value: '98.2%',
      subtext: 'Weekly material price verification',
    },
    {
      icon: Package,
      label: 'MATERIAL COVERAGE',
      value: '2.8k+',
      subtext: 'Tracked products and vendor references',
    },
    {
      icon: CurrencyDollar,
      label: 'DUAL CURRENCY',
      value: 'USD + ZiG',
      subtext: 'Live conversion across all project views',
    },
  ];

// Platform capabilities for the offers section
const offerings: Array<{
  icon: IconType;
  title: string;
  description: string;
  href: string;
}> = [
    {
      icon: Wallet,
      title: 'Budget Planner',
      description: 'Set savings targets and forecast required daily or weekly contributions.',
      href: '/projects',
    },
    {
      icon: ChartLineUp,
      title: 'Budget vs Actual',
      description: 'Track variance by quantity and unit price in real-time.',
      href: '/projects',
    },
    {
      icon: Stack,
      title: 'Stage-Based BOQ',
      description: 'Organize costs by substructure, superstructure, roofing, and finishing.',
      href: '/boq/new?method=manual',
    },
    {
      icon: CheckCircle,
      title: 'Usage Tracking',
      description: 'Record consumption against BOQ quantities and trigger low-stock actions.',
      href: '/projects',
    },
    {
      icon: Storefront,
      title: 'Procurement Hub',
      description: 'Create RFQs, compare supplier responses, and log purchases.',
      href: '/projects',
    },
    {
      icon: DownloadSimple,
      title: 'PDF/Excel Exports',
      description: 'Generate share-ready reports for clients, QS, and site teams.',
      href: '/export',
    },
  ];

const workflowLine = [
  { step: '01', title: 'Estimate', desc: 'Generate BOQ quickly from drawings, scans, or manual input.' },
  { step: '02', title: 'Price', desc: 'Pull current market pricing and compare budget scenarios.' },
  { step: '03', title: 'Procure', desc: 'Run RFQ cycles and record purchases from selected suppliers.' },
  { step: '04', title: 'Track', desc: 'Monitor usage, variance, and progress by construction stage.' },
];

export default function HomePage() {
  const router = useRouter();
  const { profile } = useAuth();

  const isAdmin =
    profile?.tier === 'admin' ||
    (profile?.email?.toLowerCase() === 'demo@zimestimate.com');

  useReveal({ selector: '.reveal-item', threshold: 0.16, once: true });

  return (
    <MainLayout fullWidth>
      <div className="home-page">
        <section className="hero reveal-item" data-delay="1">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="hero-eyebrow">ESTIMATE. PROCURE. TRACK.</span>
              <h1>One operating screen for Zimbabwe construction projects.</h1>
              <p>
                ZimEstimate connects BOQ generation, live pricing, procurement, and usage tracking so your
                team can move from estimate to execution without context switching.
              </p>

              <div className="hero-actions">
                <Button
                  onClick={() => router.push('/boq/new?method=manual')}
                  icon={<ArrowRight size={18} />}
                  iconPosition="right"
                  size="lg"
                  className="hero-primary"
                >
                  Create Estimate Now
                </Button>
                <Link href="/market-insights" className="hero-link">
                  Check Live Material Prices
                </Link>
                {isAdmin && (
                  <Link href="/admin/suppliers" className="hero-link hero-link-admin">
                    <ShieldCheck size={16} weight="bold" />
                    Open Admin Portal
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="quick-start-section reveal-item" data-delay="2">
          <div className="quick-start-card">
            <div className="quick-start-header">
              <span className="qs-kicker">QUICK START</span>
              <h2>Smart BOQ Builder</h2>
              <p>Pick a workflow to begin in minutes.</p>
            </div>

            <div className="qs-workflows">
              {workflows.map((workflow, index) => {
                const Icon = workflow.icon;
                return (
                  <Link
                    key={workflow.id}
                    href={workflow.href}
                    className="qs-item reveal-item"
                    style={{ '--delay': `${index * 80}ms` } as CSSProperties}
                  >
                    <div className="qs-icon-box">
                      <Icon size={24} weight="bold" />
                    </div>
                    <div className="qs-content">
                      <h3>{workflow.title}</h3>
                      <span className="qs-label">{workflow.label}</span>
                      <div className="qs-arrow">
                        <ArrowRight size={20} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="cta-section reveal-item" data-delay="3">
          <div className="cta-shell">
            <div className="cta-copy">
              <FileText size={24} weight="duotone" />
              <div>
                <h3>Ready to move this from estimate to execution?</h3>
                <p>Create your account to save projects, run procurement, and export client-ready reports.</p>
              </div>
            </div>
            <div className="cta-actions">
              <Button
                onClick={() => router.push('/auth/signup')}
                icon={<ArrowRight size={16} />}
                iconPosition="right"
                size="lg"
              >
                Create Free Account
              </Button>
              <Button
                onClick={() => router.push('/boq/new?method=manual')}
                variant="secondary"
                size="lg"
              >
                Start BOQ First
              </Button>
            </div>
          </div>
        </section>

        <section className="proof-section reveal-item" data-delay="4">
          <div className="proof-head">
            <span className="section-kicker">TRUST PROOF</span>
            <h2>Built for real pricing pressure and procurement timelines.</h2>
          </div>
          <div className="proof-grid">
            {signals.map((signal, index) => {
              const Icon = signal.icon;
              return (
                <div
                  key={signal.label}
                  className="proof-card reveal-item"
                  style={{ '--delay': `${index * 80}ms` } as CSSProperties}
                >
                  <div className="proof-top">
                    <Icon size={18} weight="duotone" />
                    <span>{signal.label}</span>
                  </div>
                  <strong>{signal.value}</strong>
                  <p>{signal.subtext}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="offers-section reveal-item" data-delay="5">
          <div className="section-head">
            <span className="section-kicker">PLATFORM CAPABILITIES</span>
            <h2>Everything after the estimate is already connected.</h2>
            <p>Core capabilities designed to reduce rework and improve cost control.</p>
          </div>

          <div className="offers-grid">
            {offerings.map((offer, index) => {
              const Icon = offer.icon;
              return (
                <Link
                  key={offer.title}
                  href={offer.href}
                  className="offer-card reveal-item"
                  style={{ '--delay': `${index * 70}ms` } as CSSProperties}
                >
                  <div className="offer-icon">
                    <Icon size={20} weight="duotone" />
                  </div>
                  <h4>{offer.title}</h4>
                  <p>{offer.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="flowline-section reveal-item" data-delay="6">
          <div className="section-head">
            <span className="section-kicker">HOW IT FLOWS</span>
            <h2>One pipeline from planning to site execution.</h2>
          </div>

          <div className="flowline-grid">
            {workflowLine.map((item, index) => (
              <div key={item.step} className="flow-step">
                <span className="flow-step-no">{item.step}</span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
                {index < workflowLine.length - 1 && <span className="flow-connector" />}
              </div>
            ))}
          </div>
        </section>

      </div>

      <style jsx>{`
        .home-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 22px 84px;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        .hero {
          position: relative;
          border-radius: 28px;
          padding: 42px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          background:
            radial-gradient(circle at 85% -10%, rgba(78, 154, 247, 0.22), rgba(78, 154, 247, 0)),
            radial-gradient(circle at 0% 100%, rgba(15, 23, 42, 0.09), rgba(15, 23, 42, 0)),
            linear-gradient(145deg, #ffffff 12%, #f7fbff 70%, #eef6ff 100%);
          box-shadow: 0 24px 50px rgba(15, 23, 42, 0.1);
          overflow: hidden;
        }

        .hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(78, 154, 247, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(78, 154, 247, 0.08) 1px, transparent 1px);
          background-size: 44px 44px;
          opacity: 0.18;
          pointer-events: none;
        }

        .hero-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 26px;
          align-items: stretch;
        }

        .hero-copy {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .hero-eyebrow {
          font-size: 0.71rem;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: var(--color-accent-dark);
        }

        .hero-copy h1 {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3rem);
          line-height: 1.05;
          letter-spacing: -0.025em;
          color: var(--color-primary-dark);
        }

        .hero-copy p {
          margin: 0;
          max-width: 620px;
          color: var(--color-text-secondary);
          line-height: 1.7;
        }

        .hero-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 6px;
        }

        .hero-link {
          text-decoration: none;
          color: var(--color-primary);
          font-size: 0.92rem;
          font-weight: 700;
        }

        .hero-link:hover {
          color: var(--color-accent-dark);
        }

        .hero-link-admin {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px dashed rgba(15, 23, 42, 0.3);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.04);
        }

        /* NEW QUICK START SECTION STYLES */
        .quick-start-section {
          display: flex;
          justify-content: center;
        }

        .quick-start-card {
          background: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 
            0 10px 30px -5px rgba(15, 23, 42, 0.04),
            0 4px 12px -2px rgba(15, 23, 42, 0.02);
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .quick-start-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 100%;
        }

        .qs-kicker {
          font-size: 0.75rem;
          letter-spacing: 0.15em;
          font-weight: 700;
          color: var(--color-primary-light, #3b82f6);
          text-transform: uppercase;
        }

        .quick-start-header h2 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--color-primary-dark);
          line-height: 1.2;
        }

        .quick-start-header p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 1rem;
        }

        .qs-workflows {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        .qs-item {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid transparent;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .qs-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, var(--color-primary, #2563eb), var(--color-accent-dark, #3b82f6));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }

        .qs-item:hover {
          background: #ffffff;
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 12px 24px -6px rgba(59, 130, 246, 0.12);
          transform: translateY(-6px);
        }

        .qs-item:hover::before {
          transform: scaleX(1);
        }

        .qs-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          transition: all 0.3s ease;
        }

        .qs-item:hover .qs-icon-box {
          background: #dbeafe;
          transform: scale(1.05) rotate(-3deg);
          color: var(--color-primary, #2563eb);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .qs-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
        }

        .qs-content h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #0f172a;
          transition: color 0.2s ease;
        }

        .qs-item:hover h3 {
          color: var(--color-primary, #2563eb);
        }

        .qs-label {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
          padding: 2px 0;
          transition: color 0.2s ease;
        }

        .qs-item:hover .qs-label {
          color: var(--color-accent-dark, #3b82f6);
        }

        .qs-arrow {
          margin-top: 12px;
          color: #0f172a;
          align-self: flex-end;
          opacity: 0.3;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(0);
        }

        .qs-item:hover .qs-arrow {
          opacity: 1;
          color: var(--color-primary, #2563eb);
          transform: translateX(6px);
        }

        @media (max-width: 860px) {
          .qs-workflows {
            grid-template-columns: 1fr;
          }
        }

        .section-head {
          margin-bottom: 22px;
        }

        .section-kicker {
          font-size: 0.72rem;
          letter-spacing: 0.16em;
          font-weight: 700;
          color: var(--color-accent-dark);
        }

        .section-head h2 {
          margin: 9px 0 8px;
          font-size: clamp(1.55rem, 2.9vw, 2.12rem);
          line-height: 1.2;
          color: var(--color-primary);
        }

        .section-head p {
          margin: 0;
          color: var(--color-text-secondary);
          line-height: 1.6;
        }

        .proof-section {
          border-radius: 20px;
          padding: 20px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: linear-gradient(155deg, rgba(255, 255, 255, 0.98), rgba(242, 248, 255, 0.84));
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
        }

        .proof-head {
          margin-bottom: 14px;
        }

        .proof-head h2 {
          margin: 8px 0 0;
          font-size: clamp(1.35rem, 2.5vw, 1.8rem);
          line-height: 1.25;
          color: var(--color-primary);
        }

        .proof-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .proof-card {
          border-radius: 14px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.26);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .proof-card:hover {
          transform: translateY(-2px);
          border-color: rgba(78, 154, 247, 0.48);
        }

        .proof-top {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--color-text-muted);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .proof-card strong {
          display: block;
          margin-top: 8px;
          font-size: 1.08rem;
          color: var(--color-primary);
        }

        .proof-card p {
          margin: 5px 0 0;
          font-size: 0.8rem;
          line-height: 1.45;
          color: var(--color-text-muted);
        }

        .offers-section {
          padding: 22px;
          border-radius: 24px;
          background:
            radial-gradient(circle at 6% 0%, rgba(78, 154, 247, 0.2), rgba(78, 154, 247, 0)),
            linear-gradient(180deg, rgba(10, 24, 52, 0.05), rgba(255, 255, 255, 0.9));
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .offers-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .offer-card {
          text-decoration: none;
          border-radius: 14px;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
          opacity: 0;
          transform: translateY(10px);
          animation: rise-in 0.45s ease both;
          animation-delay: var(--delay);
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .offer-card:hover {
          border-color: rgba(78, 154, 247, 0.5);
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
        }

        .offer-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(78, 154, 247, 0.15), rgba(78, 154, 247, 0.06));
          color: var(--color-accent-dark);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .offer-card h4 {
          margin: 0 0 6px;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .offer-card p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .flowline-section {
          padding: 8px 0 2px;
        }

        .flowline-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .flow-step {
          position: relative;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: #ffffff;
          padding: 15px;
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.05);
        }

        .flow-step-no {
          display: inline-flex;
          width: fit-content;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(78, 154, 247, 0.14);
          color: var(--color-accent-dark);
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .flow-step h4 {
          margin: 10px 0 6px;
          color: var(--color-primary);
          font-size: 0.96rem;
        }

        .flow-step p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.82rem;
          line-height: 1.52;
        }

        .flow-connector {
          position: absolute;
          top: 50%;
          right: -13px;
          width: 13px;
          height: 2px;
          background: rgba(78, 154, 247, 0.45);
        }

        .cta-section {
          margin-top: 8px;
        }

        .cta-shell {
          border-radius: 18px;
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: linear-gradient(130deg, rgba(6, 20, 47, 0.05), rgba(78, 154, 247, 0.08));
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          box-shadow: 0 14px 24px rgba(15, 23, 42, 0.08);
        }

        .cta-copy {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: var(--color-primary);
        }

        .cta-copy h3 {
          margin: 0 0 4px;
          font-size: 1.15rem;
        }

        .cta-copy p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }

        .cta-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .hero :global(.hero-primary) {
          box-shadow: 0 12px 22px rgba(15, 23, 42, 0.18);
        }

        @keyframes rise-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .offer-card {
            animation: none;
            opacity: 1;
            transform: none;
          }

          .offer-card {
            transition: none;
          }
        }

        @media (max-width: 1080px) {
          .offers-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .proof-grid {
            grid-template-columns: 1fr;
          }

          .workflow-proof-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .flowline-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .flow-step:nth-child(2n) .flow-connector {
            display: none;
          }
        }

        @media (max-width: 860px) {
          .offers-grid {
            grid-template-columns: 1fr;
          }

          .cta-shell {
            flex-direction: column;
            align-items: flex-start;
          }

          .cta-actions {
            width: 100%;
          }
        }

        @media (max-width: 640px) {
          .home-page {
            padding: 18px 14px 74px;
            gap: 34px;
          }

          .hero {
            padding: 24px;
          }

          .hero-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .workflow-proof-grid {
            grid-template-columns: 1fr;
          }

          .flowline-grid {
            grid-template-columns: 1fr;
          }

          .flow-connector {
            display: none;
          }
        }
      `}</style>
    </MainLayout>
  );
}
