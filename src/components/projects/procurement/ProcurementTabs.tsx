'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import { Badge } from '@/components/shadcn/badge';

import type { ProcurementStage, ProcurementStats } from '@/lib/projects/procurement';
import { FileText, Package, Receipt } from '@phosphor-icons/react';

export interface ProcurementTabsProps {
  activeStage: ProcurementStage;
  setActiveStage: (stage: ProcurementStage) => void;
  itemCount: number;
  purchaseCount: number;
  stats: ProcurementStats;
}

/** Items, Quotes and Purchases. */
export default function ProcurementTabs({ activeStage, setActiveStage, itemCount, purchaseCount, stats }: ProcurementTabsProps) {
  return (
    <Tabs value={activeStage} onValueChange={value => setActiveStage(value as ProcurementStage)}>
      <TabsList className="stage-tabs buying-tabs" aria-label="Procurement sections">
        <TabsTrigger value="boq" aria-current={activeStage === 'boq' ? 'page' : undefined}><Package weight="duotone" />Items<Badge variant="secondary">{itemCount}</Badge></TabsTrigger>
        <TabsTrigger value="rfq" aria-current={activeStage === 'rfq' ? 'page' : undefined}><FileText weight="duotone" />Quotes{stats.pendingRfqs > 0 && <Badge variant="secondary">{stats.pendingRfqs}</Badge>}</TabsTrigger>
        <TabsTrigger value="history" aria-current={activeStage === 'history' ? 'page' : undefined}><Receipt weight="duotone" />Purchases{purchaseCount > 0 && <Badge variant="secondary">{purchaseCount}</Badge>}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
