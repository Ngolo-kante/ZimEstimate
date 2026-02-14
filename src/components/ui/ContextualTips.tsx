'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, X, CaretRight, Info, Warning, CheckCircle, Sparkle } from '@phosphor-icons/react';

export type TipCategory = 'info' | 'tip' | 'warning' | 'success' | 'pro-tip';

export interface Tip {
    id: string;
    category: TipCategory;
    title: string;
    content: string;
    learnMoreUrl?: string;
}

interface ContextualTipsProps {
    tips: Tip[];
    contextKey: string; // Used to remember dismissed tips
    variant?: 'sidebar' | 'inline' | 'floating';
    showDismiss?: boolean;
    maxVisible?: number;
}

const categoryConfig: Record<TipCategory, { icon: React.ReactNode; bg: string; border: string; iconColor: string }> = {
    'info': {
        icon: <Info size={20} weight="fill" />,
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconColor: 'text-blue-600'
    },
    'tip': {
        icon: <Lightbulb size={20} weight="fill" />,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        iconColor: 'text-amber-600'
    },
    'warning': {
        icon: <Warning size={20} weight="fill" />,
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        iconColor: 'text-orange-600'
    },
    'success': {
        icon: <CheckCircle size={20} weight="fill" />,
        bg: 'bg-green-50',
        border: 'border-green-200',
        iconColor: 'text-green-600'
    },
    'pro-tip': {
        icon: <Sparkle size={20} weight="fill" />,
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        iconColor: 'text-purple-600'
    }
};

// Pre-defined tips for different contexts
export const projectTips: Record<string, Tip[]> = {
    'project-type': [
        {
            id: 'pt-1',
            category: 'tip',
            title: 'Choose the right project type',
            content: 'Your project type affects material recommendations and cost estimates. Residential projects typically use standard materials, while commercial may require higher specifications.'
        },
        {
            id: 'pt-2',
            category: 'info',
            title: 'Foundation costs vary',
            content: 'In Zimbabwe, foundation costs can range from $15-30/sqm depending on soil conditions. Consider getting a soil test if building in unfamiliar areas.'
        }
    ],
    'budget-priority': [
        {
            id: 'bp-1',
            category: 'tip',
            title: 'Set realistic budgets',
            content: 'Current market prices suggest $350-500/sqm for basic finishes, $500-750/sqm for standard, and $750+ for premium in Zimbabwe.'
        },
        {
            id: 'bp-2',
            category: 'warning',
            title: 'Include contingency',
            content: 'We recommend adding 10-15% contingency for unexpected costs. Material prices in Zimbabwe can fluctuate due to import availability.'
        }
    ],
    'boq-entry': [
        {
            id: 'be-1',
            category: 'pro-tip',
            title: 'Use the AI Scanner',
            content: 'Have an existing quote? Use our AI Quote Scanner to automatically extract items and compare prices with market rates.'
        },
        {
            id: 'be-2',
            category: 'info',
            title: 'Material matching',
            content: 'Our system automatically suggests the best local suppliers for each material based on current market prices.'
        }
    ],
    'stage-substructure': [
        {
            id: 'ss-1',
            category: 'tip',
            title: 'Foundation first',
            content: 'A solid foundation is critical. Don\'t skimp on cement quality - use at least 32.5R grade for foundations.'
        },
        {
            id: 'ss-2',
            category: 'info',
            title: 'Current cement prices',
            content: 'PPC 32.5 is around $10-11/bag, while premium 42.5R grades range $12-14/bag in Harare.'
        }
    ],
    'stage-superstructure': [
        {
            id: 'sp-1',
            category: 'tip',
            title: 'Brick alternatives',
            content: 'Consider cement blocks for faster construction. They can reduce wall costs by 15-20% compared to traditional bricks.'
        },
        {
            id: 'sp-2',
            category: 'warning',
            title: 'Verify brick quality',
            content: 'Farm bricks vary widely in quality. Always inspect before purchasing and ensure they meet strength requirements.'
        }
    ],
    'stage-roofing': [
        {
            id: 'sr-1',
            category: 'tip',
            title: 'Roof material comparison',
            content: 'IBR sheets are most economical. Tiles cost 2-3x more but last longer. Consider your long-term budget.'
        },
        {
            id: 'sr-2',
            category: 'pro-tip',
            title: 'Include accessories',
            content: 'Don\'t forget ridge caps, fascias, gutters, and proper ventilation in your roofing budget.'
        }
    ],
    'stage-finishing': [
        {
            id: 'sf-1',
            category: 'info',
            title: 'Finishing costs',
            content: 'Interior finishing typically accounts for 30-40% of total build cost. Plan this phase carefully.'
        },
        {
            id: 'sf-2',
            category: 'tip',
            title: 'Phased finishing',
            content: 'You can move in with basic finishes and upgrade over time. Prioritize kitchen and bathroom.'
        }
    ],
    'overview': [
        {
            id: 'ov-1',
            category: 'success',
            title: 'Track your progress',
            content: 'Mark items as purchased to track your actual spending vs estimates. This helps refine future projects.'
        },
        {
            id: 'ov-2',
            category: 'pro-tip',
            title: 'Compare suppliers',
            content: 'Click on any material to see price comparisons across verified Harare suppliers.'
        }
    ]
};

