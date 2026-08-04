// ─── Saving toward a quick project ────────────────────────────────────────────
// A quick estimate is often a plan for later, not a job starting tomorrow —
// "I want this borehole in March, what do I need to put aside each month?"
//
// Deliberately forward-looking. Budget-vs-actual answers "what did it cost?",
// which only has meaning once money has been spent; this answers "can I afford
// it by then?", which is the question people have while the estimate is still
// an estimate.

export interface BudgetPlanInput {
  /** Total the estimate says the job costs. */
  totalUsd: number;
  /** What the user has put aside so far. */
  savedUsd: number;
  /** ISO date they want it done by, if they have set one. */
  targetDate: string | null;
  /** Injected so this stays pure and testable — no clock inside. */
  today: Date;
}

export interface BudgetPlan {
  totalUsd: number;
  savedUsd: number;
  remainingUsd: number;
  /** 0–100, clamped. 100 once funded, even if they oversaved. */
  percentFunded: number;
  fullyFunded: boolean;
  /** Whole months from today to the target, floored at 0. Null with no target. */
  monthsRemaining: number | null;
  /** What to set aside each month to arrive funded. Null with no target. */
  monthlyRequiredUsd: number | null;
  /** True when the date has passed and the money is not there. */
  overdue: boolean;
}

/** Whole months between two dates, not counting a partial month. */
function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Pull back a month when the day-of-month has not come round yet, so a plan
  // made on the 30th for the 1st of next month is not sold as a full month.
  return to.getDate() >= from.getDate() ? months : months - 1;
}

export function buildBudgetPlan({
  totalUsd,
  savedUsd,
  targetDate,
  today,
}: BudgetPlanInput): BudgetPlan {
  const total = Math.max(0, totalUsd);
  const saved = Math.max(0, savedUsd);
  const remaining = Math.max(0, total - saved);
  const fullyFunded = remaining === 0 && total > 0;

  const percentFunded = total === 0 ? 0 : Math.min(100, Math.round((saved / total) * 100));

  let monthsRemaining: number | null = null;
  let monthlyRequiredUsd: number | null = null;
  let overdue = false;

  if (targetDate) {
    const target = new Date(targetDate);
    if (!Number.isNaN(target.getTime())) {
      monthsRemaining = Math.max(0, monthsBetween(today, target));
      overdue = target.getTime() < today.getTime() && !fullyFunded;

      // With nothing left to raise there is nothing to ask for each month.
      // Without that guard a funded plan still displayed a monthly figure.
      monthlyRequiredUsd = remaining === 0
        ? 0
        : monthsRemaining === 0
          // Due this month, or already late: the whole remainder is the ask.
          ? remaining
          : Math.ceil(remaining / monthsRemaining);
    }
  }

  return {
    totalUsd: total,
    savedUsd: saved,
    remainingUsd: remaining,
    percentFunded,
    fullyFunded,
    monthsRemaining,
    monthlyRequiredUsd,
    overdue,
  };
}
