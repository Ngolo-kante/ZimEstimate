'use client';

import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardContent, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressRing, { ProgressBar } from '@/components/ui/ProgressRing';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
    Plus,
    FileArrowUp,
    PencilSimple,
    Cube,
    Wall,
    HouseSimple,
    PaintBrush,
    ShieldCheck
} from '@phosphor-icons/react';

// Sample milestone data
const milestones = [
    { type: 'substructure', label: 'Substructure', progress: 100, icon: Cube },
    { type: 'superstructure', label: 'Superstructure', progress: 65, icon: Wall },
    { type: 'roofing', label: 'Roofing', progress: 30, icon: HouseSimple },
    { type: 'finishing', label: 'Finishing', progress: 0, icon: PaintBrush },
    { type: 'exterior', label: 'Exterior & Security', progress: 0, icon: ShieldCheck },
];

// Sample project data
const sampleProject = {
    name: 'Borrowdale 4-Bed House',
    location: 'Harare, Zimbabwe',
    totalBudgetUsd: 45000,
    totalBudgetZwg: 1350000,
    spentUsd: 28500,
    spentZwg: 855000,
};

// Component that uses currency - must be a child of CurrencyProvider
function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function Dashboard() {
    const overallProgress = milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length;

    return (
        <MainLayout title="Dashboard">
            <div className="dashboard">
                {/* Welcome Section */}
                <section className="welcome-section">
                    <div className="welcome-text">
                        <h2>Welcome back!</h2>
                        <p>Track your construction projects and manage estimates.</p>
                    </div>
                    <Button icon={<Plus size={18} weight="bold" />}>
                        New Project
                    </Button>
                </section>

                {/* Stats Grid */}
                <section className="stats-grid">
                    <Card variant="dashboard">
                        <CardHeader>
                            <CardTitle>Total Budget</CardTitle>
                            <CardBadge variant="accent">Active</CardBadge>
                        </CardHeader>
                        <CardContent>
                            <p className="stat-value">
                                <PriceDisplay priceUsd={sampleProject.totalBudgetUsd} priceZwg={sampleProject.totalBudgetZwg} />
                            </p>
                            <p className="stat-label">Across all milestones</p>
                        </CardContent>
                    </Card>

                    <Card variant="dashboard">
                        <CardHeader>
                            <CardTitle>Spent to Date</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="stat-value">
                                <PriceDisplay priceUsd={sampleProject.spentUsd} priceZwg={sampleProject.spentZwg} />
                            </p>
                            <ProgressBar progress={(sampleProject.spentUsd / sampleProject.totalBudgetUsd) * 100} />
                        </CardContent>
                    </Card>

                    <Card variant="dashboard">
                        <CardHeader>
                            <CardTitle>Overall Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="progress-display">
                                <ProgressRing progress={overallProgress} size={80} />
                                <div className="progress-meta">
                                    <span className="progress-label">Complete</span>
                                    <span className="progress-detail">2 of 5 milestones</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* BOQ Builder Selection */}
                <section className="boq-section">
                    <h3 className="section-title">Smart BOQ Builder</h3>
                    <p className="section-subtitle">Choose how you want to create your Bill of Quantities</p>

                    <div className="boq-options">
                        <Card variant="choice" onClick={() => console.log('Upload floor plan')}>
                            <div className="choice-icon">
                                <FileArrowUp size={40} weight="light" />
                            </div>
                            <h4>Upload Floor Plan</h4>
                            <p>AI analyzes your blueprint</p>
                            <CardBadge variant="success">Best for Accuracy</CardBadge>
                        </Card>

                        <Card variant="choice" onClick={() => console.log('Manual entry')}>
                            <div className="choice-icon">
                                <PencilSimple size={40} weight="light" />
                            </div>
                            <h4>Manual Entry</h4>
                            <p>Build BOQ step by step</p>
                        </Card>
                    </div>
                </section>

                {/* Milestones Progress */}
                <section className="milestones-section">
                    <h3 className="section-title">Milestone Progress</h3>
                    <div className="milestones-grid">
                        {milestones.map((milestone) => {
                            const IconComponent = milestone.icon;
                            return (
                                <Card key={milestone.type} variant="dashboard">
                                    <div className="milestone-card">
                                        <div className="milestone-icon">
                                            <IconComponent size={24} weight="light" />
                                        </div>
                                        <div className="milestone-info">
                                            <h4>{milestone.label}</h4>
                                            <ProgressBar
                                                progress={milestone.progress}
                                                showLabel
                                                color={milestone.progress === 100 ? 'success' : 'accent'}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </section>
            </div>

            <style jsx>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }

        .welcome-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .welcome-text h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 0.25rem 0;
        }

        .welcome-text p {
          color: var(--color-text-secondary);
          margin: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-lg);
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .progress-display {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
        }

        .progress-meta {
          display: flex;
          flex-direction: column;
        }

        .progress-meta .progress-label {
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .progress-meta .progress-detail {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .section-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .section-subtitle {
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-lg) 0;
        }

        .boq-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-lg);
          max-width: 600px;
        }

        .choice-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--color-background);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
          margin-bottom: var(--spacing-sm);
        }

        .boq-options h4 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 var(--spacing-xs) 0;
        }

        .boq-options p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 0 0 var(--spacing-sm) 0;
        }

        .milestones-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: var(--spacing-md);
        }

        .milestone-card {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .milestone-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          background: var(--color-background);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
        }

        .milestone-info h4 {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          margin: 0 0 var(--spacing-sm) 0;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .milestones-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .boq-options {
            grid-template-columns: 1fr;
          }

          .milestones-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
        </MainLayout>
    );
}
