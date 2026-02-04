'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle, CardContent, CardBadge } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import InlineEdit from '@/components/ui/InlineEdit';
import StageTab from '@/components/projects/StageTab';
import DocumentsTab from '@/components/projects/DocumentsTab';
import ShareModal from '@/components/projects/ShareModal';
import PurchaseTracker from '@/components/ui/PurchaseTracker';
import StageSavingsToggle from '@/components/ui/StageSavingsToggle';
import BudgetPlanner from '@/components/ui/BudgetPlanner';
import StageUsageSection from '@/components/projects/StageUsageSection';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import {
    getProjectWithItems,
    createReminder,
    deleteProject,
    updateProject,
    updateBOQItem,
} from '@/lib/services/projects';
import {
    getProjectStages,
    getAllStagesProgress,
    StageProgress,
    updateStage,
    createDefaultStages,
    getStageUsageData,
} from '@/lib/services/stages';
import {
    Project,
    BOQItem,
    ProjectStageWithTasks,
    BOQCategory,
} from '@/lib/database.types';
import {
    ShareNetwork,
    Export,
    Trash,
    ArrowLeft,
    MapPin,
    Calendar,
    Tag,
    WhatsappLogo,
    TrendUp,
    Clock,
    File,
    ShoppingCart,
    CircleNotch,
    Warning,
    CaretDown,
    CaretUp,
} from '@phosphor-icons/react';

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

// Stage categories in order
const STAGE_CATEGORIES: BOQCategory[] = ['substructure', 'superstructure', 'roofing', 'finishing', 'exterior'];

const categoryLabels: Record<BOQCategory, string> = {
    substructure: 'Substructure',
    superstructure: 'Superstructure',
    roofing: 'Roofing',
    finishing: 'Finishing',
    exterior: 'Exterior',
};

