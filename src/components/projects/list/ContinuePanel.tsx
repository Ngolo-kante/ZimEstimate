'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/shadcn/badge';
import type { BOQItem, Project, ProjectStage, PurchaseRecord } from '@/lib/database.types';
import { currentStageLabel, pendingItemsOf, shortLocation } from '@/lib/projects/listPresentation';
import { computePurchaseStats, materialItemsOf } from '@/lib/projects/workspaceStats';
import { formatUsd } from '@/lib/format';

export default function ContinuePanel({ project, stages, items, purchases }: { project: Project; stages: ProjectStage[]; items: BOQItem[]; purchases: PurchaseRecord[] }) {
    const router = useRouter();
    const materials = materialItemsOf(items);
    const pending = pendingItemsOf(materials, purchases).slice(0, 3);
    const spent = computePurchaseStats(items, materials, purchases).actualSpent;
    const estimate = Number(project.total_usd) || 0;
    const percent = estimate > 0 ? Math.min(100, Math.max(0, spent / estimate * 100)) : 0;
    return <section aria-label="Continue your build" className="continue-panel">
        <Card>
            <div className="continue-heading"><div><p className="continue-label">Continue your build</p><h2>{project.name}</h2><p>{shortLocation(project.location)}</p></div><Button onClick={() => { router.push(`/projects/${project.id}`); }}>Open</Button></div>
            <Badge variant="secondary">{currentStageLabel(project, stages.filter(s => s.project_id === project.id))}</Badge>
            <p className="continue-spend">{formatUsd(spent, { wholeDollars: true })} of {formatUsd(estimate, { wholeDollars: true })}</p>
            <div className="continue-progress" role="progressbar" aria-label="Spent against the estimate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${formatUsd(spent, { wholeDollars: true })} of ${formatUsd(estimate, { wholeDollars: true })}`}><div style={{ width: `${percent}%` }} /></div>
            <h3>Next steps</h3>
            {pending.length ? <ul>{pending.map(item => <li key={item.id}><Link href={`/projects/${project.id}?view=procurement&item=${encodeURIComponent(item.id)}`}>{item.material_name}</Link></li>)}</ul> : <p className="muted">{materials.length ? 'All items purchased.' : 'Add items to plan your next purchase.'}</p>}
        </Card>
    </section>;
}
