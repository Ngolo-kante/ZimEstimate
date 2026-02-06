'use client';

import { useState } from 'react';
import StageTaskItem from './StageTaskItem';
import Button from '@/components/ui/Button';
import { StageTask } from '@/lib/database.types';
import { Plus, ListChecks, CaretDown, CaretUp } from '@phosphor-icons/react';

interface StageTaskListProps {
    tasks: StageTask[];
    onAddTask: (data: { title: string; description?: string }) => Promise<void>;
    onToggleTask: (taskId: string, completed: boolean) => Promise<void>;
    onUpdateTask: (taskId: string, updates: Partial<StageTask>) => Promise<void>;
    onDeleteTask: (taskId: string) => Promise<void>;
}

export default function StageTaskList({
    tasks,
    onAddTask,
    onToggleTask,
    onUpdateTask,
    onDeleteTask,
}: StageTaskListProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const completedCount = tasks.filter(t => t.is_completed).length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;

        setIsCreating(true);
        await onAddTask({ title: newTaskTitle.trim() });
        setNewTaskTitle('');
        setShowAddForm(false);
        setIsCreating(false);
    };

    return (
        <>
            <div className="task-list-section">
                <div className="section-header">
                    <div className="header-title">
                        <ListChecks size={20} weight="duotone" />
                        <h4>Admin & Compliance Tasks</h4>
                    </div>
                    <div className="header-meta">
                        {!showAddForm && !isCollapsed && (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Plus size={14} />}
                                onClick={() => setShowAddForm(true)}
                            >
                                Add Task
                            </Button>
                        )}
                        <button
                            className="collapse-btn"
                            onClick={() => {
                                setIsCollapsed(prev => !prev);
                                if (!isCollapsed) {
                                    setShowAddForm(false);
                                }
                            }}
                        >
                            {isCollapsed ? 'Expand' : 'Collapse'}
                            {isCollapsed ? <CaretDown size={14} /> : <CaretUp size={14} />}
                        </button>
                    </div>
                </div>

                {!isCollapsed && (
                    <>
                        {/* Add Task Form */}
                        {showAddForm && (
                            <div className="add-task-form">
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    placeholder="Enter task title..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                    autoFocus
                                />
                                <div className="form-actions">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setShowAddForm(false);
                                            setNewTaskTitle('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleAddTask}
                                        loading={isCreating}
                                        disabled={!newTaskTitle.trim()}
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Task List */}
                        {tasks.length === 0 && !showAddForm ? (
                            <div className="empty-state">
                                <ListChecks size={32} weight="light" />
                                <p>No tasks yet</p>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={<Plus size={14} />}
                                    onClick={() => setShowAddForm(true)}
                                >
                                    Add First Task
                                </Button>
                            </div>
                        ) : (
                            <div className="tasks-list">
                                {tasks.map((task) => (
                                    <StageTaskItem
                                        key={task.id}
                                        task={task}
                                        onToggle={(completed) => onToggleTask(task.id, completed)}
                                        onUpdate={(updates) => onUpdateTask(task.id, updates)}
                                        onDelete={() => onDeleteTask(task.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <style jsx>{`
                .task-list-section {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    box-shadow: 0 12px 24px rgba(6, 20, 47, 0.06);
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md) var(--spacing-lg);
                    background: rgba(6, 20, 47, 0.02);
                    border-bottom: 1px solid var(--color-border-light);
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    color: var(--color-primary);
                }

                .header-title h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                }

                .header-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .collapse-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    background: rgba(6, 20, 47, 0.04);
                    border: 1px solid rgba(6, 20, 47, 0.08);
                    border-radius: var(--radius-full);
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .collapse-btn:hover {
                    border-color: var(--color-primary);
                    color: var(--color-text);
                }

                .add-task-form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-md);
                    background: rgba(78, 154, 247, 0.08);
                    border-bottom: 1px solid var(--color-border-light);
                }

                .add-task-form input {
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    background: var(--color-surface);
                }

                .add-task-form input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-sm);
                }

                .tasks-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    background: rgba(6, 20, 47, 0.04);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-xl);
                    text-align: center;
                    color: var(--color-text-muted);
                    background: rgba(6, 20, 47, 0.02);
                }

                .empty-state p {
                    margin: var(--spacing-sm) 0;
                    font-size: 0.875rem;
                }

                @media (max-width: 480px) {
                    .section-header {
                        flex-direction: column;
                        gap: var(--spacing-sm);
                        align-items: flex-start;
                    }

                    .header-meta {
                        width: 100%;
                        justify-content: space-between;
                    }
                }
            `}</style>
        </>
    );
}
