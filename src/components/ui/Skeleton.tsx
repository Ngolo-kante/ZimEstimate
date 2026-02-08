'use client';

import React from 'react';

type SkeletonVariant = 'rect' | 'text' | 'circle' | 'card';

interface SkeletonProps {
    variant?: SkeletonVariant;
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({
    variant = 'rect',
    width,
    height,
    borderRadius,
    className = '',
    style,
}: SkeletonProps) {
    const variantStyles: Record<SkeletonVariant, React.CSSProperties> = {
        rect: {
            width: width || '100%',
            height: height || '20px',
            borderRadius: borderRadius || '6px',
        },
        text: {
            width: width || '80%',
            height: height || '14px',
            borderRadius: borderRadius || '4px',
        },
        circle: {
            width: width || '40px',
            height: height || '40px',
            borderRadius: '50%',
        },
        card: {
            width: width || '100%',
            height: height || '200px',
            borderRadius: borderRadius || '12px',
        },
    };

    return (
        <>
            <div
                className={`skeleton-shimmer ${className}`}
                style={{ ...variantStyles[variant], ...style }}
            />
            <style jsx>{`
                .skeleton-shimmer {
                    background: linear-gradient(
                        90deg,
                        #f1f5f9 25%,
                        #e2e8f0 37%,
                        #f1f5f9 63%
                    );
                    background-size: 400% 100%;
                    animation: shimmer 1.4s ease infinite;
                }

                @keyframes shimmer {
                    0% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0 50%;
                    }
                }
            `}</style>
        </>
    );
}

export function ProjectCardSkeleton() {
    return (
        <div className="skeleton-card">
            {/* Header: title + badge */}
            <div className="skeleton-header">
                <Skeleton variant="text" width="60%" height="18px" />
                <Skeleton variant="rect" width="64px" height="22px" borderRadius="12px" />
            </div>

            {/* Meta: location + date */}
            <div className="skeleton-meta">
                <Skeleton variant="text" width="40%" height="12px" />
                <Skeleton variant="text" width="30%" height="12px" />
            </div>

            {/* Budget */}
            <div className="skeleton-budget">
                <Skeleton variant="text" width="50px" height="10px" />
                <Skeleton variant="rect" width="120px" height="20px" />
            </div>

            {/* Details */}
            <div className="skeleton-details">
                <Skeleton variant="rect" width="80px" height="18px" borderRadius="4px" />
                <Skeleton variant="rect" width="96px" height="18px" borderRadius="4px" />
            </div>

            <style jsx>{`
                .skeleton-card {
                    background: white;
                    border-radius: var(--radius-lg, 12px);
                    padding: 20px;
                    border: 1px solid var(--color-border-light, #e2e8f0);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }

                .skeleton-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .skeleton-meta {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .skeleton-budget {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 16px;
                    border-top: 1px solid var(--color-border-light, #e2e8f0);
                    margin-bottom: 12px;
                }

                .skeleton-details {
                    display: flex;
                    gap: 8px;
                }
            `}</style>
        </div>
    );
}

export function KpiSkeleton() {
    return (
        <div className="kpi-skeleton">
            <Skeleton variant="text" width="60%" height="12px" />
            <Skeleton variant="rect" width="80%" height="24px" style={{ marginTop: '8px' }} />
            <Skeleton variant="text" width="40%" height="10px" style={{ marginTop: '8px' }} />
            <style jsx>{`
                .kpi-skeleton {
                    display: flex;
                    flex-direction: column;
                }
            `}</style>
        </div>
    );
}

export function ProjectDetailSkeleton() {
    return (
        <div className="detail-skeleton">
            <div className="detail-sidebar-skeleton">
                <Skeleton variant="rect" width="100%" height="60px" borderRadius="16px" />
                <div className="nav-items-skeleton">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} variant="rect" width="100%" height="44px" borderRadius="12px" />
                    ))}
                </div>
            </div>
            <div className="detail-content-skeleton">
                {/* Breadcrumb */}
                <Skeleton variant="text" width="200px" height="14px" />
                {/* Title */}
                <Skeleton variant="rect" width="300px" height="32px" style={{ marginTop: '12px' }} />
                {/* Meta */}
                <div className="detail-meta-skeleton">
                    <Skeleton variant="text" width="120px" height="14px" />
                    <Skeleton variant="rect" width="60px" height="22px" borderRadius="6px" />
                </div>
                {/* Cards grid */}
                <div className="detail-cards-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="detail-card-skeleton">
                            <Skeleton variant="text" width="60%" height="14px" />
                            <Skeleton variant="rect" width="80%" height="28px" style={{ marginTop: '12px' }} />
                            <Skeleton variant="text" width="50%" height="12px" style={{ marginTop: '8px' }} />
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .detail-skeleton {
                    display: flex;
                    min-height: calc(100vh - 64px);
                    background: #f8fafc;
                }

                .detail-sidebar-skeleton {
                    width: 280px;
                    padding: 24px 20px;
                    background: rgba(255, 255, 255, 0.85);
                    border-right: 1px solid rgba(226, 232, 240, 0.6);
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .nav-items-skeleton {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-top: 16px;
                }

                .detail-content-skeleton {
                    flex: 1;
                    padding: 32px;
                    max-width: 1200px;
                }

                .detail-meta-skeleton {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-top: 12px;
                }

                .detail-cards-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    margin-top: 32px;
                }

                .detail-card-skeleton {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    border: 1px solid #e2e8f0;
                }

                @media (max-width: 768px) {
                    .detail-sidebar-skeleton {
                        display: none;
                    }

                    .detail-cards-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

export default Skeleton;
