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
import BudgetPlanner, { NotificationChannel } from '@/components/ui/BudgetPlanner';
import StageUsageSection from '@/components/projects/StageUsageSection';
import SidebarSpine, { ProjectView } from '@/components/projects/SidebarSpine';
import ProjectSettings from '@/components/projects/ProjectSettings';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import {
    getProjectWithItems,
    createReminder,
    deleteProject,
    updateProject,
    updateBOQItem,
    deleteBOQItem,
} from '@/lib/services/projects';
import { materials, getBestPrice } from '@/lib/materials';
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
    TrendDown,
    DownloadSimple,
    Clock,
    File,
    ShoppingCart,
    CircleNotch,
    Warning,
    CaretDown,
    CaretUp,
    WarningCircle,
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

const SYSTEM_PRICE_VERSION = materials.reduce((latest, material) => {
    const bestPrice = getBestPrice(material.id);
    const lastUpdated = bestPrice?.lastUpdated || '';
    if (lastUpdated && lastUpdated > latest) {
        return lastUpdated;
    }
    return latest;
}, '');

const normalizeMaterialPrice = (
    material: { category: string; unit: string },
    bestPrice: { priceUsd: number; priceZwg: number },
    itemUnit: string
) => {
    let priceUsd = bestPrice.priceUsd;
    let priceZwg = bestPrice.priceZwg;
    const itemUnitLower = itemUnit.toLowerCase();
    if (material.category === 'bricks' && material.unit.toLowerCase().includes('1000') && !itemUnitLower.includes('1000')) {
        priceUsd = priceUsd / 1000;
        priceZwg = priceZwg / 1000;
    }
    return { priceUsd, priceZwg };
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
    const [projectPriceVersion, setProjectPriceVersion] = useState<string>(SYSTEM_PRICE_VERSION);
    const [priceVersionReady, setPriceVersionReady] = useState(false);

    // View state
    const [activeView, setActiveView] = useState<ProjectView>('overview');
    const [activeTab, setActiveTab] = useState<BOQCategory>('substructure');
    const [stagesSetupRequired, setStagesSetupRequired] = useState(false);

    const projectPriceKey = useMemo(
        () => `boq_price_version_${projectId}`,
        [projectId]
    );

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

    const usageByItem = useMemo(() => {
        const allUsage: Record<string, number> = {};
        Object.values(usageByStage).forEach(stageData => {
            Object.entries(stageData.usageByItem).forEach(([itemId, usage]) => {
                allUsage[itemId] = (allUsage[itemId] || 0) + usage;
            });
        });
        return allUsage;
    }, [usageByStage]);

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

    useEffect(() => {
        if (typeof window === 'undefined') return;
        // eslint-disable-next-line
        setPriceVersionReady(false);
        const storedVersion = localStorage.getItem(projectPriceKey);
        const nextVersion = storedVersion || SYSTEM_PRICE_VERSION;
        localStorage.setItem(projectPriceKey, nextVersion);
        setProjectPriceVersion(nextVersion);
        setPriceVersionReady(true);
    }, [projectPriceKey]);

    useEffect(() => {
        if (!priceVersionReady || typeof window === 'undefined') return;
        localStorage.setItem(projectPriceKey, projectPriceVersion);
    }, [projectPriceKey, projectPriceVersion, priceVersionReady]);

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
        if (activeView !== 'tracking' || !project?.usage_tracking_enabled) return;
        // eslint-disable-next-line
        loadUsageData();
    }, [activeView, project?.usage_tracking_enabled, loadUsageData]);

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

    const handleUpdateAveragePrices = async () => {
        try {
            const updatedItems = new Map<string, BOQItem>();
            await Promise.all(items.map(async (item) => {
                const material = materials.find(m => m.id === item.material_id);
                if (!material) return;
                const bestPrice = getBestPrice(material.id);
                if (!bestPrice) return;
                const normalized = normalizeMaterialPrice(material, bestPrice, item.unit);
                if (!normalized) return;

                const shouldSyncActual = item.actual_price_usd === null
                    || Number(item.actual_price_usd) === Number(item.unit_price_usd);
                const nextActualPrice = shouldSyncActual ? normalized.priceUsd : item.actual_price_usd;

                const { item: updated, error } = await updateBOQItem(item.id, {
                    unit_price_usd: normalized.priceUsd,
                    unit_price_zwg: normalized.priceZwg,
                    actual_price_usd: nextActualPrice ?? undefined,
                });
                if (error) {
                    throw error;
                }
                const merged = updated || {
                    ...item,
                    unit_price_usd: normalized.priceUsd,
                    unit_price_zwg: normalized.priceZwg,
                    actual_price_usd: nextActualPrice ?? item.actual_price_usd,
                };
                updatedItems.set(item.id, merged);
            }));

            if (updatedItems.size > 0) {
                const nextItems = items.map(i => updatedItems.get(i.id) ?? i);
                setItems(nextItems);

                const newTotal = nextItems.reduce((sum, i) => {
                    const qty = Number(i.quantity) || 0;
                    const priceUsd = Number(i.unit_price_usd) || 0;
                    return sum + qty * priceUsd;
                }, 0);

                await updateProject(projectId, {
                    total_usd: newTotal,
                    total_zwg: newTotal * exchangeRate,
                });
                setProject(prev => prev ? { ...prev, total_usd: newTotal, total_zwg: newTotal * exchangeRate } : prev);
            }

            setProjectPriceVersion(SYSTEM_PRICE_VERSION);
            success('Average prices updated');
        } catch (err) {
            showError('Failed to update average prices');
        }
    };

    const handleKeepCurrentPrices = () => {
        setProjectPriceVersion(SYSTEM_PRICE_VERSION);
        success('Kept current prices');
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

    const handleSavingsReminder = async (frequency: 'daily' | 'weekly' | 'monthly', amount: number, channel: NotificationChannel) => {
        if ((channel === 'sms' || channel === 'whatsapp' || channel === 'telegram') && !profile?.phone_number) {
            showError('Add a phone number in Settings to schedule mobile reminders');
            return;
        }

        const offsetDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
        const scheduled = new Date();
        scheduled.setDate(scheduled.getDate() + offsetDays);
        const scheduledDate = scheduled.toISOString().split('T')[0];

        const stageLabel = STAGE_CATEGORIES.includes(activeTab as BOQCategory)
            ? categoryLabels[activeTab as BOQCategory]
            : 'Project';

        // Prepend channel to message since DB doesn't have a channel column yet
        const message = `[${channel.toUpperCase()}] Savings reminder for ${project?.name || 'Project'} (${stageLabel}): save ${formatPrice(amount, amount * exchangeRate)} ${frequency}.`;

        const { error: reminderError } = await createReminder({
            project_id: projectId,
            reminder_type: 'savings',
            message,
            scheduled_date: scheduledDate,
            phone_number: profile?.phone_number || '0000000000', // Fallback for email-only if DB requires phone
        });

        if (reminderError) {
            showError('Failed to schedule reminder');
            return;
        }

        success(`Reminder scheduled via ${channel} for ${scheduledDate}`);
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

    const handleDeleteItem = async (itemId: string) => {
        const { error } = await deleteBOQItem(itemId);
        if (error) { showError('Failed to delete item'); return; }
        setItems(items.filter(i => i.id !== itemId));
    };

    const handleAddItem = (item: BOQItem) => {
        setItems([...items, item]);
    };

    const handleBulkAdd = (newItems: BOQItem[]) => {
        setItems([...items, ...newItems]);
    };

    const handleUsageRecorded = () => {
        loadUsageData();
    };

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
    const showPriceUpdateBanner = priceVersionReady && projectPriceVersion !== SYSTEM_PRICE_VERSION;

    const statusColors: Record<string, 'success' | 'accent' | 'default'> = {
        active: 'success',
        draft: 'default',
        completed: 'accent',
        archived: 'default',
    };

    return (
        <MainLayout title={project.name} fullWidth>
            <div className="flex bg-slate-50 min-h-[calc(100vh-64px)]">
                <SidebarSpine
                    project={project}
                    activeView={activeView}
                    onViewChange={setActiveView}
                />

                <main className="flex-1 overflow-y-auto h-[calc(100vh-64px)] p-6 md:p-8">
                    {/* OVERVIEW View */}
                    {activeView === 'overview' && (
                        <div className="space-y-8 max-w-6xl mx-auto">
                            <div className="flex justify-between items-start">
                                <div>
                                    {/* Breadcrumbs */}
                                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                                        <Link
                                            href="/projects"
                                            className="hover:text-blue-600 transition-colors"
                                        >
                                            My Projects
                                        </Link>
                                        <span className="text-slate-400">/</span>
                                        <span className="text-slate-900 font-medium truncate max-w-[200px]">
                                            {project.name}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-slate-800 mb-2">{project.name}</h1>
                                    <div className="flex items-center gap-4 text-slate-500 text-sm">
                                        <span className="flex items-center gap-1"><MapPin size={16} /> {project.location || 'No Location'}</span>
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium capitalize ${statusColors[project.status] === 'success' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {project.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" onClick={() => setShowShareModal(true)} icon={<ShareNetwork size={18} />}>Share</Button>
                                    <Link href={`/projects/${projectId}/export`}>
                                        <Button variant="secondary" icon={<DownloadSimple size={18} />}>Export</Button>
                                    </Link>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card>
                                    <CardHeader><CardTitle>Total Budget</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className="text-3xl font-bold text-slate-800">
                                            <PriceDisplay priceUsd={purchaseStats.estimatedTotal} priceZwg={purchaseStats.estimatedTotal * exchangeRate} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">Estimated cost of materials</p>
                                    </div>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Amount Spent</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className="text-3xl font-bold text-blue-600">
                                            <PriceDisplay priceUsd={purchaseStats.actualSpent} priceZwg={purchaseStats.actualSpent * exchangeRate} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">
                                            <span className={purchaseStats.remainingBudget >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                {purchaseStats.remainingBudget >= 0 ? 'Under' : 'Over'} Budget
                                            </span> by <PriceDisplay priceUsd={Math.abs(purchaseStats.remainingBudget)} priceZwg={Math.abs(purchaseStats.remainingBudget) * exchangeRate} />
                                        </p>
                                    </div>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className="flex items-end gap-2 mb-2">
                                            <span className="text-3xl font-bold text-slate-800">
                                                {purchaseStats.totalItems > 0
                                                    ? Math.round((purchaseStats.purchasedItems / purchaseStats.totalItems) * 100)
                                                    : 0}%
                                            </span>
                                            <span className="text-slate-500 mb-1">completed</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${(purchaseStats.purchasedItems / purchaseStats.totalItems) * 100}%` }} />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* BOQ View */}
                    {activeView === 'boq' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold text-slate-800">Bill of Quantities</h2>
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
                                    {applicableStages.map(stage => (
                                        <button
                                            key={stage.id}
                                            onClick={() => setActiveTab(stage.boq_category)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === stage.boq_category
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {categoryLabels[stage.boq_category]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {currentStage && (
                                <StageTab
                                    stage={currentStage}
                                    projectId={projectId}
                                    items={activeStageItems}
                                    onStageUpdate={(u) => handleStageUpdate({ ...currentStage, ...u })}
                                    onItemUpdate={handleItemUpdate}
                                    onItemDelete={handleDeleteItem}
                                    onItemAdded={handleAddItem}
                                    showLabor={hasLabor}
                                />
                            )}
                        </div>
                    )}

                    {/* TRACKING View */}
                    {activeView === 'tracking' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Tracking & Timeline</h2>

                            {project.usage_tracking_enabled ? (
                                <StageUsageSection
                                    projectId={projectId}
                                    items={items}
                                    usageByItem={usageByItem}
                                    onUsageRecorded={handleUsageRecorded}
                                />
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-slate-500">Track your purchases against the BOQ items.</p>
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                                        {items.map(item => (
                                            <div key={item.id} className="p-4">
                                                <PurchaseTracker
                                                    key={item.id}
                                                    item={item}
                                                    onUpdate={handleItemUpdate}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DOCUMENTS View */}
                    {activeView === 'documents' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Documents</h2>
                            <DocumentsTab projectId={projectId} />
                        </div>
                    )}

                    {/* BUDGET View */}
                    {activeView === 'budget' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Budget Planner</h2>
                            <BudgetPlanner
                                totalBudgetUsd={purchaseStats.estimatedTotal}
                                amountSpentUsd={purchaseStats.actualSpent}
                                targetDate={project.target_purchase_date}
                                onTargetDateChange={handleSavingsTargetDateChange}
                                onSetReminder={handleSavingsReminder}
                            />
                        </div>
                    )}

                    {/* SETTINGS View */}
                    {activeView === 'settings' && (
                        <ProjectSettings
                            project={project}
                            onUpdate={handleProjectUpdate}
                        />
                    )}
                </main>
            </div>

            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                projectId={projectId}
                projectName={project.name}
            />

            <style jsx>{`
                :global(.spinner) {
                     animation: spin 1s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
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