export function ContextualTips({
    tips,
    contextKey,
    variant = 'sidebar',
    showDismiss = true,
    maxVisible = 3
}: ContextualTipsProps) {
    const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
    const [isExpanded, setIsExpanded] = useState(true);

    // Load dismissed tips from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(`dismissed-tips-${contextKey}`);
        if (stored) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- sync localStorage on contextKey change
            setDismissedTips(new Set(JSON.parse(stored)));
        }
    }, [contextKey]);

    const dismissTip = (tipId: string) => {
        const newDismissed = new Set(dismissedTips).add(tipId);
        setDismissedTips(newDismissed);
        localStorage.setItem(
            `dismissed-tips-${contextKey}`,
            JSON.stringify([...newDismissed])
        );
    };

    const visibleTips = tips
        .filter(tip => !dismissedTips.has(tip.id))
        .slice(0, maxVisible);

    if (visibleTips.length === 0) return null;

    if (variant === 'inline') {
        return (
            <div className="contextual-tips-inline">
                {visibleTips.map(tip => {
                    const config = categoryConfig[tip.category];
                    return (
                        <div
                            key={tip.id}
                            className={`tip-card ${config.bg} ${config.border}`}
                        >
                            <div className={`tip-icon ${config.iconColor}`}>
                                {config.icon}
                            </div>
                            <div className="tip-content">
                                <h4 className="tip-title">{tip.title}</h4>
                                <p className="tip-text">{tip.content}</p>
                            </div>
                            {showDismiss && (
                                <button
                                    className="tip-dismiss"
                                    onClick={() => dismissTip(tip.id)}
                                    aria-label="Dismiss tip"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    );
                })}

                <style jsx>{`
                    .contextual-tips-inline {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }

                    .tip-card {
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        padding: 14px 16px;
                        border-radius: 10px;
                        border: 1px solid;
                        position: relative;
                    }

                    .tip-icon {
                        flex-shrink: 0;
                        margin-top: 2px;
                    }

                    .tip-content {
                        flex: 1;
                    }

                    .tip-title {
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: #0f172a;
                        margin: 0 0 4px 0;
                    }

                    .tip-text {
                        font-size: 0.8125rem;
                        color: #475569;
                        margin: 0;
                        line-height: 1.5;
                    }

                    .tip-dismiss {
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        width: 24px;
                        height: 24px;
                        border: none;
                        background: transparent;
                        border-radius: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #94a3b8;
                        transition: all 0.15s;
                    }

                    .tip-dismiss:hover {
                        background: rgba(0, 0, 0, 0.05);
                        color: #64748b;
                    }
                `}</style>
            </div>
        );
    }

    // Sidebar variant (default)
    return (
        <div className="contextual-tips-sidebar">
            <button
                className="sidebar-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Lightbulb size={20} weight="fill" className="toggle-icon" />
                <span className="toggle-text">Tips & Insights</span>
                <CaretRight
                    size={16}
                    className={`toggle-chevron ${isExpanded ? 'expanded' : ''}`}
                />
            </button>

            {isExpanded && (
                <div className="tips-list">
                    {visibleTips.map(tip => {
                        const config = categoryConfig[tip.category];
                        return (
                            <div
                                key={tip.id}
                                className={`tip-item ${config.bg}`}
                            >
                                <div className="tip-header">
                                    <span className={`tip-icon ${config.iconColor}`}>
                                        {config.icon}
                                    </span>
                                    <span className="tip-category">
                                        {tip.category === 'pro-tip' ? 'Pro Tip' : tip.category.charAt(0).toUpperCase() + tip.category.slice(1)}
                                    </span>
                                    {showDismiss && (
                                        <button
                                            className="tip-dismiss"
                                            onClick={() => dismissTip(tip.id)}
                                            aria-label="Dismiss"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <h4 className="tip-title">{tip.title}</h4>
                                <p className="tip-text">{tip.content}</p>
                                {tip.learnMoreUrl && (
                                    <a href={tip.learnMoreUrl} className="tip-link">
                                        Learn more <CaretRight size={12} />
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .contextual-tips-sidebar {
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                }

                .sidebar-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 16px;
                    border: none;
                    background: #f8fafc;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .sidebar-toggle:hover {
                    background: #f1f5f9;
                }

                .toggle-icon {
                    color: #FCA311;
                }

                .toggle-text {
                    flex: 1;
                    text-align: left;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .toggle-chevron {
                    color: #64748b;
                    transition: transform 0.2s;
                }

                .toggle-chevron.expanded {
                    transform: rotate(90deg);
                }

                .tips-list {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .tip-item {
                    padding: 14px;
                    border-radius: 10px;
                }

                .tip-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .tip-icon {
                    display: flex;
                }

                .tip-category {
                    flex: 1;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }

                .tip-dismiss {
                    width: 20px;
                    height: 20px;
                    border: none;
                    background: transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    transition: all 0.15s;
                }

                .tip-dismiss:hover {
                    background: rgba(0, 0, 0, 0.08);
                    color: #64748b;
                }

                .tip-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0 0 6px 0;
                }

                .tip-text {
                    font-size: 0.8125rem;
                    color: #475569;
                    margin: 0;
                    line-height: 1.5;
                }

                .tip-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 10px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: #2563eb;
                    text-decoration: none;
                }

                .tip-link:hover {
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
}

export default ContextualTips;
