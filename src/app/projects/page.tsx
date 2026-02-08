'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { ProjectCardSkeleton, KpiSkeleton } from '@/components/ui/Skeleton';
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
    TrendUp,
} from '@phosphor-icons/react';

type SortOption = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'budget_desc' | 'budget_asc';

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

const formatStageLabel = (stage: string) => stage.replace('_', ' ');

const formatScopeLabel = (project: Project) => {
    if (project.selected_stages && project.selected_stages.length > 0) {
        return project.selected_stages.map(formatStageLabel).join(', ');
    }
    return project.scope.replace('_', ' ');
};

function ProjectsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, canCreateProject, projectCount } = useAuth();
    const { success, error: showError } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [optimisticProject, setOptimisticProject] = useState<{ id: string; name: string; location: string } | null>(null);
    const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuProjectId, setMobileMenuProjectId] = useState<string | null>(null);

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
            result = result.filter(p =>
                p.scope === scopeFilter ||
                (p.selected_stages && p.selected_stages.includes(scopeFilter))
            );
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

    const projectStats = useMemo(() => {
        const total = projects.length;
        const active = projects.filter(p => p.status === 'active').length;
        const completed = projects.filter(p => p.status === 'completed').length;
        const draft = projects.filter(p => p.status === 'draft').length;
        const totalBudget = projects.reduce((sum, p) => sum + Number(p.total_usd || 0), 0);
        return { total, active, completed, draft, totalBudget };
    }, [projects]);

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

    // Mobile detection
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

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
        if (isMobile) {
            setMobileMenuProjectId(projectId);
        } else {
            setOpenMenuId(openMenuId === projectId ? null : projectId);
        }
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

    // Load projects function - extracted for reuse
    const loadProjects = useCallback(async (showLoadingState = true) => {
        if (showLoadingState) {
            setIsLoading(true);
        }
        setError(null);

        const { projects: loadedProjects, error: loadError } = await getProjects();

        if (loadError) {
            setError(loadError.message);
        } else {
            setProjects(loadedProjects);
        }

        if (showLoadingState) {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle optimistic project creation
    useEffect(() => {
        if (searchParams.get('created') === '1') {
            try {
                const stored = sessionStorage.getItem('zimestimate_optimistic_project');
                if (stored) {
                    const data = JSON.parse(stored);
                    setOptimisticProject({ id: data.id, name: data.name, location: data.location });
                }
            } catch {}
            router.replace('/projects');
        }
    }, [searchParams, router]);

    // When real projects load and we have an optimistic card, transition to highlight
    useEffect(() => {
        if (!optimisticProject || isLoading) return;
        const found = projects.find(p => p.id === optimisticProject.id);
        if (found) {
            setOptimisticProject(null);
            setHighlightedProjectId(found.id);
            try { sessionStorage.removeItem('zimestimate_optimistic_project'); } catch {}
            setTimeout(() => setHighlightedProjectId(null), 3000);
        }
    }, [projects, optimisticProject, isLoading]);

    // Refresh when coming from create/delete flows
    useEffect(() => {
        if (searchParams.get('refresh') === '1') {
            loadProjects(false);
            router.replace('/projects');
        }
    }, [searchParams, loadProjects, router]);

    // Auto-refresh when window gains focus (useful after creating a project)
    useEffect(() => {
        const handleFocus = () => {
            loadProjects(false); // Refresh silently without loading state
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [loadProjects]);

    // Periodic refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            loadProjects(false); // Silent refresh
        }, 30000);

        return () => clearInterval(interval);
    }, [loadProjects]);

    const statusColors: Record<string, 'success' | 'accent' | 'default'> = {
        active: 'success',
        draft: 'default',
        completed: 'accent',
        archived: 'default',
    };

    return (
        <MainLayout title="My Projects" fullWidth>
            <div className="projects-page">
                {/* Hero KPI Section - Global Portfolio Stats */}
                <div className="hero-kpi-section">
                    <div className="kpi-card highlight">
                        <div className="kpi-icon">
                            <Crown size={24} weight="duotone" className="text-blue-500" />
                        </div>
                        {isLoading ? (
                            <KpiSkeleton />
                        ) : (
                            <div className="kpi-content">
                                <div className="kpi-label">Total Portfolio Spend</div>
                                <div className="kpi-value">
                                    <PriceDisplay priceUsd={projectStats.totalBudget} priceZwg={projectStats.totalBudget * 30} />
                                </div>
                                <div className="kpi-trend positive">
                                    <TrendUp size={14} /> +12% vs last month
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="kpi-card">
                        {isLoading ? (
                            <KpiSkeleton />
                        ) : (
                            <>
                                <div className="kpi-label">Combined Budget vs Actual</div>
                                <div className="kpi-value">$0.00 <span className="text-sm text-slate-400 font-normal">/ {useCurrency().formatPrice(projectStats.totalBudget, projectStats.totalBudget * 30)}</span></div>
                                <div className="kpi-bar-container">
                                    <div className="kpi-bar-bg">
                                        <div className="kpi-bar-fill" style={{ width: '0%' }}></div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="kpi-card">
                        {isLoading ? (
                            <KpiSkeleton />
                        ) : (
                            <>
                                <div className="kpi-label">Avg. Price Variance</div>
                                <div className="kpi-value text-green-600">-2.4%</div>
                                <div className="kpi-sub">Under Budget</div>
                            </>
                        )}
                    </div>

                    <div className="kpi-card actions-card">
                        <Link href="/boq/new" className="w-full">
                            <Button
                                icon={<Plus size={18} weight="bold" />}
                                disabled={!canCreateProject()}
                                title={!canCreateProject() ? 'Project limit reached. Upgrade to Pro.' : ''}
                                className="w-full justify-center"
                            >
                                New Project
                            </Button>
                        </Link>
                        <div className="tier-status">
                            {profile?.tier === 'free' ? (
                                <span className="text-xs text-slate-500">Free Tier: {projectCount}/3 used</span>
                            ) : (
                                <span className="text-xs text-blue-600 font-medium">Pro Plan Active</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="page-divider"></div>

                {/* Filters Bar */}
                <div className="page-header-row">
                    <h2 className="section-title">All Projects</h2>
                </div>

                {/* Filters Bar */}
                {projects.length > 0 && (
                    <div className="filters-bar">
                        <div className="filters-top-row">
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

                            {isMobile && (
                                <button className="filter-toggle-btn" onClick={() => setShowFilters(prev => !prev)}>
                                    <Funnel size={18} weight="light" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span className="filter-badge">{activeFilterCount}</span>
                                    )}
                                </button>
                            )}
                        </div>

                        <div className={`filter-group${isMobile ? ' mobile-filters' : ''}${isMobile && !showFilters ? ' hidden' : ''}`}>
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

                            {activeFilterCount > 0 && (
                                <button className="clear-filters" onClick={clearFilters}>
                                    Clear filters ({activeFilterCount})
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading State - Skeleton Cards */}
                {isLoading && (
                    <div className="projects-grid">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <ProjectCardSkeleton key={i} />
                        ))}
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
                {!isLoading && !error && (filteredProjects.length > 0 || optimisticProject) && (
                    <div className="projects-grid">
                        {/* Optimistic "Creating..." card */}
                        {optimisticProject && (
                            <div className="project-link">
                                <Card className="project-card creating">
                                    <CardHeader>
                                        <div className="project-header">
                                            <CardTitle>{optimisticProject.name}</CardTitle>
                                            <CardBadge variant="default">Creating...</CardBadge>
                                        </div>
                                    </CardHeader>
                                    <div className="project-meta">
                                        {optimisticProject.location && (
                                            <span className="meta-item">
                                                <MapPin size={14} weight="light" />
                                                {optimisticProject.location}
                                            </span>
                                        )}
                                    </div>
                                    <div className="project-budget">
                                        <span className="budget-label">Budget</span>
                                        <span className="budget-value">--</span>
                                    </div>
                                </Card>
                            </div>
                        )}
                        {filteredProjects.map((project) => (
                            <Link key={project.id} href={`/projects/${project.id}`} className="project-link">
                                <Card className={`project-card${highlightedProjectId === project.id ? ' highlight-new' : ''}`}>
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
                                            {formatScopeLabel(project)}
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

            {/* Mobile Bottom Sheet Menu */}
            {isMobile && mobileMenuProjectId && (
                <>
                    <div className="mobile-menu-backdrop" onClick={() => setMobileMenuProjectId(null)} />
                    <div className="mobile-bottom-sheet">
                        <div className="bottom-sheet-handle" />
                        <button className="bottom-sheet-item" onClick={(e) => { handleEdit(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                            <PencilSimple size={20} /> Edit
                        </button>
                        <button className="bottom-sheet-item" onClick={(e) => { handleShare(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                            <ShareNetwork size={20} /> Share
                        </button>
                        <button className="bottom-sheet-item" onClick={(e) => { handleArchive(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                            <Archive size={20} /> Archive
                        </button>
                        <button className="bottom-sheet-item danger" onClick={(e) => { handleDelete(e, mobileMenuProjectId); setMobileMenuProjectId(null); }}>
                            <Trash size={20} /> Delete
                        </button>
                    </div>
                </>
            )}

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
                .hero-kpi-section {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--spacing-lg);
                    margin-bottom: var(--spacing-xl);
                }

                .kpi-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    padding: var(--spacing-lg);
                    border: 1px solid var(--color-border-light);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-height: 140px;
                }

                .kpi-card.highlight {
                    background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
                    border-color: #bfdbfe;
                }

                .kpi-card.actions-card {
                    background: transparent;
                    border: 1px dashed var(--color-border);
                    box-shadow: none;
                    justify-content: center;
                    align-items: center;
                    gap: 12px;
                }

                .kpi-icon {
                    margin-bottom: 12px;
                }

                .kpi-label {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                .kpi-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--color-text);
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                }

                .kpi-trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.875rem;
                    margin-top: 8px;
                }

                .kpi-trend.positive {
                    color: var(--color-success);
                }

                .kpi-sub {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin-top: 4px;
                }

                .kpi-bar-container {
                    margin-top: 12px;
                }

                .kpi-bar-bg {
                    height: 6px;
                    background: var(--color-background);
                    border-radius: 999px;
                    overflow: hidden;
                }

                .kpi-bar-fill {
                    height: 100%;
                    background: var(--color-primary);
                    border-radius: 999px;
                }
                
                .page-divider {
                    height: 1px;
                    background: var(--color-border-light);
                    margin: 0 0 var(--spacing-xl) 0;
                }

                .page-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-lg);
                }

                .section-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin: 0;
                }

                .tier-status {
                    margin-top: 8px;
                    text-align: center;
                }

                /* Responsive adjustments */
                @media (max-width: 1024px) {
                    .hero-kpi-section {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 640px) {
                    .hero-kpi-section {
                        grid-template-columns: 1fr;
                    }
                }

                .projects-page {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--spacing-lg);
                }

                :global(.summary-card) {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .summary-label {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--color-text-muted);
                    font-weight: 600;
                }

                .summary-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--color-text);
                }

                .summary-sub {
                    font-size: 0.8125rem;
                    color: var(--color-text-secondary);
                }

                .page-subtitle {
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                .filters-bar {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .filters-top-row {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .filter-toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    white-space: nowrap;
                    min-height: 44px;
                    box-shadow: 0 10px 20px rgba(6, 20, 47, 0.06);
                }

                .filter-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-primary);
                    color: white;
                    font-size: 0.625rem;
                    font-weight: 700;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    flex: 1;
                    min-width: 200px;
                    max-width: 300px;
                    box-shadow: 0 10px 20px rgba(6, 20, 47, 0.06);
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
                    background: #ffffff;
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    position: relative;
                    color: var(--color-text-secondary);
                    box-shadow: 0 10px 20px rgba(6, 20, 47, 0.06);
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
                    background: rgba(78, 154, 247, 0.08);
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
                    box-shadow: 0 18px 36px rgba(6, 20, 47, 0.12);
                    border-color: rgba(78, 154, 247, 0.35);
                }

                :global(.project-card::after) {
                    content: 'View Project →';
                    position: absolute;
                    bottom: var(--spacing-md);
                    right: var(--spacing-md);
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--color-primary);
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
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-md);
                    box-shadow: 0 18px 32px rgba(6, 20, 47, 0.14);
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
                    background: rgba(6, 20, 47, 0.04);
                    border-radius: var(--radius-sm);
                    color: var(--color-text-secondary);
                }

                :global(.upgrade-prompt) {
                    background: linear-gradient(135deg, rgba(6, 20, 47, 0.9) 0%, rgba(78, 154, 247, 0.9) 100%);
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
                    .summary-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .projects-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                :global(.project-card.creating) {
                    animation: pulse-creating 1.5s ease-in-out infinite;
                    border-color: rgba(78, 154, 247, 0.4);
                    pointer-events: none;
                }

                @keyframes pulse-creating {
                    0%, 100% { opacity: 1; box-shadow: 0 4px 6px -1px rgba(78, 154, 247, 0.1); }
                    50% { opacity: 0.7; box-shadow: 0 4px 20px rgba(78, 154, 247, 0.25); }
                }

                :global(.project-card.highlight-new) {
                    animation: highlight-glow 3s ease-out forwards;
                }

                @keyframes highlight-glow {
                    0% { box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.5), 0 18px 36px rgba(78, 154, 247, 0.2); border-color: rgba(78, 154, 247, 0.5); }
                    100% { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border-color: var(--color-border-light); }
                }

                @media (max-width: 768px) {
                    .summary-grid {
                        grid-template-columns: 1fr;
                    }

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

                    .search-box {
                        max-width: none;
                        min-width: 0;
                    }

                    .filter-group.mobile-filters {
                        flex-direction: column;
                    }

                    .filter-group.mobile-filters .filter-select {
                        width: 100%;
                    }

                    .filter-group.hidden {
                        display: none;
                    }

                    .menu-btn {
                        min-width: 44px;
                        min-height: 44px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .filter-select {
                        min-height: 44px;
                    }
                }

                /* Mobile Bottom Sheet Menu */
                .mobile-menu-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    z-index: 999;
                    animation: fadeIn 0.2s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .mobile-bottom-sheet {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    border-radius: 16px 16px 0 0;
                    z-index: 1000;
                    padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
                    animation: slideUp 0.25s ease-out;
                    box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.12);
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .bottom-sheet-handle {
                    width: 36px;
                    height: 4px;
                    background: #d1d5db;
                    border-radius: 2px;
                    margin: 0 auto 12px;
                }

                .bottom-sheet-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 14px 16px;
                    background: none;
                    border: none;
                    font-size: 1rem;
                    color: var(--color-text);
                    cursor: pointer;
                    border-radius: 10px;
                    text-align: left;
                    min-height: 44px;
                }

                .bottom-sheet-item:hover,
                .bottom-sheet-item:active {
                    background: #f1f5f9;
                }

                .bottom-sheet-item.danger {
                    color: var(--color-error);
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
