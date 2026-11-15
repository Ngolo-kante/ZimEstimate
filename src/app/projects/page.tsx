'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import ProjectsSubNav from '@/components/projects/ProjectsSubNav';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { ProjectCardSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import ProjectShareSheet from '@/components/projects/ProjectShareSheet';
import QuickShareSheet from '@/components/projects/QuickShareSheet';
import InviteModal from '@/components/projects/InviteModal';
import ProjectsHeader from '@/components/projects/list/ProjectsHeader';
import SavedNotice from '@/components/projects/list/SavedNotice';
import PortfolioStrip from '@/components/projects/list/PortfolioStrip';
import ProjectsFilters from '@/components/projects/list/ProjectsFilters';
import SharedWithYou from '@/components/projects/list/SharedWithYou';
import ProjectsGrid from '@/components/projects/list/ProjectsGrid';
import MobileCardSheet from '@/components/projects/list/MobileCardSheet';
import { FolderOpen, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import '@/styles/projects-list.css';
import { useProjectList } from './hooks/useProjectList';
import { useListFilters } from './hooks/useListFilters';
import { useCardActions } from './hooks/useCardActions';
import { useSharedWithMe } from './hooks/useSharedWithMe';

export default function ProjectsPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={<MainLayout title="Projects"><div className="p-8 text-center">Loading projects...</div></MainLayout>}>
                <ProjectsContent />
            </Suspense>
        </ProtectedRoute>
    );
}

function ProjectsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, canCreateProject, projectCount } = useAuth();

    const { siteProjects, siteQuick } = useSharedWithMe();
    const {
        projects, setProjects, quickItems, setQuickItems, optimisticProject, isLoading, error,
        highlightedProjectId, justSaved, dismissJustSaved,
    } = useProjectList({ searchParams, router, profileId: profile?.id });
    const filters = useListFilters(projects, quickItems);
    const { filteredQuick, visibleProjects, projectStats, clearFilters } = filters;
    const actions = useCardActions({ router, projects, setProjects, quickItems, setQuickItems });
    const {
        isMobile, mobileMenuProjectId,
        deleteTarget, setDeleteTarget, isDeleting, confirmDelete,
        shareProjectId, setShareProjectId, inviteProjectId, setInviteProjectId,
        quickShareTarget, setQuickShareTarget, quickInviteTarget, setQuickInviteTarget,
    } = actions;


    return (
        <MainLayout fullWidth>
            <div className="projects-list projects-page">
                <ProjectsHeader canCreateProject={canCreateProject} />

                <ProjectsSubNav active="all" />

                {/* Confirmation that the save landed, and a way straight into the
                    thing that was saved. Landing on the list answers "did it
                    save?"; this answers "and where is it?" without making the
                    user hunt for a card among however many they own. */}
                {justSaved && <SavedNotice justSaved={justSaved} onDismiss={dismissJustSaved} />}

                <PortfolioStrip
                    isLoading={isLoading}
                    projectStats={projectStats}
                    quickCount={quickItems.length}
                    profile={profile}
                    projectCount={projectCount}
                />

                <div className="page-header-row">
                    <div>
                        <span className="projects-eyebrow">Saved work</span>
                        <h2 className="section-title">All projects and estimates</h2>
                    </div>
                    <span className="work-count">{projects.length + quickItems.length} total</span>
                </div>

                {/* Filters Bar */}
                {/* For all saved work: someone with only quick estimates had no
                    search or filters at all. */}
                {(projects.length > 0 || quickItems.length > 0) && (
                    <ProjectsFilters filters={filters} isMobile={isMobile} />
                )}

                {/* Loading State - Skeleton Cards */}
                {isLoading && !optimisticProject && (
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

                {/* Projects other people invited you to: the site view only. */}
                {(siteProjects.length > 0 || siteQuick.length > 0) && (
                    <SharedWithYou siteProjects={siteProjects} siteQuick={siteQuick} />
                )}

                {/* Empty State */}
                {!isLoading && !error && projects.length === 0 && !optimisticProject && (
                    <Card className="empty-state">
                        <FolderOpen size={64} weight="light" />
                        <h3>No projects yet</h3>
                        <p>Create your first construction estimate to get started</p>
                        <Link href="/estimate">
                            <Button icon={<Plus size={18} />}>
                                Create first project
                            </Button>
                        </Link>
                    </Card>
                )}

                {/* No Results State */}
                {!isLoading && !error && (projects.length > 0 || quickItems.length > 0) && visibleProjects.length === 0 && filteredQuick.length === 0 && !optimisticProject && (
                    <Card className="empty-state">
                        <MagnifyingGlass size={48} weight="light" />
                        <h3>No matching projects</h3>
                        <p>Try adjusting your search or filters</p>
                        <Button variant="secondary" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    </Card>
                )}

                {/* Projects Grid */}
                {!error && (optimisticProject || (!isLoading && (visibleProjects.length > 0 || filteredQuick.length > 0))) && (
                    <ProjectsGrid
                        optimisticProject={optimisticProject}
                        filteredQuick={filteredQuick}
                        visibleProjects={visibleProjects}
                        highlightedProjectId={highlightedProjectId}
                        profile={profile}
                        actions={actions}
                    />
                )}

            </div>

            {/* Mobile Bottom Sheet Menu */}
            {isMobile && mobileMenuProjectId && (
                <MobileCardSheet
                    mobileMenuProjectId={mobileMenuProjectId}
                    projects={projects}
                    quickItems={quickItems}
                    profile={profile}
                    actions={actions}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title={deleteTarget?.kind === 'quick' ? 'Delete Estimate' : 'Delete Project'}
                message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and all associated data will be permanently removed.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeleting}
            />

            {shareProjectId && projects.find((p) => p.id === shareProjectId) && (
                <ProjectShareSheet
                    isOpen
                    onClose={() => setShareProjectId(null)}
                    project={projects.find((p) => p.id === shareProjectId)!}
                />
            )}
            {quickShareTarget && (
                <QuickShareSheet
                    isOpen
                    onClose={() => setQuickShareTarget(null)}
                    quickId={quickShareTarget.id}
                    name={quickShareTarget.name}
                    typeLabel={quickShareTarget.typeLabel}
                />
            )}
            {quickInviteTarget && (
                <InviteModal
                    isOpen
                    onClose={() => setQuickInviteTarget(null)}
                    projectId={quickInviteTarget.id}
                    projectName={quickInviteTarget.name}
                    kind="quick"
                />
            )}
            {inviteProjectId && projects.find((p) => p.id === inviteProjectId) && (
                <InviteModal
                    isOpen
                    onClose={() => setInviteProjectId(null)}
                    projectId={inviteProjectId}
                    projectName={projects.find((p) => p.id === inviteProjectId)!.name}
                />
            )}
        </MainLayout>
    );
}
