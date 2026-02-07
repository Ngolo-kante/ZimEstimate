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
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                0 2px 4px -1px rgba(0, 0, 0, 0.01);
                    transition: all 0.2s ease;
                    margin-bottom: 24px;
                }

                .stage-description {
                    font-size: 0.9rem;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.5;
                }

                .section-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: #ffffff;
                    border: none;
                    border-bottom: 1px solid transparent;
                    cursor: pointer;
                    padding: 20px 24px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0f172a;
                    transition: all 0.2s;
                    user-select: none;
                }

                .section-toggle:hover {
                    background: #fafafa;
                }
                
                .stage-header:has(.stage-body) .section-toggle {
                    border-bottom-color: #f1f5f9;
                }

                .stage-body {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                    padding: 24px;
                    background: #ffffff;
                }

                .stage-title {
                    flex: 1;
                }

                .stage-controls {
                    display: flex;
                    align-items: flex-end;
                    gap: 24px;
                }

                /* Status Dropdown */
                .status-dropdown {
                    position: relative;
                }

                .status-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .status-field label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }

                .status-trigger {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-width: 180px;
                    justify-content: space-between;
                }

                .status-trigger:hover {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                }

                .status-icon {
                    color: var(--status-color);
                    display: flex;
                }

                .status-label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #1e293b;
                    flex: 1;
                    text-align: left;
                }

                .status-trigger :global(.rotated) {
                    transform: rotate(180deg);
                }

                .status-menu {
                    position: absolute;
                    top: calc(100% + 6px);
                    right: 0;
                    min-width: 200px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
                                0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    z-index: 50;
                    padding: 6px;
                }

                .status-option {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 8px 12px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: #475569;
                    text-align: left;
                    border-radius: 8px;
                    transition: all 0.15s ease;
                }

                .status-option:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                }

                .status-option.active {
                    background: #f1f5f9;
                    font-weight: 600;
                    color: #0f172a;
                }

                .option-icon {
                    color: var(--option-color);
                    display: flex;
                }

                /* Date Range */
                .date-range {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 16px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                }

                .date-field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .date-field label {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }

                .date-field input[type="date"] {
                    padding: 0;
                    border: none;
                    font-size: 0.85rem;
                    color: #1e293b;
                    background: transparent;
                    width: 110px;
                    font-weight: 500;
                    outline: none;
                }
                
                .date-input-wrapper {
                     display: flex;
                     align-items: center;
                     gap: 6px;
                }

                .date-display {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .days-badge {
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    background: #eff6ff;
                    color: #2563eb;
                    border-radius: 99px;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .days-badge.urgent {
                    background: #fef2f2;
                    color: #ef4444;
                }

                .date-separator {
                    color: #cbd5e1;
                    font-size: 1.2rem;
                    margin: 0 8px;
                    padding-top: 12px;
                }

                @media (max-width: 900px) {
                    .stage-body {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 20px;
                    }

                    .stage-controls {
                        width: 100%;
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }
                    
                    .status-trigger {
                        width: 100%;
                    }

                    .date-range {
                        width: 100%;
                        justify-content: space-between;
                    }
                }
            `}</style>
        </>
    );
}
