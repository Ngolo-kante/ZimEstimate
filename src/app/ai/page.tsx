'use client';

import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardContent } from '@/components/ui/Card';
import {
    Image,
    Camera,
    ChartLine,
    ArrowRight,
    Sparkle,
    Lightning,
} from '@phosphor-icons/react';

const aiFeatures = [
    {
        id: 'vision-takeoff',
        title: 'Vision Takeoff',
        description: 'Upload a floor plan and let AI automatically extract room dimensions, door/window counts, and generate a complete Bill of Quantities.',
        icon: Image,
        href: '/ai/vision-takeoff',
        badge: 'Popular',
        features: ['Automatic room detection', 'Dimension extraction', 'Material calculation', 'BOQ generation'],
    },
    {
        id: 'quote-scanner',
        title: 'Quote Scanner',
        description: 'Take a photo of any supplier quote — handwritten or printed — and extract materials, quantities, and prices automatically using OCR.',
        icon: Camera,
        href: '/ai/quote-scanner',
        badge: 'New',
        features: ['OCR text extraction', 'Material matching', 'Price harmonization', 'Import to estimate'],
    },
    {
        id: 'inflation-engine',
        title: 'Inflation Engine',
        description: 'AI-powered price predictions based on market trends, historical data, and economic indicators. Plan your purchases strategically.',
        icon: ChartLine,
        href: '/ai/inflation-engine',
        badge: null,
        features: ['1-12 month forecasts', 'Volatility tracking', 'Key factor analysis', 'Confidence scoring'],
    },
];

export default function AIHubPage() {
    return (
        <MainLayout title="AI Tools">
            <div className="ai-hub">
                {/* Hero Section */}
                <div className="hero">
                    <div className="hero-icon">
                        <Sparkle size={32} weight="fill" />
                    </div>
                    <h1>AI-Powered Construction Tools</h1>
                    <p>Leverage machine learning to save time, reduce errors, and make smarter decisions for your building projects.</p>
                </div>

                {/* Feature Cards */}
                <div className="features-grid">
                    {aiFeatures.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <Link key={feature.id} href={feature.href} className="feature-link">
                                <Card className="feature-card">
                                    <CardContent>
                                        {feature.badge && (
                                            <span className="feature-badge">{feature.badge}</span>
                                        )}
                                        <div className="feature-icon">
                                            <Icon size={32} weight="light" />
                                        </div>
                                        <h2>{feature.title}</h2>
                                        <p className="feature-description">{feature.description}</p>

                                        <ul className="feature-list">
                                            {feature.features.map((item, index) => (
                                                <li key={index}>
                                                    <Lightning size={14} weight="fill" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="feature-cta">
                                            Try {feature.title} <ArrowRight size={16} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>

                {/* Info Section */}
                <Card className="info-card">
                    <CardContent>
                        <div className="info-content">
                            <div className="info-icon">
                                <Sparkle size={24} weight="fill" />
                            </div>
                            <div>
                                <h3>How it works</h3>
                                <p>
                                    Our AI models are trained on thousands of Zimbabwean construction projects and
                                    continuously updated with the latest market data. All processing happens securely
                                    in the cloud, and your data is never shared with third parties.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <style jsx>{`
        .ai-hub {
          max-width: 1000px;
          margin: 0 auto;
        }

        .hero {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .hero-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-accent) 0%, #fbbf24 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--spacing-md);
          color: var(--color-primary);
        }

        .hero h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .hero p {
          color: var(--color-text-secondary);
          max-width: 600px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .feature-link {
          text-decoration: none;
          display: block;
        }

        .feature-card {
          height: 100%;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border-color: var(--color-accent);
        }

        .feature-badge {
          position: absolute;
          top: var(--spacing-md);
          right: var(--spacing-md);
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
          color: var(--color-primary);
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          border-radius: var(--radius-lg);
          background: rgba(252, 163, 17, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--spacing-md);
          color: var(--color-accent);
        }

        .feature-card h2 {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .feature-description {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-md) 0;
          line-height: 1.6;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0 0 var(--spacing-lg) 0;
        }

        .feature-list li {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          padding: var(--spacing-xs) 0;
        }

        .feature-list li :global(svg) {
          color: var(--color-accent);
        }

        .feature-cta {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-accent);
        }

        .info-card {
          background: linear-gradient(135deg, var(--color-primary) 0%, #1a2a4d 100%);
        }

        .info-content {
          display: flex;
          gap: var(--spacing-lg);
          align-items: flex-start;
        }

        .info-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(252, 163, 17, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          flex-shrink: 0;
        }

        .info-content h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-inverse);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .info-content p {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr;
          }

          .info-content {
            flex-direction: column;
          }
        }
      `}</style>
        </MainLayout>
    );
}
