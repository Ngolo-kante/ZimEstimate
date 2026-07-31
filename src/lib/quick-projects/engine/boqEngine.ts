// ─── BOQ Engine — Step Navigation & Conditional Logic ─────────────────────────
// Handles: active steps, "not sure" branching, answer updates, completion check.

import type { Answers, BOQItem, LaborConfig, Question, QuestionFlow, WizardStep } from './types';

// ─── Step Helpers ─────────────────────────────────────────────────────────────

/** Returns only the steps whose conditions pass for the current answers. */
export function getActiveSteps(flow: QuestionFlow, answers: Answers): WizardStep[] {
  return flow.steps.filter((s) => !s.condition || s.condition(answers));
}

/** Returns only the questions in a step that should be shown (condition passes). */
export function getVisibleQuestions(
  step: WizardStep,
  answers: Answers,
  notSureIds: Set<string>
): Question[] {
  const result: Question[] = [];
  for (const q of step.questions) {
    if (q.condition && !q.condition(answers)) continue;
    result.push(q);
    // If "not sure" was selected and follow-up questions exist, inject them
    if (notSureIds.has(q.id) && q.notSureFollowUp) {
      for (const fq of q.notSureFollowUp) {
        if (!fq.condition || fq.condition(answers)) {
          result.push(fq);
        }
      }
    }
  }
  return result;
}

// ─── Answer Handling ──────────────────────────────────────────────────────────

/** Returns true if the user chose the "not_sure" sentinel value. */
export function isNotSure(value: unknown): boolean {
  return value === 'not_sure';
}

/** Updates answers, clearing child answers when a parent answer changes. */
export function updateAnswer(
  answers: Answers,
  questionId: string,
  value: unknown
): Answers {
  return { ...answers, [questionId]: value };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Checks whether all required visible questions on a step have answers. */
export function isStepComplete(
  step: WizardStep,
  answers: Answers,
  notSureIds: Set<string>
): boolean {
  const visible = getVisibleQuestions(step, answers, notSureIds);
  return visible
    .filter((q) => q.required !== false)
    .every((q) => {
      const val = answers[q.id];

      // A question carrying a defaultValue is already answered, whether or not
      // the user touched it. Toggles render Boolean(val ?? defaultValue), so a
      // default of false shows a perfectly valid "No" while the stored answer
      // stays undefined — pressing Continue then failed validation on a
      // question the user could see was answered.
      if (val === undefined && q.defaultValue !== undefined) return true;

      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val)) return val.length > 0;
      return true;
    });
}

/**
 * Fill in any unanswered question that declares a defaultValue.
 *
 * Defaults were only ever applied at render time, so an untouched control
 * displayed its default but passed `undefined` to calculateBOQ. Seeding them
 * into the answers keeps what the user was shown and what gets costed in step.
 * Returns the same object when there is nothing to add, so it is safe to call
 * from an effect without causing a render loop.
 */
export function applyDefaultAnswers(
  steps: WizardStep[],
  answers: Answers,
  notSureIds: Set<string>
): Answers {
  let next = answers;

  steps.forEach((step) => {
    getVisibleQuestions(step, next, notSureIds).forEach((q) => {
      if (q.defaultValue === undefined) return;
      if (next[q.id] !== undefined) return;
      next = updateAnswer(next, q.id, q.defaultValue);
    });
  });

  return next;
}

// ─── BOQ Calculation Helpers ──────────────────────────────────────────────────

/**
 * Calculates the labor line item(s) from a LaborConfig and materials total.
 * Returns BOQ items ready to append to the main item list.
 */
export function calculateLaborItems(
  labor: LaborConfig,
  materialsTotalUsd: number
): BOQItem[] {
  if (!labor.enabled) return [];

  if (labor.method === 'percentage') {
    const pct = (labor.percentage ?? 25) / 100;
    const total = materialsTotalUsd * pct;
    return [
      {
        id: 'labor_total',
        category: 'Labor',
        description: `Labor (${labor.percentage ?? 25}% of materials)`,
        quantity: 1,
        unit: 'lump sum',
        unitCostUsd: total,
        totalCostUsd: total,
        included: true,
        owned: false,
        optional: true,
      },
    ];
  }

  // daily_rate method
  const rate = labor.dailyRateUsd ?? 35;
  const days = labor.days ?? 5;
  const workers = labor.workerCount ?? 2;
  const total = rate * days * workers;
  return [
    {
      id: 'labor_total',
      category: 'Labor',
      description: `Labor — ${workers} builder${workers > 1 ? 's' : ''} × ${days} days @ $${rate}/day`,
      quantity: days * workers,
      unit: 'man-days',
      unitCostUsd: rate,
      totalCostUsd: total,
      included: true,
      owned: false,
      optional: true,
    },
  ];
}

/**
 * Calculates the grand total of a BOQ (materials + optional included items)
 * applying contractor markup.
 */
export function calculateGrandTotal(
  items: BOQItem[],
  markupPct: number,
  currency: 'USD' | 'ZWG',
  zwgRate = 27
): { subtotalUsd: number; markupUsd: number; grandTotalUsd: number; grandTotalDisplay: number } {
  const subtotalUsd = items
    .filter((i) => i.included && !i.owned)
    .reduce((sum, i) => sum + i.totalCostUsd, 0);

  const markupUsd = subtotalUsd * ((markupPct ?? 0) / 100);
  const grandTotalUsd = subtotalUsd + markupUsd;
  const grandTotalDisplay = currency === 'ZWG' ? grandTotalUsd * zwgRate : grandTotalUsd;

  return { subtotalUsd, markupUsd, grandTotalUsd, grandTotalDisplay };
}

/** Groups BOQ items by category for table rendering. */
export function groupByCategory(items: BOQItem[]): Record<string, BOQItem[]> {
  return items.reduce<Record<string, BOQItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
}
