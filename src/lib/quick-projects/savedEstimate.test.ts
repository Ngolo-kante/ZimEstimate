import { describe, expect, it } from 'vitest';
import {
  estimateName,
  isShareToken,
  quickEstimateTotal,
  summariseSavedEstimate,
  toSharedQuickEstimate,
} from './savedEstimate';
import type { BOQItem } from './engine/types';

const item = (over: Partial<BOQItem>): BOQItem => ({
  id: 'x',
  category: 'Materials',
  description: 'Item',
  quantity: 1,
  unit: 'ea',
  unitCostUsd: 100,
  totalCostUsd: 100,
  included: true,
  owned: false,
  optional: false,
  ...over,
});

const ROW = {
  project_type: 'borehole',
  answers: { project_name: "Mum's borehole", project_location: 'bulawayo' },
  boq_items: [
    item({ id: 'a', totalCostUsd: 1200 }),
    item({ id: 'b', totalCostUsd: 300, owned: true }),
    item({ id: 'c', totalCostUsd: 50, included: false }),
  ],
  labor_enabled: true,
  labor_method: 'percentage',
  labor_value: 20,
  labor_days: null,
  labor_workers: null,
  markup_pct: 0,
  currency: 'USD',
  updated_at: '2026-10-11T10:00:00Z',
};

describe('a shared saved estimate', () => {
  it('reads what the database function returns', () => {
    const estimate = toSharedQuickEstimate(ROW);
    expect(estimate?.projectType).toBe('borehole');
    expect(estimate?.labor).toMatchObject({ enabled: true, method: 'percentage', percentage: 20 });
    expect(estimate?.boqItems).toHaveLength(3);
  });

  it('treats a missing or malformed answer as not found, not a crash', () => {
    expect(toSharedQuickEstimate(null)).toBeNull();
    expect(toSharedQuickEstimate('nope')).toBeNull();
    expect(toSharedQuickEstimate({})).toBeNull();
  });

  it('totals the same way the owner sees it: included items they do not already own', () => {
    // The shared page and the owner's page must never show different totals.
    expect(quickEstimateTotal(ROW.boq_items)).toBe(1200);
  });

  it("uses the owner's name for it, or a plain one", () => {
    expect(estimateName('borehole', ROW.answers)).toBe("Mum's borehole");
    expect(estimateName('solar', {})).toBe('Solar estimate');
    expect(estimateName('solar', { project_name: '   ' })).toBe('Solar estimate');
  });

  it('previews with the total and the count of items actually priced', () => {
    const summary = summariseSavedEstimate(toSharedQuickEstimate(ROW)!);
    expect(summary.headline).toBe("Mum's borehole");
    expect(summary.lines).toEqual(['Materials: $1,200', '1 item · priced for Zimbabwe']);
  });

  it('only accepts well-formed tokens, so a mangled link never reaches the database', () => {
    expect(isShareToken('3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b')).toBe(true);
    for (const bad of ['', 'abc', '3f2b8c1e-9a4d-4e6f-8b2a', "x' or 1=1 --"]) {
      expect(isShareToken(bad), bad).toBe(false);
    }
  });
});
