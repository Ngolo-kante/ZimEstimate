'use client';

import { useCurrency } from '@/components/ui/CurrencyToggle';
import { Wallet } from '@phosphor-icons/react';

interface StageSavingsToggleProps {
    totalBudget: number;
    amountSpent: number;
    targetDate?: string | null;
    onSavingsGoalSet?: (weeklyAmount: number) => void;
}

export default function StageSavingsToggle(props: StageSavingsToggleProps) {
    const { formatPrice, exchangeRate } = useCurrency();
    const { totalBudget, amountSpent } = props;

    const remaining = totalBudget - amountSpent;
    const progress = totalBudget > 0 ? (amountSpent / totalBudget) * 100 : 0;

    return (
        <>
            <div className="savings-toggle-card">
                <div className="card-header">
                    <div className="header-main">
                        <Wallet size={24} weight="duotone" className="header-icon" />
                        <div className="header-content">
                            <span className="header-label">Total Budget</span>
                            <span className="header-value">
                                {formatPrice(totalBudget, totalBudget * exchangeRate)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>

                <div className="card-stats">
                    <div className="stat">
                        <span className="stat-label">Spent</span>
                        <span className="stat-value spent">
                            {formatPrice(amountSpent, amountSpent * exchangeRate)}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Remaining</span>
                        <span className="stat-value">
                            {formatPrice(remaining, remaining * exchangeRate)}
                        </span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .savings-toggle-card {
                    background: var(--color-background);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    box-shadow: none;
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md) var(--spacing-lg);
                }

                .header-main {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                :global(.header-icon) {
                    color: var(--color-text-muted);
                }

                .header-content {
                    display: flex;
                    flex-direction: column;
                }

                .header-label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .header-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--color-text);
                }

                .progress-bar {
                    height: 4px;
                    background: var(--color-border-light);
                }

                .progress-fill {
                    height: 100%;
                    background: var(--color-text-muted);
                    transition: width 0.5s ease;
                }

                .card-stats {
                    display: flex;
                    padding: var(--spacing-sm) var(--spacing-lg);
                    gap: var(--spacing-lg);
                    background: var(--color-background);
                }

                .stat {
                    display: flex;
                    flex-direction: column;
                }

                .stat-label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .stat-value {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .stat-value.spent {
                    color: var(--color-text);
                }

                @media (max-width: 480px) {
                    .card-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: var(--spacing-sm);
                    }
                }
            `}</style>
        </>
    );
}
