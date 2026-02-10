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
import { useReveal } from '@/hooks/useReveal';
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

export default function ProjectsPage() {
    return (
        <ProtectedRoute>
            <ProjectsContent />
        </ProtectedRoute>
    );
}

const STAGE_LABELS: Record<string, string> = {
    substructure: 'Site Preparation & Foundation',
    superstructure: 'Structural Walls & Frame',
    roofing: 'Roofing',
    finishing: 'Interior & Finishing',
    exterior: 'External Work',
    entire_house: 'Full House',
    full_house: 'Full House'
};

const formatStageLabel = (stage: string) => STAGE_LABELS[stage] || stage.replace('_', ' ');

const formatScopeLabel = (project: Project) => {
    if (project.selected_stages && project.selected_stages.length > 0) {
        return project.selected_stages.map(formatStageLabel).join(', ');
    }
    return formatStageLabel(project.scope);
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

    useReveal({ deps: [isLoading, filteredProjects.length] });

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
            } catch { }
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
            try { sessionStorage.removeItem('zimestimate_optimistic_project'); } catch { }
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
                {/* Hero KPI Section */}
                <div className="hero-kpi-section reveal" data-delay="1">
                    <div className="kpi-card highlight">
                        <div className="kpi-icon">
                            <Crown size={24} weight="duotone" className="text-blue-200" />
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
                                <div className="kpi-value">$0.00 <span className="kpi-sub-value">/ {useCurrency().formatPrice(projectStats.totalBudget, projectStats.totalBudget * 30)}</span></div>
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
                                <div className="kpi-value under-budget">-2.4%</div>
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
                                className="new-project-btn"
                            >
                                New Project
                            </Button>
                        </Link>
                        <div className="tier-status">
                            {profile?.tier === 'free' ? (
                                <span className="text-xs text-secondary">Free Tier: {projectCount}/3 used</span>
                            ) : (
                                <span className="text-xs text-accent font-medium">Pro Plan Active</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="page-header-row reveal" data-delay="2">
                    <h2 className="section-title">All Projects</h2>
                </div>

                {/* Filters Bar */}
                {projects.length > 0 && (
                    <div className="filters-bar reveal" data-delay="2">
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
                                    <option value="entire_house">Full House</option>
                                    <option value="substructure">Site Preparation & Foundation</option>
                                    <option value="superstructure">Structural Walls & Frame</option>
                                    <option value="roofing">Roofing</option>
                                    <option value="finishing">Interior & Finishing</option>
                                    <option value="exterior">External Work</option>
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
                                <Card className="project-card creating reveal" data-delay="1">
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
                        {filteredProjects.map((project, index) => (
                            <Link key={project.id} href={`/projects/${project.id}`} className="project-link">
                                <Card className={`project-card${highlightedProjectId === project.id ? ' highlight-new' : ''} reveal`} data-delay={(index % 4) + 1}>
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
                    <Card className="upgrade-prompt reveal">
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
                .projects-page {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-6);
                    padding: 0 0 var(--space-10);
                    font-family: var(--font-body);
                }

                /* Hero KPI Section */
                .hero-kpi-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr auto;
                    gap: var(--space-4);
                    padding: var(--space-6);
                    background: var(--color-background);
                    border-radius: var(--radius-xl);
                    border: 1px solid var(--color-border);
                    box-shadow: var(--shadow-sm);
                }

                .kpi-card {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    padding: var(--space-5);
                    border: 1px solid var(--color-border);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                    transition: all var(--duration-normal) var(--ease-default);
                    box-shadow: var(--shadow-sm);
                }

                .kpi-card:hover {
                    border-color: var(--color-border-dark);
                    box-shadow: var(--shadow-md);
                    transform: translateY(-2px);
                }

                .kpi-card.highlight {
                    background: linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary-dark) 100%);
                    border: none;
                    color: white;
                }

                .kpi-card.highlight .kpi-label,
                .kpi-card.highlight .kpi-trend {
                    color: rgba(255, 255, 255, 0.8);
                }

                .kpi-card.highlight .kpi-value {
                    color: white;
                }

                .kpi-card.actions-card {
                    background: var(--color-surface);
                    border: 2px dashed var(--color-border);
                    justify-content: center;
                    align-items: center;
                    gap: var(--space-3);
                    min-width: 180px;
                }

                .kpi-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: var(--radius-md);
                    background: var(--color-background);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .kpi-card.highlight .kpi-icon {
                    background: rgba(255, 255, 255, 0.2);
                }

                .kpi-label {
                    font-size: var(--text-xs);
                    font-weight: var(--font-semibold);
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .kpi-value {
                    font-family: var(--font-heading);
                    font-size: var(--text-h3);
                    font-weight: var(--font-bold);
                    color: var(--color-text);
                    letter-spacing: -0.02em;
                }
                
                .kpi-sub-value {
                    font-size: var(--text-sm);
                    color: var(--color-text-muted);
                    font-weight: var(--font-normal);
                    font-family: var(--font-body);
                }

                .kpi-trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: var(--text-xs);
                    font-weight: var(--font-medium);
                }

                .kpi-trend.positive {
                    color: var(--color-emerald);
                }

                .kpi-sub {
                    font-size: var(--text-xs);
                    color: var(--color-text-secondary);
                }
                
                .under-budget {
                    color: var(--color-emerald);
                }
                
                .tier-status {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                
                .text-secondary { color: var(--color-text-secondary); }
                .text-accent { color: var(--color-accent); }
                
                .page-divider {
                    height: 1px;
                    background: var(--color-border-light);
                    margin: 20px 0;
                }
                
                .section-title {
                    font-family: var(--font-heading);
                    font-size: var(--text-h4);
                    font-weight: var(--font-bold);
                    color: var(--color-primary);
                    margin: 0;
                }

                /* Filters Bar */
                .filters-bar {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: var(--space-3);
                    display: flex;
                    gap: var(--space-4);
                    align-items: center;
                    box-shadow: var(--shadow-sm);
                }
                
                .filters-top-row {
                    display: flex;
                    flex: 1;
                    gap: var(--space-4);
                }

                .search-box {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: 0 var(--space-3);
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    height: 40px;
                    max-width: 400px;
                    transition: border-color 0.2s;
                }

                .search-box:focus-within {
                    border-color: var(--color-accent);
                }
                
                .search-box input {
                    border: none;
                    background: transparent;
                    flex: 1;
                    height: 100%;
                    outline: none;
                    font-size: var(--text-sm);
                    color: var(--color-text);
                    font-family: var(--font-body);
                }
                
                .clear-search {
                    color: var(--color-text-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                
                .filter-group {
                    display: flex;
                    gap: var(--space-3);
                    align-items: center;
                }
                
                .filter-select {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    padding: 0 var(--space-3);
                    height: 40px;
                    color: var(--color-text-secondary);
                    transition: border-color 0.2s;
                }

                .filter-select:hover {
                    border-color: var(--color-border-dark);
                }
                
                .filter-select select {
                    appearance: none;
                    background: transparent;
                    border: none;
                    outline: none;
                    font-size: var(--text-sm);
                    color: var(--color-text);
                    padding-right: 4px;
                    cursor: pointer;
                    font-family: var(--font-body);
                }
                
                .clear-filters {
                    font-size: var(--text-xs);
                    color: var(--color-text-secondary);
                    text-decoration: underline;
                    cursor: pointer;
                    margin-left: var(--space-2);
                    background: none;
                    border: none;
                }
                
                .filter-toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 16px;
                    border-radius: var(--radius-md);
                    background: var(--color-background);
                    border: 1px solid var(--color-border);
                    color: var(--color-text);
                    font-size: var(--text-sm);
                }
                
                .filter-badge {
                    background: var(--color-accent);
                    color: white;
                    font-size: 10px;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                    gap: var(--grid-gutter);
                }
                
                .project-link {
                    text-decoration: none;
                    color: inherit;
                    display: block;
                }
                
                /* Project Card Enhancements */
                :global(.project-card) {
                    transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal) var(--ease-out) !important;
                    border-radius: var(--card-radius) !important;
                    box-shadow: var(--shadow-card) !important;
                    background: var(--color-surface) !important;
                    border: 1px solid var(--color-border) !important;
                }
                
                :global(.project-card:hover) {
                    transform: translateY(-4px) !important;
                    box-shadow: var(--shadow-lg) !important;
                    border-color: var(--color-accent) !important;
                }
                
                :global(.project-card.creating) {
                    opacity: 0.7;
                    pointer-events: none;
                }
                
                :global(.project-card.highlight-new) {
                    animation: highlightPulse 2s ease-out;
                }
                
                @keyframes highlightPulse {
                    0% { box-shadow: 0 0 0 0 rgba(46, 108, 246, 0.4); border-color: var(--color-accent); }
                    70% { box-shadow: 0 0 0 10px rgba(46, 108, 246, 0); border-color: var(--color-accent); }
                    100% { box-shadow: 0 0 0 0 rgba(46, 108, 246, 0); }
                }

                .project-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-2);
                    width: 100%;
                }
                
                .menu-container {
                    position: relative;
                }
                
                .menu-btn {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-md);
                    color: var(--color-text-secondary);
                    transition: all 0.2s;
                    cursor: pointer;
                    z-index: 2;
                    background: transparent;
                    border: none;
                }
                
                .menu-btn:hover {
                    background: var(--color-mist);
                    color: var(--color-text);
                }
                
                .dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    width: 160px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    padding: 4px;
                    z-index: 10;
                    animation: fadeIn 0.1s ease-out;
                }
                
                .dropdown-menu button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    padding: 8px 12px;
                    font-size: var(--text-sm);
                    color: var(--color-text);
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    text-align: left;
                    font-family: var(--font-body);
                }
                
                .dropdown-menu button:hover {
                    background: var(--color-mist);
                }
                
                .dropdown-menu button.danger {
                    color: var(--color-danger);
                }
                
                .dropdown-menu button.danger:hover {
                    background: rgba(220, 38, 38, 0.05);
                }

                .project-meta {
                    display: flex;
                    gap: var(--space-4);
                    margin-top: var(--space-2);
                    color: var(--color-text-secondary);
                    font-size: var(--text-sm);
                }
                
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .project-budget {
                    margin-top: var(--space-4);
                    padding-top: var(--space-3);
                    border-top: 1px solid var(--color-border-light);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .budget-label {
                    font-size: var(--text-xs);
                    color: var(--color-text-muted);
                    font-weight: var(--font-medium);
                    text-transform: uppercase;
                }
                
                .budget-value {
                    font-family: var(--font-mono);
                    font-size: var(--text-lg);
                    font-weight: var(--font-bold);
                    color: var(--color-primary);
                }
                
                .project-details {
                    margin-top: var(--space-3);
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .detail-item {
                    background: var(--color-background);
                    padding: 4px 8px;
                    border-radius: var(--radius-sm);
                    font-size: 11px;
                    color: var(--color-text-secondary);
                    font-weight: var(--font-medium);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-12);
                    text-align: center;
                    gap: var(--space-4);
                    background: var(--color-surface);
                    color: var(--color-text-muted);
                    border: 1px dashed var(--color-border);
                    border-radius: var(--radius-lg);
                }
                
                .empty-state h3 {
                    margin: 0;
                    color: var(--color-text);
                    font-size: var(--text-lg);
                    font-family: var(--font-heading);
                    font-weight: var(--font-bold);
                }
                
                .empty-state p {
                    margin: 0;
                    color: var(--color-text-secondary);
                }
                
                .error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--space-8);
                    gap: var(--space-4);
                    color: var(--color-danger);
                    text-align: center;
                    background: rgba(220, 38, 38, 0.05);
                    border-radius: var(--radius-lg);
                    border: 1px solid rgba(220, 38, 38, 0.1);
                }

                /* Mobile Styles */
                @media (max-width: 768px) {
                    .hero-kpi-section {
                        grid-template-columns: 1fr;
                        padding: var(--space-4);
                    }
                    
                    .kpi-card.actions-card {
                        min-width: auto;
                        padding: var(--space-4);
                    }
                    
                    .filters-bar {
                        flex-direction: column;
                        align-items: stretch;
                        padding: var(--space-3);
                    }
                    
                    .search-box {
                        max-width: none;
                    }
                    
                    .filter-group.mobile-filters {
                        flex-direction: column;
                        align-items: stretch;
                        padding-top: var(--space-3);
                        border-top: 1px solid var(--color-border-light);
                    }
                    
                    .projects-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .mobile-menu-backdrop {
                        position: fixed;
                        inset: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 50;
                        animation: fadeIn 0.2s ease-out;
                    }
                    
                    .mobile-bottom-sheet {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: var(--color-surface);
                        border-radius: 20px 20px 0 0;
                        padding: 24px 16px 40px;
                        z-index: 51;
                        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .bottom-sheet-handle {
                        width: 40px;
                        height: 4px;
                        background: var(--color-border);
                        border-radius: 2px;
                        margin: 0 auto 16px;
                    }
                    
                    .bottom-sheet-item {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        width: 100%;
                        padding: 16px;
                        background: var(--color-background);
                        border: none;
                        border-radius: var(--radius-md);
                        font-size: var(--text-base);
                        font-weight: 500;
                        color: var(--color-text);
                    }
                    
                    .bottom-sheet-item.danger {
                        color: var(--color-danger);
                        background: rgba(220, 38, 38, 0.05);
                    }
                }
                
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
        </MainLayout>
    );
}
