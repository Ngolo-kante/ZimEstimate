'use client';

import Link from 'next/link';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SitePhotosPanel from '@/components/projects/SitePhotosPanel';
import { RunningTotalBar } from '@/components/ui/RunningTotalBar';
import { StageProgressCards } from '@/components/projects/StageProgressCards';
import ProjectKPIDashboard from '@/components/projects/ProjectKPIDashboard';
import ProjectCostSplit from '@/components/projects/ProjectCostSplit';
import type { ProjectView } from '@/components/projects/SidebarSpine';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { projectMoney } from '@/lib/projects/budgetMath';
import { slopeLabel, soilLabel } from '@/lib/projects/siteLabels';
import type { ComplianceSummary } from '@/lib/compliance';
import type { PriceUpdate } from '@/lib/projects/priceUpdates';
import type { PurchaseStats } from '@/lib/projects/workspaceStats';
import type { BOQCategory, BOQItem, Project, ProjectStageWithTasks, PurchaseRecord } from '@/lib/database.types';
import {
    ShareNetwork,
    UserPlus,
    MapPin,
    Wallet,
    TrendUp,
    CheckCircle,
    PencilSimple,
} from '@phosphor-icons/react';

const statusBadgeStyles: Record<string, { background: string; color: string }> = {
    active: { background: 'rgba(22, 163, 74, 0.12)', color: 'var(--color-emerald)' },
    draft: { background: 'var(--color-mist)', color: 'var(--color-text-secondary)' },
    completed: { background: 'rgba(46, 108, 246, 0.12)', color: 'var(--color-accent)' },
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

/** The project's front page: progress, KPIs, next purchases, summary and compliance. */
export default function OverviewView({
    project,
    projectId,
    stages,
    items,
    materialItems,
    purchases,
    usageByItem,
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
    return (
        <div className="overview-view space-y-8 max-w-6xl mx-auto reveal" data-delay="1">
            <div className="overview-header">
                <div>
                    {/* Breadcrumbs */}
                    <div className="overview-breadcrumb">
                        <Link
                            href="/projects"
                            className="hover:text-accent transition-colors"
                        >
                            My Projects
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
                            {project.status.toUpperCase()}
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
                            icon={<PencilSimple size={16} />}
                            onClick={() => setActiveView('settings')}
                        >
                            Edit Project
                        </Button>
                    )}
                </div>
            </div>



            {/* Price Update Alert */}
            {priceUpdates.length > 0 && (
                <div className="price-update-alert reveal" data-delay="2">
                    <div className="flex items-start gap-3">
                        <div className="price-update-icon">
                            <TrendUp size={20} weight="bold" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900">Price Updates Available</h4>
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
                            onClick={onApplyPriceUpdates}
                            loading={isPriceUpdateLoading}
                            className="bg-blue-500 hover:bg-blue-600 text-white border-none"
                        >
                            Apply Updates
                        </Button>
                    </div>
                </div>
            )}

            {/* Project Progress/Timeline */}
            <section className="reveal" data-delay="3">
                <h3 className="section-title mb-4">Construction Progress</h3>
                <StageProgressCards
                    stages={stages}
                    items={items}
                    activeStage={activeTab}
                    onStageClick={(category) => {
                        setActiveTab(category);
                        setActiveView('boq');
                    }}
                />
                <SitePhotosPanel projectId={projectId} />
            </section>

            {/* KPI Dashboard */}
            <section className="overview-card reveal" data-delay="4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <Wallet size={24} weight="duotone" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-primary font-heading">Project KPIs</h3>
                        <p className="text-sm text-secondary">Key performance indicators at a glance</p>
                    </div>
                </div>

                <ProjectKPIDashboard
                    items={items}
                    purchases={purchases}
                    usageByItem={usageByItem}
                    totalBudget={projectMoney({ estimateUsd: purchaseStats.estimatedTotal, limitUsd: project.budget_target_usd, spentUsd: purchaseStats.actualSpent }).budgetUsd}
                    onNavigate={(view) => setActiveView(view as ProjectView)}
                />
            </section>

            <ProjectCostSplit items={items} spentUsd={purchaseStats.actualSpent} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {/* Left Column - Next Steps */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Next Steps */}
                    <section className="overview-card reveal" data-delay="5">
                        <h3 className="text-lg font-bold text-primary mb-4 font-heading">Next Steps</h3>
                        <div className="space-y-4">
                            {materialItems.filter(i => !i.is_purchased).slice(0, 5).map(item => (
                                <div key={item.id} className="next-step-item">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                                        <span className="font-medium text-primary">{item.material_name}</span>
                                        <span className="text-xs text-secondary">
                                            {formatPrice(
                                                Number(item.quantity) * Number(item.unit_price_usd),
                                                Number(item.quantity) * Number(item.unit_price_usd) * exchangeRate
                                            )}
                                        </span>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={() => {
                                        setSelectedItemForPurchase(item);
                                        setActiveView('procurement');
                                    }}>
                                        Purchase
                                    </Button>
                                </div>
                            ))}
                            {materialItems.filter(i => !i.is_purchased).length === 0 && (
                                <div className="text-center py-8 text-secondary">
                                    <CheckCircle size={32} className="mx-auto mb-2 text-blue-600" />
                                    <p>All items purchased! Great job.</p>
                                </div>
                            )}
                            {materialItems.filter(i => !i.is_purchased).length > 5 && (
                                <button
                                    className="view-all-btn"
                                    onClick={() => setActiveView('procurement')}
                                >
                                    View all {materialItems.filter(i => !i.is_purchased).length} pending items
                                </button>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column - Summary Stats */}
                <div className="space-y-6">
                    <Card className="reveal" data-delay="6">
                        <CardHeader>
                            <CardTitle>Project Summary</CardTitle>
                        </CardHeader>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">BOQ estimate</span>
                                <span className="font-bold text-primary">
                                    {formatPrice(purchaseStats.estimatedTotal, purchaseStats.estimatedTotal * exchangeRate)}
                                </span>
                            </div>
                            {project.budget_target_usd ? (
                                <div className="flex justify-between items-center py-2 border-b border-border-light">
                                    <span className="text-sm text-secondary">Your limit</span>
                                    <span className="font-bold text-primary">
                                        {formatPrice(project.budget_target_usd, project.budget_target_usd * exchangeRate)}
                                    </span>
                                </div>
                            ) : null}
                            <div className="flex justify-between items-center py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Est. Materials</span>
                                <span className="font-medium text-primary">{materialItems.length} Items</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Completion</span>
                                <span className="font-medium text-primary">{completionRate}%</span>
                            </div>
                            <div className="pt-2">
                                <RunningTotalBar
                                    totalUSD={purchaseStats.estimatedTotal}
                                    totalZWG={purchaseStats.estimatedTotal * exchangeRate}
                                    budgetTargetUSD={project.budget_target_usd}
                                    completionPercentage={completionRate}
                                    projectName={project.name}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card className="reveal" data-delay="7">
                        <CardHeader>
                            <CardTitle>Compliance Snapshot</CardTitle>
                        </CardHeader>
                        {/* Counted exactly as the Compliance Tracker counts them
                            (summariseCompliance), so the two pages agree. */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-border-light">
                                <span className="text-sm text-secondary">Certificates</span>
                                <span className="font-medium text-primary">
                                    {complianceSummary.doneCerts}/{complianceSummary.totalCerts}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border-light">
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
                                Open Compliance Tracker
                            </Button>

                            <div className="pt-2 border-t border-border-light space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-secondary">Soil Type</span>
                                    <span className="font-medium text-primary">
                                        {soilLabel(project.soil_type) ?? 'Not set'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-secondary">Site Slope</span>
                                    <span className="font-medium text-primary">
                                        {slopeLabel(project.site_slope) ?? 'Not set'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-secondary">Geotech Report</span>
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

                    <Card className="pro-tip-card reveal" data-delay="8">
                        <div className="p-4">
                            <h4 className="font-bold text-blue-900 mb-2">Pro Tip</h4>
                            <p className="text-sm text-blue-700">
                                Use <strong>Buying &amp; quotes</strong> to request quotes from multiple suppliers and get the best deals.
                            </p>
                            <Button
                                size="sm"
                                className="mt-3 bg-blue-500 hover:bg-blue-600 text-white w-full border-none"
                                onClick={() => setActiveView('procurement')}
                            >
                                Go to Procurement
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
