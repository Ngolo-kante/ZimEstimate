'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import {
  Scan,
  Camera,
  NotePencil,
  ArrowRight,
  ChartLine,
  Package,
  CurrencyDollar,
  UserPlus,
  FileText,
  TrendUp,
} from '@phosphor-icons/react';

const boqMethods = [
  {
    id: 'upload',
    icon: Scan,
    title: 'Vision AI Takeoff',
    description: 'Transform PDF blueprints into precise Bill of Quantities instantly. Our Vision AI detects walls, doors, and window schedules automatically to save hours of manual measuring.',
    badge: 'HIGH PRECISION',
    href: '/ai/vision-takeoff',
  },
  {
    id: 'ocr',
    icon: Camera,
    title: 'Smart Quote Scanner',
    description: 'Digitize handwritten contractor quotes and invoices in seconds. Advanced OCR extracts line items, prices, and quantities into a clean, actionable digital format.',
    badge: 'FIELD READY',
    href: '/ai/quote-scanner',
  },
  {
    id: 'manual',
    icon: NotePencil,
    title: 'Manual Builder',
    description: 'Create estimates from scratch using Zimbabwe’s largest pre-built material database. Access verified pricing and templates for accurate project planning.',
    badge: 'PRO CONTROL',
    href: '/boq/new?method=manual',
  },
];

const stats = [
  {
    icon: ChartLine,
    label: 'MARKET ACCURACY',
    value: '98.2%',
    change: '+0.4%',
    subtext: 'Price verification rate this week',
  },
  {
    icon: Package,
    label: 'MATERIAL INDEX',
    value: '2.8k+',
    subtext: 'Tracked vendors across Zimbabwe',
  },
  {
    icon: CurrencyDollar,
    label: 'GLOBAL PRICING',
    value: 'USD/ZiG',
    subtext: 'Real-time exchange conversions',
  },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <MainLayout fullWidth>
      <div className="home-page">
        {/* Hero Section */}
        <section className="hero-section">
          <h1>How can we help you today?</h1>
          <p className="hero-subtitle">
            Zimbabwe&apos;s all-in-one PropTech platform for construction management,
            <br />
            AI-powered BOQ generation, and real-time material market insights.
          </p>
        </section>

        {/* Smart BOQ Builder Section */}
        <section className="boq-section">
          <div className="section-header">
            <span className="section-badge">SMART BOQ BUILDER</span>
          </div>

          <div className="boq-cards">
            {boqMethods.map((method) => {
              const Icon = method.icon;
              return (
                <div key={method.id} className="boq-card">
                  <div className="card-top">
                    <div className="card-icon-wrapper">
                      <div className="card-icon">
                        <Icon size={32} weight="light" />
                      </div>
                    </div>

                    <h3>{method.title}</h3>
                    <p>{method.description}</p>

                    <div className="badge-wrapper">
                      <span className="method-badge">
                        {method.badge}
                      </span>
                    </div>
                  </div>

                  <div className="card-bottom">
                    <Link href={method.href} className="get-started-link">
                      Get Started <ArrowRight size={16} weight="bold" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-content">
            <div className="cta-icon">
              <FileText size={28} weight="light" />
            </div>
            <div className="cta-text">
              <h3>Sign up to download or share your PDF reports</h3>
              <p>Keep your project estimates organized and shareable with stakeholders.</p>
            </div>
            <Button
              onClick={() => router.push('/export')}
              icon={<UserPlus size={18} />}
            >
              Create Account
            </Button>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="stat-card">
                <div className="stat-header">
                  <Icon size={18} weight="fill" className="stat-icon" />
                  <span className="stat-label">{stat.label}</span>
                </div>
                <div className="stat-value">
                  {stat.value}
                  {stat.change && (
                    <span className="stat-change">
                      <TrendUp size={14} weight="bold" />
                      {stat.change}
                    </span>
                  )}
                </div>
                <p className="stat-subtext">{stat.subtext}</p>
              </div>
            );
          })}
        </section>
      </div>

      <style jsx>{`
        .home-page {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 24px;
        }

        /* Hero Section */
        .hero-section {
          text-align: center;
          margin-bottom: 60px;
        }

        .hero-section h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--color-primary-dark);
          margin: 0 0 16px 0;
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: 1.125rem;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.7;
        }

        /* BOQ Section */
        .boq-section {
          margin-bottom: 48px;
        }

        .section-header {
          margin-bottom: 24px;
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--color-accent-dark);
        }

        .section-badge::before {
          content: '';
          display: inline-block;
          width: 24px;
          height: 2px;
          background: var(--color-accent);
        }

        .boq-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .boq-card {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }

        .boq-card:hover {
          border-color: var(--color-accent);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }

        .card-top {
          flex: 1;
        }

        .card-icon-wrapper {
          margin-bottom: 20px;
        }

        .card-icon {
          width: 64px;
          height: 64px;
          background: var(--color-border-light);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          position: relative;
        }

        .boq-card h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-primary);
          margin: 0 0 8px 0;
        }

        .boq-card p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 16px 0;
          line-height: 1.6;
        }

        .badge-wrapper {
          margin-bottom: 24px;
        }

        .method-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          border-radius: 4px;
          background: rgba(78, 154, 247, 0.15);
          color: var(--color-accent-dark);
        }

        .get-started-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--color-primary);
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .get-started-link:hover {
          gap: 10px;
          color: var(--color-accent-dark);
        }

        /* CTA Section */
        .cta-section {
          margin-bottom: 48px;
        }

        .cta-content {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 32px;
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .cta-icon {
          width: 56px;
          height: 56px;
          background: var(--color-primary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          flex-shrink: 0;
        }

        .cta-text {
          flex: 1;
        }

        .cta-text h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-primary);
          margin: 0 0 4px 0;
        }

        .cta-text p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        /* Stats Section */
        .stats-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .stat-card {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 24px;
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .stat-header :global(.stat-icon) {
          color: var(--color-accent);
        }

        .stat-label {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .stat-value {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 4px;
        }

        .stat-change {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-success);
        }

        .stat-subtext {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        @media (max-width: 900px) {
          .boq-cards,
          .stats-section {
            grid-template-columns: 1fr;
          }

          .hero-section h1 {
            font-size: 2rem;
          }

          .hero-subtitle br {
            display: none;
          }

          .cta-content {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </MainLayout>
  );
}
