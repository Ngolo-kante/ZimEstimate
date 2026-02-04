'use client';

import { BOQCategory, StageStatus } from '@/lib/database.types';
import { StageProgress } from '@/lib/services/stages';
import { CheckCircle, Circle, CircleNotch, Pause, Clock } from '@phosphor-icons/react';

interface StageProgressBarProps {
    stages: StageProgress[];
    activeStage: BOQCategory | null;
    onStageClick: (category: BOQCategory) => void;
}

const statusIcons: Record<StageStatus, React.ReactNode> = {
    planning: <Clock size={14} weight="bold" />,
    pending_approval: <CircleNotch size={14} weight="bold" />,
    in_progress: <Circle size={14} weight="fill" />,
    on_hold: <Pause size={14} weight="bold" />,
    completed: <CheckCircle size={14} weight="fill" />,
};

const statusColors: Record<StageStatus, string> = {
    planning: 'var(--color-text-muted)',
    pending_approval: 'var(--color-warning)',
    in_progress: 'var(--color-accent)',
    on_hold: 'var(--color-text-secondary)',
    completed: 'var(--color-success)',
};

export default function StageProgressBar({ stages, activeStage, onStageClick }: StageProgressBarProps) {
    const applicableStages = stages.filter(s => s.isApplicable);

    return (
        <>
            <div className="stage-progress-bar">
                {applicableStages.map((stage, index) => (
                    <div key={stage.stageId} className="stage-wrapper">
                        <button
                            className={`stage-node ${activeStage === stage.boqCategory ? 'active' : ''} ${stage.status}`}
                            onClick={() => onStageClick(stage.boqCategory)}
                            title={`${stage.name}: ${stage.status.replace('_', ' ')}`}
                        >
                            <span className="stage-icon" style={{ color: statusColors[stage.status] }}>
                                {statusIcons[stage.status]}
                            </span>
                            <span className="stage-name">{stage.name}</span>
                        </button>
                        {index < applicableStages.length - 1 && (
                            <div className={`connector ${stage.status === 'completed' ? 'completed' : ''}`} />
                        )}
                    </div>
                ))}
            </div>

            <style jsx>{`
                .stage-progress-bar {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    padding: var(--spacing-md) var(--spacing-lg);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow-x: auto;
                }

                .stage-wrapper {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                }

                .stage-node {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--color-background);
                    border: 2px solid var(--color-border-light);
                    border-radius: var(--radius-full);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .stage-node:hover {
                    border-color: var(--color-primary);
                    background: var(--color-primary-bg);
                }

                .stage-node.active {
                    border-color: var(--color-primary);
                    background: var(--color-primary-bg);
                    box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.15);
                }

                .stage-node.completed {
                    border-color: var(--color-success);
                }

                .stage-node.in_progress {
                    border-color: var(--color-accent);
                }

                .stage-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stage-name {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .connector {
                    width: 24px;
                    height: 2px;
                    background: var(--color-border-light);
                    flex-shrink: 0;
                }

                .connector.completed {
                    background: var(--color-success);
                }

                @media (max-width: 768px) {
                    .stage-progress-bar {
                        padding: var(--spacing-sm);
                    }

                    .stage-node {
                        padding: var(--spacing-xs) var(--spacing-sm);
                    }

                    .stage-name {
                        font-size: 0.625rem;
                    }

                    .connector {
                        width: 12px;
                    }
                }
            `}</style>
        </>
    );
}
