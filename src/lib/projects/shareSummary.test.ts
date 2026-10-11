import { describe, expect, it } from 'vitest';
import { projectShareSummary } from './shareSummary';

const item = (category: string, total_usd: number | null, quantity = 1, unit_price_usd = 0) => ({ category, total_usd, quantity, unit_price_usd });

describe('the summary sent with a shared project', () => {
  it('totals the BOQ and breaks it down by stage, in build order', () => {
    const text = projectShareSummary({ name: 'Hararegg', location: 'Urban - Harare' }, [
      item('roofing', 1500), item('substructure', 4200.4), item('substructure', 800), item('superstructure', 6000),
    ]);
    expect(text).toContain('Hararegg — Urban - Harare');
    expect(text).toContain('Estimated cost: $12,500 (4 BOQ items)');
    expect(text.indexOf('Foundations: $5,000')).toBeLessThan(text.indexOf('Walls: $6,000'));
    expect(text.indexOf('Walls')).toBeLessThan(text.indexOf('Roofing: $1,500'));
  });

  it('works out a line from quantity and price when its total is missing', () => {
    expect(projectShareSummary({ name: 'A', location: null }, [item('substructure', null, 10, 12.5)])).toContain('Estimated cost: $125 (1 BOQ item)');
  });

  it('skips the breakdown for a single stage and says when there is nothing yet', () => {
    expect(projectShareSummary({ name: 'A', location: null }, [item('roofing', 100)])).not.toContain('•');
    expect(projectShareSummary({ name: 'A', location: null }, [])).toContain('No BOQ items yet.');
  });
});
