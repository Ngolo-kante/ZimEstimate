'use client';

import Link from 'next/link';
import { formatUsd } from '@/lib/format';
import type { Profile } from '@/lib/database.types';
import type { portfolioStats } from '@/lib/projects/projectList';

export default function PortfolioStrip({ projectStats, profile, projectCount, quickTotal }: {
    projectStats: ReturnType<typeof portfolioStats>; profile: Profile | null; projectCount: number; quickTotal: number;
}) {
    return <section className="portfolio-strip" aria-label="Project portfolio summary">
        <p>{projectStats.total} {projectStats.total === 1 ? 'build' : 'builds'} · {projectStats.active} active · {formatUsd(projectStats.totalBudget + quickTotal, { wholeDollars: true, compact: true })} estimated{profile?.tier === 'free' && <> · <span className={projectCount >= 3 ? 'usage-limit' : undefined}>{projectCount} of 3 free projects</span></>}</p>
        <Link href="/projects/insights">See insights</Link>
    </section>;
}
