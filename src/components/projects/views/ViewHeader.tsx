'use client';

import type { ProjectView } from '@/components/projects/SidebarSpine';

const viewDetails: Record<Exclude<ProjectView, 'overview'>, { title: string; description: string }> = {
    budget: {
        title: 'Budget',
        description: '',
    },
    boq: {
        title: 'Bill of Quantities',
        description: '',
    },
    compliance: {
        title: 'Compliance',
        description: '',
    },
    procurement: {
        title: 'Buying & quotes',
        description: '',
    },
    usage: {
        title: 'Usage Tracking',
        description: 'Log site consumption and monitor burn-down before materials run low.',
    },
    documents: {
        title: 'Documents',
        description: 'Store plans, permits, receipts, and site records for your team.',
    },
    settings: {
        title: 'Settings',
        description: 'Adjust project scope, visibility, and low-stock alert settings.',
    },
};

/** The title band above every view except Overview, which has its own. */
export default function ViewHeader({
    activeView,
    projectName,
    stats,
}: {
    activeView: ProjectView;
    projectName: string;
    stats: { label: string; value: string }[];
}) {
    const activeViewDetails = activeView === 'overview' ? null : viewDetails[activeView];
    if (!activeViewDetails) return null;
    return (
        <section className="view-header">
            <div>
                <p className="view-eyebrow">{projectName}</p>
                <h1 className="view-title">{activeViewDetails.title}</h1>
                {activeViewDetails.description && (
                    <p className="view-description">{activeViewDetails.description}</p>
                )}
            </div>
            <div className="view-stats">
                {stats.map((stat) => (
                    <div className="view-stat" key={stat.label}>
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                    </div>
                ))}
            </div>
        </section>
    );
}
