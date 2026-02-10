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
                /* Modern Projects Page Styles */
                .projects-page {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    padding: 0 0 40px;
                }

                /* Hero KPI Section - Simplified & Modern */
                .hero-kpi-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr auto;
                    gap: 16px;
                    padding: 24px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                }

                .kpi-card {
                    background: white;
                    border-radius: 16px;
                    padding: 20px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    transition: all 0.2s ease;
                }

                .kpi-card:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }

                .kpi-card.highlight {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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
                    background: white;
                    border: 2px dashed #e2e8f0;
                    justify-content: center;
                    align-items: center;
                    gap: 12px;
                    min-width: 180px;
                }

                .kpi-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: rgba(59, 130, 246, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .kpi-card.highlight .kpi-icon {
                    background: rgba(255, 255, 255, 0.2);
                }

                .kpi-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .kpi-value {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -0.02em;
                }

                .kpi-trend {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.8125rem;
                    font-weight: 500;
                }

                .kpi-trend.positive {
                    color: #10b981;
                }

                .kpi-sub {
                    font-size: 0.8125rem;
                    color: #64748b;
                }

                .kpi-bar-container {
                    margin-top: 8px;
                }

                .kpi-bar-bg {
                    height: 6px;
                    background: #f1f5f9;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .kpi-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                    border-radius: 3px;
                }

                .tier-status {
                    font-size: 0.75rem;
                    color: #64748b;
                    text-align: center;
                }

                .page-divider {
                    display: none;
                }

                .page-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .section-title {
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0;
                }

                /* Filters Bar - Clean & Minimal */
                .filters-bar {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .filters-top-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 16px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    flex: 1;
                    max-width: 320px;
                    transition: all 0.2s;
                }

                .search-box:focus-within {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .search-box input {
                    border: none;
                    background: transparent;
                    outline: none;
                    flex: 1;
                    font-size: 0.875rem;
                    color: #0f172a;
                }

                .search-box input::placeholder {
                    color: #94a3b8;
                }

                .clear-search {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f1f5f9;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    transition: all 0.15s;
                }

                .clear-search:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                }

                .filter-toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #64748b;
                    cursor: pointer;
                    min-height: 44px;
                    transition: all 0.15s;
                }

                .filter-toggle-btn:hover {
                    border-color: #cbd5e1;
                    color: #0f172a;
                }

                .filter-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: #3b82f6;
                    color: white;
                    font-size: 0.625rem;
                    font-weight: 700;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .filter-select {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    position: relative;
                    color: #64748b;
                    transition: all 0.15s;
                }

                .filter-select:hover {
                    border-color: #cbd5e1;
                }

                .filter-select select {
                    appearance: none;
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: #0f172a;
                    cursor: pointer;
                    padding-right: 20px;
                }

                .filter-select > :global(svg:last-child) {
                    position: absolute;
                    right: 10px;
                    pointer-events: none;
                    color: #94a3b8;
                }

                .clear-filters {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 8px 12px;
                    border-radius: 8px;
                    transition: all 0.15s;
                }

                .clear-filters:hover {
                    background: rgba(59, 130, 246, 0.1);
                }

                /* Projects Grid - Modern Cards */
                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }

                .project-link {
                    text-decoration: none;
                    color: inherit;
                    display: block;
                }

                :global(.project-card) {
                    background: white;
                    border-radius: 16px;
                    padding: 20px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.25s ease;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                }

                :global(.project-card::before) {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                :global(.project-card:hover) {
                    transform: translateY(-4px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
                    border-color: #3b82f6;
                }

                :global(.project-card:hover::before) {
                    opacity: 1;
                }

                :global(.project-card:hover::after) {
                    opacity: 1;
                }

                :global(.project-card::after) {
                    content: 'View →';
                    position: absolute;
                    bottom: 16px;
                    right: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #3b82f6;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .project-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .project-header :global(.card-title) {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0;
                    line-height: 1.3;
                }

                .menu-container {
                    position: relative;
                }

                .menu-btn {
                    background: none;
                    border: none;
                    padding: 6px;
                    cursor: pointer;
                    color: #94a3b8;
                    border-radius: 8px;
                    transition: all 0.15s;
                }

                .menu-btn:hover {
                    background: #f1f5f9;
                    color: #64748b;
                }

                .dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    z-index: 100;
                    min-width: 160px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                }

                .dropdown-menu button {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 12px;
                    background: none;
                    border: none;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #374151;
                    cursor: pointer;
                    border-radius: 8px;
                    text-align: left;
                    transition: all 0.15s;
                }

                .dropdown-menu button:hover {
                    background: #f8fafc;
                }

                .dropdown-menu button.danger {
                    color: #ef4444;
                }

                .dropdown-menu button.danger:hover {
                    background: #fef2f2;
                }

                .project-meta {
                    display: flex;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.8125rem;
                    color: #64748b;
                }

                .project-budget {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #f1f5f9;
                }

                .budget-label {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .budget-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #0f172a;
                }

                .project-details {
                    display: flex;
                    gap: 8px;
                    margin-top: 12px;
                    flex-wrap: wrap;
                }

                .detail-item {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    padding: 4px 10px;
                    background: #f8fafc;
                    border-radius: 6px;
                    color: #64748b;
                }

                /* Empty & Error States */
                .error-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    gap: 16px;
                    text-align: center;
                }

                .error-state p {
                    color: #64748b;
                    margin: 0;
                }

                :global(.empty-state) {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 24px !important;
                    text-align: center;
                    color: #94a3b8;
                    background: #f8fafc;
                    border: 2px dashed #e2e8f0;
                    border-radius: 20px;
                }

                :global(.empty-state) h3 {
                    margin: 20px 0 8px 0;
                    color: #0f172a;
                    font-size: 1.25rem;
                }

                :global(.empty-state) p {
                    margin: 0 0 24px 0;
                    color: #64748b;
                }

                /* Upgrade Prompt */
                :global(.upgrade-prompt) {
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                    color: white;
                    border: none;
                    border-radius: 16px;
                    margin-top: 8px;
                }

                .upgrade-content {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .upgrade-content h4 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 700;
                }

                .upgrade-content p {
                    margin: 4px 0 0 0;
                    opacity: 0.8;
                    font-size: 0.875rem;
                }

                .upgrade-content > div {
                    flex: 1;
                }

                /* Creating & Highlight States */
                :global(.project-card.creating) {
                    animation: pulse-creating 1.5s ease-in-out infinite;
                    border-color: #3b82f6;
                    pointer-events: none;
                }

                @keyframes pulse-creating {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }

                :global(.project-card.highlight-new) {
                    animation: highlight-glow 2s ease-out forwards;
                }

                @keyframes highlight-glow {
                    0% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4), 0 20px 40px rgba(59, 130, 246, 0.15); }
                    100% { box-shadow: none; }
                }

                /* Mobile Bottom Sheet */
                .mobile-menu-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 999;
                    animation: fadeIn 0.2s ease;
                    backdrop-filter: blur(4px);
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
                    border-radius: 20px 20px 0 0;
                    z-index: 1000;
                    padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 20px);
                    animation: slideUp 0.3s ease-out;
                    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15);
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .bottom-sheet-handle {
                    width: 40px;
                    height: 4px;
                    background: #e2e8f0;
                    border-radius: 2px;
                    margin: 0 auto 16px;
                }

                .bottom-sheet-item {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    width: 100%;
                    padding: 16px;
                    background: none;
                    border: none;
                    font-size: 1rem;
                    font-weight: 500;
                    color: #0f172a;
                    cursor: pointer;
                    border-radius: 12px;
                    text-align: left;
                    min-height: 52px;
                    transition: background 0.15s;
                }

                .bottom-sheet-item:active {
                    background: #f1f5f9;
                }

                .bottom-sheet-item.danger {
                    color: #ef4444;
                }

                /* Responsive Design */
                @media (max-width: 1024px) {
                    .hero-kpi-section {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .kpi-card.actions-card {
                        grid-column: span 2;
                    }
                }

                @media (max-width: 640px) {
                    .projects-page {
                        gap: 20px;
                    }

                    .hero-kpi-section {
                        grid-template-columns: 1fr;
                        padding: 16px;
                        gap: 12px;
                    }

                    .kpi-card {
                        padding: 16px;
                    }

                    .kpi-card.actions-card {
                        grid-column: span 1;
                        flex-direction: row;
                        justify-content: space-between;
                        padding: 12px 16px;
                    }

                    .kpi-value {
                        font-size: 1.5rem;
                    }

                    .search-box {
                        max-width: none;
                    }

                    .projects-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }

                    :global(.project-card) {
                        padding: 16px;
                    }

                    .filter-group.mobile-filters {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .filter-group.mobile-filters .filter-select {
                        width: 100%;
                    }

                    .filter-group.hidden {
                        display: none;
                    }

                    .upgrade-content {
                        flex-direction: column;
                        text-align: center;
                    }

                    .menu-btn {
                        min-width: 44px;
                        min-height: 44px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
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
