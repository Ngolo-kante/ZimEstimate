import React from 'react';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
    color?: 'accent' | 'success' | 'warning' | 'error';
}

export default function ProgressRing({
    progress,
    size = 80,
    strokeWidth = 6,
    showLabel = true,
    color = 'accent',
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    const colorMap = {
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
    };

    return (
        <>
            <div className="progress-ring-container">
                <svg className="progress-ring" width={size} height={size}>
                    {/* Background circle */}
                    <circle
                        className="progress-ring-bg"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        className="progress-ring-progress"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset: offset,
                            stroke: colorMap[color],
                        }}
                    />
                </svg>
                {showLabel && (
                    <div className="progress-label">
                        <span className="progress-value">{Math.round(progress)}</span>
                        <span className="progress-unit">%</span>
                    </div>
                )}
            </div>

            <style jsx>{`
        .progress-ring-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .progress-ring {
          transform: rotate(-90deg);
        }

        .progress-ring-bg {
          fill: none;
          stroke: var(--color-border-light);
        }

        .progress-ring-progress {
          fill: none;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.5s ease;
        }

        .progress-label {
          position: absolute;
          display: flex;
          align-items: baseline;
          justify-content: center;
        }

        .progress-value {
          font-size: ${size * 0.25}px;
          font-weight: 600;
          color: var(--color-text);
        }

        .progress-unit {
          font-size: ${size * 0.12}px;
          color: var(--color-text-secondary);
        }
      `}</style>
        </>
    );
}

// Linear progress bar variant
interface ProgressBarProps {
    progress: number;
    height?: number;
    color?: 'accent' | 'success' | 'warning' | 'error';
    showLabel?: boolean;
}

export function ProgressBar({
    progress,
    height = 8,
    color = 'accent',
    showLabel = false,
}: ProgressBarProps) {
    const colorMap = {
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
    };

    return (
        <>
            <div className="progress-bar-container">
                <div className="progress-bar">
                    <div
                        className="progress-bar-fill"
                        style={{
                            width: `${Math.min(100, Math.max(0, progress))}%`,
                            backgroundColor: colorMap[color],
                        }}
                    />
                </div>
                {showLabel && <span className="progress-bar-label">{Math.round(progress)}%</span>}
            </div>

            <style jsx>{`
        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .progress-bar {
          flex: 1;
          height: ${height}px;
          background: var(--color-border-light);
          border-radius: ${height}px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: ${height}px;
          transition: width 0.3s ease;
        }

        .progress-bar-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          min-width: 2.5rem;
          text-align: right;
        }
      `}</style>
        </>
    );
}
