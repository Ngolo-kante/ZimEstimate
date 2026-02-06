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
  const heroMetrics = stats.slice(0, 2);

  return (
    <MainLayout fullWidth>
      <div className="home-page">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-shell">
            <div className="hero-grid">
              <div className="hero-copy">
                <span className="hero-eyebrow">ESTIMATION HUB</span>
                <h1>Accurate estimates. Faster decisions.</h1>
                <p className="hero-subtitle">
                  AI-powered BOQ workflows, live material pricing, and project management for
                  Zimbabwe&apos;s construction teams.
                </p>
                <div className="hero-actions">
                  <Button
                    onClick={() => router.push('/boq/new?method=manual')}
                    icon={<ArrowRight size={18} />}
                    iconPosition="right"
                    size="lg"
                    className="hero-primary"
                  >
                    Start a BOQ
                  </Button>
                  <Link href="/market-insights" className="hero-link">
                    View Market Insights
                  </Link>
                </div>
                <div className="hero-metrics">
                  {heroMetrics.map((stat) => (
                    <div key={stat.label} className="hero-metric">
                      <span className="metric-label">{stat.label}</span>
                      <span className="metric-value">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="hero-panel">
                <div className="panel-header">
                  <span className="panel-eyebrow">QUICK START</span>
                  <h3>Smart BOQ Builder</h3>
                  <p>Pick a workflow to begin in minutes.</p>
                </div>
                <div className="panel-list">
                  {boqMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <Link key={method.id} href={method.href} className="panel-item">
                        <div className="panel-icon">
                          <Icon size={20} weight="bold" />
                        </div>
                        <div className="panel-text">
                          <span className="panel-title">{method.title}</span>
                          <span className="panel-badge">{method.badge}</span>
                        </div>
                        <ArrowRight size={16} weight="bold" className="panel-arrow" />
                      </Link>
                    );
                  })}
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Smart BOQ Builder Section */}
        <section className="boq-section">
          <div className="section-header">
            <div className="section-title">
              <span className="section-badge">SMART BOQ BUILDER</span>
              <h2>Choose the best way to build a BOQ.</h2>
              <p>Three workflows tuned for speed, accuracy, and field-ready data.</p>
            </div>
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
            <div className="cta-left">
              <div className="cta-icon">
                <FileText size={28} weight="light" />
              </div>
              <div className="cta-text">
                <h3>Sign up to download or share your PDF reports</h3>
                <p>Keep your project estimates organized and shareable with stakeholders.</p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/export')}
              icon={<UserPlus size={18} />}
              variant="secondary"
              size="lg"
              className="cta-button"
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
          max-width: 1120px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          display: flex;
          flex-direction: column;
          gap: 56px;
        }

        /* Hero Section */
        .hero-section {
          position: relative;
          padding: 56px 48px;
          border-radius: 26px;
          background: linear-gradient(140deg, #ffffff 20%, rgba(78, 154, 247, 0.08));
          border: 1px solid var(--color-border-light);
          box-shadow: 0 18px 40px rgba(6, 20, 47, 0.08);
          overflow: hidden;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(78, 154, 247, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(78, 154, 247, 0.08) 1px, transparent 1px);
          background-size: 56px 56px;
          opacity: 0.22;
          pointer-events: none;
        }

        .hero-section::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 20% 0%, rgba(78, 154, 247, 0.18), transparent 55%);
          opacity: 0.28;
          pointer-events: none;
        }

        .hero-shell {
          position: relative;
          z-index: 1;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: 40px;
          align-items: stretch;
        }

        .hero-copy {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hero-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.22em;
          font-weight: 700;
          color: var(--color-primary-light);
        }

        .hero-section h1 {
          font-size: 2.7rem;
          font-weight: 700;
          color: var(--color-primary-dark);
          margin: 0;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .hero-subtitle {
          font-size: 1.02rem;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.8;
          max-width: 520px;
        }

        .hero-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .hero-link {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-primary);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .hero-link:hover {
          color: var(--color-accent-dark);
        }

        .hero-metrics {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .hero-metric {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid var(--color-border-light);
          border-radius: 999px;
          padding: 8px 14px;
          display: inline-flex;
          flex-direction: column;
          gap: 2px;
        }

        .metric-label {
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          color: var(--color-text-muted);
          font-weight: 700;
        }

        .metric-value {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .hero-panel {
          background: #ffffff;
          border-radius: 20px;
          padding: 24px;
          border: 1px solid var(--color-border-light);
          box-shadow: 0 12px 26px rgba(6, 20, 47, 0.08);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .panel-header h3 {
          margin: 0 0 6px 0;
          font-size: 1.25rem;
          color: var(--color-primary);
        }

        .panel-header p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }

        .panel-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          color: var(--color-accent-dark);
          font-weight: 700;
        }

        .panel-list {
          display: grid;
          gap: 12px;
        }

        .panel-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--color-border-light);
          background: rgba(6, 20, 47, 0.02);
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .panel-item:hover {
          border-color: var(--color-accent);
          background: rgba(78, 154, 247, 0.08);
          transform: translateX(2px);
        }

        .panel-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(78, 154, 247, 0.08);
          border: 1px solid rgba(78, 154, 247, 0.2);
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .panel-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .panel-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .panel-badge {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--color-accent-dark);
        }

        .panel-arrow {
          margin-left: auto;
          color: var(--color-primary-light);
        }

        /* BOQ Section */
        .boq-section {
          margin-bottom: 8px;
        }

        .section-header {
          margin-bottom: 32px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
        }

        .section-title h2 {
          margin: 12px 0 8px 0;
          font-size: 1.75rem;
          color: var(--color-primary);
        }

        .section-title p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 0.95rem;
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
          gap: 28px;
        }

        .boq-card {
          position: relative;
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: 18px;
          padding: 26px;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          box-shadow: 0 12px 26px rgba(6, 20, 47, 0.06);
          overflow: hidden;
        }

        .boq-card::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 2px;
          background: var(--color-accent);
          opacity: 0.7;
        }

        .boq-card:hover {
          border-color: var(--color-accent);
          box-shadow: 0 16px 32px rgba(6, 20, 47, 0.12);
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
          background: rgba(78, 154, 247, 0.08);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          position: relative;
          border: 1px solid rgba(78, 154, 247, 0.2);
        }

        .boq-card h3 {
          font-size: 1.15rem;
          font-weight: 700;
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
          padding: 6px 12px;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          border-radius: 999px;
          background: rgba(78, 154, 247, 0.12);
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
          background: rgba(6, 20, 47, 0.04);
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid var(--color-border);
        }

        .get-started-link:hover {
          background: rgba(78, 154, 247, 0.12);
          border-color: var(--color-accent);
        }

        /* CTA Section */
        .cta-section {
          margin-bottom: 16px;
        }

        .cta-content {
          background: linear-gradient(120deg, rgba(6, 20, 47, 0.04), rgba(78, 154, 247, 0.08));
          border-radius: 20px;
          padding: 32px 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          color: var(--color-primary);
          border: 1px solid var(--color-border-light);
          box-shadow: 0 16px 30px rgba(6, 20, 47, 0.1);
        }

        .cta-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .cta-icon {
          width: 56px;
          height: 56px;
          background: rgba(78, 154, 247, 0.12);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .cta-text {
          flex: 1;
        }

        .cta-text h3 {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--color-primary);
          margin: 0 0 4px 0;
        }

        .cta-text p {
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        /* Stats Section */
        .stats-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          background: #ffffff;
          border: 1px solid var(--color-border-light);
          border-radius: 16px;
          overflow: hidden;
        }

        .stat-card {
          padding: 22px 26px;
          border-right: 1px solid var(--color-border-light);
          background: rgba(6, 20, 47, 0.02);
        }

        .stat-card:last-child {
          border-right: none;
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
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-success);
          background: rgba(16, 185, 129, 0.12);
          padding: 2px 8px;
          border-radius: 999px;
        }

        .stat-subtext {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        .hero-section :global(.hero-primary) {
          box-shadow: 0 8px 18px rgba(6, 20, 47, 0.15);
        }

        .cta-section :global(.cta-button) {
          background: var(--color-primary);
          color: white;
          border: none;
          box-shadow: 0 8px 18px rgba(6, 20, 47, 0.18);
        }

        .cta-section :global(.cta-button:hover:not(:disabled)) {
          background: var(--color-primary-light);
        }

        .hero-copy,
        .hero-panel,
        .boq-card,
        .cta-content,
        .stat-card {
          animation: fade-up 0.7s ease both;
        }

        .hero-panel {
          animation-delay: 120ms;
        }

        .boq-card:nth-child(2) {
          animation-delay: 80ms;
        }

        .boq-card:nth-child(3) {
          animation-delay: 160ms;
        }

        .cta-content {
          animation-delay: 120ms;
        }

        .stat-card:nth-child(2) {
          animation-delay: 60ms;
        }

        .stat-card:nth-child(3) {
          animation-delay: 120ms;
        }

        @keyframes fade-up {
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
          .hero-copy,
          .hero-panel,
          .boq-card,
          .cta-content,
          .stat-card {
            animation: none;
          }

          .panel-item,
          .boq-card,
          .get-started-link {
            transition: none;
          }
        }

        @media (max-width: 1100px) {
          .hero-grid {
            grid-template-columns: 1fr;
          }

          .hero-subtitle {
            max-width: 100%;
          }
        }

        @media (max-width: 900px) {
          .boq-cards {
            grid-template-columns: 1fr;
          }

          .stats-section {
            grid-template-columns: 1fr;
          }

          .stat-card {
            border-right: none;
            border-bottom: 1px solid var(--color-border-light);
          }

          .stat-card:last-child {
            border-bottom: none;
          }

          .hero-section {
            padding: 40px 28px;
          }

          .hero-section h1 {
            font-size: 2.2rem;
          }

          .cta-content {
            flex-direction: column;
            text-align: center;
          }

          .cta-left {
            flex-direction: column;
          }
        }

        @media (max-width: 640px) {
          .hero-section {
            padding: 32px 22px;
          }

          .hero-actions {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-metrics {
            flex-direction: column;
          }
        }
      `}</style>
    </MainLayout>
  );
}
