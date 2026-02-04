'use client';

import { useState } from 'react';
import { Check, Trash, Circle, CircleNotch } from '@phosphor-icons/react';
import { MilestoneTask } from '@/lib/database.types';

interface TaskItemProps {
    task: MilestoneTask;
    onToggle: (taskId: string, completed: boolean) => Promise<void>;
    onDelete: (taskId: string) => Promise<void>;
}

export default function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleToggle = async () => {
        setIsUpdating(true);
        await onToggle(task.id, !task.is_completed);
        setIsUpdating(false);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete(task.id);
        setIsDeleting(false);
    };

    return (
        <>
            <div className={`task-item ${task.is_completed ? 'completed' : ''}`}>
                <button
                    className="checkbox"
                    onClick={handleToggle}
                    disabled={isUpdating}
                >
                    {isUpdating ? (
                        <CircleNotch size={18} className="spinner" />
                    ) : task.is_completed ? (
                        <Check size={18} weight="bold" />
                    ) : (
                        <Circle size={18} weight="light" />
                    )}
                </button>

                <span className="task-title">{task.title}</span>

                <button
                    className="delete-btn"
                    onClick={handleDelete}
                    disabled={isDeleting}
                >
                    {isDeleting ? (
                        <CircleNotch size={14} className="spinner" />
                    ) : (
                        <Trash size={14} />
                    )}
                </button>
            </div>

            <style jsx>{`
                .task-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--color-background);
                    border-radius: var(--radius-md);
                    transition: all 0.2s ease;
                }

                .task-item:hover {
                    background: var(--color-surface);
                }

                .task-item.completed {
                    opacity: 0.7;
                }

                .checkbox {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-text-muted);
                    transition: color 0.2s ease;
                }

                .checkbox:hover {
                    color: var(--color-primary);
                }

                .task-item.completed .checkbox {
                    color: var(--color-success);
                }

                .task-title {
                    flex: 1;
                    font-size: 0.875rem;
                    color: var(--color-text);
                }

                .task-item.completed .task-title {
                    text-decoration: line-through;
                    color: var(--color-text-muted);
                }

                .delete-btn {
                    opacity: 0;
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
                    transition: all 0.2s ease;
                }

                .task-item:hover .delete-btn {
                    opacity: 1;
                }

                .delete-btn:hover {
                    background: var(--color-error-bg);
                    color: var(--color-error);
                }

                :global(.spinner) {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}
