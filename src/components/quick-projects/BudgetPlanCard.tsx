'use client';

// ─── Saving toward a quick project ────────────────────────────────────────────
// "Some may create a project to do in three months and need to budget their
// funds towards it." This answers "can I afford it by then?", which is the
// question people have while the estimate is still an estimate — as opposed to
// budget-vs-actual, which only means something once money has been spent.

import { useState } from 'react';
import { CalendarBlank, PiggyBank, Check, Warning } from '@phosphor-icons/react';
import { buildBudgetPlan } from '@/lib/quick-projects/budgetPlan';

interface BudgetPlanCardProps {
  totalUsd: number;
  targetDate: string | null;
  fundsSavedUsd: number;
  onSave: (patch: { targetDate: string | null; fundsSavedUsd: number }) => Promise<void>;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function BudgetPlanCard({
  totalUsd,
  targetDate,
  fundsSavedUsd,
  onSave,
}: BudgetPlanCardProps) {
  const [editing, setEditing] = useState(false);
  const [dateDraft, setDateDraft] = useState(targetDate ?? '');
  const [savedDraft, setSavedDraft] = useState(String(fundsSavedUsd || ''));
  const [busy, setBusy] = useState(false);

  // `today` is injected rather than read inside buildBudgetPlan so the maths
  // stays pure and testable.
  const plan = buildBudgetPlan({
    totalUsd,
    savedUsd: fundsSavedUsd,
    targetDate,
    today: new Date(),
  });

  async function commit() {
    setBusy(true);
    await onSave({
      targetDate: dateDraft || null,
      fundsSavedUsd: Math.max(0, Number(savedDraft) || 0),
    });
    setBusy(false);
    setEditing(false);
  }

  const hasPlan = targetDate !== null || fundsSavedUsd > 0;

  return (
    <section className="plan-card">
      <header className="plan-head">
        <h2><PiggyBank size={18} weight="duotone" /> Budget plan</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="link-btn">
            {hasPlan ? 'Update' : 'Set a target'}
          </button>
        )}
      </header>

      {editing ? (
        <div className="edit-grid">
          <label>
            <span>Target date</span>
            <input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
          </label>
          <label>
            <span>Saved so far (USD)</span>
            <input
              type="number" min="0" step="1" inputMode="decimal"
              value={savedDraft}
              onChange={(e) => setSavedDraft(e.target.value)}
              placeholder="0"
            />
          </label>
          <div className="edit-actions">
            <button type="button" onClick={() => void commit()} disabled={busy} className="primary">
              {busy ? 'Saving…' : 'Save plan'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setDateDraft(targetDate ?? ''); setSavedDraft(String(fundsSavedUsd || '')); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : !hasPlan ? (
        <p className="empty">
          Planning this for later? Set a date and we&rsquo;ll work out what to put aside each month.
        </p>
      ) : (
        <>
          <div className="bar" role="progressbar" aria-valuenow={plan.percentFunded} aria-valuemin={0} aria-valuemax={100}>
            <div className="fill" style={{ width: `${plan.percentFunded}%` }} />
          </div>
          <p className="progress-line">
            <strong>{money(plan.savedUsd)}</strong> of {money(plan.totalUsd)} &middot; {plan.percentFunded}% funded
          </p>

          {plan.fullyFunded ? (
            <p className="status good"><Check size={16} weight="bold" /> Fully funded — you have what this costs.</p>
          ) : plan.overdue ? (
            <p className="status warn">
              <Warning size={16} weight="fill" />
              Target date has passed with {money(plan.remainingUsd)} still to raise.
            </p>
          ) : plan.monthlyRequiredUsd !== null ? (
            <p className="status">
              <CalendarBlank size={16} weight="duotone" />
              {plan.monthsRemaining === 0
                ? `Due this month — ${money(plan.remainingUsd)} left to raise.`
                : `Put aside ${money(plan.monthlyRequiredUsd)} a month for ${plan.monthsRemaining} month${plan.monthsRemaining === 1 ? '' : 's'}.`}
            </p>
          ) : (
            <p className="status">{money(plan.remainingUsd)} still to raise. Add a date for a monthly figure.</p>
          )}
        </>
      )}

      <style jsx>{`
        .plan-card {
          border: 1px solid var(--color-border); border-radius: 12px;
          background: var(--color-surface); padding: 20px; margin-bottom: 16px;
        }
        .plan-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .plan-head h2 {
          display: inline-flex; align-items: center; gap: 8px; margin: 0;
          font-size: 1rem; font-weight: 700; color: var(--color-text);
        }
        .link-btn {
          background: none; border: none; cursor: pointer; padding: 0;
          font-size: 0.85rem; font-weight: 600; color: var(--color-accent);
        }
        .empty { margin: 0; font-size: 0.875rem; color: var(--color-text-secondary); }
        .bar { height: 8px; border-radius: 999px; background: var(--color-background); overflow: hidden; }
        .fill { height: 100%; background: var(--color-accent); transition: width 0.3s ease; }
        .progress-line { margin: 10px 0 0; font-size: 0.9rem; color: var(--color-text-secondary); }
        .progress-line strong { color: var(--color-text); }
        .status {
          display: flex; align-items: center; gap: 6px; margin: 10px 0 0;
          font-size: 0.875rem; color: var(--color-text-secondary);
        }
        .status.good { color: var(--color-success); font-weight: 600; }
        .status.warn { color: var(--color-warning); font-weight: 600; }

        .edit-grid { display: grid; gap: 12px; }
        .edit-grid label { display: grid; gap: 5px; font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); }
        .edit-grid input {
          padding: 9px 11px; border: 1px solid var(--color-border); border-radius: 8px;
          background: var(--color-surface); color: var(--color-text); font-size: 0.9rem;
          /* iOS zooms the page when a focused input is under 16px. */
          font-size: max(0.9rem, 16px);
        }
        .edit-actions { display: flex; gap: 8px; }
        .edit-actions button {
          padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600;
          border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text);
        }
        .edit-actions .primary { background: var(--color-accent); border-color: var(--color-accent); color: #fff; }
        .edit-actions button:disabled { opacity: 0.6; cursor: default; }

        @media (min-width: 520px) {
          .edit-grid { grid-template-columns: 1fr 1fr; align-items: end; }
          .edit-actions { grid-column: 1 / -1; }
        }
      `}</style>
    </section>
  );
}
