'use client';

import { useState, useMemo } from 'react';
import { Calendar, Wallet, TrendUp, Target, CaretDown, Info, WhatsappLogo, PaperPlaneTilt, Envelope, ChatCircleText, PiggyBank } from '@phosphor-icons/react';
import { useCurrency } from './CurrencyToggle';

export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email';

interface BudgetPlannerProps {
  totalBudgetUsd: number;
  amountSpentUsd?: number;
  targetDate?: string | null;
  onTargetDateChange?: (date: string) => void;
  criticalItemsUsd?: number;
  onSetReminder?: (type: 'daily' | 'weekly' | 'monthly', amount: number, channel: NotificationChannel) => void;
}

type PlanMode = 'all' | 'critical' | 'custom';

export default function BudgetPlanner({
  totalBudgetUsd,
  amountSpentUsd = 0,
  targetDate,
  onTargetDateChange,
  criticalItemsUsd = 0,
  onSetReminder,
}: BudgetPlannerProps) {
  const { currency, exchangeRate, formatPrice } = useCurrency();
  const [planMode, setPlanMode] = useState<PlanMode>('all');
  const [customAmount, setCustomAmount] = useState('');
  const [localTargetDate, setLocalTargetDate] = useState(targetDate || '');
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel>('sms');

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

  return (
    <div className="budget-planner">
      <div className="planner-header">
        <div className="header-icon">
          <PiggyBank size={24} weight="duotone" />
        </div>
        <div className="header-content">
          <h3>Budget Planner</h3>
          <p>Plan your savings to reach your construction goals</p>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Progress</span>
          <span className="progress-percent">{percentComplete.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(100, percentComplete)}%` }} />
        </div>
        <div className="progress-labels">
          <span>Spent: {formatPrice(amountSpentUsd, amountSpentUsd * exchangeRate)}</span>
          <span>Remaining: {formatPrice(remainingBudget, remainingBudget * exchangeRate)}</span>
        </div>
      </div>

      {/* Plan Mode Selection */}
      <div className="mode-section">
        <label className="mode-label">What do you want to save for?</label>
        <div className="mode-options">
          <button
            className={`mode-btn ${planMode === 'all' ? 'active' : ''}`}
            onClick={() => setPlanMode('all')}
          >
            <Target size={18} weight={planMode === 'all' ? 'fill' : 'light'} />
            All Materials
          </button>
          <button
            className={`mode-btn ${planMode === 'critical' ? 'active' : ''}`}
            onClick={() => setPlanMode('critical')}
            disabled={criticalItemsUsd === 0}
          >
            <TrendUp size={18} weight={planMode === 'critical' ? 'fill' : 'light'} />
            Critical Items
          </button>
          <button
            className={`mode-btn ${planMode === 'custom' ? 'active' : ''}`}
            onClick={() => setPlanMode('custom')}
          >
            <Wallet size={18} weight={planMode === 'custom' ? 'fill' : 'light'} />
            Custom Amount
          </button>
        </div>

        {planMode === 'custom' && (
          <div className="custom-amount-input">
            <span className="currency-prefix">$</span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Enter target amount"
              min="0"
            />
          </div>
        )}
      </div>

      {/* Target Date */}
      <div className="date-section">
        <label className="date-label">
          <Calendar size={18} weight="light" />
          When do you want to buy?
        </label>
        <input
          type="date"
          value={localTargetDate}
          onChange={(e) => handleDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="date-input"
        />
        {daysUntilTarget > 0 && (
          <span className="days-remaining">{daysUntilTarget} days remaining</span>
        )}
      </div>

      {/* Savings Breakdown */}
      {localTargetDate && targetAmount > 0 && (
        <div className="savings-breakdown">
          <h4>Your Savings Plan</h4>
          <p className="target-info">
            To save {formatPrice(targetAmount, targetAmount * exchangeRate)} by{' '}
            {new Date(localTargetDate).toLocaleDateString()}, you need to save:
          </p>

          <div className="channel-selector">
            <label>Notify me via:</label>
            <div className="channel-options">
              <button
                className={`channel-btn ${selectedChannel === 'sms' ? 'active' : ''}`}
                onClick={() => setSelectedChannel('sms')}
                title="SMS Text"
              >
                <ChatCircleText size={20} weight={selectedChannel === 'sms' ? 'fill' : 'light'} />
              </button>
              <button
                className={`channel-btn ${selectedChannel === 'whatsapp' ? 'active' : ''}`}
                onClick={() => setSelectedChannel('whatsapp')}
                title="WhatsApp"
              >
                <WhatsappLogo size={20} weight={selectedChannel === 'whatsapp' ? 'fill' : 'light'} />
              </button>
              <button
                className={`channel-btn ${selectedChannel === 'telegram' ? 'active' : ''}`}
                onClick={() => setSelectedChannel('telegram')}
                title="Telegram"
              >
                <PaperPlaneTilt size={20} weight={selectedChannel === 'telegram' ? 'fill' : 'light'} />
              </button>
              <button
                className={`channel-btn ${selectedChannel === 'email' ? 'active' : ''}`}
                onClick={() => setSelectedChannel('email')}
                title="Email"
              >
                <Envelope size={20} weight={selectedChannel === 'email' ? 'fill' : 'light'} />
              </button>
            </div>
          </div>

          <div className="savings-grid">
            <div className="savings-card daily">
              <span className="savings-label">Daily</span>
              <span className="savings-amount">
                {formatPrice(savingsPerDay, savingsPerDay * exchangeRate)}
              </span>
              {onSetReminder && (
                <button
                  className="reminder-btn"
                  onClick={() => onSetReminder('daily', savingsPerDay, selectedChannel)}
                >
                  Set Reminder
                </button>
              )}
            </div>
            <div className="savings-card weekly">
              <span className="savings-label">Weekly</span>
              <span className="savings-amount">
                {formatPrice(savingsPerWeek, savingsPerWeek * exchangeRate)}
              </span>
              {onSetReminder && (
                <button
                  className="reminder-btn"
                  onClick={() => onSetReminder('weekly', savingsPerWeek, selectedChannel)}
                >
                  Set Reminder
                </button>
              )}
            </div>
            <div className="savings-card monthly">
              <span className="savings-label">Monthly</span>
              <span className="savings-amount">
                {formatPrice(savingsPerMonth, savingsPerMonth * exchangeRate)}
              </span>
              {onSetReminder && (
                <button
                  className="reminder-btn"
                  onClick={() => onSetReminder('monthly', savingsPerMonth, selectedChannel)}
                >
                  Set Reminder
                </button>
              )}
            </div>
          </div>

          <div className="savings-tip">
            <Info size={16} weight="fill" />
            <span>
              Start with daily savings of {formatPrice(savingsPerDay, savingsPerDay * exchangeRate)} and watch your construction fund grow!
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        .budget-planner {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
        }

        .planner-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .header-icon {
          width: 48px;
          height: 48px;
          background: var(--color-accent-bg);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent);
        }

        .header-content h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
          color: var(--color-text);
        }

        .header-content p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin: 4px 0 0 0;
        }

        .progress-section {
          background: var(--color-background);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-lg);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          margin-bottom: var(--spacing-sm);
        }

        .progress-percent {
          font-weight: 600;
          color: var(--color-accent);
        }

        .progress-bar {
          height: 8px;
          background: var(--color-border-light);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-success) 100%);
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin-top: var(--spacing-sm);
        }

        .mode-section {
          margin-bottom: var(--spacing-lg);
        }

        .mode-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          display: block;
          margin-bottom: var(--spacing-sm);
        }

        .mode-options {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mode-btn:hover:not(:disabled) {
          border-color: var(--color-accent);
          color: var(--color-text);
        }

        .mode-btn.active {
          background: var(--color-accent-bg);
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .custom-amount-input {
          display: flex;
          align-items: center;
          margin-top: var(--spacing-sm);
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .currency-prefix {
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-border-light);
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .custom-amount-input input {
          flex: 1;
          border: none;
          padding: var(--spacing-sm) var(--spacing-md);
          font-size: 1rem;
          outline: none;
        }

        .date-section {
          margin-bottom: var(--spacing-lg);
        }

        .date-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          margin-bottom: var(--spacing-sm);
        }

        .date-input {
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .date-input:focus {
          border-color: var(--color-accent);
        }

        .days-remaining {
          display: block;
          margin-top: var(--spacing-xs);
          font-size: 0.75rem;
          color: var(--color-accent);
          font-weight: 500;
        }

        .savings-breakdown {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          color: var(--color-text);
          box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.05);
        }

        .savings-breakdown h4 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 var(--spacing-sm) 0;
        }

        .target-info {
          font-size: 0.875rem;
          opacity: 0.9;
          margin: 0 0 var(--spacing-md) 0;
        }

        .channel-selector {
          margin-bottom: var(--spacing-md);
        }
        
        .channel-selector label {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
          margin-bottom: 8px;
        }
        
        .channel-options {
          display: flex;
          gap: 12px;
        }
        
        .channel-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .channel-btn:hover {
          background: var(--color-surface-hover);
          color: var(--color-primary);
          border-color: var(--color-primary);
        }
        
        .channel-btn.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .savings-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .savings-card {
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--spacing-md);
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .savings-label {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.8;
          margin-bottom: 4px;
        }

        .savings-amount {
          display: block;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .reminder-btn {
          margin-top: auto;
          padding: 8px 12px;
          background: var(--color-primary);
          border: none;
          border-radius: var(--radius-sm);
          color: white;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reminder-btn:hover {
          background: var(--color-primary-dark);
          transform: translateY(-1px);
        }

        .savings-tip {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: var(--color-background);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          line-height: 1.5;
          color: var(--color-text-secondary);
        }

        @media (max-width: 640px) {
          .savings-grid {
            grid-template-columns: 1fr;
          }

          .mode-options {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
