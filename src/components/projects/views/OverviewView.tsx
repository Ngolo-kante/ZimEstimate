'use client';

import { isLinePurchased } from '@/lib/projects/itemStatus';
import Link from 'next/link';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SitePhotosPanel from '@/components/projects/SitePhotosPanel';
import { StageProgressCards } from '@/components/projects/StageProgressCards';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { slopeLabel, soilLabel } from '@/lib/projects/siteLabels';
import type { ComplianceSummary } from '@/lib/compliance';
import type { PriceUpdate } from '@/lib/projects/priceUpdates';
import type { PurchaseStats } from '@/lib/projects/workspaceStats';
import type { BOQCategory, BOQItem, Project, ProjectStageWithTasks, PurchaseRecord } from '@/lib/database.types';
import {
    ShareNetwork,
    UserPlus,
    MapPin,
    TrendUp,
    CheckCircle,
    PencilSimple,
} from '@phosphor-icons/react';

const statusBadgeStyles: Record<string, { background: string; color: string }> = {
    active: { background: 'var(--color-info-bg)', color: 'var(--color-info-fg)' },
    draft: { background: 'var(--color-mist)', color: 'var(--color-text-secondary)' },
    completed: { background: 'var(--color-success-bg)', color: 'var(--color-success-fg)' },
    archived: { background: 'var(--color-mist)', color: 'var(--color-text-muted)' },
};

export interface OverviewViewProps {
    project: Project;
    projectId: string;
    stages: ProjectStageWithTasks[];
    items: BOQItem[];
    materialItems: BOQItem[];
    purchases: PurchaseRecord[];
    usageByItem: Record<string, number>;
    purchaseStats: PurchaseStats;
    completionRate: number;
    complianceSummary: ComplianceSummary;
    geotechDocumentSummary: { id: string; fileName: string; createdAt: string } | null;
    activeTab: BOQCategory;
    setActiveTab: (category: BOQCategory) => void;
    setActiveView: (view: ProjectView) => void;
    setSelectedItemForPurchase: (item: BOQItem) => void;
    isProjectOwner: boolean;
    canManageProject: boolean;
    onShare: () => void;
    onInvite: () => void;
    priceUpdates: PriceUpdate[];
    priceUpdatePreview: string;
    isPriceUpdateLoading: boolean;
    onIgnorePriceUpdates: () => void;
    onApplyPriceUpdates: () => void;
}

