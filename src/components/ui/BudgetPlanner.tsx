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
import { projectMoney, savingsPace, type SavingsPeriod } from '@/lib/projects/budgetMath';

// Email and WhatsApp first: what people in Zimbabwe actually use. Telegram
// was offered but is set aside for now (its bot routes in /api/telegram are
// kept, unused, for if it returns).
export type NotificationChannel = 'email' | 'whatsapp' | 'sms';

interface BudgetPlannerProps {
  /** What the BOQ adds up to. */
  estimateUsd: number;
  /** What the owner says they can spend; null when not set. */
  limitUsd?: number | null;
  amountSpentUsd?: number;
  targetDate?: string | null;
  /** Resolves false when the date could not be saved, so it is rolled back. */
  onTargetDateChange?: (date: string) => Promise<boolean> | boolean;
  onLimitChange?: (limitUsd: number | null) => Promise<boolean> | boolean;
  savingsMode?: PlanMode;
  savingsCustomUsd?: number | null;
  onSavingsTargetChange?: (mode: PlanMode, customUsd: number | null) => Promise<boolean> | boolean;
  /** Opens reminder setup with this plan's recommended amount filled in. */
  onSetReminder?: (plan: { amountUsd: number; frequency: SavingsPeriod }) => void;
  criticalItemsUsd?: number;
}

