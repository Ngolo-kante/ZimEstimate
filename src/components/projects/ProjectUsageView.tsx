'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  recordUsage,
  getUsageHistory,
  createProjectNotification,
} from '@/lib/services/projects';
import { supabase } from '@/lib/supabase';
import { BOQItem, MaterialUsage, Project } from '@/lib/database.types';
import {
  Calendar,
  Check,
  EnvelopeSimple,
  ChatCircleText,
  WhatsappLogo,
  PaperPlaneTilt,
  BellRinging,
  Gear,
  Package,
  Receipt,
  Plus,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';

type UsageViewMode = 'daily' | 'weekly';
type UsageTab = 'log' | 'materials' | 'ledger';

interface ProjectUsageViewProps {
  project: Project;
  items: BOQItem[];
  usageByItem: Record<string, number>;
  onUsageRecorded?: () => void | Promise<void>;
  onRequestPhone?: (payload?: { channel?: NotificationChannel }) => void;
  canUseMobileReminders?: boolean;
  selectedItemForUsage?: BOQItem | null;
  onClearSelectedItem?: () => void;
  preferredChannel?: NotificationChannel;
  onNavigateToSettings?: () => void;
}

interface UsageFormState {
  itemId: string;
  quantity: string;
  date: string;
  notes: string;
}

const CHANNEL_INFO: Record<NotificationChannel, { icon: React.ReactNode; label: string }> = {
  email: { icon: <EnvelopeSimple size={15} weight="duotone" />, label: 'Email' },
  sms: { icon: <ChatCircleText size={15} weight="duotone" />, label: 'SMS' },
  whatsapp: { icon: <WhatsappLogo size={15} weight="duotone" />, label: 'WhatsApp' },
  telegram: { icon: <PaperPlaneTilt size={15} weight="duotone" />, label: 'Telegram' },
};

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
  const { formatPrice, exchangeRate } = useCurrency();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<UsageTab>('log');
  const [viewMode, setViewMode] = useState<UsageViewMode>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [usageHistory, setUsageHistory] = useState<MaterialUsage[]>([]);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const [formState, setFormState] = useState<UsageFormState>({
    itemId: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Reminder state is now managed centrally in Settings / Notification Centre
  // We only read the preferredChannel prop for display purposes

  // Ref for debouncing realtime updates
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load usage history
  const loadUsage = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const { usage, error } = await getUsageHistory(project.id);
    if (error) {
      showError(error.message || 'Failed to load usage history');
    } else {
      setUsageHistory(usage);
    }
    setIsLoading(false);
  }, [project.id, showError, user?.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadUsage();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [loadUsage]);

  // Realtime subscription for material_usage changes
  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        void loadUsage();
        onUsageRecorded?.();
      }, 250);
    };

    const channel = supabase
      .channel(`usage-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_usage',
          filter: `project_id=eq.${project.id}`,
        },
        () => scheduleRefresh()
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadUsage, project.id, onUsageRecorded]);

  // Reminder loading removed — now managed in Settings / Notification Centre

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

  const itemLookup = useMemo(() => {
    const map = new Map<string, BOQItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const groupedUsage = useMemo(() => {
    const grouped: Record<string, MaterialUsage[]> = {};
    usageHistory.forEach((usage) => {
      const date = new Date(usage.usage_date);
      let key = date.toISOString().split('T')[0];
      if (viewMode === 'weekly') {
        const weekStart = new Date(date);
        const day = weekStart.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        weekStart.setDate(weekStart.getDate() + diff);
        key = weekStart.toISOString().split('T')[0];
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(usage);
    });
    return grouped;
  }, [usageHistory, viewMode]);

  const totalUsedCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const used = usageByItem[item.id] || 0;
      return sum + used * Number(item.unit_price_usd);
    }, 0);
  }, [items, usageByItem]);

  const remainingCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const purchased = Number(item.actual_quantity ?? item.quantity);
      const used = usageByItem[item.id] || 0;
      return sum + (purchased - used) * Number(item.unit_price_usd);
    }, 0);
  }, [items, usageByItem]);

  const usageThreshold = Number(project.usage_low_stock_threshold ?? 20);
  const alertsEnabled = Boolean(project.usage_low_stock_alert_enabled);

  const usageStats = useMemo(() => {
    return items.map((item) => {
      const availableQty = Number(item.actual_quantity ?? item.quantity) || 0;
      const usedQty = usageByItem[item.id] || 0;
      const remainingQty = Math.max(availableQty - usedQty, 0);
      const usagePercent = availableQty > 0 ? (usedQty / availableQty) * 100 : 0;
      return {
        item,
        availableQty,
        usedQty,
        remainingQty,
        usagePercent,
      };
    });
  }, [items, usageByItem]);

  const usageSummary = useMemo(() => {
    const totalAvailable = usageStats.reduce((sum, s) => sum + s.availableQty, 0);
    const totalUsed = usageStats.reduce((sum, s) => sum + s.usedQty, 0);
    const totalRemaining = Math.max(totalAvailable - totalUsed, 0);
    const overallPercent = totalAvailable > 0 ? (totalUsed / totalAvailable) * 100 : 0;
    const lowStockCount = usageStats.filter((s) => {
      if (s.availableQty <= 0) return false;
      const remainingPercent = (s.remainingQty / s.availableQty) * 100;
      return remainingPercent <= usageThreshold;
    }).length;
    return {
      totalAvailable,
      totalUsed,
      totalRemaining,
      overallPercent,
      lowStockCount,
    };
  }, [usageStats, usageThreshold]);

  // Group usage history by material for per-material view
  const usageByMaterial = useMemo(() => {
    const grouped: Record<string, MaterialUsage[]> = {};
    usageHistory.forEach((usage) => {
      const itemId = usage.boq_item_id;
      if (!grouped[itemId]) grouped[itemId] = [];
      grouped[itemId].push(usage);
    });
    // Sort each material's history by date descending
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) =>
        new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime()
      );
    });
    return grouped;
  }, [usageHistory]);

  // Ledger-style view: all usage sorted by date descending
  const ledgerEntries = useMemo(() => {
    return [...usageHistory].sort((a, b) =>
      new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime()
    );
  }, [usageHistory]);

  // Group ledger entries by date
  const ledgerByDate = useMemo(() => {
    const grouped: Record<string, MaterialUsage[]> = {};
    ledgerEntries.forEach((usage) => {
      const dateKey = new Date(usage.usage_date).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(usage);
    });
    return grouped;
  }, [ledgerEntries]);

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

  // Channel & reminder handlers removed — now managed centrally in Settings

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
      date: new Date().toISOString().split('T')[0],
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
    <div className="usage-page">
      <div className="usage-header">
        <div>
          <h2>Usage Tracking</h2>
          <p>Log material usage and track remaining stock on site.</p>
        </div>
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
      <div className="usage-tabs">
        <button
          className={`usage-tab ${activeTab === 'log' ? 'active' : ''}`}
          onClick={() => setActiveTab('log')}
        >
          <Plus size={16} weight="duotone" />
          <span>Log Usage</span>
        </button>
        <button
          className={`usage-tab ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          <Package size={16} weight="duotone" />
          <span>Materials</span>
          <span className="tab-count">{items.length}</span>
        </button>
        <button
          className={`usage-tab ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <Receipt size={16} weight="duotone" />
          <span>Usage Ledger</span>
          {usageHistory.length > 0 && <span className="tab-count">{usageHistory.length}</span>}
        </button>
      </div>

      {/* Log Usage Tab Content */}
      {activeTab === 'log' && (
        <>
          <div className="usage-kpis">
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="label">Used value</span>
                <span className="value">{formatPrice(totalUsedCost, totalUsedCost * exchangeRate)}</span>
              </div>
              <div className="kpi-card">
                <span className="label">Remaining value</span>
                <span className="value">{formatPrice(remainingCost, remainingCost * exchangeRate)}</span>
              </div>
              <div className="kpi-card">
                <span className="label">Usage %</span>
                <span className="value">{usageSummary.overallPercent.toFixed(0)}%</span>
              </div>
              <div className="kpi-card alert">
                <span className="label">Low stock</span>
                <span className="value">{usageSummary.lowStockCount}</span>
              </div>
            </div>
            <div className="donut-card">
              <div
                className="donut"
                style={{ '--percent': `${usageSummary.overallPercent}%` } as React.CSSProperties}
              >
                <div className="donut-center">
                  <span>{usageSummary.overallPercent.toFixed(0)}%</span>
                  <small>used</small>
                </div>
              </div>
              <div className="donut-meta">
                <span>{usageSummary.totalUsed.toFixed(2)} used</span>
                <span>{usageSummary.totalRemaining.toFixed(2)} remaining</span>
              </div>
            </div>
          </div>

          {/* Usage reminder status — managed centrally in Settings */}
          <div className="usage-reminder">
            <div className="reminder-left">
              <BellRinging size={18} weight="duotone" />
              <div>
                <h4>Usage Alerts</h4>
                <p>
                  Alerts via <strong>{CHANNEL_INFO[preferredChannel].label}</strong>
                  {' '}{CHANNEL_INFO[preferredChannel].icon}
                </p>
              </div>
            </div>
            {onNavigateToSettings && (
              <button
                type="button"
                className="reminder-settings-link"
                onClick={onNavigateToSettings}
              >
                <Gear size={16} />
                Configure in Settings
              </button>
            )}
          </div>

          <div className="usage-log">
            <div className="log-header">
              <h3>Log Usage</h3>
            </div>
            <div className="log-form">
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Material</label>
                  <select
                    value={formState.itemId}
                    onChange={(e) => setFormState({ ...formState, itemId: e.target.value })}
                  >
                    <option value="">Select material...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.material_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity Used</label>
                  <input
                    type="number"
                    value={formState.quantity}
                    onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Notes (optional)</label>
                  <Input
                    value={formState.notes}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                    placeholder="e.g., slab pour day 1"
                  />
                </div>
                <div className="form-actions">
                  <Button onClick={handleLogUsage} icon={<Check size={16} />}>
                    Save Usage
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="usage-table-card">
            <div className="table-header">
              <h3>Burn-down by material</h3>
              <p>Track how each material is being consumed on site.</p>
            </div>
            <div className="table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th className="num">Available</th>
                    <th className="num">Used</th>
                    <th className="num">Remaining</th>
                    <th className="num">Usage %</th>
                    <th>Burn-down</th>
                  </tr>
                </thead>
                <tbody>
                  {usageStats.map((stat) => (
                    <tr key={stat.item.id}>
                      <td>
                        <div className="material-cell">
                          <span className="material-name">{stat.item.material_name}</span>
                          <span className="material-unit">{stat.item.unit}</span>
                        </div>
                      </td>
                      <td className="num">{stat.availableQty.toFixed(2)}</td>
                      <td className="num">{stat.usedQty.toFixed(2)}</td>
                      <td className="num">{stat.remainingQty.toFixed(2)}</td>
                      <td className="num">{stat.usagePercent.toFixed(0)}%</td>
                      <td>
                        <div className="burn-bar">
                          <div className="burn-fill" style={{ width: `${Math.min(stat.usagePercent, 100)}%` }} />
                        </div>
                        {stat.availableQty > 0 && (
                          <span className="burn-label">
                            {stat.remainingQty.toFixed(2)} {stat.item.unit} left
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usageStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        No materials found for usage tracking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="usage-history">
            <div className="history-header">
              <h3>Recent usage logs</h3>
              {isLoading && <span>Loading...</span>}
            </div>
            {Object.keys(groupedUsage).length === 0 && !isLoading ? (
              <div className="empty-state">
                <Calendar size={32} />
                <p>No usage logged yet.</p>
              </div>
            ) : (
              Object.entries(groupedUsage).map(([dateKey, records]) => (
                <div key={dateKey} className="history-group">
                  <div className="group-header">
                    <Calendar size={14} />
                    <span>{dateKey}</span>
                  </div>
                  <div className="group-list">
                    {records.map((record) => {
                      const item = itemLookup.get(record.boq_item_id);
                      return (
                        <div key={record.id} className="history-item">
                          <div>
                            <span className="item-name">{item?.material_name || 'Material'}</span>
                            <span className="item-notes">{record.notes || '—'}</span>
                          </div>
                          <div className="item-qty">
                            {record.quantity_used} {item?.unit || ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Materials Tab - Per-material usage history */}
      {activeTab === 'materials' && (
        <div className="materials-tab">
          <div className="materials-header">
            <h3>Material Usage History</h3>
            <p>Click on a material to see its usage history.</p>
          </div>
          <div className="materials-list">
            {usageStats.map((stat) => {
              const isExpanded = expandedMaterials.has(stat.item.id);
              const materialHistory = usageByMaterial[stat.item.id] || [];
              const hasHistory = materialHistory.length > 0;

              return (
                <div key={stat.item.id} className={`material-card ${isExpanded ? 'expanded' : ''}`}>
                  <div
                    className="material-header"
                    onClick={() => hasHistory && toggleMaterialExpanded(stat.item.id)}
                    role={hasHistory ? 'button' : undefined}
                    tabIndex={hasHistory ? 0 : undefined}
                  >
                    <div className="material-expand">
                      {hasHistory ? (
                        isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />
                      ) : (
                        <span className="expand-placeholder" />
                      )}
                    </div>
                    <div className="material-info">
                      <span className="material-name">{stat.item.material_name}</span>
                      <span className="material-unit">{stat.item.unit}</span>
                    </div>
                    <div className="material-stats">
                      <div className="stat-group">
                        <span className="stat-label">Available</span>
                        <span className="stat-value">{stat.availableQty.toFixed(1)}</span>
                      </div>
                      <div className="stat-group">
                        <span className="stat-label">Used</span>
                        <span className="stat-value used">{stat.usedQty.toFixed(1)}</span>
                      </div>
                      <div className="stat-group">
                        <span className="stat-label">Remaining</span>
                        <span className={`stat-value ${stat.remainingQty <= 0 ? 'depleted' : ''}`}>
                          {stat.remainingQty.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="material-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.min(stat.usagePercent, 100)}%` }}
                        />
                      </div>
                      <span className="progress-text">{stat.usagePercent.toFixed(0)}%</span>
                    </div>
                    {hasHistory && (
                      <span className="history-count">{materialHistory.length} log{materialHistory.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {isExpanded && hasHistory && (
                    <div className="material-history">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th className="col-date">Date</th>
                            <th className="col-qty">Quantity</th>
                            <th className="col-notes">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materialHistory.map((usage) => (
                            <tr key={usage.id}>
                              <td className="col-date">
                                {new Date(usage.usage_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="col-qty">{usage.quantity_used} {stat.item.unit}</td>
                              <td className="col-notes">{usage.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td className="footer-label">Total Used</td>
                            <td className="col-qty bold">{stat.usedQty.toFixed(2)} {stat.item.unit}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {usageStats.length === 0 && (
              <div className="empty-materials">
                <Package size={32} />
                <p>No materials to track.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ledger Tab - Overall usage history */}
      {activeTab === 'ledger' && (
        <div className="ledger-tab">
          <div className="ledger-header-bar">
            <h3>Usage Ledger</h3>
            <span className="ledger-total">
              {usageHistory.length} entries • Total: {formatPrice(totalUsedCost, totalUsedCost * exchangeRate)}
            </span>
          </div>

          {Object.keys(ledgerByDate).length === 0 ? (
            <div className="empty-ledger">
              <Receipt size={48} />
              <p>No usage records yet.</p>
              <span>Log material usage to see entries here.</span>
            </div>
          ) : (
            <div className="ledger-container">
              {Object.entries(ledgerByDate).map(([dateKey, records]) => {
                const dayTotal = records.reduce((sum, r) => {
                  const item = itemLookup.get(r.boq_item_id);
                  const price = Number(item?.unit_price_usd || 0);
                  return sum + (r.quantity_used * price);
                }, 0);

                return (
                  <div key={dateKey} className="ledger-date-group">
                    <div className="ledger-date-header">
                      <span className="ledger-date">{dateKey}</span>
                      <span className="ledger-date-total">{formatPrice(dayTotal, dayTotal * exchangeRate)}</span>
                    </div>
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th className="col-material">Material</th>
                          <th className="col-qty">Quantity</th>
                          <th className="col-unit">Unit</th>
                          <th className="col-price">Unit Price</th>
                          <th className="col-total">Value</th>
                          <th className="col-notes">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => {
                          const item = itemLookup.get(record.boq_item_id);
                          const unitPrice = Number(item?.unit_price_usd || 0);
                          const recordValue = record.quantity_used * unitPrice;

                          return (
                            <tr key={record.id}>
                              <td className="col-material">
                                <span className="material-name">{item?.material_name || 'Unknown'}</span>
                                {item?.category && <span className="material-cat">{item.category}</span>}
                              </td>
                              <td className="col-qty mono">{record.quantity_used.toFixed(2)}</td>
                              <td className="col-unit">{item?.unit || '—'}</td>
                              <td className="col-price mono">{formatPrice(unitPrice, unitPrice * exchangeRate)}</td>
                              <td className="col-total mono bold">{formatPrice(recordValue, recordValue * exchangeRate)}</td>
                              <td className="col-notes">{record.notes || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .usage-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.8));
          border: 1px solid rgba(226, 232, 240, 0.8);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
          transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .usage-page:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .usage-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 4px;
        }

        .usage-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: #0f172a;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .usage-header p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 0.95rem;
        }

        .view-toggle {
          display: flex;
          gap: 4px;
          background: #edf6ff;
          padding: 4px;
          border-radius: 10px;
          border: 1px solid #d5e6f7;
        }

        .view-toggle button {
          border: none;
          background: transparent;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-toggle button.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transform: translateY(-1px);
        }

        .usage-kpis {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 16px;
        }

        .kpi-card {
            background: linear-gradient(135deg, #ffffff, #f8fafc);
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
            transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .kpi-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
            border-color: rgba(59, 130, 246, 0.2);
        }

        .kpi-card.alert {
            border-color: rgba(239, 68, 68, 0.25);
            background: linear-gradient(135deg, #fef2f2, #fff5f5);
        }

        .kpi-card.alert .value {
            color: #dc2626;
        }

        .kpi-card .label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 600;
        }

        .kpi-card .value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.1;
            letter-spacing: -0.02em;
        }

        .donut-card {
            background: linear-gradient(135deg, #ffffff, #f8fafc);
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }

        .donut {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          background: conic-gradient(#3b82f6 0 var(--percent), #f1f5f9 var(--percent) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .donut-center {
          width: 90px;
          height: 90px;
          background: #ffffff;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #0f172a;
          box-shadow: 0 0 0 8px #ffffff;
        }
        
        .donut-center span {
            font-size: 1.5rem;
            line-height: 1;
        }

        .donut-center small {
          font-size: 0.7rem;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 2px;
        }

        .donut-meta {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.85rem;
          color: #64748b;
          text-align: center;
        }

        .usage-reminder {
            background: #ffffff;
            border: 1px solid #d9e7f5;
            border-radius: 16px;
            padding: 20px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
        }

        .reminder-left {
          display: flex;
          gap: 16px;
          align-items: center;
          min-width: 280px;
        }
        
        .reminder-left svg {
            color: #3b82f6;
            padding: 8px;
            background: #eff6ff;
            border-radius: 10px;
            width: 40px;
            height: 40px;
        }

        .reminder-left h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: #0f172a;
        }

        .reminder-left p {
            margin: 4px 0 0;
            font-size: 0.85rem;
            color: #64748b;
        }

        .reminder-left p strong {
            font-weight: 600;
            color: #1e293b;
        }

        .reminder-settings-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          border: 1px solid #d9e7f5;
          background: #f8fafc;
          color: #3b82f6;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .reminder-settings-link:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .reminder-settings-link:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.22);
        }

        .usage-log {
            background: #ffffff;
            border: 1px solid #d9e7f5;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
        }
        
        .log-header h3 {
            margin: 0 0 20px;
            font-size: 1.1rem;
            color: #0f172a;
        }

        .log-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .form-group.flex-2 {
            grid-column: span 2;
        }
        
        .form-group label {
            font-size: 0.75rem;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .form-group input,
        .form-group select {
            padding: 10px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            font-size: 0.95rem;
            color: #0f172a;
            outline: none;
            transition: border-color 0.2s;
        }
        
        .form-group input:focus,
        .form-group select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .form-actions {
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
        }

        .usage-table-card {
            background: #ffffff;
            border: 1px solid #d9e7f5;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
        }

        .table-header {
            padding: 20px 24px;
            border-bottom: 1px solid #f1f5f9;
        }

        .table-header h3 {
            margin: 0;
            font-size: 1.1rem;
            color: #0f172a;
            font-weight: 700;
        }

        .table-header p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 0.9rem;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .usage-table {
          width: 100%;
          border-collapse: collapse;
        }

        .usage-table th {
            text-align: left;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            padding: 16px 24px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            white-space: nowrap;
        }

        .usage-table td {
            padding: 16px 24px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 0.95rem;
            color: #334155;
            vertical-align: middle;
        }
        
        .usage-table tr:last-child td {
            border-bottom: none;
        }

        .usage-table .num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .material-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .material-name {
          font-weight: 600;
          color: #0f172a;
        }

        .material-unit {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .burn-bar {
          width: 100%;
          height: 8px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
        }

        .burn-fill {
          height: 100%;
          background: #3b82f6;
          border-radius: 999px;
        }
        
        .burn-label {
            display: block;
            margin-top: 6px;
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 500;
        }

        .empty-row {
            text-align: center;
            padding: 32px;
            color: #94a3b8;
            font-style: italic;
        }

        .usage-history {
            background: #ffffff;
            border: 1px solid #d9e7f5;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
        }
        
        .history-header {
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .history-header h3 {
            margin: 0;
            font-size: 1.1rem;
            color: #0f172a;
        }

        .history-group {
          margin-bottom: 24px;
        }
        
        .history-group:last-child {
            margin-bottom: 0;
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 12px;
          font-weight: 700;
        }
        
        .group-header svg {
            color: #3b82f6;
        }

        .group-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border: 1px solid #f1f5f9;
            border-radius: 12px;
            background: #ffffff;
            transition: all 0.2s;
        }
        
        .history-item:hover {
            border-color: #e2e8f0;
            background: #f8fafc;
        }

        .item-name {
          font-weight: 600;
          color: #0f172a;
          display: block;
          font-size: 0.95rem;
        }

        .item-notes {
          font-size: 0.8rem;
          color: #94a3b8;
        }

        .item-qty {
          font-weight: 700;
          color: #0f172a;
          font-size: 0.95rem;
        }

        /* Tab Navigation */
        .usage-tabs {
          display: flex;
          gap: 6px;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
          padding: 6px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
        }

        .usage-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: transparent;
          border: none;
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .usage-tab:hover {
          background: rgba(255, 255, 255, 0.7);
          color: #334155;
        }

        .usage-tab.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .tab-count {
          background: rgba(100, 116, 139, 0.15);
          color: #64748b;
          font-size: 0.7rem;
          padding: 3px 8px;
          border-radius: 99px;
          font-weight: 700;
        }

        .usage-tab.active .tab-count {
          background: rgba(59, 130, 246, 0.15);
          color: #2563eb;
        }

        /* Materials Tab */
        .materials-tab {
          background: linear-gradient(135deg, #ffffff, #f8fafc);
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }

        .materials-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .materials-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #0f172a;
          font-weight: 700;
        }

        .materials-header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 0.9rem;
        }

        .materials-list {
          display: flex;
          flex-direction: column;
        }

        .material-card {
          border-bottom: 1px solid #f1f5f9;
        }

        .material-card:last-child {
          border-bottom: none;
        }

        .material-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .material-header:hover {
          background: #f8fafc;
        }

        .material-expand {
          width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
        }

        .expand-placeholder {
          width: 16px;
        }

        .material-info {
          flex: 1;
          min-width: 0;
        }

        .materials-tab .material-name {
          display: block;
          font-weight: 600;
          color: #0f172a;
          font-size: 0.95rem;
        }

        .materials-tab .material-unit {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .material-stats {
          display: flex;
          gap: 24px;
        }

        .stat-group {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          font-weight: 600;
        }

        .stat-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #0f172a;
        }

        .stat-value.used {
          color: #3b82f6;
        }

        .stat-value.depleted {
          color: #ef4444;
        }

        .material-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 120px;
        }

        .material-progress .progress-bar {
          flex: 1;
          height: 6px;
          background: #f1f5f9;
          border-radius: 999px;
          overflow: hidden;
        }

        .material-progress .progress-fill {
          height: 100%;
          background: #3b82f6;
          border-radius: 999px;
        }

        .material-progress .progress-text {
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          min-width: 36px;
          text-align: right;
        }

        .history-count {
          font-size: 0.75rem;
          color: #64748b;
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 99px;
        }

        .material-history {
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          padding: 0;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
        }

        .history-table th {
          text-align: left;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          padding: 12px 24px;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
        }

        .history-table td {
          padding: 12px 24px;
          font-size: 0.9rem;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
        }

        .history-table tr:last-child td {
          border-bottom: none;
        }

        .history-table tfoot td {
          background: #f8fafc;
          font-weight: 600;
          border-top: 1px solid #e2e8f0;
        }

        .history-table .footer-label {
          color: #64748b;
        }

        .history-table .bold {
          font-weight: 700;
          color: #0f172a;
        }

        .empty-materials {
          padding: 48px 24px;
          text-align: center;
          color: #94a3b8;
        }

        .empty-materials p {
          margin: 12px 0 0;
          font-weight: 500;
          color: #64748b;
        }

        /* Ledger Tab */
        .ledger-tab {
          background: #ffffff;
          border: 1px solid #d9e7f5;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
        }

        .ledger-header-bar {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .ledger-header-bar h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #0f172a;
          font-weight: 700;
        }

        .ledger-total {
          font-size: 0.85rem;
          color: #64748b;
        }

        .ledger-container {
          display: flex;
          flex-direction: column;
        }

        .ledger-date-group {
          border-bottom: 1px solid #f1f5f9;
        }

        .ledger-date-group:last-child {
          border-bottom: none;
        }

        .ledger-date-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 24px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
        }

        .ledger-date {
          font-size: 0.8rem;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .ledger-date-total {
          font-size: 0.85rem;
          font-weight: 600;
          color: #3b82f6;
        }

        .ledger-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ledger-table th {
          text-align: left;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          padding: 10px 24px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
        }

        .ledger-table td {
          padding: 14px 24px;
          font-size: 0.9rem;
          color: #334155;
          border-bottom: 1px solid #f8fafc;
        }

        .ledger-table tr:last-child td {
          border-bottom: none;
        }

        .ledger-table .col-material {
          min-width: 180px;
        }

        .ledger-table .material-name {
          display: block;
          font-weight: 500;
          color: #0f172a;
        }

        .ledger-table .material-cat {
          display: block;
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: capitalize;
        }

        .ledger-table .mono {
          font-variant-numeric: tabular-nums;
        }

        .ledger-table .bold {
          font-weight: 700;
          color: #0f172a;
        }

        .ledger-table .col-qty,
        .ledger-table .col-price,
        .ledger-table .col-total {
          text-align: right;
          white-space: nowrap;
        }

        .ledger-table .col-notes {
          color: #94a3b8;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .empty-ledger {
          padding: 64px 24px;
          text-align: center;
          color: #94a3b8;
        }

        .empty-ledger p {
          margin: 16px 0 4px;
          font-weight: 600;
          color: #64748b;
          font-size: 1rem;
        }

        .empty-ledger span {
          font-size: 0.875rem;
        }

        @media (max-width: 900px) {
            .usage-kpis {
                grid-template-columns: 1fr;
            }
            .form-group.flex-2 {
                grid-column: span 1;
            }
        }
        
        @media (max-width: 640px) {
            .usage-page {
                padding: 14px;
                border-radius: 16px;
                gap: 14px;
            }
            .usage-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .usage-header h2 {
                font-size: 1.38rem;
            }
            .reminder-left {
                width: 100%;
                min-width: 0;
            }
            .reminder-controls {
                width: 100%;
                justify-content: space-between;
            }
            .usage-log,
            .usage-reminder,
            .usage-history {
                padding: 16px;
                border-radius: 14px;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .usage-page,
            .kpi-card,
            .history-item,
            .view-toggle button,
            .channel-btn,
            .toggle-btn {
                transition: none;
                transform: none !important;
            }
        }
      `}</style>
    </div>
  );
}
