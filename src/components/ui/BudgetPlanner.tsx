'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BellSimple,
  CalendarBlank,
  CheckCircle,
  CurrencyDollar,
  Target,
  TrendUp,
  Warning,
  Wallet,
} from '@phosphor-icons/react';
import { useCurrency } from './CurrencyToggle';

export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email';

interface BudgetPlannerProps {
  totalBudgetUsd: number;
  amountSpentUsd?: number;
  targetDate?: string | null;
  onTargetDateChange?: (date: string) => void;
  onOpenSettings?: () => void;
  criticalItemsUsd?: number;
}

type PlanMode = 'all' | 'critical' | 'custom';

export default function BudgetPlanner({
  totalBudgetUsd,
  amountSpentUsd = 0,
  targetDate,
  onTargetDateChange,
  onOpenSettings,
  criticalItemsUsd = 0,
}: BudgetPlannerProps) {
  const { exchangeRate, formatPrice } = useCurrency();
  const [planMode, setPlanMode] = useState<PlanMode>('all');
  const [customAmount, setCustomAmount] = useState('');
  const [localTargetDate, setLocalTargetDate] = useState(targetDate || '');

  const budgetBalance = totalBudgetUsd - amountSpentUsd;
  const remainingBudget = Math.max(0, budgetBalance);
  const amountOverBudget = Math.max(0, -budgetBalance);
  const percentComplete = totalBudgetUsd > 0 ? (amountSpentUsd / totalBudgetUsd) * 100 : 0;
  const displayedProgress = Math.min(100, Math.max(0, percentComplete));
  const isOverBudget = budgetBalance < 0;
  const hasBudget = totalBudgetUsd > 0;

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
  const hasSavingsPlan = Boolean(localTargetDate && targetAmount > 0 && daysUntilTarget > 0);

  const emptyPlanCopy = useMemo(() => {
    if (isOverBudget) {
      return {
        title: 'Spending is over the planned budget',
        detail: 'Increase the budget or choose a custom savings target.',
      };
    }
    if (totalBudgetUsd <= 0) {
      return {
        title: 'Add BOQ items to calculate a plan',
        detail: 'The savings target uses your project BOQ total.',
      };
    }
    if (!localTargetDate) {
      return {
        title: 'Choose a target date',
        detail: 'Your daily, weekly, and monthly pace will appear here.',
      };
    }
    if (daysUntilTarget <= 0) {
      return {
        title: 'Choose a future target date',
        detail: 'The savings pace needs at least one day.',
      };
    }
    return {
      title: 'No remaining amount to fund',
      detail: 'Choose a custom target to create a savings plan.',
    };
  }, [daysUntilTarget, isOverBudget, localTargetDate, totalBudgetUsd]);

  const handleDateChange = (date: string) => {
    setLocalTargetDate(date);
    onTargetDateChange?.(date);
  };

  const formatAmount = (amount: number) => formatPrice(amount, amount * exchangeRate);

  return (
    <div className="budget-planner">
      <section className={`budget-overview ${isOverBudget ? 'is-over' : ''}`} aria-labelledby="budget-position-title">
        <header className="overview-header">
          <div>
            <span className="eyebrow">Project budget</span>
            <h2 id="budget-position-title">Budget position</h2>
          </div>
          <span className={`status-badge ${isOverBudget ? 'status-warning' : hasBudget ? 'status-good' : 'status-neutral'}`}>
            {isOverBudget
              ? <Warning size={16} weight="fill" />
              : hasBudget
                ? <CheckCircle size={16} weight="fill" />
                : <Wallet size={16} weight="fill" />}
            {isOverBudget ? 'Over budget' : hasBudget ? 'On track' : 'No budget yet'}
          </span>
        </header>

        <div className="metric-grid">
          <div className="metric">
            <span className="metric-icon"><Wallet size={18} weight="duotone" /></span>
            <span className="metric-label">Planned</span>
            <strong className="metric-value">{formatAmount(totalBudgetUsd)}</strong>
          </div>
          <div className="metric">
            <span className="metric-icon"><CurrencyDollar size={18} weight="duotone" /></span>
            <span className="metric-label">Spent</span>
            <strong className="metric-value">{formatAmount(amountSpentUsd)}</strong>
          </div>
          <div className={`metric ${isOverBudget ? 'metric-warning' : 'metric-success'}`}>
            <span className="metric-icon"><Target size={18} weight="duotone" /></span>
            <span className="metric-label">{isOverBudget ? 'Over by' : 'Remaining'}</span>
            <strong className="metric-value">{formatAmount(isOverBudget ? amountOverBudget : remainingBudget)}</strong>
          </div>
          <div className="metric metric-progress">
            <span className="metric-icon"><TrendUp size={18} weight="duotone" /></span>
            <span className="metric-label">Progress</span>
            <strong className="metric-value">{percentComplete.toFixed(0)}%</strong>
          </div>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-label="Budget spent"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayedProgress)}
        >
          <div className="progress-fill" style={{ width: `${displayedProgress}%` }} />
        </div>
        <div className="progress-caption">
          <span>{formatAmount(amountSpentUsd)} spent</span>
          <span>{formatAmount(totalBudgetUsd)} planned</span>
        </div>
      </section>

      <section className="savings-workspace" aria-labelledby="savings-plan-title">
        <header className="workspace-header">
          <div className="title-lockup">
            <span className="title-icon"><Target size={20} weight="duotone" /></span>
            <div>
              <h2 id="savings-plan-title">Savings target</h2>
              <p>Choose what to fund and when you need it.</p>
            </div>
          </div>
          <div className="target-readout" aria-live="polite">
            <span>Target amount</span>
            <strong>{formatAmount(targetAmount)}</strong>
          </div>
        </header>

        <div className="workspace-grid">
          <div className="target-controls">
            <fieldset className="input-group">
              <legend>What are you saving for?</legend>
              <div className={`toggle-group ${criticalItemsUsd > 0 ? 'has-critical' : ''}`}>
                <button
                  type="button"
                  className={`toggle-btn ${planMode === 'all' ? 'active' : ''}`}
                  aria-pressed={planMode === 'all'}
                  onClick={() => setPlanMode('all')}
                >
                  Remaining
                </button>
                {criticalItemsUsd > 0 && (
                  <button
                    type="button"
                    className={`toggle-btn ${planMode === 'critical' ? 'active' : ''}`}
                    aria-pressed={planMode === 'critical'}
                    onClick={() => setPlanMode('critical')}
                  >
                    Critical
                  </button>
                )}
                <button
                  type="button"
                  className={`toggle-btn ${planMode === 'custom' ? 'active' : ''}`}
                  aria-pressed={planMode === 'custom'}
                  onClick={() => setPlanMode('custom')}
                >
                  Custom
                </button>
              </div>
            </fieldset>

            <div className={`field-grid ${planMode === 'custom' ? 'has-custom' : ''}`}>
              {planMode === 'custom' && (
                <div className="input-group animate-in">
                  <label htmlFor="budget-target-amount">Target amount</label>
                  <div className="money-input-wrapper">
                    <span aria-hidden="true">$</span>
                    <input
                      id="budget-target-amount"
                      type="number"
                      inputMode="decimal"
                      value={customAmount}
                      onChange={(event) => setCustomAmount(event.target.value)}
                      placeholder="0.00"
                      min="0"
                      className="modern-input money-input"
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="budget-target-date">Target date</label>
                <div className="date-input-wrapper">
                  <CalendarBlank size={18} className="input-icon" aria-hidden="true" />
                  <input
                    id="budget-target-date"
                    type="date"
                    value={localTargetDate}
                    onChange={(event) => handleDateChange(event.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="modern-input with-icon"
                  />
                </div>
                <span className="helper-text">
                  {daysUntilTarget > 0 ? `${daysUntilTarget} days to reach your target` : 'Select a future date'}
                </span>
              </div>
            </div>
          </div>

          <div className="savings-results" aria-live="polite">
            <div className="results-heading">
              <div>
                <span className="eyebrow">Savings pace</span>
                <h3>Amounts to set aside</h3>
              </div>
              <TrendUp size={20} weight="duotone" aria-hidden="true" />
            </div>

            {hasSavingsPlan ? (
              <div className="savings-list">
                <div className="savings-row">
                  <span>Daily</span>
                  <strong>{formatAmount(savingsPerDay)}</strong>
                </div>
                <div className="savings-row featured">
                  <span>Weekly <small>Recommended</small></span>
                  <strong>{formatAmount(savingsPerWeek)}</strong>
                </div>
                <div className="savings-row">
                  <span>Monthly</span>
                  <strong>{formatAmount(savingsPerMonth)}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <CalendarBlank size={24} weight="duotone" aria-hidden="true" />
                <div>
                  <strong>{emptyPlanCopy.title}</strong>
                  <span>{emptyPlanCopy.detail}</span>
                </div>
              </div>
            )}

            {onOpenSettings ? (
              <button type="button" className="reminder-note reminder-action" onClick={onOpenSettings}>
                <BellSimple size={17} weight="duotone" aria-hidden="true" />
                <span>Set delivery reminders</span>
                <ArrowRight size={15} weight="bold" aria-hidden="true" />
              </button>
            ) : (
              <div className="reminder-note">
                <BellSimple size={17} weight="duotone" aria-hidden="true" />
                <span>Set delivery reminders in Project Settings.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <style jsx>{`
        .budget-planner {
          display: grid;
          gap: 16px;
          min-width: 0;
          color: var(--color-text);
          font-family: var(--font-sans);
        }

        .budget-overview,
        .savings-workspace {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-surface);
        }

        .budget-overview {
          border-top: 3px solid var(--color-accent);
        }

        .budget-overview.is-over {
          border-top-color: var(--color-warning);
        }

        .overview-header,
        .workspace-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
        }

        h2,
        h3,
        p {
          margin: 0;
        }

        h2 {
          margin-top: 3px;
          font-family: var(--font-heading);
          font-size: 1.125rem;
          line-height: 1.25;
        }

        h3 {
          margin-top: 3px;
          font-size: 0.9375rem;
          line-height: 1.3;
        }

        .eyebrow,
        .metric-label,
        .target-readout span {
          font-size: 0.6875rem;
          font-weight: 700;
          line-height: 1.2;
          text-transform: uppercase;
          color: var(--color-text-secondary);
        }

        .status-badge {
          display: inline-flex;
          min-height: 32px;
          flex: 0 0 auto;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-good {
          border-color: var(--color-success-border);
          background: var(--color-success-bg);
          color: var(--color-success-fg);
        }

        .status-warning {
          border-color: var(--color-warning-border);
          background: var(--color-warning-bg);
          color: var(--color-warning-fg);
        }

        .status-neutral {
          border-color: var(--color-border);
          background: var(--color-background);
          color: var(--color-text-secondary);
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-block: 1px solid var(--color-border-light);
        }

        .metric {
          position: relative;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr);
          column-gap: 7px;
          align-items: center;
          min-width: 0;
          padding: 13px 12px;
        }

        .metric:nth-child(odd) {
          border-right: 1px solid var(--color-border-light);
        }

        .metric:nth-child(-n + 2) {
          border-bottom: 1px solid var(--color-border-light);
        }

        .metric-icon {
          display: grid;
          grid-row: 1 / 3;
          place-items: center;
          color: var(--color-accent);
        }

        .metric-success .metric-icon {
          color: var(--color-success);
        }

        .metric-warning .metric-icon {
          color: var(--color-warning-fg);
        }

        .metric-value,
        .target-readout strong,
        .savings-row strong {
          min-width: 0;
          overflow-wrap: anywhere;
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }

        .metric-value {
          margin-top: 3px;
          font-size: clamp(0.875rem, 4.2vw, 1.125rem);
          line-height: 1.2;
        }

        .progress-track {
          height: 8px;
          margin: 16px 16px 0;
          overflow: hidden;
          border-radius: 999px;
          background: var(--color-border);
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: var(--color-success);
          transition: width 450ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .is-over .progress-fill {
          background: var(--color-warning);
        }

        .progress-caption {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 16px 16px;
          color: var(--color-text-secondary);
          font-size: 0.6875rem;
          font-variant-numeric: tabular-nums;
        }

        .workspace-header {
          border-bottom: 1px solid var(--color-border-light);
        }

        .title-lockup {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 10px;
        }

        .title-icon {
          display: grid;
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 7px;
          background: var(--color-primary-bg);
          color: var(--color-accent);
        }

        .title-lockup p {
          display: none;
          margin-top: 3px;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
        }

        .target-readout {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
        }

        .target-readout strong {
          margin-top: 3px;
          max-width: 145px;
          font-size: 0.9375rem;
          color: var(--color-primary);
          overflow-wrap: normal;
          white-space: nowrap;
        }

        .workspace-grid {
          display: grid;
          min-width: 0;
        }

        .target-controls,
        .savings-results {
          min-width: 0;
          padding: 16px;
        }

        .savings-results {
          border-top: 1px solid var(--color-border-light);
          background: var(--color-background);
        }

        .input-group {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .input-group legend,
        .input-group label {
          display: block;
          margin-bottom: 7px;
          color: var(--color-text-secondary);
          font-size: 0.75rem;
          font-weight: 700;
        }

        .toggle-group {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 3px;
          padding: 3px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-background);
        }

        .toggle-group.has-critical {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .toggle-btn {
          min-width: 0;
          min-height: 44px;
          padding: 0 8px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          font: inherit;
          font-size: 0.75rem;
          font-weight: 700;
          transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
        }

        .toggle-btn.active {
          border-color: var(--color-accent);
          background: var(--color-surface);
          color: var(--color-accent-dark);
          box-shadow: var(--shadow-sm);
        }

        .toggle-btn:disabled {
          color: var(--color-disabled);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .field-grid {
          display: grid;
          gap: 14px;
          margin-top: 16px;
        }

        .modern-input {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid var(--color-border);
          border-radius: 7px;
          outline: none;
          background: var(--color-surface);
          color: var(--color-text);
          font: inherit;
          font-size: 0.9375rem;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .modern-input:focus-visible,
        .toggle-btn:focus-visible {
          border-color: var(--color-focus-ring);
          outline: 2px solid var(--color-focus-ring);
          outline-offset: 2px;
        }

        .money-input-wrapper,
        .date-input-wrapper {
          position: relative;
        }

        .money-input-wrapper > span,
        .input-icon {
          position: absolute;
          z-index: 1;
          top: 50%;
          left: 13px;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--color-text-secondary);
        }

        .money-input,
        .modern-input.with-icon {
          padding-left: 38px;
        }

        .helper-text {
          display: block;
          margin-top: 6px;
          color: var(--color-info-fg);
          font-size: 0.6875rem;
          font-weight: 600;
        }

        .results-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          color: var(--color-accent);
        }

        .results-heading h3 {
          color: var(--color-text);
        }

        .savings-list {
          overflow: hidden;
          border-block: 1px solid var(--color-border);
        }

        .savings-row {
          display: flex;
          min-height: 48px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 2px;
          border-bottom: 1px solid var(--color-border-light);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
        }

        .savings-row:last-child {
          border-bottom: 0;
        }

        .savings-row.featured {
          color: var(--color-success-fg);
        }

        .savings-row span {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 6px;
          font-weight: 700;
        }

        .savings-row small {
          padding: 3px 5px;
          border-radius: 4px;
          background: var(--color-success-bg);
          font-size: 0.5625rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .savings-row strong {
          text-align: right;
          color: var(--color-text);
          font-size: 0.8125rem;
          overflow-wrap: normal;
          white-space: nowrap;
        }

        .featured strong {
          color: var(--color-success-fg);
        }

        .empty-state {
          display: flex;
          min-height: 116px;
          align-items: center;
          gap: 10px;
          border-block: 1px dashed var(--color-border);
          color: var(--color-accent);
        }

        .empty-state div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .empty-state strong {
          color: var(--color-text);
          font-size: 0.8125rem;
        }

        .empty-state span,
        .reminder-note {
          color: var(--color-text-secondary);
          font-size: 0.75rem;
        }

        .reminder-note {
          display: flex;
          width: 100%;
          min-height: 44px;
          align-items: center;
          gap: 7px;
          margin-top: 8px;
        }

        .reminder-action {
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          font: inherit;
          text-align: left;
        }

        .reminder-action span {
          flex: 1;
        }

        .reminder-action:hover {
          color: var(--color-accent-dark);
        }

        .reminder-action:focus-visible {
          border-radius: 4px;
          outline: 2px solid var(--color-focus-ring);
          outline-offset: 2px;
        }

        .reminder-note :global(svg) {
          flex: 0 0 auto;
          color: var(--color-accent);
        }

        @media (max-width: 360px) {
          .savings-row small {
            display: none;
          }
        }

        @media (min-width: 640px) {
          .budget-planner {
            gap: 20px;
          }

          .overview-header,
          .workspace-header,
          .target-controls,
          .savings-results {
            padding: 20px;
          }

          .title-lockup p {
            display: block;
          }

          .metric-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .metric {
            padding: 16px;
          }

          .metric:nth-child(n) {
            border-bottom: 0;
          }

          .metric:not(:last-child) {
            border-right: 1px solid var(--color-border-light);
          }

          .metric-value {
            font-size: 1rem;
          }

          .progress-track {
            margin-inline: 20px;
          }

          .progress-caption {
            padding-inline: 20px;
            padding-bottom: 20px;
          }

          .target-readout strong {
            max-width: none;
            font-size: 1.0625rem;
          }

          .field-grid.has-custom {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          }
        }

        @media (min-width: 900px) {
          .workspace-grid {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
          }

          .savings-results {
            border-top: 0;
            border-left: 1px solid var(--color-border-light);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .progress-fill,
          .toggle-btn,
          .modern-input {
            transition: none;
          }

          .animate-in {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
