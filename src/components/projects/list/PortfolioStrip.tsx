'use client';

import PriceDisplay from '@/components/projects/PriceDisplay';
import type { Profile } from '@/lib/database.types';
import type { portfolioStats } from '@/lib/projects/projectList';

/** Counts of full builds and quick estimates, their total, and plan usage. */
export default function PortfolioStrip({
    isLoading,
    projectStats,
    quickCount,
    profile,
    projectCount,
}: {
    isLoading: boolean;
    projectStats: ReturnType<typeof portfolioStats>;
    quickCount: number;
    profile: Profile | null;
    projectCount: number;
}) {
    return (
        <section className="portfolio-strip" aria-label="Project portfolio summary">
            <div className="portfolio-value">
                <span>Portfolio value</span>
                <strong>
                    {isLoading ? '—' : <PriceDisplay unwrapped priceUsd={projectStats.totalBudget} priceZwg={projectStats.totalBudget * 30} />}
                </strong>
            </div>
            <div>
                <span>Full builds</span>
                <strong>{isLoading ? '—' : projectStats.total}</strong>
            </div>
            <div>
                <span>Active</span>
                <strong>{isLoading ? '—' : projectStats.active}</strong>
            </div>
            <div>
                <span>Quick estimates</span>
                <strong>{isLoading ? '—' : quickCount}</strong>
            </div>
            <div className="plan-usage">
                <span>{profile?.tier === 'free' ? 'Free plan usage' : 'Plan'}</span>
                <strong>{profile?.tier === 'free' ? `${projectCount}/3` : 'Pro'}</strong>
            </div>
        </section>
    );
}
