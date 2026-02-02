'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { getProjects, deleteProject, archiveProject } from '@/lib/services/projects';
import { Project, ProjectStatus, ProjectScope } from '@/lib/database.types';
import {
    Plus,
    DotsThreeVertical,
    MapPin,
    Calendar,
    FolderOpen,
    Crown,
    PencilSimple,
    Trash,
    ShareNetwork,
    Archive,
    MagnifyingGlass,
    Funnel,
    SortAscending,
    X,
    CaretDown,
} from '@phosphor-icons/react';

type SortOption = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'budget_desc' | 'budget_asc';

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

function ProjectsContent() {
    const router = useRouter();
    const { profile, canCreateProject, projectCount } = useAuth();
    const { success, error: showError } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Filter and sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
    const [scopeFilter, setScopeFilter] = useState<ProjectScope | 'all'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('updated_desc');

    // Filter and sort projects
    const filteredProjects = useMemo(() => {
        let result = [...projects];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.location && p.location.toLowerCase().includes(query))
            );
        }

        // Apply status filter
        if (statusFilter !== 'all') {
            result = result.filter(p => p.status === statusFilter);
        }

        // Apply scope filter
        if (scopeFilter !== 'all') {
            result = result.filter(p => p.scope === scopeFilter);
        }

        // Apply sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'updated_desc':
                    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                case 'updated_asc':
                    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'budget_desc':
                    return Number(b.total_usd) - Number(a.total_usd);
                case 'budget_asc':
                    return Number(a.total_usd) - Number(b.total_usd);
                default:
                    return 0;
            }
        });

        return result;
    }, [projects, searchQuery, statusFilter, scopeFilter, sortBy]);

    const activeFilterCount = [
        statusFilter !== 'all',
        scopeFilter !== 'all',
    ].filter(Boolean).length;

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setScopeFilter('all');
        setSortBy('updated_desc');
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuToggle = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(openMenuId === projectId ? null : projectId);
    };

    const handleEdit = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        router.push(`/projects/${projectId}`);
    };

    const handleShare = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        router.push(`/projects/${projectId}?share=true`);
    };

    const handleArchive = async (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);

        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const { error } = await archiveProject(projectId);

        if (error) {
            showError('Failed to archive project. Please try again.');
        } else {
            // Update local state to reflect the change
            setProjects(projects.map(p =>
                p.id === projectId ? { ...p, status: 'archived' as const } : p
            ));
            success(`"${project.name}" has been archived`);
        }
    };

    const handleDelete = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenuId(null);
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setDeleteTarget({ id: projectId, name: project.name });
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        const { error } = await deleteProject(deleteTarget.id);

        if (error) {
            showError('Failed to delete project. Please try again.');
        } else {
            setProjects(projects.filter(p => p.id !== deleteTarget.id));
            success(`"${deleteTarget.name}" has been deleted`);
        }

        setIsDeleting(false);
        setDeleteTarget(null);
    };

    useEffect(() => {
        async function loadProjects() {
            setIsLoading(true);
            setError(null);

            const { projects: loadedProjects, error: loadError } = await getProjects();

            if (loadError) {
                setError(loadError.message);
            } else {
                setProjects(loadedProjects);
            }

            setIsLoading(false);
        }

        loadProjects();
    }, []);

    const statusColors: Record<string, 'success' | 'accent' | 'default'> = {
        active: 'success',
        draft: 'default',
        completed: 'accent',
        archived: 'default',
    };

    return (
        <MainLayout title="Projects">
            <div className="projects-page">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <p className="page-subtitle">Manage your construction estimates</p>
                        {profile?.tier === 'free' && (
                            <p className="tier-info">
                                <Crown size={14} />
                                Free plan: {projectCount}/3 projects used
                            </p>
                        )}
                    </div>
                    <Link href="/boq/new">
                        <Button
                            icon={<Plus size={18} weight="bold" />}
                            disabled={!canCreateProject()}
                            title={!canCreateProject() ? 'Project limit reached. Upgrade to Pro.' : ''}
                        >
                            New Project
                        </Button>
                    </Link>
                </div>

                {/* Filters Bar */}
                {projects.length > 0 && (
                    <div className="filters-bar">
                        <div className="search-box">
                            <MagnifyingGlass size={18} weight="light" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="clear-search" onClick={() => setSearchQuery('')}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="filter-group">
                            <div className="filter-select">
                                <Funnel size={16} weight="light" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                                >
                                    <option value="all">All Status</option>
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="archived">Archived</option>
                                </select>
                                <CaretDown size={14} />
                            </div>

                            <div className="filter-select">
                                <select
                                    value={scopeFilter}
                                    onChange={(e) => setScopeFilter(e.target.value as ProjectScope | 'all')}
                                >
                                    <option value="all">All Scopes</option>
                                    <option value="entire_house">Entire House</option>
                                    <option value="substructure">Substructure</option>
                                    <option value="superstructure">Superstructure</option>
                                    <option value="roofing">Roofing</option>
                                    <option value="finishing">Finishing</option>
                                    <option value="exterior">Exterior</option>
                                </select>
                                <CaretDown size={14} />
                            </div>

                            <div className="filter-select">
                                <SortAscending size={16} weight="light" />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                >
                                    <option value="updated_desc">Recently Updated</option>
                                    <option value="updated_asc">Oldest First</option>
                                    <option value="name_asc">Name A-Z</option>
                                    <option value="name_desc">Name Z-A</option>
                                    <option value="budget_desc">Budget High-Low</option>
                                    <option value="budget_asc">Budget Low-High</option>
                                </select>
                                <CaretDown size={14} />
                            </div>
                        </div>

                        {activeFilterCount > 0 && (
                            <button className="clear-filters" onClick={clearFilters}>
                                Clear filters ({activeFilterCount})
                            </button>
                        )}
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading projects...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div className="error-state">
                        <p>Failed to load projects: {error}</p>
                        <Button variant="secondary" onClick={() => window.location.reload()}>
                            Retry
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && projects.length === 0 && (
                    <Card className="empty-state">
                        <FolderOpen size={64} weight="light" />
                        <h3>No projects yet</h3>
                        <p>Create your first construction estimate to get started</p>
                        <Link href="/boq/new">
                            <Button icon={<Plus size={18} />}>
                                Create First Project
                            </Button>
                        </Link>
                    </Card>
                )}

                {/* No Results State */}
                {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && (
                    <Card className="empty-state">
                        <MagnifyingGlass size={48} weight="light" />
                        <h3>No matching projects</h3>
                        <p>Try adjusting your search or filters</p>
                        <Button variant="secondary" onClick={clearFilters}>
                            Clear Filters
                        </Button>
                    </Card>
                )}

                {/* Projects Grid */}
                {!isLoading && !error && filteredProjects.length > 0 && (
                    <div className="projects-grid">
                        {filteredProjects.map((project) => (
                            <Link key={project.id} href={`/projects/${project.id}`} className="project-link">
                                <Card className="project-card">
                                    <CardHeader>
                                        <div className="project-header">
                                            <CardTitle>{project.name}</CardTitle>
                                            <CardBadge variant={statusColors[project.status] || 'default'}>
                                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                            </CardBadge>
                                        </div>
                                        <div className="menu-container" ref={openMenuId === project.id ? menuRef : null}>
                                            <button className="menu-btn" onClick={(e) => handleMenuToggle(e, project.id)}>
                                                <DotsThreeVertical size={20} weight="bold" />
                                            </button>
                                            {openMenuId === project.id && (
                                                <div className="dropdown-menu">
                                                    <button onClick={(e) => handleEdit(e, project.id)}>
                                                        <PencilSimple size={16} /> Edit
                                                    </button>
                                                    <button onClick={(e) => handleShare(e, project.id)}>
                                                        <ShareNetwork size={16} /> Share
                                                    </button>
                                                    <button onClick={(e) => handleArchive(e, project.id)}>
                                                        <Archive size={16} /> Archive
                                                    </button>
                                                    <button className="danger" onClick={(e) => handleDelete(e, project.id)}>
                                                        <Trash size={16} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <div className="project-meta">
                                        {project.location && (
                                            <span className="meta-item">
                                                <MapPin size={14} weight="light" />
                                                {project.location}
                                            </span>
                                        )}
                                        <span className="meta-item">
                                            <Calendar size={14} weight="light" />
                                            {new Date(project.updated_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="project-budget">
                                        <span className="budget-label">Budget</span>
                                        <span className="budget-value">
                                            <PriceDisplay
                                                priceUsd={Number(project.total_usd)}
                                                priceZwg={Number(project.total_zwg)}
                                            />
                                        </span>
                                    </div>

                                    <div className="project-details">
                                        <span className="detail-item">
                                            {project.scope.replace('_', ' ')}
                                        </span>
                                        <span className="detail-item">
                                            {project.labor_preference === 'with_labor' ? 'With Labor' : 'Materials Only'}
                                        </span>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Upgrade Prompt for Free Users */}
                {profile?.tier === 'free' && projects.length >= 3 && (
                    <Card className="upgrade-prompt">
                        <div className="upgrade-content">
                            <Crown size={32} weight="duotone" />
                            <div>
                                <h4>Need more projects?</h4>
                                <p>Upgrade to Pro for unlimited projects and AI features</p>
                            </div>
                            <Link href="/upgrade">
                                <Button>Upgrade to Pro</Button>
                            </Link>
                        </div>
                    </Card>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title="Delete Project"
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and all associated data will be permanently removed.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeleting}
            />

            <style jsx>{`
                .projects-page {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xl);
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .page-subtitle {
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                .filters-bar {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    flex-wrap: wrap;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    flex: 1;
                    min-width: 200px;
                    max-width: 300px;
                }

                .search-box input {
                    border: none;
                    background: transparent;
                    outline: none;
                    flex: 1;
                    font-size: 0.875rem;
                    color: var(--color-text);
                }

                .search-box input::placeholder {
                    color: var(--color-text-muted);
                }

                .clear-search {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    color: var(--color-text-muted);
                    cursor: pointer;
                    padding: 2px;
                    border-radius: var(--radius-sm);
                }

                .clear-search:hover {
                    background: var(--color-border-light);
                    color: var(--color-text);
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .filter-select {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    position: relative;
                    color: var(--color-text-secondary);
                }

                .filter-select select {
                    appearance: none;
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 0.875rem;
                    color: var(--color-text);
                    cursor: pointer;
                    padding-right: var(--spacing-md);
                }

                .filter-select > :global(svg:last-child) {
                    position: absolute;
                    right: var(--spacing-sm);
                    pointer-events: none;
                }

                .clear-filters {
                    background: none;
                    border: none;
                    color: var(--color-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--radius-sm);
                }

                .clear-filters:hover {
                    background: rgba(20, 33, 61, 0.05);
                    text-decoration: underline;
                }

                .tier-info {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    font-size: 0.75rem;
                    color: var(--color-accent);
                    margin: var(--spacing-xs) 0 0 0;
                }

                .loading-state,
                .error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    gap: var(--spacing-md);
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--color-border);
                    border-top-color: var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .loading-state p,
                .error-state p {
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                :global(.empty-state) {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl) !important;
                    text-align: center;
                    color: var(--color-text-muted);
                }

                :global(.empty-state) h3 {
                    margin: var(--spacing-md) 0 var(--spacing-xs) 0;
                    color: var(--color-text);
                }

                :global(.empty-state) p {
                    margin: 0 0 var(--spacing-lg) 0;
                }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-lg);
                }

                .project-link {
                    text-decoration: none;
                    color: inherit;
                    cursor: pointer;
                    display: block;
                }

                :global(.project-card) {
                    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
                    cursor: pointer;
                    position: relative;
                }

                :global(.project-card:hover) {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
                    border-color: var(--color-accent);
                }

                :global(.project-card::after) {
                    content: 'View Project →';
                    position: absolute;
                    bottom: var(--spacing-md);
                    right: var(--spacing-md);
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--color-accent);
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }

                :global(.project-card:hover::after) {
                    opacity: 1;
                }

                .project-header {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    flex: 1;
                }

                .menu-btn {
                    background: none;
                    border: none;
                    padding: var(--spacing-xs);
                    cursor: pointer;
                    color: var(--color-text-muted);
                    border-radius: var(--radius-sm);
                }

                .menu-btn:hover {
                    background: var(--color-border-light);
                    color: var(--color-text);
                }

                .menu-container {
                    position: relative;
                }

                .dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    z-index: 100;
                    min-width: 160px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    padding: var(--spacing-xs);
                    display: flex;
                    flex-direction: column;
                }

                .dropdown-menu button {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    width: 100%;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: none;
                    border: none;
                    font-size: 0.875rem;
                    color: var(--color-text);
                    cursor: pointer;
                    border-radius: var(--radius-sm);
                    text-align: left;
                }

                .dropdown-menu button:hover {
                    background: var(--color-background);
                }

                .dropdown-menu button.danger {
                    color: var(--color-error);
                }

                .dropdown-menu button.danger:hover {
                    background: rgba(239, 68, 68, 0.1);
                }

                .project-meta {
                    display: flex;
                    gap: var(--spacing-md);
                    margin-top: var(--spacing-md);
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }

                .project-budget {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: var(--spacing-lg);
                    padding-top: var(--spacing-md);
                    border-top: 1px solid var(--color-border-light);
                }

                .budget-label {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .budget-value {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .project-details {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-top: var(--spacing-md);
                    flex-wrap: wrap;
                }

                .detail-item {
                    font-size: 0.625rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 2px 8px;
                    background: var(--color-background);
                    border-radius: var(--radius-sm);
                    color: var(--color-text-secondary);
                }

                :global(.upgrade-prompt) {
                    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
                    color: white;
                }

                .upgrade-content {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-lg);
                }

                .upgrade-content h4 {
                    margin: 0;
                    font-size: 1rem;
                }

                .upgrade-content p {
                    margin: var(--spacing-xs) 0 0 0;
                    opacity: 0.9;
                    font-size: 0.875rem;
                }

                .upgrade-content > div {
                    flex: 1;
                }

                @media (max-width: 1200px) {
                    .projects-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .projects-grid {
                        grid-template-columns: 1fr;
                    }

                    .page-header {
                        flex-direction: column;
                        gap: var(--spacing-md);
                    }

                    .upgrade-content {
                        flex-direction: column;
                        text-align: center;
                    }
                }
            `}</style>
        </MainLayout>
    );
}

export default function ProjectsPage() {
    return (
        <ProtectedRoute>
            <ProjectsContent />
        </ProtectedRoute>
    );
}