function ProjectDetailContent() {
    const params = useParams();
    const router = useRouter();
    const { success, error: showError } = useToast();
    const { profile } = useAuth();
    const { exchangeRate, formatPrice } = useCurrency();
    const projectId = params.id as string;

    // Core state
    const [project, setProject] = useState<Project | null>(null);
    const [items, setItems] = useState<BOQItem[]>([]);
    const [stages, setStages] = useState<ProjectStageWithTasks[]>([]);
    const [stagesProgress, setStagesProgress] = useState<StageProgress[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showBudgetPlanner, setShowBudgetPlanner] = useState(false);
    const [isCreatingStages, setIsCreatingStages] = useState(false);
    const [usageByStage, setUsageByStage] = useState<Record<string, { items: BOQItem[]; usageByItem: Record<string, number> }>>({});
    const [isUsageLoading, setIsUsageLoading] = useState(false);

    // View state
    const [activeTab, setActiveTab] = useState<BOQCategory | 'usage' | 'tracking' | 'documents'>('substructure');
    const [stagesSetupRequired, setStagesSetupRequired] = useState(false);

    // Purchase stats (calculated from items)
    const purchaseStats = useMemo(() => {
        const totalItems = items.length;
        const purchasedItems = items.filter(i => i.is_purchased).length;
        const estimatedTotal = items.reduce((sum, item) =>
            sum + (Number(item.quantity) * Number(item.unit_price_usd)), 0);
        const actualSpent = items
            .filter(item => item.is_purchased)
            .reduce((sum, item) => {
                const qty = item.actual_quantity ?? item.quantity;
                const price = item.actual_price_usd ?? item.unit_price_usd;
                return sum + (Number(qty) * Number(price));
            }, 0);

        return {
            totalItems,
            purchasedItems,
            estimatedTotal,
            actualSpent,
            remainingBudget: estimatedTotal - actualSpent,
        };
    }, [items]);

    const activeStageItems = useMemo(() => {
        if (STAGE_CATEGORIES.includes(activeTab as BOQCategory)) {
            const category = activeTab as BOQCategory;
            return items.filter(i => i.category === category);
        }
        return items;
    }, [items, activeTab]);

    const activeStageBudget = useMemo(() => {
        const totalBudget = activeStageItems.reduce((sum: number, item: BOQItem) =>
            sum + (Number(item.quantity) * Number(item.unit_price_usd)), 0);

        const totalSpent = activeStageItems
            .filter(item => item.is_purchased)
            .reduce((sum: number, item: BOQItem) => {
                const qty = item.actual_quantity ?? item.quantity;
                const price = item.actual_price_usd ?? item.unit_price_usd;
                return sum + (Number(qty) * Number(price));
            }, 0);

        return { totalBudget, totalSpent };
    }, [activeStageItems]);

    // Load project data
    useEffect(() => {
        async function loadProject() {
            setIsLoading(true);
            setError(null);

            const [projectResult, stagesResult] = await Promise.all([
                getProjectWithItems(projectId),
                getProjectStages(projectId),
            ]);

            if (projectResult.error) {
                setError(projectResult.error.message);
            } else if (projectResult.project) {
                setProject(projectResult.project);
                setItems(projectResult.items);
            } else {
                setError('Project not found');
            }

            if (stagesResult.error) {
                // Check if it's a missing table error
                if (stagesResult.error.message?.includes('does not exist')) {
                    setStagesSetupRequired(true);
                }
            } else {
                setStages(stagesResult.stages);
                // Set initial active tab to first applicable stage
                const firstApplicable = stagesResult.stages.find(s => s.is_applicable);
                if (firstApplicable) {
                    setActiveTab(firstApplicable.boq_category);
                }
            }

            // Load progress data
            const progressResult = await getAllStagesProgress(projectId);
            if (!progressResult.error) {
                setStagesProgress(progressResult.progress);
            }

            setIsLoading(false);
        }

        loadProject();
    }, [projectId]);

    const loadUsageData = useCallback(async () => {
        setIsUsageLoading(true);
        const stagesToLoad = stages.filter(s => s.is_applicable);
        const results = await Promise.all(
            stagesToLoad.map(stage => getStageUsageData(projectId, stage.boq_category))
        );

        const nextUsage: Record<string, { items: BOQItem[]; usageByItem: Record<string, number> }> = {};
        results.forEach((result, index) => {
            const stage = stagesToLoad[index];
            if (!stage) return;
            if (!result.error) {
                nextUsage[stage.boq_category] = {
                    items: result.items,
                    usageByItem: result.usageByItem,
                };
            }
        });

        setUsageByStage(nextUsage);
        setIsUsageLoading(false);
    }, [projectId, stages]);

    useEffect(() => {
        if (activeTab !== 'usage' || !project?.usage_tracking_enabled) return;
        loadUsageData();
    }, [activeTab, project?.usage_tracking_enabled, loadUsageData]);

    // Handlers
    const handleProjectUpdate = async (updates: Partial<Project>) => {
        if (!project) return;

        const { project: updated, error } = await updateProject(projectId, updates);
        if (error) {
            showError('Failed to update project');
        } else if (updated) {
            setProject(updated);
            success('Project updated');
        }
    };

    const handleItemUpdate = async (itemId: string, updates: Partial<BOQItem>): Promise<void> => {
        const { item, error } = await updateBOQItem(itemId, updates);
        if (error) {
            showError('Failed to update item');
        } else if (item) {
            const updatedItems = items.map(i => {
                if (i.id !== itemId) return i;
                const next = { ...i, ...updates };
                const qty = Number(next.quantity) || 0;
                const priceUsd = Number(next.unit_price_usd) || 0;
                const priceZwg = Number(next.unit_price_zwg) || 0;
                return {
                    ...next,
                    total_usd: qty * priceUsd,
                    total_zwg: qty * priceZwg,
                };
            });

            setItems(updatedItems);

            if ('quantity' in updates || 'unit_price_usd' in updates || 'unit_price_zwg' in updates) {
                const newTotal = updatedItems.reduce((sum, i) => sum + Number(i.total_usd), 0);
                await updateProject(projectId, {
                    total_usd: newTotal,
                    total_zwg: newTotal * exchangeRate,
                });
                setProject(prev => prev ? { ...prev, total_usd: newTotal, total_zwg: newTotal * exchangeRate } : prev);
            }
        }
    };

    const handleItemDelete = (itemId: string) => {
        setItems(prev => prev.filter(i => i.id !== itemId));
    };

    const handleItemAdded = async (item: BOQItem) => {
        setItems(prev => [...prev, item]);
        const newTotal = items.reduce((sum, i) => sum + Number(i.total_usd), 0) + Number(item.total_usd);
        await updateProject(projectId, {
            total_usd: newTotal,
            total_zwg: newTotal * exchangeRate,
        });
        setProject(prev => prev ? { ...prev, total_usd: newTotal, total_zwg: newTotal * exchangeRate } : prev);
    };

    const handleStageUpdate = (updatedStage: ProjectStageWithTasks) => {
        setStages(prev => prev.map(s => s.id === updatedStage.id ? updatedStage : s));
        setStagesProgress(prev => prev.map(stage => {
            if (stage.stageId !== updatedStage.id) {
                return stage;
            }
            const completedTasks = updatedStage.tasks.filter(t => t.is_completed).length;
            return {
                ...stage,
                status: updatedStage.status,
                name: updatedStage.name,
                boqCategory: updatedStage.boq_category,
                isApplicable: updatedStage.is_applicable,
                taskProgress: { completed: completedTasks, total: updatedStage.tasks.length },
            };
        }));
    };

    const handleSavingsTargetDateChange = async (date: string) => {
        if (STAGE_CATEGORIES.includes(activeTab as BOQCategory) && currentStage) {
            const { stage: updated, error: stageError } = await updateStage(currentStage.id, { end_date: date });
            if (stageError) {
                showError('Failed to update stage target date');
                return;
            }
            if (updated) {
                handleStageUpdate({ ...currentStage, ...updated });
                success('Stage target date updated');
            }
            return;
        }

        await handleProjectUpdate({ target_purchase_date: date });
    };

    const handleSavingsReminder = async (frequency: 'daily' | 'weekly' | 'monthly', amount: number) => {
        if (!profile?.phone_number) {
            showError('Add a phone number in Settings to schedule reminders');
            return;
        }

        const offsetDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
        const scheduled = new Date();
        scheduled.setDate(scheduled.getDate() + offsetDays);
        const scheduledDate = scheduled.toISOString().split('T')[0];

        const stageLabel = STAGE_CATEGORIES.includes(activeTab as BOQCategory)
            ? categoryLabels[activeTab as BOQCategory]
            : 'Project';

        const message = `Savings reminder for ${project?.name || 'Project'} (${stageLabel}): save ${formatPrice(amount, amount * exchangeRate)} ${frequency}.`;

        const { error: reminderError } = await createReminder({
            project_id: projectId,
            reminder_type: 'savings',
            message,
            scheduled_date: scheduledDate,
            phone_number: profile.phone_number,
        });

        if (reminderError) {
            showError('Failed to schedule reminder');
            return;
        }

        success(`Reminder scheduled for ${scheduledDate}`);
    };

    const handleCreateStages = async () => {
        if (!project) return;
        setIsCreatingStages(true);
        const { error: createError } = await createDefaultStages(projectId, project.scope);
        if (createError) {
            showError('Failed to create stages. Please run the stage migration.');
            setIsCreatingStages(false);
            return;
        }

        const [stagesResult, progressResult] = await Promise.all([
            getProjectStages(projectId),
            getAllStagesProgress(projectId),
        ]);

        if (!stagesResult.error) {
            setStages(stagesResult.stages);
            const firstApplicable = stagesResult.stages.find(s => s.is_applicable);
            if (firstApplicable) {
                setActiveTab(firstApplicable.boq_category);
            }
        }

        if (!progressResult.error) {
            setStagesProgress(progressResult.progress);
        }

        setIsCreatingStages(false);
        success('Stages created');
    };

    const handleUsageTrackingToggle = async (enabled: boolean) => {
        const { project: updated, error: updateError } = await updateProject(projectId, {
            usage_tracking_enabled: enabled,
        });
        if (updateError) {
            showError('Failed to update usage tracking');
            return;
        }
        if (updated) {
            setProject(updated);
            if (enabled) {
                loadUsageData();
            }
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/projects/${projectId}`;
        const message = `Check out my construction project "${project?.name}" on ZimEstimate!\n\nTotal Budget: $${Number(project?.total_usd).toLocaleString()}\n\n${shareUrl}`;

        if (navigator.share) {
            navigator.share({
                title: project?.name || 'My Project',
                text: message,
                url: shareUrl,
            });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            return;
        }

        setIsDeleting(true);
        const { error: deleteError } = await deleteProject(projectId);

        if (deleteError) {
            showError('Failed to delete project: ' + deleteError.message);
            setIsDeleting(false);
        } else {
            success('Project deleted');
            router.push('/projects?refresh=1');
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <MainLayout title="Loading...">
                <div className="loading-state">
                    <CircleNotch size={40} className="spinner" />
                    <p>Loading project...</p>
                </div>
                <style jsx>{`
                    .loading-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 400px;
                        gap: var(--spacing-md);
                    }
                    :global(.spinner) {
                        animation: spin 1s linear infinite;
                        color: var(--color-primary);
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    p { color: var(--color-text-secondary); }
                `}</style>
            </MainLayout>
        );
    }

    // Error state
    if (error || !project) {
        return (
            <MainLayout title="Error">
                <div className="error-state">
                    <Warning size={48} weight="light" />
                    <h2>Project Not Found</h2>
                    <p>{error || 'The requested project could not be found.'}</p>
                    <Link href="/projects?refresh=1">
                        <Button variant="secondary" icon={<ArrowLeft size={18} />}>
                            Back to Projects
                        </Button>
                    </Link>
                </div>
                <style jsx>{`
                    .error-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 400px;
                        gap: var(--spacing-md);
                        text-align: center;
                        color: var(--color-text-muted);
                    }
                    h2 { color: var(--color-text); margin: 0; }
                    p { color: var(--color-text-secondary); margin: 0; }
                `}</style>
            </MainLayout>
        );
    }

    // Get current stage
    const currentStage = stages.find(s => s.boq_category === activeTab);
    const applicableStages = stages.filter(s => s.is_applicable);
    const hasLabor = project.labor_preference === 'with_labor';
    const primaryStageCategory = applicableStages[0]?.boq_category;
    const formatStageLabel = (stage: string) =>
        categoryLabels[stage as BOQCategory] || stage.replace('_', ' ');
    const scopeLabel = project.selected_stages && project.selected_stages.length > 0
        ? project.selected_stages.map(formatStageLabel).join(', ')
        : project.scope.replace('_', ' ');
    const savingsTargetDate = STAGE_CATEGORIES.includes(activeTab as BOQCategory)
        ? currentStage?.end_date || null
        : project.target_purchase_date || project.target_completion_date || null;

    const statusColors: Record<string, 'success' | 'accent' | 'default'> = {
        active: 'success',
        draft: 'default',
        completed: 'accent',
        archived: 'default',
    };

    return (
        <MainLayout title={project.name}>
            <div className="project-detail">
                <div className="sub-nav">
                    <Link href="/dashboard">Dashboard</Link>
                    <span>›</span>
                    <Link href="/projects?refresh=1">Projects Summary</Link>
                    <span>›</span>
                    <span className="current">{project.name}</span>
                </div>

                {/* Back Link */}
                <Link href="/projects?refresh=1" className="back-link">
                    <ArrowLeft size={16} />
                    Back to Projects
                </Link>

                {/* Project Header */}
                <div className="project-header">
                    <div className="project-info">
                        <h1>
                            <InlineEdit
                                value={project.name}
                                onSave={(val) => handleProjectUpdate({ name: String(val) })}
                                className="title-edit"
                            />
                        </h1>
                        <div className="project-meta">
                            <CardBadge variant={statusColors[project.status] || 'default'}>
                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </CardBadge>
                            <span className="meta-item">
                                <MapPin size={14} />
                                <InlineEdit
                                    value={project.location || ''}
                                    placeholder="Add location"
                                    onSave={(val) => handleProjectUpdate({ location: String(val) || null })}
                                />
                            </span>
                            <span className="meta-item">
                                <Calendar size={14} />
                                Created {new Date(project.created_at).toLocaleDateString()}
                            </span>
                            {project.updated_at && project.updated_at !== project.created_at && (
                                <span className="meta-item">
                                    <Clock size={14} />
                                    Modified {new Date(project.updated_at).toLocaleDateString()}
                                </span>
                            )}
                            <span className="meta-item">
                                <Tag size={14} />
                                {scopeLabel}
                            </span>
                        </div>
                    </div>
                    <div className="header-actions">
                        <Button variant="ghost" icon={<ShareNetwork size={18} />} onClick={() => setShowShareModal(true)}>
                            Share
                        </Button>
                        <Button variant="ghost" icon={<WhatsappLogo size={18} />} onClick={handleShare}>
                            WhatsApp
                        </Button>
                        <Link href={`/export?project=${project.id}`}>
                            <Button variant="secondary" icon={<Export size={18} />}>
                                Export
                            </Button>
                        </Link>
                        <Button
                            variant="danger"
                            icon={<Trash size={18} />}
                            onClick={handleDelete}
                            loading={isDeleting}
                        >
                            Delete
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="stats-grid">
                    <StageSavingsToggle
                        totalBudget={activeStageBudget.totalBudget}
                        amountSpent={activeStageBudget.totalSpent}
                        targetDate={savingsTargetDate}
                    />

                    <Card variant="dashboard">
                        <CardHeader>
                            <CardTitle>Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="stat-value">
                                {purchaseStats.purchasedItems}/{purchaseStats.totalItems}
                            </p>
                            <div className="mini-progress">
                                <div
                                    className="mini-progress-fill"
                                    style={{ width: `${purchaseStats.totalItems > 0 ? (purchaseStats.purchasedItems / purchaseStats.totalItems) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="stat-label">items purchased</p>
                        </CardContent>
                    </Card>

                    <Card variant="dashboard">
                        <CardHeader>
                            <CardTitle>Amount Spent</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="stat-value spent">
                                <PriceDisplay
                                    priceUsd={purchaseStats.actualSpent}
                                    priceZwg={purchaseStats.actualSpent * exchangeRate}
                                />
                            </p>
                            <p className="stat-label">
                                {purchaseStats.actualSpent <= purchaseStats.estimatedTotal ? (
                                    <span className="under-budget">
                                        <TrendUp size={12} /> Under budget
                                    </span>
                                ) : (
                                    <span className="over-budget">Over by ${(purchaseStats.actualSpent - purchaseStats.estimatedTotal).toFixed(2)}</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Cost Savings Planner */}
                <div className="savings-planner">
                    <button
                        className="planner-toggle"
                        onClick={() => setShowBudgetPlanner(prev => !prev)}
                    >
                        <span>Cost Savings Planner</span>
                        {showBudgetPlanner ? <CaretUp size={16} /> : <CaretDown size={16} />}
                    </button>

                    {showBudgetPlanner && (
                        <div className="planner-body">
                            <BudgetPlanner
                                totalBudgetUsd={activeStageBudget.totalBudget}
                                amountSpentUsd={activeStageBudget.totalSpent}
                                targetDate={savingsTargetDate}
                                onTargetDateChange={handleSavingsTargetDateChange}
                                onSetReminder={handleSavingsReminder}
                            />
                        </div>
                    )}
                </div>

                {/* Tab Navigation */}
                <div className="view-toggle">
                    {/* Stage Tabs */}
                    {applicableStages.map((stage) => (
                        <button
                            key={stage.boq_category}
                            className={`toggle-btn ${activeTab === stage.boq_category ? 'active' : ''}`}
                            onClick={() => setActiveTab(stage.boq_category as BOQCategory)}
                        >
                            {categoryLabels[stage.boq_category]}
                        </button>
                    ))}

                    <div className="tab-separator" />

                    {/* Usage Tab */}
                    <button
                        className={`toggle-btn ${activeTab === 'usage' ? 'active' : ''}`}
                        onClick={() => setActiveTab('usage')}
                    >
                        Usage
                    </button>

                    {/* Tracking Tab */}
                    <button
                        className={`toggle-btn ${activeTab === 'tracking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tracking')}
                    >
                        <ShoppingCart size={18} />
                        Tracking
                    </button>

                    {/* Documents Tab */}
                    <button
                        className={`toggle-btn ${activeTab === 'documents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('documents')}
                    >
                        <File size={18} />
                        Documents
                    </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {/* Database setup required message */}
                    {stagesSetupRequired && STAGE_CATEGORIES.includes(activeTab as BOQCategory) && (
                        <div className="setup-required">
                            <Warning size={48} weight="light" />
                            <h4>Database Setup Required</h4>
                            <p>The stage-first architecture requires running the database migration.</p>
                            <code>supabase/migrations/006_stage_first_architecture.sql</code>
                        </div>
                    )}

                    {/* Stage Tabs */}
                    {!stagesSetupRequired && STAGE_CATEGORIES.includes(activeTab as BOQCategory) && (
                        currentStage ? (
                            <StageTab
                                key={currentStage.id}
                                stage={currentStage}
                                projectId={projectId}
                                items={items}
                                onStageUpdate={handleStageUpdate}
                                onItemUpdate={handleItemUpdate}
                                onItemDelete={handleItemDelete}
                                onItemAdded={handleItemAdded}
                                showLabor={hasLabor}
                                primaryStageCategory={primaryStageCategory}
                            />
                        ) : (
                            <div className="setup-required">
                                <Warning size={48} weight="light" />
                                <h4>Stage Data Missing</h4>
                                <p>This project does not have stage records yet.</p>
                                <Button
                                    variant="primary"
                                    onClick={handleCreateStages}
                                    loading={isCreatingStages}
                                >
                                    Create Stages
                                </Button>
                                <p className="hint">
                                    If this fails, run <code>supabase/migrations/006_stage_first_architecture.sql</code>.
                                </p>
                            </div>
                        )
                    )}

                    {/* Usage Tab */}
                    {activeTab === 'usage' && (
                        <div className="usage-tab">
                            {!project.usage_tracking_enabled ? (
                                <div className="usage-gate">
                                    <h3>Has production started?</h3>
                                    <p>Enable usage tracking to record material consumption on-site.</p>
                                    <div className="usage-actions">
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleUsageTrackingToggle(false)}
                                        >
                                            Not Yet
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => handleUsageTrackingToggle(true)}
                                        >
                                            Yes, Start Tracking
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="usage-content">
                                    <div className="usage-header">
                                        <div>
                                            <h3>Usage Tracking</h3>
                                            <p>Track actual material usage once production starts.</p>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleUsageTrackingToggle(false)}
                                        >
                                            Turn Off
                                        </Button>
                                    </div>

                                    {isUsageLoading ? (
                                        <div className="loading-state">
                                            <CircleNotch size={24} className="spinner" />
                                            <span>Loading usage data...</span>
                                        </div>
                                    ) : (
                                        <div className="usage-sections">
                                            {applicableStages.every(stage => (usageByStage[stage.boq_category]?.items || []).length === 0) ? (
                                                <div className="empty-state">
                                                    <ShoppingCart size={48} weight="light" />
                                                    <h4>No items to track yet</h4>
                                                    <p>Add BOQ items to start tracking usage</p>
                                                </div>
                                            ) : (
                                                applicableStages.map((stage) => {
                                                    const data = usageByStage[stage.boq_category];
                                                    return (
                                                        <div key={stage.id} className="usage-stage">
                                                            <h4>{categoryLabels[stage.boq_category]}</h4>
                                                            <StageUsageSection
                                                                projectId={projectId}
                                                                items={data?.items || []}
                                                                usageByItem={data?.usageByItem || {}}
                                                                onUsageRecorded={loadUsageData}
                                                            />
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tracking Tab */}
                    {activeTab === 'tracking' && (
                        <div className="tracking-tab">
                            <h3>Purchase Tracking</h3>
                            <p className="tracking-description">Track actual purchases and compare to estimates</p>

                            {items.length === 0 ? (
                                <div className="empty-state">
                                    <ShoppingCart size={48} weight="light" />
                                    <h4>No items to track</h4>
                                    <p>Add materials to your BOQ to start tracking purchases</p>
                                </div>
                            ) : (
                                <div className="tracking-list">
                                    {items.map((item) => (
                                        <PurchaseTracker
                                            key={item.id}
                                            item={item}
                                            onUpdate={(itemId, updates) => handleItemUpdate(itemId, updates)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                        <DocumentsTab projectId={projectId} />
                    )}
                </div>
            </div>

            {/* Share Modal */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                projectName={project.name}
                projectId={projectId}
            />

            <style jsx>{`
                .project-detail {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xl);
                    max-width: 1000px;
                    margin: 0 auto;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    color: var(--color-text);
                    text-decoration: none;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    padding: 6px 12px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-full);
                    transition: color 0.2s;
                }
                .back-link:hover {
                    color: var(--color-primary);
                    border-color: rgba(78, 154, 247, 0.35);
                    background: var(--color-primary-bg);
                }

                .sub-nav {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                }

                .sub-nav a {
                    color: var(--color-text-secondary);
                    text-decoration: none;
                }

                .sub-nav a:hover {
                    color: var(--color-primary);
                }

                .sub-nav .current {
                    color: var(--color-text);
                    font-weight: 600;
                }

                .project-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: var(--spacing-lg);
                }

                .project-info h1 {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-sm) 0;
                }

                .project-info :global(.title-edit) {
                    font-size: inherit;
                    font-weight: inherit;
                }

                .project-meta {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                }

                .header-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex-shrink: 0;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-lg);
                }

                .savings-planner {
                    margin-top: var(--spacing-md);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .planner-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                    cursor: pointer;
                    transition: border-color 0.2s ease, background 0.2s ease;
                }

                .planner-toggle:hover {
                    border-color: var(--color-primary);
                    background: var(--color-background);
                }

                .planner-body {
                    border-radius: var(--radius-lg);
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin: 0;
                }

                .stat-value.spent { color: var(--color-accent); }

                .stat-label {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    margin: var(--spacing-xs) 0 0 0;
                }

                .mini-progress {
                    height: 6px;
                    background: var(--color-border-light);
                    border-radius: 3px;
                    margin: var(--spacing-sm) 0;
                    overflow: hidden;
                }

                .mini-progress-fill {
                    height: 100%;
                    background: var(--color-success);
                    border-radius: 3px;
                    transition: width 0.5s ease;
                }

                .under-budget {
                    color: var(--color-success);
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .over-budget { color: var(--color-error); }

                .view-toggle {
                    display: flex;
                    gap: var(--spacing-xs);
                    align-items: center;
                    background: var(--color-surface);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    overflow-x: auto;
                }

                .toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: var(--radius-full);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--color-text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .toggle-btn:hover:not(:disabled) {
                    color: var(--color-text);
                    background: var(--color-background);
                }

                .toggle-btn.active {
                    background: var(--color-primary-bg);
                    color: var(--color-primary);
                    border-color: rgba(78, 154, 247, 0.35);
                    box-shadow: 0 6px 16px rgba(78, 154, 247, 0.18);
                }

                .toggle-btn.not-applicable {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .tab-separator {
                    width: 1px;
                    background: var(--color-border-light);
                    margin: var(--spacing-xs) var(--spacing-sm);
                    align-self: stretch;
                }

                .tab-content {
                    min-height: 400px;
                }

                .setup-required {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl);
                    text-align: center;
                    color: var(--color-text-muted);
                    background: rgba(245, 158, 11, 0.05);
                    border: 1px dashed var(--color-warning);
                    border-radius: var(--radius-lg);
                }

                .setup-required h4 {
                    margin: var(--spacing-md) 0 var(--spacing-xs) 0;
                    color: var(--color-text);
                }

                .setup-required p {
                    margin: 0;
                    font-size: 0.875rem;
                }

                .setup-required code {
                    margin-top: var(--spacing-sm);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-surface);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                }

                .setup-required .hint {
                    margin-top: var(--spacing-sm);
                    font-size: 0.75rem;
                }

                .usage-tab {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .usage-gate {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-xl);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    text-align: center;
                }

                .usage-gate h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .usage-gate p {
                    margin: 0;
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                }

                .usage-actions {
                    display: flex;
                    justify-content: center;
                    gap: var(--spacing-sm);
                    margin-top: var(--spacing-sm);
                }

                .usage-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .usage-header h3 {
                    margin: 0 0 var(--spacing-xs) 0;
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .usage-header p {
                    margin: 0;
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .usage-sections {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .usage-stage h4 {
                    margin: 0 0 var(--spacing-sm) 0;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text);
                }

                .loading-state {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-xl);
                    background: var(--color-surface);
                    border: 1px solid var(--color-border-light);
                    border-radius: var(--radius-lg);
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                }

                :global(.spinner) {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .tracking-tab h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin: 0 0 var(--spacing-xs) 0;
                }

                .tracking-description {
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                    margin: 0 0 var(--spacing-lg) 0;
                }

                .tracking-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-2xl);
                    text-align: center;
                    color: var(--color-text-muted);
                    background: var(--color-background);
                    border-radius: var(--radius-lg);
                    border: 1px dashed var(--color-border);
                }

                .empty-state h4 {
                    margin: var(--spacing-md) 0 var(--spacing-xs) 0;
                    color: var(--color-text);
                }

                .empty-state p {
                    margin: 0;
                    font-size: 0.875rem;
                }

                @media (max-width: 768px) {
                    .project-header { flex-direction: column; }
                    .header-actions {
                        width: 100%;
                        flex-wrap: wrap;
                    }
                    .stats-grid { grid-template-columns: 1fr; }
                    .view-toggle {
                        flex-wrap: nowrap;
                        -webkit-overflow-scrolling: touch;
                    }
                    .toggle-btn {
                        flex-shrink: 0;
                        padding: var(--spacing-xs) var(--spacing-sm);
                        font-size: 0.75rem;
                    }
                }
            `}</style>
        </MainLayout>
    );
}

export default function ProjectDetail() {
    return (
        <ProtectedRoute>
            <ProjectDetailContent />
        </ProtectedRoute>
    );
}
