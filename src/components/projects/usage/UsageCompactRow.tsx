'use client';

import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/shadcn/collapsible';
import { Badge } from '@/components/shadcn/badge';

export default function UsageCompactRow({ name, fact, percent, children }: { name: string; fact: string; percent?: number; children: ReactNode }) {
  const progress = Math.max(0, Math.min(percent ?? 0, 100));
  return <Collapsible className="compact-row">
    <CollapsibleTrigger className="compact-trigger">
      <span className="compact-copy"><strong>{name}</strong><span>{fact}</span></span>
      <Badge className="bg-sc-muted text-sc-foreground">{percent === undefined ? 'Details' : `${percent.toFixed(0)}%`}</Badge>
    </CollapsibleTrigger>
    {percent !== undefined && <div className="compact-progress" role="progressbar" aria-label={`${name} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div style={{ width: `${progress}%` }} /></div>}
    <CollapsibleContent className="compact-details">{children}</CollapsibleContent>
  </Collapsible>;
}
