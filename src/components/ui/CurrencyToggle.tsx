'use client';

import { createContext, useContext, ReactNode } from 'react';

// ZimEstimate displays prices in USD only. Zimbabwe construction trades in USD,
// and the ZiG display multiplied by a rate that was hardcoded and never
// refreshed, so every ZiG figure shown to users was wrong.
//
// The context shape is deliberately unchanged so the ~100 existing call sites
// keep compiling: `currency` is pinned to 'USD' (ZiG branches are unreachable),
// `setCurrency` is a no-op, and `formatPrice` ignores the ZWG argument. To
// reintroduce ZiG later, restore the state here and source `exchangeRate` from
// the existing `exchange_rates` table instead of a constant.
type Currency = 'USD' | 'ZWG';

interface CurrencyContextType {
    currency: Currency;
    /** No-op: currency selection is disabled while the app is USD-only. */
    setCurrency: (currency: Currency) => void;
    /** The ZWG argument is ignored; amounts always render in USD. */
    formatPrice: (priceUsd: number, priceZwg?: number) => string;
    /**
     * Retained only for legacy `*_zwg` column writes. Not used for display.
     * @deprecated Read a live rate from `exchange_rates` when ZiG returns.
     */
    exchangeRate: number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const LEGACY_ZWG_RATE = 30;

function formatUsd(priceUsd: number) {
    const safe = Number.isFinite(priceUsd) ? priceUsd : 0;
    return `$${safe.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

const CURRENCY_VALUE: CurrencyContextType = {
    currency: 'USD',
    setCurrency: () => {},
    formatPrice: formatUsd,
    exchangeRate: LEGACY_ZWG_RATE,
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
    return (
        <CurrencyContext.Provider value={CURRENCY_VALUE}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
