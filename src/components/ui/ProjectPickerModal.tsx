'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { getProjects } from '@/lib/services/projects';
import { Project } from '@/lib/database.types';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
    X,
    FolderOpen,
    MapPin,
    Check,
    Plus,
} from '@phosphor-icons/react';

interface ProjectPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (project: Project) => void;
    title?: string;
    description?: string;
}

export default function ProjectPickerModal({
    isOpen,
    onClose,
    onSelect,
    title = 'Select Project',
    description = 'Choose a project to add the item to',
}: ProjectPickerModalProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { formatPrice } = useCurrency();

    const loadProjects = useCallback(async () => {
        setIsLoading(true);
        const { projects: loadedProjects } = await getProjects();
        // Only show active/draft projects
        setProjects(loadedProjects.filter(p => p.status !== 'archived' && p.status !== 'completed'));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadProjects();
        }
    }, [isOpen, loadProjects]);

    const handleConfirm = () => {
        const selected = projects.find(p => p.id === selectedId);
        if (selected) {
            onSelect(selected);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="modal-header">
                        <div>
                            <h2>{title}</h2>
                            <p className="modal-description">{description}</p>
                        </div>
                        <button className="close-btn" onClick={onClose}>
                            <X size={20} weight="bold" />
                        </button>
                    </div>

                    {/* Projects List */}
                    <div className="projects-list">
                        {isLoading ? (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Loading projects...</p>
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="empty-state">
                                <FolderOpen size={48} weight="light" />
                                <p>No active projects</p>
                                <Button
                                    variant="secondary"
                                    icon={<Plus size={16} />}
                                    onClick={() => window.location.href = '/boq/new'}
                                >
                                    Create New Project
                                </Button>
                            </div>
                        ) : (
                            projects.map((project) => (
                                <button
                                    key={project.id}
                                    className={`project-item ${selectedId === project.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedId(project.id)}
                                >
                                    <div className="project-info">
                                        <span className="project-name">{project.name}</span>
                                        {project.location && (
                                            <span className="project-location">
                                                <MapPin size={12} /> {project.location}
                                            </span>
                                        )}
                                    </div>
                                    <div className="project-meta">
                                        <span className="project-total">
                                            {formatPrice(Number(project.total_usd), Number(project.total_zwg))}
                                        </span>
                                        {selectedId === project.id && (
                                            <span className="check-icon">
                                                <Check size={18} weight="bold" />
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {projects.length > 0 && (
                        <div className="modal-footer">
                            <Button variant="secondary" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={!selectedId}
                            >
                                Add to Project
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: var(--spacing-lg);
                }

                .modal-content {
                    background: var(--color-surface);
                    border-radius: var(--radius-xl);
                    width: 100%;
                    max-width: 480px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-lg);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: var(--spacing-xl);
                    border-bottom: 1px solid var(--color-border-light);
                }

                .modal-header h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0;
                }

                .modal-description {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin: var(--spacing-xs) 0 0 0;
                }

                .close-btn {
                    background: none;
                    border: none;
                    padding: var(--spacing-xs);
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                }

                .close-btn:hover {
                    background: var(--color-border-light);
                    color: var(--color-text);
                }

                .projects-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--spacing-md);
                }

                .loading-state,
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl);
                    gap: var(--spacing-md);
                    color: var(--color-text-muted);
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--color-border);
                    border-top-color: var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .project-item {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md);
                    background: var(--color-background);
                    border: 2px solid transparent;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    margin-bottom: var(--spacing-sm);
                    text-align: left;
                }

                .project-item:hover {
                    border-color: var(--color-border);
                }

                .project-item.selected {
                    border-color: var(--color-primary);
                    background: rgba(78, 154, 247, 0.05);
                }

                .project-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .project-name {
                    font-size: 0.9375rem;
                    font-weight: 500;
                    color: var(--color-text);
                }

                .project-location {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }

                .project-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .project-total {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                }

                .check-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: var(--color-primary);
                    color: white;
                    border-radius: 50%;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-lg);
                    border-top: 1px solid var(--color-border-light);
                }
            `}</style>
        </>
    );
}
