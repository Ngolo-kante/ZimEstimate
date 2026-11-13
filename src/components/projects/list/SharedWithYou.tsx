'use client';

import Link from 'next/link';
import { QUICK_TYPE_LABELS } from '@/lib/services/savedWork';
import type { SiteProjectSummary, SiteQuickSummary } from '@/lib/services/site';

/** Projects other people invited this person to: the site view only. */
export default function SharedWithYou({
    siteProjects,
    siteQuick,
}: {
    siteProjects: SiteProjectSummary[];
    siteQuick: SiteQuickSummary[];
}) {
    return (
        <section className="shared-section">
            <h2>Shared with you</h2>
            <div className="shared-list">
                {siteProjects.map((sp) => (
                    <Link key={sp.id} href={`/projects/${sp.id}`} className="shared-card">
                        <strong>{sp.name}</strong>
                        <span>{sp.location || 'No location'} · from {sp.owner_name}</span>
                        <span className="shared-access">{sp.access_level === 'edit' ? 'You report progress' : 'You follow progress'}</span>
                    </Link>
                ))}
                {siteQuick.map((sq) => (
                    <Link key={sq.id} href={`/projects/quick/${sq.id}`} className="shared-card">
                        <strong>{sq.name}</strong>
                        <span>{QUICK_TYPE_LABELS[sq.project_type] ?? 'Quick'} · {sq.location || 'No location'} · from {sq.owner_name}</span>
                        <span className="shared-access">{sq.access_level === 'edit' ? 'You report progress' : 'You follow progress'}</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
