'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ProjectViewTabs from '@/components/projects/ProjectViewTabs';
import InviteModal from '@/components/projects/InviteModal';
import SiteView from '@/components/projects/SiteView';
import ProjectShareSheet from '@/components/projects/ProjectShareSheet';
import SidebarSpine from '@/components/projects/SidebarSpine';
import ViewHeader from '@/components/projects/views/ViewHeader';
import OverviewView from '@/components/projects/views/OverviewView';
import BoqView from '@/components/projects/views/BoqView';
import ComplianceView from '@/components/projects/views/ComplianceView';
import ProcurementView from '@/components/projects/views/ProcurementView';
import UsageView from '@/components/projects/views/UsageView';
import DocumentsView from '@/components/projects/views/DocumentsView';
import BudgetView from '@/components/projects/views/BudgetView';
import SettingsView from '@/components/projects/views/SettingsView';
import PhoneNumberModal from '@/components/ui/PhoneNumberModal';
import { ProjectDetailSkeleton } from '@/components/ui/Skeleton';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useAuth } from '@/components/providers/AuthProvider';
import { useReminderChannels } from '@/hooks/useReminderChannels';
import { supabase } from '@/lib/supabase';
import { summariseCompliance } from '@/lib/compliance';
import { completionRate as completionPercent } from '@/lib/projects/workspaceStats';
import { parseProjectLocationType, stageComplianceWarnings } from '@/lib/projects/workspaceStages';
import type { BOQItem } from '@/lib/database.types';
import { ArrowLeft, Warning } from '@phosphor-icons/react';
import '@/styles/project-workspace.css';
import { useProjectUrlState } from './hooks/useProjectUrlState';
import { useProjectData } from './hooks/useProjectData';
import { useSavingsReminder } from './hooks/useSavingsReminder';
import { useUsageData } from './hooks/useUsageData';
import { useProjectRealtime } from './hooks/useProjectRealtime';
import { usePriceUpdates } from './hooks/usePriceUpdates';
import { useWorkspaceDialogs } from './hooks/useWorkspaceDialogs';

