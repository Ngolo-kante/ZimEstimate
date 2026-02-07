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
                            aria-label={isCollapsed ? 'Expand tasks' : 'Collapse tasks'}
                        >
                            {isCollapsed ? <CaretDown size={16} /> : <CaretUp size={16} />}
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
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 
                                0 2px 4px -1px rgba(0, 0, 0, 0.01);
                    margin-bottom: 24px;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: #ffffff;
                    border-bottom: 1px solid #f1f5f9;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .header-title svg {
                    color: #2563eb;
                }

                .header-title h4 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .header-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .collapse-btn {
                    width: 32px;
                    height: 32px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .collapse-btn:hover {
                    color: #475569;
                    background: #f1f5f9;
                }

                .add-task-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 20px 24px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }

                .add-task-form input {
                    padding: 12px 16px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    background: #ffffff;
                    width: 100%;
                }

                .add-task-form input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }

                .tasks-list {
                    display: flex;
                    flex-direction: column;
                    padding: 8px 0;
                    background: #ffffff;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 24px;
                    text-align: center;
                    color: #64748b;
                }
                
                .empty-state svg {
                    margin-bottom: 12px;
                    color: #cbd5e1;
                }

                .empty-state p {
                    margin: 0 0 16px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: #334155;
                }

                @media (max-width: 480px) {
                    .section-header {
                        padding: 16px 20px;
                    }
                    .add-task-form {
                        padding: 16px 20px;
                    }
                }
            `}</style>
        </>
    );
}
