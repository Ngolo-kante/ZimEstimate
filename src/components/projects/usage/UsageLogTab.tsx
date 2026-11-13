'use client';

import { localToday } from '@/lib/projects/usageStats';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import type { BOQItem, MaterialUsage } from '@/lib/database.types';
import type { MaterialOptionGroup, MaterialUsageStat, UsageSummary } from '@/lib/projects/usageStats';
import {
  Calendar,
  Check,
  EnvelopeSimple,
  ChatCircleText,
  WhatsappLogo,
  BellRinging,
  Gear,
} from '@phosphor-icons/react';

export interface UsageFormState {
  itemId: string;
  quantity: string;
  date: string;
  notes: string;
}

const CHANNEL_INFO: Record<NotificationChannel, { icon: React.ReactNode; label: string }> = {
  email: { icon: <EnvelopeSimple size={15} weight="duotone" />, label: 'Email' },
  whatsapp: { icon: <WhatsappLogo size={15} weight="duotone" />, label: 'WhatsApp' },
  sms: { icon: <ChatCircleText size={15} weight="duotone" />, label: 'SMS' },
};

export interface UsageLogTabProps {
  usageSummary: UsageSummary;
  usageStats: MaterialUsageStat[];
  totalUsedCost: number;
  remainingCost: number;
  preferredChannel: NotificationChannel;
  onNavigateToSettings?: () => void;
  formState: UsageFormState;
  setFormState: React.Dispatch<React.SetStateAction<UsageFormState>>;
  materialOptionGroups: MaterialOptionGroup[];
  onLogUsage: () => void | Promise<void>;
  isLoading: boolean;
  groupedUsage: Record<string, MaterialUsage[]>;
  itemLookup: Map<string, BOQItem>;
}

/** Usage totals, the low-stock reminder, the form to log usage, and recent entries. */
export default function UsageLogTab({
  usageSummary,
  usageStats,
  totalUsedCost,
  remainingCost,
  preferredChannel,
  onNavigateToSettings,
  formState,
  setFormState,
  materialOptionGroups,
  onLogUsage,
  isLoading,
  groupedUsage,
  itemLookup,
}: UsageLogTabProps) {
  const { formatPrice, exchangeRate } = useCurrency();
  return (
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
                  {materialOptionGroups.map((group) => (
                    <optgroup key={group.key} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </optgroup>
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
                  max={localToday()}
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
                <Button onClick={onLogUsage} icon={<Check size={16} />}>
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
                    <td className="col-material">
                      <div className="material-cell">
                        <span className="material-name">{stat.item.material_name}</span>
                        <span className="material-unit">{stat.item.unit}</span>
                      </div>
                    </td>
                    <td data-label="Available" className="num">{stat.availableQty.toFixed(2)}</td>
                    <td data-label="Used" className="num">{stat.usedQty.toFixed(2)}</td>
                    <td data-label="Remaining" className="num">{stat.remainingQty.toFixed(2)}</td>
                    <td data-label="Usage %" className="num">{stat.usagePercent.toFixed(0)}%</td>
                    <td className="col-burn">
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
  );
}
