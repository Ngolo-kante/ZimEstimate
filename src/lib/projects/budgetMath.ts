/**
 * The money words used across a project — Overview, Budget and Insights —
 * computed in one place so the same word always means the same amount.
 *
 * - BOQ estimate: what the bill of quantities adds up to.
 * - Budget limit: what the owner says they can spend (optional).
 * - Budget: the limit when one is set, otherwise the estimate. This is the
 *   rule Overview, the KPI panel and Insights already used; the Budget page
 *   used the estimate alone, so a project with a limit showed two different
 *   "budgets" a click apart.
 * - Still to fund: estimate minus what has been spent.
 */

export interface ProjectMoneyInput {
  estimateUsd: number;
  limitUsd: number | null | undefined;
  spentUsd: number;
}

export interface ProjectMoney {
  estimateUsd: number;
  limitUsd: number | null;
  spentUsd: number;
  budgetUsd: number;
  basis: 'limit' | 'estimate';
  stillToFundUsd: number;
  /** Spent beyond the budget (limit or estimate). */
  overspentUsd: number;
  /** How far the estimate already exceeds the limit, before any spending. */
  estimateOverLimitUsd: number;
}

const money = (n: unknown) => {
  const value = Number(n);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export function projectMoney({ estimateUsd, limitUsd, spentUsd }: ProjectMoneyInput): ProjectMoney {
  const estimate = money(estimateUsd);
  const spent = money(spentUsd);
  const limit = limitUsd !== null && limitUsd !== undefined && money(limitUsd) > 0 ? money(limitUsd) : null;
  const budget = limit ?? estimate;
  return {
    estimateUsd: estimate,
    limitUsd: limit,
    spentUsd: spent,
    budgetUsd: budget,
    basis: limit === null ? 'estimate' : 'limit',
    stillToFundUsd: Math.max(0, estimate - spent),
    overspentUsd: budget > 0 ? Math.max(0, spent - budget) : 0,
    estimateOverLimitUsd: limit === null ? 0 : Math.max(0, estimate - limit),
  };
}

export type SavingsPeriod = 'daily' | 'weekly' | 'monthly';

export interface SavingsPace {
  perDay: number;
  /** Null when the deadline is less than a week away: there is no "weekly". */
  perWeek: number | null;
  /** Null when the deadline is less than a month away. */
  perMonth: number | null;
  recommended: SavingsPeriod;
}

/**
 * How much to set aside per contribution to reach a target by a deadline.
 *
 * Each amount is the target divided by the number of contributions of that
 * kind that fit before the deadline (rounded up), so none can exceed the
 * target. The old pace multiplied the daily figure by 7 and 30, so a target
 * due tomorrow recommended a weekly amount seven times the whole target.
 */
export function savingsPace(targetUsd: number, daysUntil: number): SavingsPace | null {
  const target = money(targetUsd);
  const days = Math.floor(Number(daysUntil));
  if (target <= 0 || !Number.isFinite(days) || days <= 0) return null;

  const perDay = target / days;
  const perWeek = days >= 7 ? target / Math.ceil(days / 7) : null;
  const perMonth = days >= 30 ? target / Math.ceil(days / 30) : null;
  // Weekly is the habit most people keep, once there are at least two weeks
  // to spread it over; monthly when it is months away; daily otherwise.
  const recommended: SavingsPeriod = days >= 120 ? 'monthly' : days >= 14 ? 'weekly' : 'daily';
  return { perDay, perWeek, perMonth, recommended };
}
