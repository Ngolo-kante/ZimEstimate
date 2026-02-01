'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { CurrencyDollar } from '@phosphor-icons/react';

type Currency = 'USD' | 'ZWG';

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    formatPrice: (priceUsd: number, priceZwg: number) => string;
    exchangeRate: number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrency] = useState<Currency>(() => {
        // Lazy initialization to load from localStorage on first render
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('preferredCurrency') as Currency;
            if (saved === 'USD' || saved === 'ZWG') {
                return saved;
            }
        }
        return 'USD';
    });
    const [exchangeRate] = useState(30); // Default rate, should be fetched from DB

    const handleSetCurrency = (newCurrency: Currency) => {
        setCurrency(newCurrency);
        localStorage.setItem('preferredCurrency', newCurrency);
    };

    const formatPrice = (priceUsd: number, priceZwg: number) => {
        if (currency === 'USD') {
            return `$${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `ZiG ${priceZwg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency: handleSetCurrency, formatPrice, exchangeRate }}>
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

// Toggle Component
export function CurrencyToggle() {
    const { currency, setCurrency } = useCurrency();

    return (
        <>
            <div className="currency-toggle">
                <button
                    className={`toggle-option ${currency === 'USD' ? 'active' : ''}`}
                    onClick={() => setCurrency('USD')}
                >
                    <CurrencyDollar size={16} weight="light" />
                    <span>USD</span>
                </button>
                <button
                    className={`toggle-option ${currency === 'ZWG' ? 'active' : ''}`}
                    onClick={() => setCurrency('ZWG')}
                >
                    <span className="zig-symbol">Z$</span>
                    <span>ZiG</span>
                </button>
            </div>

            <style jsx>{`
        .currency-toggle {
          display: flex;
          background: var(--color-border-light);
          border-radius: var(--radius-md);
          padding: 0.25rem;
        }

        .toggle-option {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .toggle-option:hover {
          color: var(--color-text);
        }

        .toggle-option.active {
          background: var(--color-surface);
          color: var(--color-primary);
          box-shadow: var(--shadow-sm);
        }

        .zig-symbol {
          font-weight: 600;
          font-size: 0.75rem;
        }
      `}</style>
        </>
    );
}
