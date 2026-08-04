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
        title: 'From a Plan',
        // Named for what the user is holding, not for the technology. Someone
        // landing here is not shopping for "vision takeoff" — they have a
        // drawing and want to know what it costs. "Takeoff" is correct
        // quantity-surveying terminology and meaningless to a homeowner.
        description: 'Have architectural drawings? Upload the floor plan and we read the room sizes, doors and windows off it, then price the materials.',
        icon: Image,
        href: '/ai/vision-takeoff',
        badge: 'Popular',
        features: ['Reads room sizes', 'Counts doors and windows', 'Prices the materials', 'Becomes a project'],
    },
    {
        id: 'boq-scanner',
        title: 'From Paper',
        // Named for the document, not the technique. "OCR text extraction" told
        // the user how it works rather than what they get, and the previous
        // wording promised price harmonisation the feature never did.
        description: 'Have a BOQ on paper? Photograph it — handwritten or printed — and it becomes a project you can manage. Figures are read from the page, never estimated.',
        icon: Camera,
        href: '/ai/boq-scanner',
        badge: 'New',
        features: ['Reads handwriting', 'Line-by-line confidence', 'Edit before saving', 'Becomes a project'],
    },
    {
        id: 'inflation-engine',
        title: 'Price Outlook',
        description: 'Not buying yet? See where material prices are heading so you can decide when to buy rather than guessing.',
        icon: ChartLine,
        href: '/ai/inflation-engine',
        badge: null,
        features: ['1–12 month outlook', 'Which prices move most', 'What is driving them', 'How sure we are'],
    },
];

export default function AIHubPage() {
    return (
        <MainLayout title="Start from what you have">
            <div className="ai-hub">
                {/* Hero Section */}
                <div className="hero">
                    <div className="hero-icon">
                        <Sparkle size={32} weight="fill" />
                    </div>
                    <h1>Start from what you have</h1>
                    {/* The old line sold machine learning. Nobody arrives wanting
                        machine learning — they arrive holding a drawing, or a
                        sheet of paper, or nothing yet, and want to know which
                        door is theirs. */}
                    <p>A drawing, a BOQ scribbled on site, or nothing but a budget — each one is a way in. Pick whichever matches what is in front of you.</p>
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
