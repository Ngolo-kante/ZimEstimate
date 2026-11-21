'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/shadcn/tabs';
import { Badge } from '@/components/shadcn/badge';

import { formatQuantity } from '@/lib/format';

import { localToday } from '@/lib/projects/usageStats';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  recordUsage,
  getUsageHistory,
  createProjectNotification,
} from '@/lib/services/projects';
import { BOQItem, Project } from '@/lib/database.types';
import {
  groupUsageByPeriod,
  ledgerByDate as groupLedgerByDate,
  materialOptionGroups as buildMaterialOptionGroups,
  materialUsageStats,
  remainingValue,
  summariseUsage,
  usageByMaterial as groupUsageByMaterial,
  usedValue,
  type UsageViewMode,
} from '@/lib/projects/usageStats';
import '@/styles/project-usage.css';
import { Package, Receipt, Plus } from '@phosphor-icons/react';
import { useUsageHistory } from './usage/useUsageHistory';
import UsageLogTab, { type UsageFormState } from './usage/UsageLogTab';
import UsageMaterialsTab from './usage/UsageMaterialsTab';
import UsageLedgerTab from './usage/UsageLedgerTab';

type UsageTab = 'log' | 'materials' | 'ledger';

interface ProjectUsageViewProps {
  project: Project;
  items: BOQItem[];
  usageByItem: Record<string, number>;
  onUsageRecorded?: () => void | Promise<void>;
  selectedItemForUsage?: BOQItem | null;
  onClearSelectedItem?: () => void;
  preferredChannel?: NotificationChannel;
  onNavigateToSettings?: () => void;
}

