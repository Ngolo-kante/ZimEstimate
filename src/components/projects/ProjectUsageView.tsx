'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
  recordUsage,
  getUsageHistory,
  createProjectNotification,
  getProjectRecurringReminder,
  upsertProjectRecurringReminder,
  updateProjectRecurringReminder,
} from '@/lib/services/projects';
import { BOQItem, MaterialUsage, Project } from '@/lib/database.types';
import {
  Calendar,
  Check,
  ClipboardText,
  ChatCircleText,
  WhatsappLogo,
  PaperPlaneTilt,
  Envelope,
} from '@phosphor-icons/react';

type UsageViewMode = 'daily' | 'weekly';
type ReminderFrequency = 'daily' | 'weekly' | 'monthly';
type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email';

interface ProjectUsageViewProps {
  project: Project;
  items: BOQItem[];
  usageByItem: Record<string, number>;
  onUsageRecorded?: () => void | Promise<void>;
  onRequestPhone?: (payload?: { channel?: NotificationChannel }) => void;
  canUseMobileReminders?: boolean;
}

interface UsageFormState {
  itemId: string;
  quantity: string;
  date: string;
  notes: string;
}

export default function ProjectUsageView({
  project,
  items,
  usageByItem,
  onUsageRecorded,
  onRequestPhone,
  canUseMobileReminders = true,
}: ProjectUsageViewProps) {
  const { profile, user } = useAuth();
  const { formatPrice, exchangeRate } = useCurrency();
  const { success, error: showError } = useToast();
  const [viewMode, setViewMode] = useState<UsageViewMode>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [usageHistory, setUsageHistory] = useState<MaterialUsage[]>([]);
  const [formState, setFormState] = useState<UsageFormState>({
    itemId: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [usageReminder, setUsageReminder] = useState<{
    id?: string;
    is_active: boolean;
    frequency: ReminderFrequency;
    channel: NotificationChannel;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const loadUsage = async () => {
      setIsLoading(true);
      const { usage, error } = await getUsageHistory(project.id);
      if (error) {
        showError(error.message || 'Failed to load usage history');
      } else {
        setUsageHistory(usage);
      }
      setIsLoading(false);
    };
    loadUsage();
  }, [project.id, showError, user?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    const loadReminder = async () => {
      const { reminder } = await getProjectRecurringReminder(project.id, profile.id, 'usage');
      if (!reminder) {
        setUsageReminder(null);
        return;
      }
      setUsageReminder({
        id: reminder.id,
        is_active: reminder.is_active,
        frequency: reminder.frequency as ReminderFrequency,
        channel: reminder.channel as NotificationChannel,
      });
    };
    loadReminder();
  }, [project.id, profile?.id]);

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

  const isMobileChannel = (channel: NotificationChannel) =>
    channel === 'sms' || channel === 'whatsapp' || channel === 'telegram';

  const handleChannelSelect = (channel: NotificationChannel) => {
    if (isMobileChannel(channel) && !canUseMobileReminders) {
      onRequestPhone?.({ channel });
      return;
    }
    setUsageReminder((prev) => ({
      id: prev?.id,
      is_active: prev?.is_active ?? false,
      frequency: prev?.frequency || 'daily',
      channel,
    }));
  };

  const handleReminderSave = async () => {
    if (!profile?.id) {
      showError('Please sign in again to save reminders.');
      return;
    }
    if (!usageReminder) return;
    if (isMobileChannel(usageReminder.channel) && !canUseMobileReminders) {
      onRequestPhone?.({ channel: usageReminder.channel });
      return;
    }

    const nextRunAt = new Date();
    nextRunAt.setDate(nextRunAt.getDate() + (usageReminder.frequency === 'weekly' ? 7 : 1));
    nextRunAt.setHours(9, 0, 0, 0);

    const { reminder, error } = await upsertProjectRecurringReminder({
      project_id: project.id,
      user_id: profile.id,
      reminder_type: 'usage',
      frequency: usageReminder.frequency,
      channel: usageReminder.channel,
      amount_usd: null,
      target_date: null,
      next_run_at: nextRunAt.toISOString(),
      is_active: true,

    });

    if (error) {
      showError('Failed to save usage reminder');
      return;
    }

    setUsageReminder({
      id: reminder?.id,
      is_active: reminder?.is_active ?? true,
      frequency: reminder?.frequency as ReminderFrequency,
      channel: reminder?.channel as NotificationChannel,
    });
    success('Usage reminder saved');
  };

  const handleReminderToggle = async (active: boolean) => {
    if (!usageReminder?.id) return;
    const { reminder, error } = await updateProjectRecurringReminder(usageReminder.id, { is_active: active });
    if (error) {
      showError('Failed to update reminder');
      return;
    }
    setUsageReminder({
      id: reminder?.id,
      is_active: reminder?.is_active ?? active,
      frequency: reminder?.frequency as ReminderFrequency,
      channel: reminder?.channel as NotificationChannel,
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

      <div className="usage-reminder">
        <div className="reminder-left">
          <ClipboardText size={18} />
          <div>
            <h4>Usage reminders</h4>
            <p>Set a cadence to remind builders to log usage.</p>
          </div>
        </div>
        <div className="reminder-controls">
          <select
            value={usageReminder?.frequency || 'daily'}
            onChange={(e) =>
              setUsageReminder((prev) => ({
                id: prev?.id,
                is_active: prev?.is_active ?? false,
                frequency: e.target.value as ReminderFrequency,
                channel: prev?.channel || 'email',
              }))
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <div className="channel-options">
            <button
              className={`channel-btn ${(usageReminder?.channel || 'email') === 'sms' ? 'active' : ''}`}
              onClick={() => handleChannelSelect('sms')}
            >
              <ChatCircleText size={16} weight={(usageReminder?.channel || 'email') === 'sms' ? 'fill' : 'light'} />
            </button>
            <button
              className={`channel-btn ${(usageReminder?.channel || 'email') === 'whatsapp' ? 'active' : ''}`}
              onClick={() => handleChannelSelect('whatsapp')}
            >
              <WhatsappLogo size={16} weight={(usageReminder?.channel || 'email') === 'whatsapp' ? 'fill' : 'light'} />
            </button>
            <button
              className={`channel-btn ${(usageReminder?.channel || 'email') === 'telegram' ? 'active' : ''}`}
              onClick={() => handleChannelSelect('telegram')}
            >
              <PaperPlaneTilt size={16} weight={(usageReminder?.channel || 'email') === 'telegram' ? 'fill' : 'light'} />
            </button>
            <button
              className={`channel-btn ${(usageReminder?.channel || 'email') === 'email' ? 'active' : ''}`}
              onClick={() => handleChannelSelect('email')}
            >
              <Envelope size={16} weight={(usageReminder?.channel || 'email') === 'email' ? 'fill' : 'light'} />
            </button>
          </div>
          <div className="reminder-actions">
            {usageReminder?.id ? (
              <button
                className={`toggle-btn ${usageReminder.is_active ? 'off' : 'on'}`}
                onClick={() => handleReminderToggle(!usageReminder?.is_active)}
              >
                {usageReminder?.is_active ? 'Turn Off' : 'Turn On'}
              </button>
            ) : (
              <Button size="sm" onClick={handleReminderSave}>
                Save
              </Button>
            )}
            {usageReminder?.id && (
              <Button size="sm" variant="secondary" onClick={handleReminderSave}>
                Update
              </Button>
            )}
          </div>
        </div>
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

      <style jsx>{`
        .usage-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .usage-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }

        .usage-header h2 {
            margin: 0;
            font-size: 1.75rem;
            color: #0f172a;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .usage-header p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 1rem;
        }

        .view-toggle {
          display: flex;
          gap: 4px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 12px;
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
            background: #ffffff;
            border: 1px solid rgba(226, 232, 240, 0.6);
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
            transition: transform 0.2s;
        }
        
        .kpi-card:hover {
            transform: translateY(-2px);
        }

        .kpi-card.alert {
            border-color: rgba(239, 68, 68, 0.2);
            background: #fef2f2;
        }
        
        .kpi-card.alert .value {
            color: #ef4444;
        }

        .kpi-card .label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
        }

        .kpi-card .value {
            font-size: 1.75rem;
            font-weight: 700;
            color: #0f172a;
            line-height: 1;
        }

        .donut-card {
            background: #ffffff;
            border: 1px solid rgba(226, 232, 240, 0.6);
            border-radius: 20px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
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
            border: 1px solid rgba(226, 232, 240, 0.6);
            border-radius: 20px;
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

        .reminder-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        
        .reminder-controls select {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            font-size: 0.9rem;
            color: #334155;
            background: #ffffff;
            outline: none;
            cursor: pointer;
        }
        
        .channel-options {
            background: #f8fafc;
            padding: 4px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            display: flex;
            gap: 2px;
        }

        .channel-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .channel-btn.active {
          background: #ffffff;
          color: #3b82f6;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        
        .toggle-btn {
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .toggle-btn.on {
            background: #eff6ff;
            color: #3b82f6;
        }
        
        .toggle-btn.on:hover {
            background: #dbeafe;
        }
        
        .toggle-btn.off {
            background: #fef2f2;
            color: #ef4444;
        }
        
        .toggle-btn.off:hover {
            background: #fee2e2;
        }

        .usage-log {
            background: #ffffff;
            border: 1px solid rgba(226, 232, 240, 0.6);
            border-radius: 20px;
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
            border: 1px solid rgba(226, 232, 240, 0.6);
            border-radius: 20px;
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
            border: 1px solid rgba(226, 232, 240, 0.6);
            border-radius: 20px;
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

        @media (max-width: 900px) {
            .usage-kpis {
                grid-template-columns: 1fr;
            }
            .form-group.flex-2 {
                grid-column: span 1;
            }
        }
        
        @media (max-width: 640px) {
            .usage-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .reminder-left {
                width: 100%;
                min-width: 0;
            }
            .reminder-controls {
                width: 100%;
                justify-content: space-between;
            }
        }
      `}</style>
    </div>
  );
}
