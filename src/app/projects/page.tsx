'use client';

import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressRing';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
    Plus,
    DotsThreeVertical,
    MapPin,
    Calendar,
} from '@phosphor-icons/react';

// Sample projects data
const projects = [
    {
        id: 'proj-1',
        name: 'Borrowdale 4-Bed House',
        location: 'Harare, Zimbabwe',
        status: 'active',
        progress: 39,
        budgetUsd: 45000,
        budgetZwg: 1350000,
        updatedAt: '2026-01-30',
    },
    {
        id: 'proj-2',
        name: 'Avondale Office Block',
        location: 'Harare, Zimbabwe',
        status: 'active',
        progress: 15,
        budgetUsd: 120000,
        budgetZwg: 3600000,
        updatedAt: '2026-01-28',
    },
    {
        id: 'proj-3',
        name: 'Bulawayo Warehouse',
        location: 'Bulawayo, Zimbabwe',
        status: 'draft',
        progress: 0,
        budgetUsd: 85000,
        budgetZwg: 2550000,
        updatedAt: '2026-01-25',
    },
];

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

export default function ProjectsPage() {
    return (
        <MainLayout title="Projects">
            <div className="projects-page">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <p className="page-subtitle">Manage your construction estimates</p>
                    </div>
                    <Link href="/projects/new">
                        <Button icon={<Plus size={18} weight="bold" />}>
                            New Project
                        </Button>
                    </Link>
                </div>

                {/* Projects Grid */}
                <div className="projects-grid">
                    {projects.map((project) => (
                        <Link key={project.id} href={`/projects/${project.id}`} className="project-link">
                            <Card className="project-card">
                                <CardHeader>
                                    <div className="project-header">
                                        <CardTitle>{project.name}</CardTitle>
                                        <CardBadge variant={project.status === 'active' ? 'success' : 'default'}>
                                            {project.status === 'active' ? 'Active' : 'Draft'}
                                        </CardBadge>
                                    </div>
                                    <button className="menu-btn" onClick={(e) => e.preventDefault()}>
                                        <DotsThreeVertical size={20} weight="bold" />
                                    </button>
                                </CardHeader>

                                <div className="project-meta">
                                    <span className="meta-item">
                                        <MapPin size={14} weight="light" />
                                        {project.location}
                                    </span>
                                    <span className="meta-item">
                                        <Calendar size={14} weight="light" />
                                        {new Date(project.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>

                                <div className="project-budget">
                                    <span className="budget-label">Budget</span>
                                    <span className="budget-value">
                                        <PriceDisplay priceUsd={project.budgetUsd} priceZwg={project.budgetZwg} />
                                    </span>
                                </div>

                                <div className="project-progress">
                                    <div className="progress-header">
                                        <span>Overall Progress</span>
                                        <span className="progress-value">{project.progress}%</span>
                                    </div>
                                    <ProgressBar
                                        progress={project.progress}
                                        color={project.progress > 50 ? 'success' : 'accent'}
                                    />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            <style jsx>{`
        .projects-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xl);
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .page-subtitle {
          color: var(--color-text-secondary);
          margin: 0;
        }

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-lg);
        }

        .project-link {
          text-decoration: none;
          color: inherit;
        }

        .project-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex: 1;
        }

        .menu-btn {
          background: none;
          border: none;
          padding: var(--spacing-xs);
          cursor: pointer;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
        }

        .menu-btn:hover {
          background: var(--color-border-light);
          color: var(--color-text);
        }

        .project-meta {
          display: flex;
          gap: var(--spacing-md);
          margin-top: var(--spacing-md);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .project-budget {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--spacing-lg);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--color-border-light);
        }

        .budget-label {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .budget-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text);
        }

        .project-progress {
          margin-top: var(--spacing-md);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        .progress-value {
          font-weight: 600;
          color: var(--color-text);
        }

        @media (max-width: 1200px) {
          .projects-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .projects-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </MainLayout>
    );
}