/** The project's front page: progress, next purchases, summary and compliance. */
export default function OverviewView({
    project,
    projectId,
    stages,
    items,
    materialItems,
    purchases,
    purchaseStats,
    completionRate,
    complianceSummary,
    geotechDocumentSummary,
    activeTab,
    setActiveTab,
    setActiveView,
    setSelectedItemForPurchase,
    isProjectOwner,
    canManageProject,
    onShare,
    onInvite,
    priceUpdates,
    priceUpdatePreview,
    isPriceUpdateLoading,
    onIgnorePriceUpdates,
    onApplyPriceUpdates,
}: OverviewViewProps) {
    const { exchangeRate, formatPrice } = useCurrency();
    const pendingItems = materialItems.filter(item => !isLinePurchased(item, purchases));
    return (
        <div className="overview-view space-y-8 max-w-6xl mx-auto">
            <div className="overview-header">
                <div>
                    {/* Breadcrumbs */}
                    <div className="overview-breadcrumb">
                        <Link
                            href="/projects"
                            className="hover:text-accent transition-colors"
                        >
                            My projects
                        </Link>
                        <span>/</span>
                        <span className="font-medium text-primary">{project.name}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-primary font-heading break-words">{project.name}</h1>
                    <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                        <MapPin size={16} />
                        {project.location || 'No location set'}
                        <span className="mx-2">•</span>
                        <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={statusBadgeStyles[project.status] ?? statusBadgeStyles.draft}
                        >
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </span>
                    </div>
                </div>
                <div className="overview-actions">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onShare()}
                        icon={<ShareNetwork size={16} />}
                    >
                        Share
                    </Button>
                    {isProjectOwner && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onInvite()}
                            icon={<UserPlus size={16} />}
                        >
                            Invite
                        </Button>
                    )}
                    {canManageProject && (
                        <Button
                            size="sm"
                            variant="secondary"
                            icon={<PencilSimple size={16} />}
                            onClick={() => setActiveView('settings')}
                        >
                            Edit project
                        </Button>
                    )}
                </div>
            </div>

            {/* Project Progress/Timeline */}
            <section>
                <h3 className="section-title mb-4">Construction progress</h3>
                <StageProgressCards
                    stages={stages}
                    items={items} purchases={purchases}
                    activeStage={activeTab}
                    onStageClick={(category) => {
                        setActiveTab(category);
                        setActiveView('boq');
                    }}
                />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {/* Left Column - Next Steps */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Next Steps */}
                    <section className="overview-card">
                        <h3 className="text-lg font-bold text-primary mb-4 font-heading">Next steps</h3>
                        <div className="space-y-4">
                            {pendingItems.slice(0, 5).map((item, index) => (
                                <div key={item.id} className="next-step-item">
                                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                                        <span className="font-medium text-primary break-words min-w-0">{item.material_name}</span>
                                        <span className="text-xs text-secondary">
                                            {formatPrice(
                                                Number(item.quantity) * Number(item.unit_price_usd),
                                                Number(item.quantity) * Number(item.unit_price_usd) * exchangeRate
                                            )}
                                        </span>
                                    </div>
                                    <Button size="sm" variant={index === 0 ? 'primary' : 'secondary'} onClick={() => {
                                        setSelectedItemForPurchase(item);
                                        setActiveView('procurement');
                                    }}>
                                        Purchase
                                    </Button>
                                </div>
                            ))}
                            {pendingItems.length === 0 && (
                                <div className="text-center py-8 text-secondary">
                                    <CheckCircle size={32} className="mx-auto mb-2 text-[var(--color-success-fg)]" />
                                    <p>All items purchased! Great job.</p>
                                </div>
                            )}
                            {pendingItems.length > 5 && (
                                <button
                                    className="view-all-btn"
                                    onClick={() => setActiveView('procurement')}
                                >
                                    View all {pendingItems.length} pending items
                                </button>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column - Summary Stats */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project summary</CardTitle>
                        </CardHeader>
                        <div className="space-y-4">
                            <div className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">BOQ estimate</span>
                                <span className="font-bold text-primary">
                                    {formatPrice(purchaseStats.estimatedTotal, purchaseStats.estimatedTotal * exchangeRate)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-3 py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Spent so far</span>
                                <span className="font-bold text-primary">{formatPrice(purchaseStats.actualSpent, purchaseStats.actualSpent * exchangeRate)}</span>
                            </div>
                            {project.budget_target_usd ? (
                                <div className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-border-light">
                                    <span className="text-sm text-secondary">Your limit</span>
                                    <span className="font-bold text-primary">
                                        {formatPrice(project.budget_target_usd, project.budget_target_usd * exchangeRate)}
                                    </span>
                                </div>
                            ) : null}
                            <div className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Est. materials</span>
                                <span className="font-medium text-primary">{materialItems.length} items</span>
                            </div>
                            <div className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Completion</span>
                                <span className="font-medium text-primary">{completionRate}%</span>
                            </div>

                        </div>
                    </Card>



                </div>
            </div>
            {/* Price Update Alert */}
            {priceUpdates.length > 0 && (
                <div className="price-update-alert">
                    <div className="flex items-start gap-3">
                        <div className="price-update-icon">
                            <TrendUp size={20} weight="bold" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900">Price updates available</h4>
                            <p className="text-sm text-blue-700 mt-1">
                                New market prices detected for {priceUpdatePreview}.
                                Updating will adjust your estimated totals.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={onIgnorePriceUpdates}
                            className="bg-white text-blue-700 border-blue-200"
                        >
                            Ignore
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={onApplyPriceUpdates}
                            loading={isPriceUpdateLoading}
                        >
                            Apply updates
                        </Button>
                    </div>
                </div>
            )}

            <details className="overview-details">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4">Details</summary>
                <div className="space-y-6 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Compliance snapshot</CardTitle>
                        </CardHeader>
                        {/* Counted exactly as the Compliance counts them
                            (summariseCompliance), so the two pages agree. */}
                        <div className="space-y-4">
                            <div className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Certificates</span>
                                <span className="font-medium text-primary">
                                    {complianceSummary.doneCerts}/{complianceSummary.totalCerts}
                                </span>
                            </div>
                            <div className="flex flex-wrap justify-between items-center gap-2 py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Admin tasks</span>
                                <span className="font-medium text-primary">
                                    {complianceSummary.doneTasks}/{complianceSummary.totalTasks}
                                </span>
                            </div>
                            {complianceSummary.next ? (
                                <div className="text-xs">
                                    <span className="text-secondary">Next {complianceSummary.next.type === 'Certificate' ? 'certificate' : 'task'}: </span>
                                    <span className="font-medium text-primary">{complianceSummary.next.label}</span>
                                    <span className="text-secondary"> · {complianceSummary.next.stageName}</span>
                                </div>
                            ) : complianceSummary.total > 0 ? (
                                <div className="text-xs font-medium text-green-700">All certificates and tasks are done.</div>
                            ) : (
                                <div className="text-xs text-secondary">No stages switched on yet.</div>
                            )}
                            <Button size="sm" variant="secondary" className="w-full" onClick={() => setActiveView('compliance')}>
                                Open compliance
                            </Button>

                            <div className="pt-2 border-t border-border-light space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-secondary">Soil type</span>
                                    <span className="font-medium text-primary">
                                        {soilLabel(project.soil_type) ?? 'Not set'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-secondary">Site slope</span>
                                    <span className="font-medium text-primary">
                                        {slopeLabel(project.site_slope) ?? 'Not set'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-secondary">Geotech report</span>
                                    <span className={`font-medium ${project.geotech_report_uploaded ? 'text-green-700' : 'text-slate-600'}`}>
                                        {project.geotech_report_uploaded ? 'Uploaded' : 'Not uploaded'}
                                    </span>
                                </div>
                                {geotechDocumentSummary && (
                                    <div className="text-xs text-secondary">
                                        {geotechDocumentSummary.fileName} ({new Date(geotechDocumentSummary.createdAt).toLocaleDateString()})
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                    <SitePhotosPanel projectId={projectId} />
                </div>
            </details>
        </div>
    );
}
