import { describe, expect, it } from 'vitest';
import { formatQuantity, formatUsd, truncateMiddle } from './format';

describe('shared number formats', () => {
    it.each([
        [0, '0', '$0.00'], [0.0875, '0.09', '$0.0875'], [0.5, '0.5', '$0.50'], [0.085, '0.09', '$0.085'],
        [22000, '22,000', '$22,000.00'], [1250000, '1,250,000', '$1,250,000.00'],
        [-1234, '-1,234', '-$1,234.00'], [NaN, '—', '—'], [null, '—', '—'], [undefined, '—', '—'],
    ])('formats %s consistently', (value, quantity, usd) => {
        expect(formatQuantity(value)).toBe(quantity);
        expect(formatUsd(value)).toBe(usd);
    });
    it('formats fractions, units and whole-dollar headlines', () => {
        expect(formatQuantity(12.5, 'kg')).toBe('12.5 kg');
        expect(formatQuantity(0.333333)).toBe('0.33');
        expect(formatQuantity(null, 'kg')).toBe('—');
        expect(formatUsd(13999)).toBe('$13,999.00');
        expect(formatUsd(16794)).toBe('$16,794.00');
        expect(formatUsd(13999.4, { wholeDollars: true })).toBe('$13,999');
    });
});

describe('truncateMiddle', () => {
    it('keeps the extension and both ends of a long filename', () => {
        const name = 'Approved_Structural_Engineering_Drawings_Revision_12_FINAL_final_signed_and_stamped_2026-09-05.pdf';
        const result = truncateMiddle(name, 64);
        expect(result).toHaveLength(64);
        expect(result.startsWith('Approved_Structural_')).toBe(true);
        expect(result.endsWith('stamped_2026-09-05.pdf')).toBe(true);
        expect(result).toContain('…');
        expect(truncateMiddle('plan.pdf', 64)).toBe('plan.pdf');
        expect(truncateMiddle(name, 1)).toBe('…');
        expect(truncateMiddle(name, 0)).toBe('');
    });
});

describe('compact money', () => {
    it('uses compact figures only from a million and preserves existing formats', () => {
        expect(formatUsd(1_284_750.55, { compact: true, wholeDollars: true })).toBe('$1.3M');
        expect(formatUsd(1_000_000, { compact: true })).toBe('$1M');
        expect(formatUsd(999_999, { compact: true, wholeDollars: true })).toBe('$999,999');
        expect(formatUsd(16_794, { compact: true, wholeDollars: true })).toBe('$16,794');
        expect(formatUsd(1_284_750.55)).toBe('$1,284,750.55');
        expect(formatUsd(-1_284_750.55, { compact: true })).toBe('-$1.3M');
        expect(formatUsd(null, { compact: true })).toBe('—');
    });
});