export default function ProjectUsageView({
  project,
  items,
  usageByItem,
  onUsageRecorded,
  selectedItemForUsage,
  onClearSelectedItem,
  preferredChannel = 'email',
  onNavigateToSettings,
}: ProjectUsageViewProps) {
  const { profile, user } = useAuth();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<UsageTab>('log');
  const [viewMode, setViewMode] = useState<UsageViewMode>('daily');
  const { isLoading, usageHistory, setUsageHistory } = useUsageHistory(project.id, onUsageRecorded);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const [formState, setFormState] = useState<UsageFormState>({
    itemId: '',
    quantity: '',
    date: localToday(),
    notes: '',
  });

  // Reminder state is now managed centrally in Settings / Notification Centre
  // We only read the preferredChannel prop for display purposes

  // Handle external item selection (from BOQ quick action)
  useEffect(() => {
    if (selectedItemForUsage) {
      const timeoutId = setTimeout(() => {
        setActiveTab('log');
        setFormState(prev => ({
          ...prev,
          itemId: selectedItemForUsage.id,
        }));
        onClearSelectedItem?.();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedItemForUsage, onClearSelectedItem]);

  // Options for "which material was used", grouped by stage and labelled
  // with quantity and what is left — 99 lines of bare names repeated "DPC
  // Roll" and "Standard Cement 32.5N" with nothing to tell them apart.
  const materialOptionGroups = useMemo(() => buildMaterialOptionGroups(items, usageByItem), [items, usageByItem]);

  const itemLookup = useMemo(() => {
    const map = new Map<string, BOQItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const groupedUsage = useMemo(() => groupUsageByPeriod(usageHistory, viewMode), [usageHistory, viewMode]);

  const totalUsedCost = useMemo(() => usedValue(items, usageByItem), [items, usageByItem]);

  const remainingCost = useMemo(() => remainingValue(items, usageByItem), [items, usageByItem]);

  const usageThreshold = Number(project.usage_low_stock_threshold ?? 20);
  const alertsEnabled = Boolean(project.usage_low_stock_alert_enabled);

  const usageStats = useMemo(() => materialUsageStats(items, usageByItem), [items, usageByItem]);

  const usageSummary = useMemo(() => summariseUsage(usageStats, usageThreshold), [usageStats, usageThreshold]);

  // Group usage history by material for per-material view
  const usageByMaterial = useMemo(() => groupUsageByMaterial(usageHistory), [usageHistory]);

  // Ledger-style view: all usage newest first, grouped by date
  const ledgerByDate = useMemo(() => groupLedgerByDate(usageHistory), [usageHistory]);

  const toggleMaterialExpanded = (itemId: string) => {
    setExpandedMaterials((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleLogUsage = async () => {
    if (!formState.itemId || !formState.quantity) {
      showError('Select a material and enter quantity');
      return;
    }

    const qty = parseFloat(formState.quantity);
    if (isNaN(qty) || qty <= 0) {
      showError('Enter a valid quantity');
      return;
    }

    const { error } = await recordUsage(
      project.id,
      formState.itemId,
      qty,
      formState.date,
      formState.notes || undefined
    );

    if (error) {
      showError('Failed to record usage');
      return;
    }

    const item = itemLookup.get(formState.itemId);
    const previousUsed = usageByItem[formState.itemId] || 0;
    const newUsed = previousUsed + qty;
    const availableQty = Number(item?.actual_quantity ?? item?.quantity ?? 0);
    const remainingQty = Math.max(availableQty - newUsed, 0);
    const remainingPercent = availableQty > 0 ? (remainingQty / availableQty) * 100 : 0;
    const previousRemainingQty = Math.max(availableQty - previousUsed, 0);
    const previousRemainingPercent = availableQty > 0 ? (previousRemainingQty / availableQty) * 100 : 0;
    if (project.owner_id && user?.id && project.owner_id !== user.id) {
      await createProjectNotification({
        project_id: project.id,
        user_id: project.owner_id,
        type: 'usage',
        title: 'Usage updated',
        message: `${profile?.full_name || user?.email || 'A builder'} logged ${qty} ${item?.unit || ''} of ${item?.material_name || 'materials'}.`,
      });
    }

    const crossedThreshold = previousRemainingPercent > usageThreshold && remainingPercent <= usageThreshold;
    if (alertsEnabled && item && availableQty > 0 && crossedThreshold) {
      await createProjectNotification({
        project_id: project.id,
        user_id: project.owner_id || user?.id || '',
        type: 'low_stock',
        title: 'Low stock alert',
        message: `${item.material_name} is at ${remainingPercent.toFixed(0)}% remaining (${formatQuantity(remainingQty)} ${item.unit}).`,
      });
    }

    success('Usage recorded');
    setFormState({
      itemId: '',
      quantity: '',
      date: localToday(),
      notes: '',
    });

    await onUsageRecorded?.();

    const { usage, error: usageError } = await getUsageHistory(project.id);
    if (usageError) {
      showError(usageError.message || 'Failed to refresh usage history');
    } else {
      setUsageHistory(usage);
    }
  };

  return (
    <div className="project-usage usage-page">
      {/* Tab Navigation */}
      {/* Three equal columns that always fit: as a row that could not
          shrink it pushed the page to 426px on a 390px phone and cut off
          the ledger. Short labels on small screens. */}
      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as UsageTab)}>
      <TabsList aria-label="Usage tracking" className="usage-tab-switcher !h-auto !w-full !grid grid-cols-3">
        <TabsTrigger className="min-h-11 min-w-0 px-1 text-sc-muted-foreground transition-none" value="log">
          <Plus className="hidden sm:block" size={16} weight="duotone" aria-hidden="true" />
          <span className="tab-label-long">Log usage</span><span className="tab-label-short">Log</span>
        </TabsTrigger>
        <TabsTrigger className="min-h-11 min-w-0 px-1 text-sc-muted-foreground transition-none" value="materials">
          <Package className="hidden sm:block" size={16} weight="duotone" aria-hidden="true" />Materials<Badge variant="secondary">{items.length}</Badge>
        </TabsTrigger>
        <TabsTrigger className="min-h-11 min-w-0 px-1 text-sc-muted-foreground transition-none" value="ledger">
          <Receipt className="hidden sm:block" size={16} weight="duotone" aria-hidden="true" />
          <span className="tab-label-long">Usage ledger</span><span className="tab-label-short">Ledger</span>
          {usageHistory.length > 0 && <Badge variant="secondary">{usageHistory.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      {/* Log usage Tab Content */}
      <TabsContent value="log">
        <UsageLogTab
          usageSummary={usageSummary}
          usageStats={usageStats}
          totalUsedCost={totalUsedCost}
          remainingCost={remainingCost}
          preferredChannel={preferredChannel}
          onNavigateToSettings={onNavigateToSettings}
          formState={formState}
          setFormState={setFormState}
          materialOptionGroups={materialOptionGroups}
          onLogUsage={handleLogUsage}
          isLoading={isLoading}
          groupedUsage={groupedUsage}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          itemLookup={itemLookup}
        />
      </TabsContent>

      {/* Materials Tab - Per-material usage history */}
      <TabsContent value="materials">
        <UsageMaterialsTab
          usageStats={usageStats}
          usageByMaterial={usageByMaterial}
          expandedMaterials={expandedMaterials}
          toggleMaterialExpanded={toggleMaterialExpanded}
        />
      </TabsContent>

      {/* Ledger Tab - Overall usage history */}
      <TabsContent value="ledger">
        <UsageLedgerTab
          usageHistory={usageHistory}
          ledgerByDate={ledgerByDate}
          itemLookup={itemLookup}
          totalUsedCost={totalUsedCost}
        />
      </TabsContent>
      </Tabs>
    </div>
  );
}
