import type { Answers, BOQItem } from '@/lib/quick-projects/engine/types';

/**
 * Answers "how much of this can I afford?" for any quick project whose cost is
 * driven by one number — metres of fencing, square metres of paving, litres of
 * storage.
 *
 * The house estimator already answers the budget question from the other
 * direction ("how far does my money carry a fixed build"), and solar and
 * borehole have bespoke explorers. The remaining types had none, even though
 * they are the ones where the question is most natural: a fence is whatever
 * length you can pay for.
 *
 * Nothing here knows any prices. It calls each project's own BOQ generator —
 * the same code the wizard uses — and searches for the largest quantity whose
 * total fits. That means a price change anywhere flows through automatically,
 * and this file can never disagree with the wizard about what something costs.
 */

export interface QuantityFitInput {
  budgetUsd: number;
  /** Builds the project's answers for a candidate quantity. */
  answersFor: (quantity: number) => Answers;
  /** The project's own BOQ generator, used unmodified. */
  generate: (answers: Answers) => BOQItem[];
  /** Smallest sensible job, and the largest worth offering. */
  min: number;
  max: number;
  /** Quantities are rounded to this, so results are orderable in real life. */
  step?: number;
}

export interface QuantityFitResult {
  /** Largest quantity that fits the budget, or `min` when nothing fits. */
  quantity: number;
  totalUsd: number;
  items: BOQItem[];
  /** The budget cannot cover even the smallest job. */
  belowMinimum: boolean;
  /** The budget covers the largest job offered; the limit is the range, not the money. */
  atMaximum: boolean;
  /** What is left after the recommended quantity. */
  remainingUsd: number;
}

/** Only items the user has kept and does not already own are charged for. */
export function totalOf(items: BOQItem[]): number {
  return items.reduce(
    (sum, item) => (item.included !== false && !item.owned ? sum + (item.totalCostUsd || 0) : sum),
    0,
  );
}

export function fitQuantityToBudget(input: QuantityFitInput): QuantityFitResult {
  const { budgetUsd, answersFor, generate, min, max } = input;
  const step = input.step && input.step > 0 ? input.step : 1;

  const snap = (value: number) => Math.round(value / step) * step;
  const costAt = (quantity: number) => {
    const items = generate(answersFor(quantity));
    return { items, total: totalOf(items) };
  };

  const low = snap(Math.max(min, step));
  const high = snap(Math.max(low, max));

  const atLow = costAt(low);
  if (!Number.isFinite(budgetUsd) || budgetUsd < atLow.total) {
    // Returning the smallest real job rather than zero: "you cannot afford
    // anything" is less use than "the smallest fence is $X, you have $Y".
    return {
      quantity: low,
      totalUsd: atLow.total,
      items: atLow.items,
      belowMinimum: true,
      atMaximum: false,
      remainingUsd: budgetUsd - atLow.total,
    };
  }

  const atHigh = costAt(high);
  if (budgetUsd >= atHigh.total) {
    return {
      quantity: high,
      totalUsd: atHigh.total,
      items: atHigh.items,
      belowMinimum: false,
      atMaximum: true,
      remainingUsd: budgetUsd - atHigh.total,
    };
  }

  /* Bisect on quantity. Cost rises with quantity for every generator this is
     used with, so the largest affordable quantity is found in log2(range/step)
     generator calls — a few dozen at most, which is why this can run on every
     keystroke without debouncing. */
  let lo = low;
  let hi = high;
  let best = atLow;
  let bestQuantity = low;

  while (hi - lo > step) {
    const mid = snap(lo + (hi - lo) / 2);
    // Guard against a midpoint that snaps back onto a bound, which would spin.
    if (mid <= lo || mid >= hi) break;
    const candidate = costAt(mid);
    if (candidate.total <= budgetUsd) {
      best = candidate;
      bestQuantity = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return {
    quantity: bestQuantity,
    totalUsd: best.total,
    items: best.items,
    belowMinimum: false,
    atMaximum: false,
    remainingUsd: budgetUsd - best.total,
  };
}
