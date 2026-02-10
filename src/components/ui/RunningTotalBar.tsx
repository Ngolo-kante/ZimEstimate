'use client';

import React, { useEffect, useState } from 'react';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';

interface RunningTotalBarProps {
    totalUSD: number;
    totalZWG: number;
    budgetTargetUSD?: number | null;
    completionPercentage?: number;
    projectName?: string;
    previousTotal?: number; // For showing trend
    variant?: 'default' | 'compact';
}

export function RunningTotalBar({
    totalUSD,
    totalZWG,
    budgetTargetUSD,
    completionPercentage = 0,
    projectName,
    previousTotal,
    variant = 'default'
}: RunningTotalBarProps) {
    const { currency, formatPrice, exchangeRate } = useCurrency();
    const [isAnimating, setIsAnimating] = useState(false);
    const [displayTotal, setDisplayTotal] = useState(totalUSD);

    // Animate total changes
    useEffect(() => {
        if (displayTotal !== totalUSD) {
            setIsAnimating(true);
            const timer = setTimeout(() => {
                setDisplayTotal(totalUSD);
                setIsAnimating(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [totalUSD, displayTotal]);

    const formattedTotal = formatPrice(totalUSD, totalZWG || totalUSD * exchangeRate);

    // Calculate budget status
    const isOverBudget = budgetTargetUSD && totalUSD > budgetTargetUSD;
    const budgetPercentage = budgetTargetUSD ? (totalUSD / budgetTargetUSD) * 100 : 0;

    // Trend indicator
    const showTrend = previousTotal !== undefined && previousTotal !== totalUSD;
    const trendUp = previousTotal !== undefined && totalUSD > previousTotal;
    const trendDiff = previousTotal ? Math.abs(totalUSD - previousTotal) : 0;

    if (variant === 'compact') {
        return (
            <div className="running-total-compact">
                <span className="label">Total</span>
                <span className={`amount ${isAnimating ? 'pulse' : ''}`}>
                    {formattedTotal}
                </span>
                <style jsx>{`
                    .running-total-compact {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 16px;
                        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                        border-radius: 24px;
                        color: white;
                    }
                    .label {
                        font-size: 0.75rem;
                        opacity: 0.7;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .amount {
                        font-size: 1rem;
                        font-weight: 700;
                        font-feature-settings: 'tnum';
                        transition: transform 0.3s, color 0.3s;
                    }
                    .amount.pulse {
                        animation: pulse 0.3s ease-out;
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); color: #22c55e; }
                        100% { transform: scale(1); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className={`running-total-bar ${isOverBudget ? 'over-budget' : ''}`}>
            <div className="total-section">
                <div className="total-label">
                    {projectName && <span className="project-name">{projectName}</span>}
                    <span className="estimate-label">Estimated Total</span>
                </div>
                <div className="total-amount-row">
                    <span className={`total-amount ${isAnimating ? 'updating' : ''}`}>
                        {formattedTotal}
                    </span>
                    {showTrend && (
                        <span className={`trend ${trendUp ? 'up' : 'down'}`}>
                            {trendUp ? <TrendUp size={16} weight="bold" /> : <TrendDown size={16} weight="bold" />}
                            <span className="trend-amount">
                                {currency === 'USD' ? '$' : 'ZWG '}{trendDiff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </span>
                    )}
                </div>
            </div>

            {(budgetTargetUSD || completionPercentage > 0) && (
                <div className="progress-section">
                    {budgetTargetUSD && (
                        <div className="budget-info">
                            <span className="budget-label">
                                {isOverBudget ? 'Over budget by' : 'Under budget by'}
                            </span>
                            <span className={`budget-diff ${isOverBudget ? 'over' : 'under'}`}>
                                {formatPrice(Math.abs(budgetTargetUSD - totalUSD), Math.abs(budgetTargetUSD - totalUSD) * exchangeRate)}
                            </span>
                        </div>
                    )}
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{
                                width: `${Math.min(completionPercentage, 100)}%`,
                                background: completionPercentage >= 100
                                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                    : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                            }}
                        />
                    </div>
                    <span className="progress-label">{completionPercentage.toFixed(0)}% complete</span>
                </div>
            )}

            <style jsx>{`
                .running-total-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                    padding: 16px 24px;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    border-radius: 16px;
                    color: white;
                    box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.3);
                    position: sticky;
                    top: 0;
                    z-index: 50;
                }

                .running-total-bar.over-budget {
                    background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
                }

                .total-section {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .total-label {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .project-name {
                    font-size: 0.75rem;
                    opacity: 0.6;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .estimate-label {
                    font-size: 0.875rem;
                    opacity: 0.8;
                }

                .total-amount-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .total-amount {
                    font-size: 2rem;
                    font-weight: 800;
                    font-feature-settings: 'tnum';
                    letter-spacing: -0.02em;
                    transition: all 0.3s ease;
                }

                .total-amount.updating {
                    animation: countUp 0.3s ease-out;
                }

                @keyframes countUp {
                    0% { transform: translateY(10px); opacity: 0.5; }
                    100% { transform: translateY(0); opacity: 1; }
                }

                .trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .trend.up {
                    background: rgba(239, 68, 68, 0.2);
                    color: #fca5a5;
                }

                .trend.down {
                    background: rgba(34, 197, 94, 0.2);
                    color: #86efac;
                }

                .progress-section {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                    min-width: 200px;
                }

                .budget-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.875rem;
                }

                .budget-label {
                    opacity: 0.7;
                }

                .budget-diff {
                    font-weight: 700;
                }

                .budget-diff.over {
                    color: #fca5a5;
                }

                .budget-diff.under {
                    color: #86efac;
                }

                .progress-bar-container {
                    width: 100%;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-bar-fill {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 0.5s ease-out;
                }

                .progress-label {
                    font-size: 0.75rem;
                    opacity: 0.7;
                }

                @media (max-width: 640px) {
                    .running-total-bar {
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 12px 16px;
                        gap: 12px;
                    }

                    .total-amount {
                        font-size: 1.5rem;
                    }

                    .progress-section {
                        width: 100%;
                        align-items: stretch;
                    }

                    .budget-info {
                        justify-content: space-between;
                    }
                }
            `}</style>
        </div>
    );
}
