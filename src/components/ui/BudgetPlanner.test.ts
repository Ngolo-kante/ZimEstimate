import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

// Exercise the planner's event handlers without a browser or extra packages.
const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useMemo: (calculate: () => unknown) => calculate(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (value: unknown) => { state.values[index] = value; }];
  },
}));
vi.mock('./CurrencyToggle', () => ({ useCurrency: () => ({ exchangeRate: 1, formatPrice: String }) }));
import BudgetPlanner from './BudgetPlanner';

function find(node: ReactNode, id: string): ReactElement<Record<string, unknown>> | undefined {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) { const match = find(child, id); if (match) return match; }
    return;
  }
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props?.id === id) return element;
  return find(element.props?.children as ReactNode, id);
}

const render = (props: Parameters<typeof BudgetPlanner>[0]) => {
  state.cursor = 0;
  return BudgetPlanner(props);
};

beforeEach(() => { state.values = []; state.cursor = 0; });

describe('budget saved values', () => {
  it('restores a saved custom target on a fresh mount', () => {
    const props = { estimateUsd: 32914.79, savingsMode: 'custom' as const, savingsCustomUsd: 15000 };
    expect(find(render(props), 'budget-target-amount')?.props.value).toBe('15000');
    state.values = []; // Returning to the view or reloading mounts a new planner.
    expect(find(render(props), 'budget-target-amount')?.props.value).toBe('15000');
  });

  it.each([false, 'throw'])('restores the saved date when persistence fails (%s)', async (failure) => {
    const props = {
      estimateUsd: 1000, targetDate: '2026-12-01',
      onTargetDateChange: vi.fn(async () => { if (failure === 'throw') throw new Error('offline'); return false; }),
    };
    const input = find(render(props), 'budget-target-date')!;
    await (input.props.onChange as (event: unknown) => Promise<void>)({ target: { value: '2026-12-20' } });
    expect(props.onTargetDateChange).toHaveBeenCalledWith('2026-12-20');
    await vi.waitFor(() => expect(find(render(props), 'budget-target-date')?.props.value).toBe('2026-12-01'));
    expect(state.values).toContain('failed');
  });
});
