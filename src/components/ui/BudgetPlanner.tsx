'use client';

import { useState, useMemo } from 'react';
import { Calendar, Wallet, TrendUp, Target, Info, WhatsappLogo, PaperPlaneTilt, Envelope, ChatCircleText, PiggyBank, Bell, CheckCircle } from '@phosphor-icons/react';
import { useCurrency } from './CurrencyToggle';

export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email';

type ReminderFrequency = 'daily' | 'weekly' | 'monthly';

interface BudgetPlannerProps {
  totalBudgetUsd: number;
  amountSpentUsd?: number;
  targetDate?: string | null;
  onTargetDateChange?: (date: string) => void;
  criticalItemsUsd?: number;
  onSetReminder?: (type: ReminderFrequency, amount: number, channel: NotificationChannel) => void;
  canUseMobileReminders?: boolean;
  defaultChannel?: NotificationChannel;
  onRequestPhone?: (payload?: { channel?: NotificationChannel; pendingReminder?: { frequency: ReminderFrequency; amount: number } }) => void;
  reminderActive?: boolean;
  reminderFrequency?: ReminderFrequency | null;
  onToggleReminder?: (active: boolean) => void;
}

type PlanMode = 'all' | 'critical' | 'custom';

export default function BudgetPlanner({
  totalBudgetUsd,
  amountSpentUsd = 0,
  targetDate,
  onTargetDateChange,
  criticalItemsUsd = 0,
  onSetReminder,
  canUseMobileReminders = true,
  defaultChannel = 'sms',
  onRequestPhone,
  reminderActive = false,
  reminderFrequency = null,
  onToggleReminder,
}: BudgetPlannerProps) {
  const { exchangeRate, formatPrice } = useCurrency();
  const [planMode, setPlanMode] = useState<PlanMode>('all');
  const [customAmount, setCustomAmount] = useState('');
  const [localTargetDate, setLocalTargetDate] = useState(targetDate || '');
  const [channelOverride, setChannelOverride] = useState<NotificationChannel | null>(null);

  const remainingBudget = totalBudgetUsd - amountSpentUsd;
  const percentComplete = totalBudgetUsd > 0 ? (amountSpentUsd / totalBudgetUsd) * 100 : 0;

  const targetAmount = useMemo(() => {
    switch (planMode) {
      case 'critical':
        return criticalItemsUsd;
      case 'custom':
        return parseFloat(customAmount) || 0;
      default:
        return remainingBudget;
    }
  }, [planMode, criticalItemsUsd, customAmount, remainingBudget]);

  const daysUntilTarget = useMemo(() => {
    if (!localTargetDate) return 0;
    const target = new Date(localTargetDate);
    const today = new Date();
    const diff = target.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [localTargetDate]);

  const savingsPerDay = daysUntilTarget > 0 ? targetAmount / daysUntilTarget : 0;
  const savingsPerWeek = savingsPerDay * 7;
  const savingsPerMonth = savingsPerDay * 30;

  const handleDateChange = (date: string) => {
    setLocalTargetDate(date);
    onTargetDateChange?.(date);
  };

  const isMobileChannel = (channel: NotificationChannel) =>
    channel === 'sms' || channel === 'whatsapp' || channel === 'telegram';

  const selectedChannel = useMemo(() => {
    const baseChannel = channelOverride ?? defaultChannel;
    if (!canUseMobileReminders && isMobileChannel(baseChannel)) {
      return 'email';
    }
    return baseChannel;
  }, [channelOverride, defaultChannel, canUseMobileReminders]);

  const handleChannelSelect = (channel: NotificationChannel) => {
    if (isMobileChannel(channel) && !canUseMobileReminders) {
      onRequestPhone?.({ channel });
      return;
    }
    setChannelOverride(channel);
  };

  const handleReminder = (frequency: ReminderFrequency, amount: number) => {
    if (isMobileChannel(selectedChannel) && !canUseMobileReminders) {
      onRequestPhone?.({ channel: selectedChannel, pendingReminder: { frequency, amount } });
      return;
    }
    onSetReminder?.(frequency, amount, selectedChannel);
  };

  return (
    <div className="budget-planner">
      <div className="planner-header">
        <div className="header-icon-wrapper">
          <PiggyBank size={32} weight="duotone" />
        </div>
        <div className="header-content">
          <h3>Budget Planner</h3>
          <p>Optimize your project savings & timeline</p>
        </div>
        <div className="header-badge">
          {percentComplete >= 100 ? 'Goal Reached' : 'In Progress'}
        </div>
      </div>

      {/* Progress Card */}
      <div className="planner-card progress-card">
        <div className="card-row">
          <div className="progress-info">
            <span className="label">Budget Progress</span>
            <span className="value">{percentComplete.toFixed(0)}%</span>
          </div>
          <div className="budget-values">
            <div className="budget-item">
              <span className="sub-label">Spent</span>
              <span className="sub-value">{formatPrice(amountSpentUsd, amountSpentUsd * exchangeRate)}</span>
            </div>
            <div className="divider"></div>
            <div className="budget-item">
              <span className="sub-label">Remaining</span>
              <span className="sub-value">{formatPrice(remainingBudget, remainingBudget * exchangeRate)}</span>
            </div>
          </div>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, percentComplete)}%` }}
          />
        </div>
      </div>

      <div className="planner-grid">
        {/* Helper Column */}
        <div className="planner-col settings-col">
          <div className="section-title">
            <Target size={18} />
            <span>Savings Goal</span>
          </div>

          <div className="input-group">
            <label>Target Scope</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${planMode === 'all' ? 'active' : ''}`}
                onClick={() => setPlanMode('all')}
              >
                All
              </button>
              <button
                className={`toggle-btn ${planMode === 'critical' ? 'active' : ''}`}
                onClick={() => setPlanMode('critical')}
                disabled={criticalItemsUsd === 0}
              >
                Critical
              </button>
              <button
                className={`toggle-btn ${planMode === 'custom' ? 'active' : ''}`}
                onClick={() => setPlanMode('custom')}
              >
                Custom
              </button>
            </div>
          </div>

          {planMode === 'custom' && (
            <div className="input-group animate-in">
              <label>Target Amount ($)</label>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                className="modern-input"
              />
            </div>
          )}

          <div className="input-group">
            <label>Target Date</label>
            <div className="date-input-wrapper">
              <Calendar size={18} className="input-icon" />
              <input
                type="date"
                value={localTargetDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="modern-input with-icon"
              />
            </div>
            {daysUntilTarget > 0 && (
              <span className="helper-text">{daysUntilTarget} days remaining</span>
            )}
          </div>
        </div>

        {/* Savings Output Column */}
        <div className="planner-col results-col">
          {localTargetDate && targetAmount > 0 ? (
            <>
              <div className="section-title">
                <TrendUp size={18} />
                <span>Required Savings</span>
              </div>

              <div className="savings-cards">
                <div className="savings-card">
                  <span className="period">Daily</span>
                  <span className="amount">{formatPrice(savingsPerDay, savingsPerDay * exchangeRate)}</span>
                  {onSetReminder && (
                    <button className="set-reminder-sm" onClick={() => handleReminder('daily', savingsPerDay)}>
                      <Bell size={14} /> Set
                    </button>
                  )}
                </div>
                <div className="savings-card featured">
                  <span className="period">Weekly</span>
                  <span className="amount">{formatPrice(savingsPerWeek, savingsPerWeek * exchangeRate)}</span>
                  {onSetReminder && (
                    <button className="set-reminder-sm" onClick={() => handleReminder('weekly', savingsPerWeek)}>
                      <Bell size={14} /> Set
                    </button>
                  )}
                </div>
                <div className="savings-card">
                  <span className="period">Monthly</span>
                  <span className="amount">{formatPrice(savingsPerMonth, savingsPerMonth * exchangeRate)}</span>
                  {onSetReminder && (
                    <button className="set-reminder-sm" onClick={() => handleReminder('monthly', savingsPerMonth)}>
                      <Bell size={14} /> Set
                    </button>
                  )}
                </div>
              </div>

              <div className="channel-section">
                <span className="channel-label">Notify via:</span>
                <div className="channel-row">
                  <button className={`channel-chip ${selectedChannel === 'sms' ? 'active' : ''}`} onClick={() => handleChannelSelect('sms')}>
                    <ChatCircleText size={16} weight="fill" /> SMS
                  </button>
                  <button className={`channel-chip ${selectedChannel === 'whatsapp' ? 'active' : ''}`} onClick={() => handleChannelSelect('whatsapp')}>
                    <WhatsappLogo size={16} weight="fill" /> WhatsApp
                  </button>
                  <button className={`channel-chip ${selectedChannel === 'email' ? 'active' : ''}`} onClick={() => handleChannelSelect('email')}>
                    <Envelope size={16} weight="fill" /> Email
                  </button>
                </div>
              </div>

              {reminderFrequency && onToggleReminder && (
                <div className={`reminder-banner ${reminderActive ? 'active' : 'inactive'}`}>
                  <div className="banner-icon">
                    {reminderActive ? <CheckCircle size={20} weight="fill" /> : <Info size={20} weight="fill" />}
                  </div>
                  <div className="banner-content">
                    <span className="banner-title">{reminderActive ? 'Reminder Active' : 'Reminder Paused'}</span>
                    <span className="banner-desc">{reminderActive ? `Scheduled ${reminderFrequency}` : 'Resume to stay on track'}</span>
                  </div>
                  <button className="toggle-switch" onClick={() => onToggleReminder(!reminderActive)}>
                    {reminderActive ? 'Off' : 'On'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Target size={48} weight="duotone" />
              <p>Set a target date to see your savings plan</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .budget-planner {
          background: #ffffff;
          border: 1px solid var(--color-border-light);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
          font-family: var(--font-sans);
        }

        .planner-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--color-border-light);
        }

        .header-icon-wrapper {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            color: #3b82f6;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .header-content {
            flex: 1;
        }

        .header-content h3 {
            font-size: 1.25rem;
            font-weight: 700;
            color: #1e293b;
            margin: 0;
            letter-spacing: -0.01em;
        }

        .header-content p {
            font-size: 0.9rem;
            color: #64748b;
            margin: 4px 0 0 0;
        }

        .header-badge {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 6px 12px;
            border-radius: 99px;
            background: #f1f5f9;
            color: #64748b;
        }

        /* Progress Card */
        .progress-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .card-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 12px;
        }

        .progress-info {
            display: flex;
            flex-direction: column;
        }

        .label {
            font-size: 0.8rem;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }

        .value {
            font-size: 2rem;
            font-weight: 800;
            color: #0f172a;
            line-height: 1;
        }

        .budget-values {
            display: flex;
            align-items: center;
            gap: 16px;
            background: rgba(255, 255, 255, 0.6);
            padding: 8px 16px;
            border-radius: 12px;
            border: 1px solid rgba(226, 232, 240, 0.6);
        }

        .budget-item {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        .sub-label {
            font-size: 0.7rem;
            color: #94a3b8;
            font-weight: 600;
            text-transform: uppercase;
        }

        .sub-value {
            font-size: 0.95rem;
            font-weight: 600;
            color: #334155;
        }

        .divider {
            width: 1px;
            height: 24px;
            background: #cbd5e1;
        }

        .progress-track {
            height: 10px;
            background: #cbd5e1;
            border-radius: 99px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 99px;
            transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        }

        /* Grid Layout */
        .planner-grid {
            display: grid;
            grid-template-columns: 1fr 1.5fr;
            gap: 24px;
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
            font-weight: 700;
            color: #334155;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .input-group {
            margin-bottom: 20px;
        }

        .input-group label {
            display: block;
            font-size: 0.85rem;
            font-weight: 500;
            color: #64748b;
            margin-bottom: 8px;
        }

        .modern-input {
            width: 100%;
            padding: 12px 16px;
            font-size: 1rem;
            color: #0f172a;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            outline: none;
            transition: all 0.2s;
        }

        .modern-input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .date-input-wrapper {
            position: relative;
        }

        .input-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
        }

        .modern-input.with-icon {
            padding-left: 42px;
        }

        .toggle-group {
            display: flex;
            background: #f1f5f9;
            padding: 4px;
            border-radius: 12px;
        }

        .toggle-btn {
            flex: 1;
            padding: 8px;
            border: none;
            background: transparent;
            font-size: 0.85rem;
            font-weight: 500;
            color: #64748b;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .toggle-btn.active {
            background: #ffffff;
            color: #0f172a;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .toggle-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            color: #cbd5e1;
        }

        .helper-text {
            display: block;
            font-size: 0.75rem;
            color: #3b82f6;
            margin-top: 6px;
            font-weight: 500;
        }

        /* Savings Cards */
        .savings-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }

        .savings-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 16px 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 8px;
            transition: transform 0.2s;
        }
        
        .savings-card:hover {
            border-color: #cbd5e1;
            transform: translateY(-2px);
        }

        .savings-card.featured {
            background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
            border-color: #bfdbfe;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
            position: relative;
            z-index: 1;
            transform: scale(1.05);
        }
        
         .savings-card.featured:hover {
            transform: scale(1.05) translateY(-2px);
         }

        .period {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 600;
        }

        .amount {
            font-size: 1.1rem;
            font-weight: 700;
            color: #0f172a;
        }

        .set-reminder-sm {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: #f1f5f9;
            border: none;
            border-radius: 6px;
            font-size: 0.7rem;
            color: #475569;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .set-reminder-sm:hover {
            background: #e2e8f0;
            color: #1e293b;
        }
        
        .savings-card.featured .set-reminder-sm {
            background: #dbeafe;
            color: #2563eb;
        }
        
        .savings-card.featured .set-reminder-sm:hover {
            background: #bfdbfe;
        }

        /* Channels */
        .channel-section {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding: 0 4px;
        }

        .channel-label {
            font-size: 0.8rem;
            color: #64748b;
            font-weight: 500;
        }

        .channel-row {
            display: flex;
            gap: 8px;
        }

        .channel-chip {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 99px;
            border: 1px solid #e2e8f0;
            background: white;
            font-size: 0.8rem;
            font-weight: 500;
            color: #475569;
            cursor: pointer;
            transition: all 0.2s;
        }

        .channel-chip:hover {
            border-color: #cbd5e1;
            background: #f8fafc;
        }

        .channel-chip.active {
            background: #0f172a;
            color: white;
            border-color: #0f172a;
        }

        /* Reminder Banner */
        .reminder-banner {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 12px;
            transition: all 0.2s;
        }

        .reminder-banner.active {
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
        }
        
        .reminder-banner.inactive {
            background: #fff1f2;
            border: 1px solid #fecdd3;
        }

        .banner-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .active .banner-icon {
            background: #d1fae5;
            color: #059669;
        }
        
        .inactive .banner-icon {
            background: #ffe4e6;
            color: #e11d48;
        }

        .banner-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .banner-title {
            font-size: 0.85rem;
            font-weight: 600;
            color: #1e293b;
        }

        .banner-desc {
            font-size: 0.75rem;
            color: #64748b;
        }

        .toggle-switch {
            padding: 6px 12px;
            border-radius: 8px;
            border: none;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
        }
        
        .active .toggle-switch {
            background: white;
            color: #059669;
            border: 1px solid #d1fae5;
        }
        
        .inactive .toggle-switch {
             background: #e11d48;
             color: white;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #cbd5e1;
            gap: 12px;
            min-height: 200px;
            background: #f8fafc;
            border-radius: 16px;
            border: 2px dashed #e2e8f0;
        }

        .empty-state p {
            font-size: 0.9rem;
            color: #94a3b8;
        }

        @media (max-width: 768px) {
            .planner-grid {
                grid-template-columns: 1fr;
            }
            .card-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 16px;
            }
            .budget-values {
                width: 100%;
                justify-content: space-between;
            }
        }
      `}</style>
    </div>
  );
}
