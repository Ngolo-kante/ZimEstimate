'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Plus } from '@phosphor-icons/react';

/** Title, and the ways to start something new. */
export default function ProjectsHeader({ canCreateProject }: { canCreateProject: () => boolean }) {
    return (
        <header className="projects-header">
            <div>
                <h1>My projects</h1>
            </div>
            <div className="projects-header-actions">
                {/* The start page lists every kind of estimate — full house,
                    by stage, from a plan, solar, borehole and the rest —
                    rather than dropping straight into the house builder. */}
                <Link href="/estimate?from=projects">
                    <Button
                        icon={<Plus size={18} weight="bold" />}
                        disabled={!canCreateProject()}
                        title={!canCreateProject() ? 'Project limit reached. Upgrade to Pro.' : ''}
                    >
                        New project
                    </Button>
                </Link>
            </div>
        </header>
    );
}
