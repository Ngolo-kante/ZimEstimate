'use client';

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
        message: `${item.material_name} is at ${remainingPercent.toFixed(0)}% remaining (${remainingQty.toFixed(2)} ${item.unit}).`,
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
      <div className="usage-header">
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={viewMode === 'daily' ? 'active' : ''}
              onClick={() => setViewMode('daily')}
            >
              Daily
            </button>
            <button
              className={viewMode === 'weekly' ? 'active' : ''}
              onClick={() => setViewMode('weekly')}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      {/* Three equal columns that always fit: as a row that could not
          shrink it pushed the page to 426px on a 390px phone and cut off
          the ledger. Short labels on small screens. */}
      <div className="usage-tabs" role="tablist" aria-label="Usage tracking">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'log'}
          className={`usage-tab ${activeTab === 'log' ? 'active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          <Plus size={16} weight="duotone" aria-hidden="true" />
          <span className="tab-label-long">Log Usage</span>
          <span className="tab-label-short">Log</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'materials'}
          className={`usage-tab ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          <Package size={16} weight="duotone" aria-hidden="true" />
          <span>Materials</span>
          <span className="tab-count">{items.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ledger'}
          className={`usage-tab ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <Receipt size={16} weight="duotone" aria-hidden="true" />
          <span className="tab-label-long">Usage Ledger</span>
          <span className="tab-label-short">Ledger</span>
          {usageHistory.length > 0 && <span className="tab-count">{usageHistory.length}</span>}
        </button>
      </div>

      {/* Log Usage Tab Content */}
      {activeTab === 'log' && (
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
          itemLookup={itemLookup}
        />
      )}

      {/* Materials Tab - Per-material usage history */}
      {activeTab === 'materials' && (
        <UsageMaterialsTab
          usageStats={usageStats}
          usageByMaterial={usageByMaterial}
          expandedMaterials={expandedMaterials}
          toggleMaterialExpanded={toggleMaterialExpanded}
        />
      )}

      {/* Ledger Tab - Overall usage history */}
      {activeTab === 'ledger' && (
        <UsageLedgerTab
          usageHistory={usageHistory}
          ledgerByDate={ledgerByDate}
          itemLookup={itemLookup}
          totalUsedCost={totalUsedCost}
        />
      )}
    </div>
  );
}
