import { describe, expect, it } from 'vitest';
import { quickCostGroup, quickCostSlices } from './costSplit';

describe('quick estimate cost split', () => {
  it('keeps permits, professional services, transport and contingency apart from materials', () => {
    expect(quickCostGroup('Permits & Compliance')).toBe('permits');
    expect(quickCostGroup('Professional Services')).toBe('professional');
    expect(quickCostGroup('Transport & Logistics')).toBe('transport');
    expect(quickCostGroup('Contingency')).toBe('contingency');
    expect(quickCostGroup('Labor')).toBe('labour');
    expect(quickCostGroup('Drilling')).toBe('materials');
  });

  it('counts only lines the total counts', () => {
    const slices = quickCostSlices([
      { category: 'Pipework', totalCostUsd: 100 },
      { category: 'Pump', totalCostUsd: 50, owned: true },
      { category: 'Tank', totalCostUsd: 70, included: false },
      { category: 'Permits & Compliance', totalCostUsd: 30 },
      { category: 'Labor', totalCostUsd: 25 },
    ]);
    const value = (label: string) => slices.find((slice) => slice.label === label)?.value;
    expect(value('Materials & works')).toBe(100);
    expect(value('Permits & compliance')).toBe(30);
    expect(value('Labour')).toBe(25);
    expect(value('Contingency')).toBe(0);
  });
});
