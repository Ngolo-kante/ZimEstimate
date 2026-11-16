import { describe, expect, it } from 'vitest';
import { quantityInputValue } from './quantityInput';
import { formatQuantity } from './format';

describe('computed quantities', () => {
  it('removes the October septic quantity tail in input and display values', () => {
    const quantity = 2.4 * 3;
    expect(quantityInputValue(quantity)).toBe('7.2');
    expect(formatQuantity(quantity)).toBe('7.2');
  });
  it('keeps up to four decimal places without grouping input values', () => {
    expect(quantityInputValue(12345.123456)).toBe('12345.1235');
    expect(quantityInputValue(0.0001)).toBe('0.0001');
    expect(quantityInputValue(0.1 + 0.2 + 1)).toBe('1.3');
    expect(quantityInputValue(Infinity)).toBe('');
  });
});
