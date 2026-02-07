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
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
                }

                .task-item:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }

                .task-item.completed {
                    background: #f8fafc;
                    opacity: 0.9;
                }

                .task-main {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 12px 16px;
                    cursor: pointer;
                }

                .checkbox {
                    width: 22px;
                    height: 22px;
                    border: 2px solid #cbd5e1;
                    border-radius: 6px;
                    background: #ffffff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: all 0.15s ease;
                    color: white;
                }

                .checkbox:hover {
                    border-color: #3b82f6;
                }

                .checkbox.checked {
                    background: #2563eb;
                    border-color: #2563eb;
                }

                .task-content {
                    flex: 1;
                    min-width: 0;
                }

                .task-title {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #1e293b;
                    display: block;
                    transition: color 0.1s;
                }

                .task-item.completed .task-title {
                    text-decoration: line-through;
                    color: #94a3b8;
                }

                .task-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-top: 4px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.75rem;
                    color: #64748b;
                }

                .meta-item.verified {
                    color: #166534;
                    font-weight: 500;
                }

                .task-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .default-badge {
                    font-size: 0.65rem;
                    font-weight: 600;
                    padding: 2px 6px;
                    background: #f1f5f9;
                    color: #64748b;
                    border-radius: 99px;
                    text-transform: uppercase;
                }

                .expand-btn {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #94a3b8;
                    border-radius: 6px;
                    transition: all 0.2s;
                }

                .expand-btn:hover {
                    background: #f1f5f9;
                    color: #475569;
                }

                .task-details {
                    padding: 16px;
                    border-top: 1px solid #f1f5f9;
                    background: #fcfcfc;
                }

                .task-description {
                    font-size: 0.85rem;
                    color: #475569;
                    margin: 0 0 16px 0;
                    line-height: 1.5;
                }

                .edit-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .form-group label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748b;
                }

                .form-group input {
                    padding: 8px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    background: #ffffff;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 8px;
                }

                .btn-cancel,
                .btn-save {
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                }

                .btn-cancel {
                    background: #f1f5f9;
                    color: #64748b;
                }

                .btn-cancel:hover {
                    background: #e2e8f0;
                }

                .btn-save {
                    background: #2563eb;
                    color: white;
                }

                .btn-save:hover {
                    background: #1d4ed8;
                }

                .detail-actions {
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .action-btn:hover {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                }

                .action-btn.danger:hover {
                    border-color: #fee2e2;
                    color: #ef4444;
                    background: #fef2f2;
                }

                .completed-info {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    margin: 12px 0 0 0;
                    text-align: right;
                }
            `}</style>
        </>
    );
}
