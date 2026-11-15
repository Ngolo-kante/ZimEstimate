'use client';

import { useCurrency } from '@/components/ui/CurrencyToggle';

interface PriceDisplayProps {
    priceUsd: number;
    priceZwg: number;
    /** Bold text. */
    bold?: boolean;
    /** Just the text, with no <span> around it (the projects list uses it inline). */
    unwrapped?: boolean;
}

/** A price in whichever currency the person has chosen. */
export default function PriceDisplay({ priceUsd, priceZwg, bold = false, unwrapped = false }: PriceDisplayProps) {
    const { formatPrice } = useCurrency();
    if (unwrapped) return <>{formatPrice(priceUsd, priceZwg)}</>;
    return <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }} className={bold ? 'font-semibold' : ''}>{formatPrice(priceUsd, priceZwg)}</span>;
}
