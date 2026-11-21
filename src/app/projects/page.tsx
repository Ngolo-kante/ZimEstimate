'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ProjectsLoading from '@/components/projects/list/ProjectsLoading';
import ContinuePanel from '@/components/projects/list/ContinuePanel';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/shadcn/collapsible';
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
import { MagnifyingGlass } from '@phosphor-icons/react';
import '@/styles/projects-list.css';
import { useProjectList } from './hooks/useProjectList';
import { useListFilters } from './hooks/useListFilters';
import { useCardActions } from './hooks/useCardActions';
import { useSharedWithMe } from './hooks/useSharedWithMe';

export default function ProjectsPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={<MainLayout mobileNavy title="My projects"><div className="projects-list projects-page"><ProjectsLoading /></div></MainLayout>}>
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
        projects, setProjects, quickItems, setQuickItems, isLoading, error,
        stages, continueItems, continuePurchases, continueProject,
        highlightedProjectId, justSaved, dismissJustSaved,
    } = useProjectList({ searchParams, router, profileId: profile?.id });
    const [archiveKeyboard, setArchiveKeyboard] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);
    useEffect(() => {
        if (isLoading) return;
        // Paint the loaded surface once at zero opacity, then fade it in.
        let revealFrame = 0;
        const frame = requestAnimationFrame(() => {
            revealFrame = requestAnimationFrame(() => setContentVisible(true));
        });
        return () => { cancelAnimationFrame(frame); cancelAnimationFrame(revealFrame); };
    }, [isLoading]);
    const filters = useListFilters(projects, quickItems);
    const { filteredQuick, visibleProjects, projectStats, clearFilters } = filters;
    const actions = useCardActions({ router, projects, setProjects, quickItems, setQuickItems });
    const {
        isMobile, mobileMenuProjectId, mobileMenuTargetId,
        deleteTarget, setDeleteTarget, isDeleting, confirmDelete,
        shareProjectId, setShareProjectId, inviteProjectId, setInviteProjectId,
        quickShareTarget, setQuickShareTarget, quickInviteTarget, setQuickInviteTarget,
    } = actions;


    return (
        <MainLayout fullWidth mobileNavy>
            <div className="projects-list projects-page">
                <ProjectsHeader canCreateProject={canCreateProject} />
                {/* No portfolio summary until there are saved projects. */}
                {!isLoading && !error && projects.length + quickItems.length > 0 && <PortfolioStrip projectStats={projectStats} profile={profile} projectCount={projectCount} quickTotal={quickItems.filter(q => q.status !== 'archived').reduce((sum, q) => sum + q.totalUsd, 0)} />}

                {/* Confirmation that the save landed, and a way straight into the
                    thing that was saved. Landing on the list answers "did it
                    save?"; this answers "and where is it?" without making the
                    user hunt for a card among however many they own. */}
                {justSaved && <SavedNotice justSaved={justSaved} onDismiss={dismissJustSaved} />}

                {isLoading && <ProjectsLoading />}
                {!isLoading && !error && <div className="projects-content" style={{ opacity: contentVisible ? 1 : 0 }}>
                    {continueProject && <ContinuePanel project={continueProject} stages={stages} items={continueItems} purchases={continuePurchases} profile={profile} actions={actions} />}

                    {projects.length + quickItems.length >= 6 && <ProjectsFilters filters={filters} isMobile={isMobile} />}

                {/* Empty State */}
                {!isLoading && !error && projects.length === 0 && quickItems.length === 0 && (
                    <Card className="empty-state">
                        <h2>Start your first estimate</h2>
                        <div className="start-choices">
                            <Link href="/ai/vision-takeoff"><h3>Upload a plan</h3><p>Turn your floor plan into an estimate.</p><span>About 5 minutes</span></Link>
                            <Link href="/estimate"><h3>Describe the house</h3><p>Build an estimate from your rooms and sizes.</p><span>About 10 minutes</span></Link>
                            <Link href="/projects/quick"><h3>Quick estimate (solar, borehole)</h3><p>Price a specific installation or improvement.</p><span>About 2 minutes</span></Link>
                        </div>
                    </Card>
                )}

                {/* No Results State */}
                {!isLoading && !error && (projects.length > 0 || quickItems.length > 0) && visibleProjects.length === 0 && filteredQuick.length === 0 && (
                    <Card className="empty-state">
                        <MagnifyingGlass size={48} weight="light" />
                        <h3>No matching projects</h3>
                        <p>Try adjusting your search or filters</p>
                        <Button variant="secondary" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    </Card>
                )}

                {visibleProjects.some(p => p.status !== 'archived') && <section><h2 className="projects-section-heading">Builds <span className="section-count">{visibleProjects.filter(p => p.status !== 'archived').length}</span></h2><ProjectsGrid filteredQuick={[]} visibleProjects={visibleProjects.filter(p => p.status !== 'archived')} stages={stages} highlightedProjectId={highlightedProjectId} profile={profile} actions={actions} /></section>}
                {filteredQuick.some(q => q.status !== 'archived') && <section><h2 className="projects-section-heading">Quick estimates <span className="section-count">{filteredQuick.filter(q => q.status !== 'archived').length}</span></h2><ProjectsGrid filteredQuick={filteredQuick.filter(q => q.status !== 'archived')} visibleProjects={[]} stages={stages} highlightedProjectId={highlightedProjectId} profile={profile} actions={actions} /></section>}
                {(siteProjects.length > 0 || siteQuick.length > 0) && <SharedWithYou siteProjects={siteProjects} siteQuick={siteQuick} />}
                {(projects.some(p => p.status === 'archived') || quickItems.some(q => q.status === 'archived')) && <Collapsible className="archived-projects" data-keyboard={archiveKeyboard}>
                    <CollapsibleTrigger asChild onPointerDownCapture={() => setArchiveKeyboard(false)} onKeyDownCapture={() => setArchiveKeyboard(true)}><Button variant="secondary" className="archive-heading">Archived <span className="section-count">{projects.filter(p => p.status === 'archived').length + quickItems.filter(q => q.status === 'archived').length}</span></Button></CollapsibleTrigger>
                    <CollapsibleContent className="archived-content"><ProjectsGrid visibleProjects={visibleProjects.filter(p => p.status === 'archived')} filteredQuick={filteredQuick.filter(q => q.status === 'archived')} stages={stages} highlightedProjectId={highlightedProjectId} profile={profile} actions={actions} /></CollapsibleContent>
                </Collapsible>}
                </div>}
                {error && !isLoading && <div className="error-state"><p>Failed to load projects: {error}</p><Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button></div>}
            </div>

            {/* Mobile Bottom Sheet Menu */}
            {isMobile && mobileMenuTargetId && (
                <MobileCardSheet
                    mobileMenuProjectId={mobileMenuTargetId}
                    open={!!mobileMenuProjectId}
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
                title={deleteTarget?.kind === 'quick' ? 'Delete estimate' : 'Delete project'}
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