function ProjectDetailContent() {
    const params = useParams();
    const { profile } = useAuth();
    const { exchangeRate, formatPrice } = useCurrency();
    const projectId = params.id as string;

    const { activeView, activeTab, setActiveView, setActiveTab } = useProjectUrlState();
    // What reminders can actually be sent by right now (email until WhatsApp
    // is set up); a saved preference for anything else falls back to email.
    const reminderChannels = useReminderChannels();
    const {
        project, setProject, items, setItems, stages, purchases, setPurchases, isLoading, error,
        geotechDocumentSummary, feeItems, materialItems, purchaseStats,
        loadProjectData, refreshStages, refreshItems,
        handleProjectUpdate, handleItemUpdate, handleStageUpdate, handleDeleteItem, handleAddItem,
    } = useProjectData(projectId, setActiveTab);

    const {
        activeReminderChannel, setPreferredReminderChannel, savingsReminder, reminderDraft, setReminderDraft,
        showPhoneModal, closePhoneModal,
        handleSavingsReminder, handleToggleSavingsReminder, handleRequestPhone, handleSavePhoneNumber,
    } = useSavingsReminder({ projectId, project, activeTab, reminderChannels });
    const { usageByItem, loadUsageData, refreshProjectMaterialState, handleUsageTrackingToggle } = useUsageData({
        projectId, project, setProject, stages, activeView, refreshItems,
    });
    useProjectRealtime({ projectId, project, stages, activeView, loadProjectData, loadUsageData, refreshStages });
    const { priceUpdates, priceUpdatePreview, isPriceUpdateLoading, handleApplyPriceUpdates, handleIgnorePriceUpdates } = usePriceUpdates({
        projectId, project, setProject, items, setItems, profileId: profile?.id,
    });
    const {
        showShareSheet, setShowShareSheet, showInviteModal, setShowInviteModal,
    } = useWorkspaceDialogs();

    const [isComplianceBannerDismissed, setIsComplianceBannerDismissed] = useState(false);
    const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<BOQItem | null>(null);
    const [selectedItemForUsage, setSelectedItemForUsage] = useState<BOQItem | null>(null);

    const isProjectOwner = Boolean(project && profile && project.owner_id === profile.id);
    // Invitees never reach this page (ProjectAccessGate shows them SiteView).
    const canManageProject = isProjectOwner;

    const handleSavingsTargetDateChange = (date: string) =>
        handleProjectUpdate({ target_purchase_date: date || null }, { quiet: true });

    const currentStage = stages.find(s => s.boq_category === activeTab);
    const complianceSummary = useMemo(() => summariseCompliance(stages), [stages]);
    const hasLabor = project?.labor_preference === 'with_labor';
    const projectLocationType = parseProjectLocationType(project?.location);
    const activeStageComplianceWarnings = useMemo(
        () => stageComplianceWarnings(currentStage, stages, projectLocationType),
        [currentStage, stages, projectLocationType]
    );

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- show the banner again for a new stage
        setIsComplianceBannerDismissed(false);
    }, [activeTab, activeStageComplianceWarnings.length]);

    // Loading state - skeleton layout
    if (isLoading) {
        return (
            <MainLayout title="Loading..." fullWidth>
                <ProjectDetailSkeleton />
            </MainLayout>
        );
    }

    // Error state
    if (error || !project) {
        return (
            <MainLayout title="Error">
                <div className="project-workspace-error error-state">
                    <Warning size={48} weight="light" />
                    <h2>Project Not Found</h2>
                    <p>{error || 'The requested project could not be found.'}</p>
                    <Link href="/projects?refresh=1">
                        <Button variant="secondary" icon={<ArrowLeft size={18} />}>
                            Back to Projects
                        </Button>
                    </Link>
                </div>
            </MainLayout>
        );
    }

    const handleUsageRecorded = async () => {
        await refreshProjectMaterialState();
    };

    const handleLogPurchase = (item: BOQItem) => {
        setSelectedItemForPurchase(item);
        setActiveView('procurement');
    };

    const handleRecordUsage = (item: BOQItem) => {
        setSelectedItemForUsage(item);
        setActiveView('usage');
    };

    const completionRate = completionPercent(purchaseStats);
    const activeViewStats = activeView === 'boq'
            ? [
                { label: 'Materials', value: String(materialItems.length) },
                { label: 'Project estimate', value: formatPrice(purchaseStats.estimatedTotal, purchaseStats.estimatedTotal * exchangeRate) },
                { label: 'Materials purchased', value: `${purchaseStats.purchasedItems}/${purchaseStats.totalItems}` },
            ]
            : [];

    return (
        <MainLayout fullWidth hideBottomNav>
            <div className="project-workspace project-shell project-dashboard-shell">
                <SidebarSpine
                    project={project}
                    activeView={activeView}
                    onViewChange={setActiveView}
                />

                <main className="project-main">
                    {/* Mobile-only project dock. Desktop keeps the full sidebar. */}
                    <ProjectViewTabs
                        activeView={activeView}
                        onViewChange={setActiveView}
                    />

                    <ViewHeader activeView={activeView} projectName={project.name} stats={activeViewStats} />

                    {activeView === 'overview' && (
                        <OverviewView
                            project={project}
                            projectId={projectId}
                            stages={stages}
                            items={items}
                            materialItems={materialItems}
                            purchases={purchases}
                            usageByItem={usageByItem}
                            purchaseStats={purchaseStats}
                            completionRate={completionRate}
                            complianceSummary={complianceSummary}
                            geotechDocumentSummary={geotechDocumentSummary}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            setActiveView={setActiveView}
                            setSelectedItemForPurchase={setSelectedItemForPurchase}
                            isProjectOwner={isProjectOwner}
                            canManageProject={canManageProject}
                            onShare={() => setShowShareSheet(true)}
                            onInvite={() => setShowInviteModal(true)}
                            priceUpdates={priceUpdates}
                            priceUpdatePreview={priceUpdatePreview}
                            isPriceUpdateLoading={isPriceUpdateLoading}
                            onIgnorePriceUpdates={handleIgnorePriceUpdates}
                            onApplyPriceUpdates={handleApplyPriceUpdates}
                        />
                    )}

                    {activeView === 'boq' && (
                        <BoqView
                            projectId={projectId}
                            items={items}
                            feeItems={feeItems}
                            stages={stages}
                            currentStage={currentStage}
                            purchases={purchases}
                            actualSpentUsd={purchaseStats.actualSpent}
                            usageByItem={usageByItem}
                            usageTrackingEnabled={project.usage_tracking_enabled}
                            hasLabor={hasLabor}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            setActiveView={setActiveView}
                            complianceWarnings={activeStageComplianceWarnings}
                            isComplianceBannerDismissed={isComplianceBannerDismissed}
                            onDismissComplianceBanner={() => setIsComplianceBannerDismissed(true)}
                            onStageUpdate={handleStageUpdate}
                            onItemUpdate={handleItemUpdate}
                            onItemDelete={handleDeleteItem}
                            onItemAdded={handleAddItem}
                            onLogPurchase={handleLogPurchase}
                            onRecordUsage={handleRecordUsage}
                        />
                    )}

                    {activeView === 'compliance' && (
                        <ComplianceView
                            projectId={projectId}
                            projectName={project.name}
                            stages={stages}
                            onStageUpdate={handleStageUpdate}
                            phoneNumber={profile?.phone_number}
                            onRequestPhone={handleRequestPhone}
                            preferredChannel={activeReminderChannel}
                            setActiveView={setActiveView}
                        />
                    )}

                    {activeView === 'procurement' && (
                        <ProcurementView
                            purchases={purchases}
                            setPurchases={setPurchases}
                            project={project}
                            materialItems={materialItems}
                            onItemsRefresh={refreshProjectMaterialState}
                            selectedItemForPurchase={selectedItemForPurchase}
                            setSelectedItemForPurchase={setSelectedItemForPurchase}
                        />
                    )}

                    {activeView === 'usage' && (
                        <UsageView
                            project={project}
                            materialItems={materialItems}
                            usageByItem={usageByItem}
                            onUsageRecorded={handleUsageRecorded}
                            selectedItemForUsage={selectedItemForUsage}
                            setSelectedItemForUsage={setSelectedItemForUsage}
                            preferredChannel={activeReminderChannel}
                            setActiveView={setActiveView}
                            onEnableUsageTracking={handleUsageTrackingToggle}
                        />
                    )}

                    {activeView === 'documents' && <DocumentsView projectId={projectId} />}

                    {activeView === 'budget' && (
                        <BudgetView
                            project={project}
                            purchaseStats={purchaseStats}
                            onTargetDateChange={handleSavingsTargetDateChange}
                            onProjectUpdate={handleProjectUpdate}
                            setReminderDraft={setReminderDraft}
                            setActiveView={setActiveView}
                        />
                    )}

                    {activeView === 'settings' && (
                        <SettingsView
                            project={project}
                            setProject={setProject}
                            onSetReminder={handleSavingsReminder}
                            phoneNumber={profile?.phone_number}
                            defaultReminderChannel={activeReminderChannel}
                            onRequestPhone={handleRequestPhone}
                            savingsReminder={savingsReminder}
                            onToggleReminder={handleToggleSavingsReminder}
                            purchaseStats={purchaseStats}
                            reminderDraft={reminderDraft}
                            setReminderDraft={setReminderDraft}
                            onReminderChannelChange={setPreferredReminderChannel}
                        />
                    )}
                </main>
            </div>

            {/* ProjectViewTabs replaces the global mobile bar inside a project,
                keeping the money workflows reachable without competing docks. */}

            {/* Modals */}
            <PhoneNumberModal
                isOpen={showPhoneModal}
                onClose={closePhoneModal}
                onSave={handleSavePhoneNumber}
                initialValue={profile?.phone_number || ''}
            />

            <ProjectShareSheet
                isOpen={showShareSheet}
                onClose={() => setShowShareSheet(false)}
                project={project}
                items={items}
            />

            <InviteModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                projectId={projectId}
                projectName={project.name}
            />


        </MainLayout>
    );
}

/**
 * The owner gets the whole project. Anyone it was shared with gets the site
 * view — progress, photos, materials without prices — because they have no
 * access to the project tables themselves (migration 058).
 */
function ProjectAccessGate() {
    const params = useParams();
    const projectId = params.id as string;
    const [access, setAccess] = useState<'owner' | 'edit' | 'view' | 'none' | null>(null);

    useEffect(() => {
        let active = true;
        void supabase.rpc('site_access' as never, { p_project_id: projectId } as never).then(({ data }) => {
            if (active) setAccess(((data as string | null) ?? 'none') as 'owner' | 'edit' | 'view' | 'none');
        });
        return () => { active = false; };
    }, [projectId]);

    if (access === null) {
        return <MainLayout><div className="p-8 text-center text-secondary">Loading project…</div></MainLayout>;
    }
    if (access === 'edit' || access === 'view') {
        return <MainLayout><SiteView target={{ kind: 'project', id: projectId }} /></MainLayout>;
    }
    return <ProjectDetailContent />;
}

export default function ProjectDetailPage() {
    return (
        <ProtectedRoute>
            <ProjectAccessGate />
        </ProtectedRoute>
    );
}