export type PlanMode = 'remaining' | 'critical' | 'custom';
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const PERIOD_LABEL: Record<SavingsPeriod, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function BudgetPlanner({
  estimateUsd,
  limitUsd = null,
  amountSpentUsd = 0,
  targetDate,
  onTargetDateChange,
  onLimitChange,
  savingsMode = 'remaining',
  savingsCustomUsd = null,
  onSavingsTargetChange,
  onSetReminder,
  criticalItemsUsd = 0,
}: BudgetPlannerProps) {
  const { exchangeRate, formatPrice } = useCurrency();
  // Seeded from the project, so leaving Budget and coming back (or
  // reloading) shows the target that was chosen, not the default.
  const [planMode, setPlanMode] = useState<PlanMode>(savingsMode);
  const [customAmount, setCustomAmount] = useState(savingsCustomUsd ? String(savingsCustomUsd) : '');
  const [localTargetDate, setLocalTargetDate] = useState(targetDate || '');
  const [targetSave, setTargetSave] = useState<SaveState>('idle');
  const [dateSave, setDateSave] = useState<SaveState>('idle');
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState(limitUsd ? String(limitUsd) : '');
  const [limitSave, setLimitSave] = useState<SaveState>('idle');

  const m = projectMoney({ estimateUsd, limitUsd, spentUsd: amountSpentUsd });
  const isOverBudget = m.overspentUsd > 0;
  const estimateOverLimit = m.estimateOverLimitUsd > 0;
  const percentSpent = m.budgetUsd > 0 ? (m.spentUsd / m.budgetUsd) * 100 : 0;
  const displayedProgress = Math.min(100, Math.max(0, percentSpent));
  const hasEstimate = m.estimateUsd > 0;

  const targetAmount = useMemo(() => {
    switch (planMode) {
      case 'critical':
        return criticalItemsUsd;
      case 'custom':
        return parseFloat(customAmount) || 0;
      default:
        return m.stillToFundUsd;
    }
  }, [planMode, criticalItemsUsd, customAmount, m.stillToFundUsd]);

  const daysUntilTarget = useMemo(() => {
    if (!localTargetDate) return 0;
    // Calendar days, so a date of tomorrow reads "1 day" whatever the hour.
    const target = new Date(`${localTargetDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }, [localTargetDate]);

  const pace = savingsPace(targetAmount, daysUntilTarget);
  const recommendedAmount = pace
    ? pace.recommended === 'monthly' ? pace.perMonth! : pace.recommended === 'weekly' ? pace.perWeek! : pace.perDay
    : 0;

  const emptyPlanCopy = useMemo(() => {
    if (!hasEstimate && planMode !== 'custom') {
      return { title: 'Add BOQ items to calculate a plan', detail: 'The savings target uses your project BOQ total, or set a custom amount.' };
    }
    if (!localTargetDate) {
      return { title: 'Choose a target date', detail: 'How much to set aside each day, week or month will appear here.' };
    }
    if (daysUntilTarget <= 0) {
      return { title: 'Choose a future target date', detail: 'The savings pace needs at least one day.' };
    }
    return { title: 'Nothing left to fund', detail: 'Choose a custom amount to plan savings for.' };
  }, [daysUntilTarget, hasEstimate, localTargetDate, planMode]);

  const run = async (
    save: (() => Promise<boolean> | boolean) | undefined,
    setState: (s: SaveState) => void,
  ): Promise<boolean> => {
    if (!save) return true;
    setState('saving');
    const ok = await Promise.resolve(save()).catch(() => false);
    setState(ok ? 'saved' : 'failed');
    if (ok) window.setTimeout(() => setState('idle'), 2000);
    return ok;
  };

  const saveTarget = (mode: PlanMode, amount: string) => {
    const custom = mode === 'custom' && amount ? Math.max(0, parseFloat(amount) || 0) : null;
    void run(onSavingsTargetChange && (() => onSavingsTargetChange(mode, custom)), setTargetSave);
  };

  const chooseMode = (mode: PlanMode) => {
    setPlanMode(mode);
    saveTarget(mode, customAmount);
  };

  const handleDateChange = async (date: string) => {
    const previous = localTargetDate;
    setLocalTargetDate(date);
    const ok = await run(onTargetDateChange && (() => onTargetDateChange(date)), setDateSave);
    // A date that did not save must not look saved.
    if (!ok) setLocalTargetDate(previous);
  };

  const saveLimit = async (clear = false) => {
    const value = clear ? null : Math.max(0, parseFloat(limitDraft) || 0) || null;
    const ok = await run(onLimitChange && (() => onLimitChange(value)), setLimitSave);
    if (ok) {
      setEditingLimit(false);
      setLimitDraft(value ? String(value) : '');
    }
  };

  const formatAmount = (amount: number) => formatPrice(amount, amount * exchangeRate);

  const status = isOverBudget
    ? { tone: 'status-warning', icon: <Warning size={16} weight="fill" />, text: `Over budget by ${formatAmount(m.overspentUsd)}` }
    : estimateOverLimit
      ? { tone: 'status-attention', icon: <Warning size={16} weight="fill" />, text: `Estimate is ${formatAmount(m.estimateOverLimitUsd)} over your limit` }
      : m.limitUsd !== null
        ? { tone: 'status-good', icon: <CheckCircle size={16} weight="fill" />, text: 'Within your limit' }
        : { tone: 'status-neutral', icon: <Wallet size={16} weight="fill" />, text: hasEstimate ? 'No budget limit set' : 'No budget yet' };

  const saveNote = (state: SaveState, onRetry: () => void) =>
    state === 'saving' ? <span className="save-note">Saving…</span>
      : state === 'saved' ? <span className="save-note ok">Saved</span>
        : state === 'failed' ? <span className="save-note bad">Not saved. <button type="button" onClick={onRetry}>Retry</button></span>
          : null;

  return (
    <div className="budget-planner">
      <section className={`budget-overview ${isOverBudget ? 'is-over' : ''}`} aria-labelledby="budget-position-title">
        <header className="overview-header">
          <div>
            <span className="eyebrow">Project budget</span>
            <h2 id="budget-position-title">Budget position</h2>
          </div>
          <span className={`status-badge ${status.tone}`}>
            {status.icon}
            {status.text}
          </span>
        </header>

        <div className="metric-grid">
          <div className="metric">
            <span className="metric-icon"><Wallet size={18} weight="duotone" /></span>
            <span className="metric-label">BOQ estimate</span>
            <strong className="metric-value">{formatAmount(m.estimateUsd)}</strong>
          </div>
          <div className="metric">
            <span className="metric-icon"><Target size={18} weight="duotone" /></span>
            <span className="metric-label">
              Your limit
              {onLimitChange && !editingLimit && (
                <button type="button" className="inline-edit" onClick={() => { setLimitDraft(m.limitUsd ? String(m.limitUsd) : ''); setEditingLimit(true); }}>
                  {m.limitUsd !== null ? 'Edit' : 'Set'}
                </button>
              )}
            </span>
            {editingLimit ? (
              <span className="limit-editor">
                <span className="money-input-wrapper">
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={limitDraft}
                    onChange={(e) => setLimitDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveLimit(); if (e.key === 'Escape') setEditingLimit(false); }}
                    className="modern-input money-input"
                    aria-label="Budget limit in US dollars"
                    autoFocus
                  />
                </span>
                <span className="limit-actions">
                  <button type="button" onClick={() => void saveLimit()}>Save</button>
                  {m.limitUsd !== null && <button type="button" onClick={() => void saveLimit(true)}>Clear</button>}
                  <button type="button" onClick={() => setEditingLimit(false)}>Cancel</button>
                </span>
                {saveNote(limitSave, () => void saveLimit())}
              </span>
            ) : (
              <strong className="metric-value">{m.limitUsd !== null ? formatAmount(m.limitUsd) : <span className="not-set">Not set</span>}</strong>
            )}
          </div>
          <div className="metric">
            <span className="metric-icon"><CurrencyDollar size={18} weight="duotone" /></span>
            <span className="metric-label">Spent</span>
            <strong className="metric-value">{formatAmount(m.spentUsd)}</strong>
          </div>
          <div className={`metric ${isOverBudget ? 'metric-warning' : 'metric-success'}`}>
            <span className="metric-icon"><TrendUp size={18} weight="duotone" /></span>
            <span className="metric-label">Still to fund</span>
            <strong className="metric-value">{formatAmount(m.stillToFundUsd)}</strong>
          </div>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-label={`Share of the ${m.basis === 'limit' ? 'budget limit' : 'BOQ estimate'} spent`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayedProgress)}
        >
          <div className="progress-fill" style={{ width: `${displayedProgress}%` }} />
        </div>
        <div className="progress-caption">
          <span>{formatAmount(m.spentUsd)} spent · {percentSpent.toFixed(0)}% of the {m.basis === 'limit' ? 'limit' : 'estimate'}</span>
          <span>{formatAmount(m.budgetUsd)} {m.basis === 'limit' ? 'limit' : 'estimate'}</span>
        </div>
      </section>

      <section className="savings-workspace" aria-labelledby="savings-plan-title">
        <header className="workspace-header">
          <div className="title-lockup">
            <span className="title-icon"><Target size={20} weight="duotone" /></span>
            <div>
              <h2 id="savings-plan-title">Savings target</h2>
              <p>Choose what to fund and when you need it. Your choice is saved.</p>
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
              <legend>What are you saving for? {saveNote(targetSave, () => saveTarget(planMode, customAmount))}</legend>
              <div className={`toggle-group ${criticalItemsUsd > 0 ? 'has-critical' : ''}`}>
                <button
                  type="button"
                  className={`toggle-btn ${planMode === 'remaining' ? 'active' : ''}`}
                  aria-pressed={planMode === 'remaining'}
                  onClick={() => chooseMode('remaining')}
                >
                  Still to fund
                </button>
                {criticalItemsUsd > 0 && (
                  <button
                    type="button"
                    className={`toggle-btn ${planMode === 'critical' ? 'active' : ''}`}
                    aria-pressed={planMode === 'critical'}
                    onClick={() => chooseMode('critical')}
                  >
                    Critical
                  </button>
                )}
                <button
                  type="button"
                  className={`toggle-btn ${planMode === 'custom' ? 'active' : ''}`}
                  aria-pressed={planMode === 'custom'}
                  onClick={() => chooseMode('custom')}
                >
                  Custom
                </button>
              </div>
            </fieldset>

            <div className={`field-grid ${planMode === 'custom' ? 'has-custom' : ''}`}>
              {planMode === 'custom' && (
                <div className="input-group animate-in">
                  <label htmlFor="budget-target-amount">Target amount (US$)</label>
                  <div className="money-input-wrapper">
                    <span aria-hidden="true">$</span>
                    <input
                      id="budget-target-amount"
                      type="number"
                      inputMode="decimal"
                      value={customAmount}
                      onChange={(event) => setCustomAmount(event.target.value)}
                      onBlur={() => saveTarget('custom', customAmount)}
                      onKeyDown={(event) => { if (event.key === 'Enter') saveTarget('custom', customAmount); }}
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
                    onChange={(event) => void handleDateChange(event.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="modern-input with-icon"
                    aria-describedby="budget-target-date-help"
                  />
                </div>
                <span className="helper-text" id="budget-target-date-help">
                  {dateSave === 'failed'
                    ? <span className="save-note bad">The date could not be saved, so it was put back. Try again.</span>
                    : daysUntilTarget > 0 ? `${daysUntilTarget} day${daysUntilTarget === 1 ? '' : 's'} to reach your target` : 'Select a future date'}
                  {dateSave === 'saving' && <span className="save-note"> · Saving…</span>}
                  {dateSave === 'saved' && <span className="save-note ok"> · Saved</span>}
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

            {pace ? (
              <>
                <div className="savings-list">
                  {(['daily', 'weekly', 'monthly'] as SavingsPeriod[]).map((period) => {
                    const amount = period === 'daily' ? pace.perDay : period === 'weekly' ? pace.perWeek : pace.perMonth;
                    if (amount === null) return null;
                    return (
                      <div key={period} className={`savings-row ${pace.recommended === period ? 'featured' : ''}`}>
                        <span>{PERIOD_LABEL[period]} {pace.recommended === period && <small>Recommended</small>}</span>
                        <strong>{formatAmount(amount)}</strong>
                      </div>
                    );
                  })}
                </div>
                {pace.perWeek === null && (
                  <p className="pace-note">The date is under a week away, so this is the daily amount to set aside.</p>
                )}
              </>
            ) : (
              <div className="empty-state">
                <CalendarBlank size={24} weight="duotone" aria-hidden="true" />
                <div>
                  <strong>{emptyPlanCopy.title}</strong>
                  <span>{emptyPlanCopy.detail}</span>
                </div>
              </div>
            )}

            {onSetReminder && pace ? (
              <button
                type="button"
                className="reminder-note reminder-action"
                onClick={() => onSetReminder({ amountUsd: recommendedAmount, frequency: pace.recommended })}
              >
                <BellSimple size={17} weight="duotone" aria-hidden="true" />
                <span>Remind me to save {formatAmount(recommendedAmount)} {pace.recommended === 'daily' ? 'a day' : pace.recommended === 'weekly' ? 'a week' : 'a month'}</span>
                <ArrowRight size={15} weight="bold" aria-hidden="true" />
              </button>
            ) : (
              <div className="reminder-note">
                <BellSimple size={17} weight="duotone" aria-hidden="true" />
                <span>Choose a target and date to set a savings reminder.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <style jsx>{`
        .budget-planner {
          container-type: inline-size;
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
          /* Whole figures: "$32,914.79" broke mid-number at tablet width. */
          white-space: nowrap;
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
          /* 16px: iOS zooms the page into anything smaller. */
          font-size: 1rem;
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
        .date-input-wrapper > :global(.input-icon) {
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

          .metric {
            padding: 16px;
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

        /* Four across only when the planner itself is wide enough — with the
           project sidebar open on a tablet it is far narrower than the screen. */
        @container (min-width: 720px) {
          .metric-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .metric:nth-child(n) {
            border-bottom: 0;
            border-right: 0;
          }

          .metric:not(:last-child) {
            border-right: 1px solid var(--color-border-light);
          }
        }

        .status-attention {
          color: #92400e;
          background: #fef3c7;
        }

        .inline-edit {
          margin-left: 6px;
          padding: 0;
          border: 0;
          background: none;
          color: var(--color-accent);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
        }

        .not-set {
          color: var(--color-text-secondary);
          font-family: var(--font-sans);
          font-weight: 600;
        }

        .limit-editor {
          display: grid;
          gap: 6px;
          margin-top: 6px;
        }

        .limit-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .limit-actions button,
        .save-note button {
          min-height: 32px;
          padding: 4px 10px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          background: var(--color-surface);
          color: var(--color-text);
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }

        .save-note {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .save-note.ok {
          color: var(--color-success);
        }

        .save-note.bad {
          color: var(--color-error, #b91c1c);
        }

        .pace-note {
          margin: 10px 0 0;
          font-size: 0.78rem;
          color: var(--color-text-secondary);
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
