'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    Crown,
    Lightning,
    Buildings,
    Check,
    X,
    RocketLaunch,
    Brain,
    FileText,
    Users
} from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import MainLayout from '@/components/layout/MainLayout';

function UpgradeContent() {
    const searchParams = useSearchParams();
    const { profile } = useAuth();
    const feature = searchParams.get('feature');

    const plans = [
        {
            name: 'Free',
            price: '$0',
            period: 'forever',
            description: 'Perfect for getting started',
            icon: Buildings,
            current: profile?.tier === 'free',
            features: [
                { name: 'Up to 3 projects', included: true },
                { name: 'Basic PDF export', included: true },
                { name: 'Material catalog access', included: true },
                { name: 'AI Vision Takeoff', included: false },
                { name: 'Quote Scanner (OCR)', included: false },
                { name: 'Price predictions', included: false },
                { name: 'Excel export', included: false },
            ],
        },
        {
            name: 'Pro',
            price: '$19',
            period: 'per month',
            description: 'For professionals & contractors',
            icon: RocketLaunch,
            current: profile?.tier === 'pro',
            popular: true,
            features: [
                { name: 'Unlimited projects', included: true },
                { name: 'All export formats', included: true },
                { name: 'Material catalog access', included: true },
                { name: 'AI Vision Takeoff', included: true },
                { name: 'Quote Scanner (OCR)', included: true },
                { name: 'Price predictions', included: true },
                { name: 'Excel export', included: true },
            ],
        },
    ];

    const featureMessages: Record<string, { title: string; description: string }> = {
        ai: {
            title: 'AI Features Require Pro',
            description: 'Upgrade to Pro to access Vision Takeoff, Quote Scanner, and Price Predictions.',
        },
        projects: {
            title: 'Project Limit Reached',
            description: 'You\'ve reached the 3 project limit on the Free plan. Upgrade to Pro for unlimited projects.',
        },
    };

    const activeMessage = feature ? featureMessages[feature] : null;

    return (
        <MainLayout>
            <div className="upgrade-page">
                {/* Header */}
                <div className="upgrade-header">
                    <Crown size={48} weight="duotone" className="crown-icon" />
                    <h1>Upgrade Your Plan</h1>
                    {activeMessage ? (
                        <p className="feature-message">{activeMessage.description}</p>
                    ) : (
                        <p>Unlock more features and build without limits</p>
                    )}
                </div>

                {/* Plans Grid */}
                <div className="plans-grid">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`plan-card ${plan.popular ? 'popular' : ''} ${plan.current ? 'current' : ''}`}
                        >
                            {plan.popular && (
                                <div className="popular-badge">
                                    <Lightning size={14} weight="fill" />
                                    Most Popular
                                </div>
                            )}

                            <div className="plan-header">
                                <plan.icon size={32} weight="duotone" className="plan-icon" />
                                <h2>{plan.name}</h2>
                                <p className="plan-description">{plan.description}</p>
                            </div>

                            <div className="plan-price">
                                <span className="amount">{plan.price}</span>
                                <span className="period">/{plan.period}</span>
                            </div>

                            <ul className="plan-features">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className={feature.included ? 'included' : 'excluded'}>
                                        {feature.included ? (
                                            <Check size={18} weight="bold" className="check-icon" />
                                        ) : (
                                            <X size={18} weight="bold" className="x-icon" />
                                        )}
                                        {feature.name}
                                    </li>
                                ))}
                            </ul>

                            <div className="plan-action">
                                {plan.current ? (
                                    <Button variant="secondary" fullWidth disabled>
                                        Current Plan
                                    </Button>
                                ) : plan.name === 'Free' ? (
                                    <Button variant="ghost" fullWidth disabled>
                                        Downgrade
                                    </Button>
                                ) : (
                                    <Button fullWidth>
                                        Upgrade to {plan.name}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Feature Highlights */}
                <div className="features-section">
                    <h3>Pro Features Explained</h3>
                    <div className="features-grid">
                        <div className="feature-card">
                            <Brain size={24} weight="duotone" />
                            <h4>AI Vision Takeoff</h4>
                            <p>Upload blueprints and let AI extract room dimensions, materials, and generate BOQs automatically.</p>
                        </div>
                        <div className="feature-card">
                            <FileText size={24} weight="duotone" />
                            <h4>Quote Scanner</h4>
                            <p>Scan supplier quotes with OCR to automatically extract materials, quantities, and prices.</p>
                        </div>
                        <div className="feature-card">
                            <Lightning size={24} weight="duotone" />
                            <h4>Price Predictions</h4>
                            <p>AI-powered price forecasting to help you plan for material cost changes.</p>
                        </div>
                        <div className="feature-card">
                            <Users size={24} weight="duotone" />
                            <h4>Unlimited Projects</h4>
                            <p>Manage as many construction projects as you need without restrictions.</p>
                        </div>
                    </div>
                </div>

                {/* Back Link */}
                <div className="back-link">
                    <Link href="/dashboard">
                        <Button variant="ghost">Back to Dashboard</Button>
                    </Link>
                </div>
            </div>

            <style jsx>{`
                .upgrade-page {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: var(--spacing-xl);
                }

                .upgrade-header {
                    text-align: center;
                    margin-bottom: var(--spacing-xl);
                }

                .upgrade-header :global(.crown-icon) {
                    color: var(--color-accent);
                    margin-bottom: var(--spacing-md);
                }

                .upgrade-header h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin-bottom: var(--spacing-sm);
                }

                .upgrade-header p {
                    color: var(--color-text-secondary);
                    font-size: 1.125rem;
                }

                .feature-message {
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: rgba(252, 163, 17, 0.1);
                    border-radius: var(--radius-md);
                    display: inline-block;
                }

                .plans-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: var(--spacing-lg);
                    margin-bottom: var(--spacing-2xl);
                }

                .plan-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: var(--spacing-lg);
                    position: relative;
                    transition: all 0.2s ease;
                }

                .plan-card.popular {
                    border-color: var(--color-accent);
                    box-shadow: 0 0 0 1px var(--color-accent);
                }

                .plan-card.current {
                    border-color: var(--color-primary);
                }

                .popular-badge {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--color-accent);
                    color: var(--color-bg-primary);
                    padding: 0.25rem 0.75rem;
                    border-radius: var(--radius-full);
                    font-size: 0.75rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .plan-header {
                    text-align: center;
                    margin-bottom: var(--spacing-md);
                }

                .plan-header :global(.plan-icon) {
                    color: var(--color-primary);
                    margin-bottom: var(--spacing-sm);
                }

                .plan-header h2 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin-bottom: var(--spacing-xs);
                }

                .plan-description {
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                }

                .plan-price {
                    text-align: center;
                    margin-bottom: var(--spacing-lg);
                }

                .plan-price .amount {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--color-text);
                }

                .plan-price .period {
                    color: var(--color-text-muted);
                    font-size: 0.875rem;
                }

                .plan-features {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 var(--spacing-lg) 0;
                }

                .plan-features li {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) 0;
                    font-size: 0.9375rem;
                    border-bottom: 1px solid var(--color-border-light);
                }

                .plan-features li:last-child {
                    border-bottom: none;
                }

                .plan-features li.included {
                    color: var(--color-text);
                }

                .plan-features li.excluded {
                    color: var(--color-text-muted);
                }

                .plan-features :global(.check-icon) {
                    color: var(--color-success);
                }

                .plan-features :global(.x-icon) {
                    color: var(--color-text-muted);
                }

                .features-section {
                    margin-bottom: var(--spacing-xl);
                }

                .features-section h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin-bottom: var(--spacing-lg);
                    text-align: center;
                }

                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: var(--spacing-md);
                }

                .feature-card {
                    padding: var(--spacing-md);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                }

                .feature-card :global(svg) {
                    color: var(--color-primary);
                    margin-bottom: var(--spacing-sm);
                }

                .feature-card h4 {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin-bottom: var(--spacing-xs);
                }

                .feature-card p {
                    font-size: 0.8125rem;
                    color: var(--color-text-secondary);
                    line-height: 1.5;
                }

                .back-link {
                    text-align: center;
                }
            `}</style>
        </MainLayout>
    );
}

export default function UpgradePage() {
    return (
        <Suspense fallback={
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
                </div>
            </MainLayout>
        }>
            <UpgradeContent />
        </Suspense>
    );
}
