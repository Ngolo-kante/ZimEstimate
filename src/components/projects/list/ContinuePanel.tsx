'use client';

import Link from 'next/link';
import ProjectActionsMenu from './ProjectActionsMenu';
import StageBadge from './StageBadge';
import type { useCardActions } from '@/app/projects/hooks/useCardActions';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { BOQItem, Profile, Project, ProjectStage, PurchaseRecord } from '@/lib/database.types';
import { pendingItemsOf, shortLocation } from '@/lib/projects/listPresentation';
import { computePurchaseStats, materialItemsOf } from '@/lib/projects/workspaceStats';
import { formatUsd } from '@/lib/format';
import { ArrowRight, CaretRight } from '@phosphor-icons/react';

export default function ContinuePanel({ project, stages, items, purchases, profile, actions }: { project: Project; stages: ProjectStage[]; items: BOQItem[]; purchases: PurchaseRecord[]; profile: Profile | null; actions: ReturnType<typeof useCardActions> }) {
    const router = useRouter();
    const materials = materialItemsOf(items);
    const pending = pendingItemsOf(materials, purchases).slice(0, 3);
    const spent = computePurchaseStats(items, materials, purchases).actualSpent;
    const estimate = Number(project.total_usd) || 0;
    const percent = estimate > 0 ? Math.min(100, Math.max(0, spent / estimate * 100)) : 0;
    const lineCost = (item: BOQItem) => Number(item.quantity) * Number(item.unit_price_usd);
    return <section aria-label="Continue your build" className="continue-panel">
        <Card>
            <ProjectActionsMenu project={project} profile={profile} actions={actions} menuId={`continue:${project.id}`} />
            <div className="continue-grid">
                <div className="continue-main">
                    <p className="continue-label">Continue your build</p>
                    <h2>{project.name}</h2>
                    <p className="continue-location">{shortLocation(project.location)}</p>
                    <StageBadge project={project} stages={stages} />
                    <div className="continue-spend"><p><strong>{formatUsd(spent, { wholeDollars: true })}</strong> spent of <strong>{formatUsd(estimate, { wholeDollars: true })}</strong></p><span>{Math.round(percent)}%</span></div>
                    <div className="continue-progress" role="progressbar" aria-label="Spent against the estimate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`${formatUsd(spent, { wholeDollars: true })} of ${formatUsd(estimate, { wholeDollars: true })}`}><div style={{ width: `${percent}%` }} /></div>
                </div>
                <div className="continue-next">
                    <h3>Next to buy</h3>
                    {pending.length ? <ul>{pending.map(item => <li key={item.id}><Link href={`/projects/${project.id}?view=procurement&item=${encodeURIComponent(item.id)}`}><span className="step-name">{item.material_name}</span><span className="step-meta">{lineCost(item) > 0 ? formatUsd(lineCost(item), { wholeDollars: true }) : 'No price yet'}<CaretRight size={14} weight="bold" aria-hidden="true" /></span></Link></li>)}</ul> : <p className="muted">{materials.length ? 'Everything on the list is bought.' : 'Add items to plan your next purchase.'}</p>}
                </div>
                <div className="continue-actions"><Button icon={<ArrowRight size={18} aria-hidden="true" />} iconPosition="right" onClick={() => { router.push(`/projects/${project.id}`); }}>Open project</Button></div>
            </div>
        </Card>
    </section>;
}
