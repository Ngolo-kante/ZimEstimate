const quantityFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Unit prices under a dollar (a brick at $0.085) keep up to four decimals: rounding
// them to cents misstates the line by thousands once multiplied by 1,250,000 bricks.
const centsUsdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const wholeUsdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatQuantity(n: number | null | undefined, unit?: string): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return quantityFormatter.format(n) + (unit ? ` ${unit}` : '');
}

export function formatUsd(n: number | null | undefined, opts?: { wholeDollars?: boolean }): string {
    if (n == null || !Number.isFinite(n)) return '—';
    if (opts?.wholeDollars) return wholeUsdFormatter.format(n);
    return (n !== 0 && Math.abs(n) < 1 ? centsUsdFormatter : usdFormatter).format(n);
}

/** Keep both ends (including the extension) readable within a character limit. */
export function truncateMiddle(name: string, max: number): string {
    if (name.length <= max) return name;
    if (max <= 1) return max > 0 ? '…' : '';
    const tail = Math.floor((max - 1) / 2);
    return `${name.slice(0, max - 1 - tail)}…${name.slice(-tail || name.length)}`;
}
