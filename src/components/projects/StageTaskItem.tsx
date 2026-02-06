'use client';

import { useState } from 'react';
import { StageTask } from '@/lib/database.types';
import { Check, Trash, User, NotePencil, CaretDown, CaretUp } from '@phosphor-icons/react';

interface StageTaskItemProps {
    task: StageTask;
    onToggle: (completed: boolean) => Promise<void>;
    onUpdate: (updates: Partial<StageTask>) => Promise<void>;
    onDelete: () => Promise<void>;
}

export default function StageTaskItem({ task, onToggle, onUpdate, onDelete }: StageTaskItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
    const [verificationNote, setVerificationNote] = useState(task.verification_note || '');
    const [isEditing, setIsEditing] = useState(false);

    const handleToggle = async () => {
        await onToggle(!task.is_completed);
    };

    const handleSaveDetails = async () => {
        await onUpdate({
            assigned_to: assignedTo || null,
            verification_note: verificationNote || null,
        });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (confirm('Delete this task?')) {
            await onDelete();
        }
    };

    return (
        <>
            <div className={`task-item ${task.is_completed ? 'completed' : ''}`}>
                <div className="task-main" onClick={() => setIsExpanded(!isExpanded)}>
                    <button
                        className={`checkbox ${task.is_completed ? 'checked' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggle();
                        }}
                    >
                        {task.is_completed && <Check size={12} weight="bold" />}
                    </button>

                    <div className="task-content">
                        <span className="task-title">{task.title}</span>
                        {(task.assigned_to || task.verification_note) && (
                            <div className="task-meta">
                                {task.assigned_to && (
                                    <span className="meta-item">
                                        <User size={12} />
                                        {task.assigned_to}
                                    </span>
                                )}
                                {task.verification_note && task.is_completed && (
                                    <span className="meta-item verified">
                                        <Check size={12} />
                                        Verified
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="task-actions">
                        {task.is_default && (
                            <span className="default-badge">Default</span>
                        )}
                        <button className="expand-btn">
                            {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="task-details">
                        {task.description && (
                            <p className="task-description">{task.description}</p>
                        )}

                        {isEditing ? (
                            <div className="edit-form">
                                <div className="form-group">
                                    <label>
                                        <User size={14} />
                                        Assigned To
                                    </label>
                                    <input
                                        type="text"
                                        value={assignedTo}
                                        onChange={(e) => setAssignedTo(e.target.value)}
                                        placeholder="e.g., John, Inspector"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>
                                        <NotePencil size={14} />
                                        Verification Note
                                    </label>
                                    <input
                                        type="text"
                                        value={verificationNote}
                                        onChange={(e) => setVerificationNote(e.target.value)}
                                        placeholder="e.g., Approved by city inspector"
                                    />
                                </div>
                                <div className="form-actions">
                                    <button className="btn-cancel" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </button>
                                    <button className="btn-save" onClick={handleSaveDetails}>
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="detail-actions">
                                <button className="action-btn" onClick={() => setIsEditing(true)}>
                                    <NotePencil size={14} />
                                    Edit Details
                                </button>
                                <button className="action-btn danger" onClick={handleDelete}>
                                    <Trash size={14} />
                                    Delete
                                </button>
                            </div>
                        )}

                        {task.completed_at && (
                            <p className="completed-info">
                                Completed {new Date(task.completed_at).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .task-item {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    transition: all 0.2s ease;
                    box-shadow: 0 10px 20px rgba(6, 20, 47, 0.06);
                }

                .task-item:hover {
                    border-color: var(--color-border);
                }

                .task-item.completed {
                    background: rgba(6, 20, 47, 0.02);
                    opacity: 0.8;
                }

                .task-main {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    cursor: pointer;
                }

                .checkbox {
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--color-border-light);
                    border-radius: var(--radius-sm);
                    background: var(--color-surface);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.15s ease;
                }

                .checkbox:hover {
                    border-color: var(--color-primary);
                }

                .checkbox.checked {
                    background: var(--color-success);
                    border-color: var(--color-success);
                    color: white;
                }

                .task-content {
                    flex: 1;
                    min-width: 0;
                }

                .task-title {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-text);
                    display: block;
                }

                .task-item.completed .task-title {
                    text-decoration: line-through;
                    color: var(--color-text-muted);
                }

                .task-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    margin-top: 2px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.625rem;
                    color: var(--color-text-muted);
                }

                .meta-item.verified {
                    color: var(--color-success);
                    font-weight: 600;
                }

                .task-actions {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .default-badge {
                    font-size: 0.5rem;
                    font-weight: 600;
                    padding: 2px 6px;
                    background: rgba(6, 20, 47, 0.04);
                    color: var(--color-text-muted);
                    border-radius: var(--radius-full);
                    text-transform: uppercase;
                }

                .expand-btn {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                }

                .expand-btn:hover {
                    background: rgba(6, 20, 47, 0.04);
                }

                .task-details {
                    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
                    border-top: 1px solid var(--color-border-light);
                    background: rgba(6, 20, 47, 0.02);
                }

                .task-description {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    margin: 0 0 var(--spacing-sm) 0;
                }

                .edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .form-group label {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-muted);
                }

                .form-group input {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    background: #ffffff;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-xs);
                    margin-top: var(--spacing-xs);
                }

                .btn-cancel,
                .btn-save {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                }

                .btn-cancel {
                    background: rgba(6, 20, 47, 0.04);
                    color: var(--color-text-secondary);
                }

                .btn-save {
                    background: var(--color-primary);
                    color: white;
                }

                .detail-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: none;
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .action-btn:hover {
                    border-color: rgba(6, 20, 47, 0.2);
                    background: rgba(6, 20, 47, 0.04);
                }

                .action-btn.danger:hover {
                    border-color: var(--color-error);
                    color: var(--color-error);
                    background: rgba(239, 68, 68, 0.05);
                }

                .completed-info {
                    font-size: 0.625rem;
                    color: var(--color-text-muted);
                    margin: var(--spacing-sm) 0 0 0;
                }
            `}</style>
        </>
    );
}
