'use client';

import { useId } from 'react';

import { Field, FieldGroup, FieldLabel } from '@/components/shadcn/field';
import { NativeSelect } from '@/components/shadcn/native-select';


import UsageCompactRow from './UsageCompactRow';
import { formatQuantity } from '@/lib/format';

import { localToday } from '@/lib/projects/usageStats';

import Button from '@/components/ui/Button';
import { Input } from '@/components/shadcn/input';
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
    const controlId = useId();
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
              <span>{formatQuantity(usageSummary.totalUsed)} used</span>
              <span>{formatQuantity(usageSummary.totalRemaining)} remaining</span>
            </div>
          </div>
        </div>

        {/* Usage reminder status — managed centrally in Settings */}
        <div className="usage-reminder">
          <div className="reminder-left">
            <BellRinging size={18} weight="duotone" />
            <div>
              <h4>Usage alerts</h4>
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
              Configure in settings
            </button>
          )}
        </div>

        <div className="usage-log">
          <div className="log-header">
            <h3>Log usage</h3>
          </div>
          <FieldGroup className="gap-4">
            <FieldGroup className="!grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field className="min-w-0 md:col-span-1">
                <FieldLabel htmlFor={`${controlId}-1`}>Material</FieldLabel>
                <NativeSelect id={`${controlId}-1`} className="w-full [&_select]:!h-11 [&_select]:bg-sc-background [&_select]:text-base [&_select]:transition-none"
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
                </NativeSelect>
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor={`${controlId}-2`}>Quantity used</FieldLabel>
                <Input id={`${controlId}-2`} className="!h-11 bg-sc-background text-sc-foreground transition-none"
                  type="number" inputMode="decimal"
                  value={formState.quantity}
                  onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor={`${controlId}-3`}>Date</FieldLabel>
                <Input id={`${controlId}-3`} className="!h-11 bg-sc-background text-sc-foreground transition-none"
                  type="date"
                  value={formState.date}
                  onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                  max={localToday()}
                />
              </Field>
            </FieldGroup>
            <FieldGroup className="!grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field className="min-w-0 md:col-span-1">
                <FieldLabel htmlFor={`${controlId}-4`}>Notes (optional)</FieldLabel>
                <Input id={`${controlId}-4`} className="!h-11 bg-sc-background text-sc-foreground transition-none"
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="e.g., slab pour day 1"
                />
              </Field>
              <div className="form-actions">
                <Button onClick={onLogUsage} icon={<Check size={16} />}>
                  Save usage
                </Button>
              </div>
            </FieldGroup>
          </FieldGroup>
        </div>

        <div className="usage-table-card">
          <div className="table-header">
            <h3>Burn-down by material</h3>
            <p>Track how each material is being consumed on site.</p>
          </div>
          <div className="usage-mobile-list">
            {usageStats.map(stat => <UsageCompactRow key={stat.item.id} name={stat.item.material_name} fact={!Number(stat.item.unit_price_usd) ? 'No price yet' : `${formatQuantity(stat.remainingQty)} ${stat.item.unit} left`} percent={stat.usagePercent}>
              <dl><div><dt>Available</dt><dd>{formatQuantity(stat.availableQty)} {stat.item.unit}</dd></div><div><dt>Used</dt><dd>{formatQuantity(stat.usedQty)} {stat.item.unit}</dd></div><div><dt>Remaining</dt><dd>{formatQuantity(stat.remainingQty)} {stat.item.unit}</dd></div></dl>
            </UsageCompactRow>)}
            {usageStats.length === 0 && <p className="empty-row">No materials found for usage tracking.</p>}
          </div>
          <div className="table-wrap usage-desktop-list">
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
                        <span className="material-name" title={stat.item.material_name}>{stat.item.material_name}</span>{!Number(stat.item.unit_price_usd) && <span className="muted">No price yet</span>}
                        <span className="material-unit">{stat.item.unit}</span>
                      </div>
                    </td>
                    <td data-label="Available" className="num">{formatQuantity(stat.availableQty)}</td>
                    <td data-label="Used" className="num">{formatQuantity(stat.usedQty)}</td>
                    <td data-label="Remaining" className="num">{formatQuantity(stat.remainingQty)}</td>
                    <td data-label="Usage %" className="num">{stat.usagePercent.toFixed(0)}%</td>
                    <td className="col-burn">
                      <div className="burn-bar">
                        <div className="burn-fill" style={{ width: `${Math.min(stat.usagePercent, 100)}%` }} />
                      </div>
                      {stat.availableQty > 0 && (
                        <span className="burn-label">
                          {formatQuantity(stat.remainingQty)} {stat.item.unit} left
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
                      <UsageCompactRow key={record.id} name={item?.material_name || 'Material'} fact={`${formatQuantity(record.quantity_used)} ${item?.unit || ''} used`}>
                        <p>{record.notes || 'No notes'}</p>
                      </UsageCompactRow>
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
