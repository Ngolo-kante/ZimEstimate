'use client';

import { useState } from 'react';
import { ProjectStage, StageStatus } from '@/lib/database.types';
import { Calendar, CaretDown, CaretUp, CheckCircle, Clock, Pause, CircleNotch, Flag } from '@phosphor-icons/react';

interface StageMetadataHeaderProps {
    stage: ProjectStage;
    onUpdate: (updates: Partial<ProjectStage>) => Promise<void>;
}

const statusOptions: { value: StageStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'planning', label: 'Planning', icon: <Clock size={16} />, color: 'var(--color-text-muted)' },
    { value: 'pending_approval', label: 'Pending Approval', icon: <CircleNotch size={16} />, color: 'var(--color-warning)' },
    { value: 'in_progress', label: 'In Progress', icon: <Flag size={16} />, color: 'var(--color-accent)' },
    { value: 'on_hold', label: 'On Hold', icon: <Pause size={16} />, color: 'var(--color-text-secondary)' },
    { value: 'completed', label: 'Completed', icon: <CheckCircle size={16} />, color: 'var(--color-success)' },
];

export default function StageMetadataHeader({ stage, onUpdate }: StageMetadataHeaderProps) {
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTimelineOpen, setIsTimelineOpen] = useState(true);

    const currentStatus = statusOptions.find(s => s.value === stage.status) || statusOptions[0];

    const handleStatusChange = async (newStatus: StageStatus) => {
        setIsSaving(true);
        await onUpdate({ status: newStatus });
        setIsSaving(false);
        setIsStatusOpen(false);
    };

    const handleDateChange = async (field: 'start_date' | 'end_date', value: string) => {
        await onUpdate({ [field]: value || null });
    };

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return 'Not set';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getDaysRemaining = (): { days: number; urgent: boolean } | null => {
        if (!stage.end_date) return null;
        const target = new Date(stage.end_date);
        const today = new Date();
        const diffTime = target.getTime() - today.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { days, urgent: days < 14 && days > 0 };
    };

    const daysInfo = getDaysRemaining();

    return (
        <>
            <div className="stage-header">
                <button
                    className="section-toggle"
                    onClick={() => setIsTimelineOpen(prev => !prev)}
                >
                    <span>Timelines - {stage.name} Phase</span>
                    {isTimelineOpen ? <CaretUp size={16} /> : <CaretDown size={16} />}
                </button>

                {isTimelineOpen && (
                    <div className="stage-body">
                        <div className="stage-title">
                            {stage.description && <p className="stage-description">{stage.description}</p>}
                        </div>
                        <div className="stage-controls">
                        {/* Status Dropdown */}
                        <div className="status-dropdown">
                            <div className="status-field">
                                <label>
                                    <Flag size={14} />
                                    Status
                                </label>
                                <button
                                    className="status-trigger"
                                    onClick={() => setIsStatusOpen(!isStatusOpen)}
                                    disabled={isSaving}
                                    style={{ '--status-color': currentStatus.color } as React.CSSProperties}
                                >
                                    <span className="status-icon">{currentStatus.icon}</span>
                                    <span className="status-label">{currentStatus.label}</span>
                                    <CaretDown size={14} className={isStatusOpen ? 'rotated' : ''} />
                                </button>
                            </div>

                            {isStatusOpen && (
                                <div className="status-menu">
                                    {statusOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            className={`status-option ${stage.status === option.value ? 'active' : ''}`}
                                            onClick={() => handleStatusChange(option.value)}
                                            style={{ '--option-color': option.color } as React.CSSProperties}
                                        >
                                            <span className="option-icon">{option.icon}</span>
                                            <span>{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date Range */}
                        <div className="date-range">
                            <div className="date-field">
                                <label>
                                    <Calendar size={14} />
                                    Start
                                </label>
                                <input
                                    type="date"
                                    value={stage.start_date || ''}
                                    onChange={(e) => handleDateChange('start_date', e.target.value)}
                                />
                                <span className="date-display">{formatDate(stage.start_date)}</span>
                            </div>
                            <span className="date-separator">-</span>
                            <div className="date-field">
                                <label>
                                    <Calendar size={14} />
                                    End
                                </label>
                                <input
                                    type="date"
                                    value={stage.end_date || ''}
                                    onChange={(e) => handleDateChange('end_date', e.target.value)}
                                />
                                <span className="date-display">
                                    {formatDate(stage.end_date)}
                                    {daysInfo && (
                                        <span className={`days-badge ${daysInfo.urgent ? 'urgent' : ''}`}>
                                            {daysInfo.days > 0 ? `${daysInfo.days}d left` : daysInfo.days === 0 ? 'Today' : 'Overdue'}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>

            <style jsx>{`
                .stage-header {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow: visible;
                    box-shadow: 0 12px 26px rgba(6, 20, 47, 0.08);
                }

                .stage-description {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                .section-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: rgba(6, 20, 47, 0.02);
                    border: none;
                    cursor: pointer;
                    padding: var(--spacing-md) var(--spacing-lg);
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--color-text);
                }

                .section-toggle:hover {
                    background: var(--color-surface);
                }

                .stage-body {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--spacing-lg);
                    padding: var(--spacing-lg);
                    background: #ffffff;
                }

                .stage-controls {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--spacing-lg);
                }

                /* Status Dropdown */
                .status-dropdown {
                    position: relative;
                }

                .status-field {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .status-field label {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .status-trigger {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .status-trigger:hover {
                    border-color: var(--color-primary);
                }

                .status-icon {
                    color: var(--status-color);
                    display: flex;
                }

                .status-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-text);
                }

                .status-trigger :global(.rotated) {
                    transform: rotate(180deg);
                }

                .status-menu {
                    position: absolute;
                    top: calc(100% + 4px);
                    right: 0;
                    min-width: 180px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    box-shadow: 0 18px 32px rgba(6, 20, 47, 0.14);
                    z-index: 200;
                    overflow: hidden;
                }

                .status-option {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    width: 100%;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.875rem;
                    color: var(--color-text);
                    text-align: left;
                    transition: background 0.15s ease;
                }

                .status-option:hover {
                    background: var(--color-primary-bg);
                }

                .status-option.active {
                    background: var(--color-primary-bg);
                    font-weight: 600;
                }

                .option-icon {
                    color: var(--option-color);
                    display: flex;
                }

                /* Date Range */
                .date-range {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .date-field {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .date-field label {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .date-field input[type="date"] {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    color: var(--color-text);
                    background: #ffffff;
                    width: 130px;
                }

                .date-field input[type="date"]:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }

                .date-display {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                }

                .days-badge {
                    font-size: 0.5rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    background: var(--color-primary-bg);
                    color: var(--color-primary);
                    border-radius: var(--radius-full);
                    text-transform: uppercase;
                }

                .days-badge.urgent {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--color-error);
                }

                .date-separator {
                    color: var(--color-text-muted);
                    margin-top: var(--spacing-md);
                }

                @media (max-width: 768px) {
                    .stage-body {
                        flex-direction: column;
                    }

                    .stage-controls {
                        width: 100%;
                        flex-direction: column;
                        gap: var(--spacing-md);
                    }

                    .date-range {
                        width: 100%;
                    }

                    .date-field {
                        flex: 1;
                    }

                    .date-field input[type="date"] {
                        width: 100%;
                    }
                }
            `}</style>
        </>
    );
}
