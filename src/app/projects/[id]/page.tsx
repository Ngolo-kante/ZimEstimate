'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import StageTab from '@/components/projects/StageTab';
import DocumentsTab from '@/components/projects/DocumentsTab';
import ShareModal from '@/components/projects/ShareModal';
import { RunningTotalBar } from '@/components/ui/RunningTotalBar';
import { StageProgressCards } from '@/components/projects/StageProgressCards';
import { CelebrationModal } from '@/components/ui/CelebrationModal';
import BudgetPlanner, { NotificationChannel } from '@/components/ui/BudgetPlanner';
import PhoneNumberModal from '@/components/ui/PhoneNumberModal';
import ProjectUsageView from '@/components/projects/ProjectUsageView';
import UnifiedProcurementView from '@/components/projects/UnifiedProcurementView';
import SidebarSpine, { ProjectView } from '@/components/projects/SidebarSpine';
import ProjectSettings from '@/components/projects/ProjectSettings';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useReveal } from '@/hooks/useReveal';
import {
    getProjectWithItems,
    getBOQItems,
    getLatestWeeklyPrices,
    getLatestProjectNotification,
    createProjectNotification,
    createReminder,
    updateProject,
    updateBOQItem,
    deleteBOQItem,
    getProjectRecurringReminder,
    upsertProjectRecurringReminder,
    updateProjectRecurringReminder,
} from '@/lib/services/projects';
import { materials, getBestPrice } from '@/lib/materials';
import {
    getProjectStages,
    getStageUsageData,
} from '@/lib/services/stages';
import {
    Project,
    BOQItem,
    ProjectStageWithTasks,
    BOQCategory,
    ProjectRecurringReminder,
} from '@/lib/database.types';
import {
    ShareNetwork,
    ArrowLeft,
    MapPin,
    DownloadSimple,
    Warning,
    List,
    Wallet,
    TrendUp,
    Info,
    CheckCircle,
    ChartLineUp,
    Tag,
    Stack,
} from '@phosphor-icons/react';
import { ProjectDetailSkeleton } from '@/components/ui/Skeleton';

function PriceDisplay({ priceUsd, priceZwg }: { priceUsd: number; priceZwg: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(priceUsd, priceZwg)}</>;
}

// Stage categories in order
const STAGE_CATEGORIES: BOQCategory[] = ['substructure', 'superstructure', 'roofing', 'finishing', 'exterior'];

const categoryLabels: Record<BOQCategory, string> = {
    substructure: 'Site Preparation & Foundation',
    superstructure: 'Structural Walls & Frame',
    roofing: 'Roofing',
    finishing: 'Interior & Finishing',
    exterior: 'External Work',
};

type PriceUpdate = {
    itemId: string;
    materialId: string;
    materialName: string;
    currentPriceUsd: number;
    newPriceUsd: number;
    deltaPercent: number;
    lastUpdated: string;
};

const SYSTEM_PRICE_VERSION = materials.reduce((latest, material) => {
    const bestPrice = getBestPrice(material.id);
    const lastUpdated = bestPrice?.lastUpdated || '';
    if (lastUpdated && lastUpdated > latest) {
        return lastUpdated;
    }
    return latest;
}, '');

function ProjectDetailContent() {
    const params = useParams();
    const { success, error: showError } = useToast();
    const { profile, updateProfile } = useAuth();
    const { exchangeRate, formatPrice } = useCurrency();
    const projectId = params.id as string;

    // Core state
    const [project, setProject] = useState<Project | null>(null);
    const [items, setItems] = useState<BOQItem[]>([]);
    const [stages, setStages] = useState<ProjectStageWithTasks[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [usageByStage, setUsageByStage] = useState<Record<string, { items: BOQItem[]; usageByItem: Record<string, number> }>>({});
    const [projectPriceVersion, setProjectPriceVersion] = useState<string>(SYSTEM_PRICE_VERSION);
    const [priceVersionReady, setPriceVersionReady] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [pendingReminder, setPendingReminder] = useState<{ frequency: 'daily' | 'weekly' | 'monthly'; amount: number; channel: NotificationChannel } | null>(null);
    const [preferredReminderChannel, setPreferredReminderChannel] = useState<NotificationChannel>('email');
    const [requestedChannel, setRequestedChannel] = useState<NotificationChannel | null>(null);
    const [savingsReminder, setSavingsReminder] = useState<ProjectRecurringReminder | null>(null);
    const [priceUpdates, setPriceUpdates] = useState<PriceUpdate[]>([]);
    const [isPriceUpdateLoading, setIsPriceUpdateLoading] = useState(false);
    const priceNotificationSentRef = useRef(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationData, setCelebrationData] = useState<{
        title: string;
        message: string;
        stats?: { label: string; value: string; highlight?: boolean }[];
    } | null>(null);

    // View state
    const [activeView, setActiveView] = useState<ProjectView>('overview');
    const [activeTab, setActiveTab] = useState<BOQCategory>('substructure');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isMobileDetail, setIsMobileDetail] = useState(false);

    useReveal({ deps: [isLoading, activeView, activeTab] });

    // Mobile detection for project detail
    useEffect(() => {
        const check = () => setIsMobileDetail(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const projectPriceKey = useMemo(
        () => `boq_price_version_${projectId}`,
        [projectId]
    );
    const priceUpdateAckKey = useMemo(
        () => `boq_price_update_ack_${projectId}`,
        [projectId]
    );

    // Purchase stats (calculated from items)
    const purchaseStats = useMemo(() => {
        const totalItems = items.length;
        const purchasedItems = items.filter(i => i.is_purchased).length;
        const totals = items.reduce(
            (acc, item) => {
                const estimatedQty = Number(item.quantity) || 0;
                const averagePrice = Number(item.unit_price_usd) || 0;
                const actualQty = Number(item.actual_quantity ?? item.quantity) || 0;
                const actualPrice = Number(item.actual_price_usd ?? item.unit_price_usd) || 0;

                const estimatedTotal = estimatedQty * averagePrice;
                const actualTotal = actualQty * actualPrice;
                const priceVariance = (actualPrice - averagePrice) * actualQty;
                const qtyVariance = (actualQty - estimatedQty) * averagePrice;

                return {
                    estimatedTotal: acc.estimatedTotal + estimatedTotal,
                    actualTotal: acc.actualTotal + actualTotal,
                    priceVariance: acc.priceVariance + priceVariance,
                    qtyVariance: acc.qtyVariance + qtyVariance,
                };
            },
            { estimatedTotal: 0, actualTotal: 0, priceVariance: 0, qtyVariance: 0 }
        );

        const actualSpent = items
            .filter(item => item.is_purchased)
            .reduce((sum, item) => {
                const qty = item.actual_quantity ?? item.quantity;
                const price = item.actual_price_usd ?? item.unit_price_usd;
                return sum + (Number(qty) * Number(price));
            }, 0);

        const totalVariance = totals.actualTotal - totals.estimatedTotal;
        const totalVariancePercent = totals.estimatedTotal > 0
            ? (totalVariance / totals.estimatedTotal) * 100
            : 0;
        const priceVariancePercent = totals.estimatedTotal > 0
            ? (totals.priceVariance / totals.estimatedTotal) * 100
            : 0;
        const qtyVariancePercent = totals.estimatedTotal > 0
            ? (totals.qtyVariance / totals.estimatedTotal) * 100
            : 0;

        return {
            totalItems,
            purchasedItems,
            estimatedTotal: totals.estimatedTotal,
            actualTotal: totals.actualTotal,
            actualSpent,
            totalVariance,
            totalVariancePercent,
            priceVariance: totals.priceVariance,
            priceVariancePercent,
            qtyVariance: totals.qtyVariance,
            qtyVariancePercent,
        };
    }, [items]);

    const priceUpdatePreview = useMemo(() => {
        if (priceUpdates.length === 0) return '';
        const names = priceUpdates.slice(0, 3).map((update) => update.materialName);
        const suffix = priceUpdates.length > 3 ? ` +${priceUpdates.length - 3} more` : '';
        return `${names.join(', ')}${suffix}`;
    }, [priceUpdates]);

    const latestPriceUpdateAt = useMemo(() => {
        if (priceUpdates.length === 0) return null;
        return priceUpdates.reduce((latest, update) => {
            const updateDate = new Date(update.lastUpdated);
            if (!latest) return updateDate;
            return updateDate > latest ? updateDate : latest;
        }, null as Date | null);
    }, [priceUpdates]);

    const activeStageItems = useMemo(() => {
        if (STAGE_CATEGORIES.includes(activeTab as BOQCategory)) {
            const category = activeTab as BOQCategory;
            return items.filter(i => i.category === category);
        }
        return items;
    }, [items, activeTab]);

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

            if (!stagesResult.error) {
                setStages(stagesResult.stages);
                // Set initial active tab to first applicable stage
                const firstApplicable = stagesResult.stages.find(s => s.is_applicable);
                if (firstApplicable) {
                    setActiveTab(firstApplicable.boq_category);
                }
            }

            setIsLoading(false);
        }

        loadProject();
    }, [projectId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setPriceVersionReady(false);
        const storedVersion = localStorage.getItem(projectPriceKey);
        const nextVersion = storedVersion || SYSTEM_PRICE_VERSION;
        localStorage.setItem(projectPriceKey, nextVersion);
        setProjectPriceVersion(nextVersion);
        setPriceVersionReady(true);
    }, [projectPriceKey]);

    useEffect(() => {
        if (!profile) return;
        if (!profile.phone_number && preferredReminderChannel !== 'email') {
            setPreferredReminderChannel('email');
        }
    }, [profile, preferredReminderChannel]);

    useEffect(() => {
        if (!priceVersionReady || typeof window === 'undefined') return;
        localStorage.setItem(projectPriceKey, projectPriceVersion);
    }, [projectPriceKey, projectPriceVersion, priceVersionReady]);

    useEffect(() => {
        if (!project || !profile?.id) return;
        const loadRecurringReminder = async () => {
            const { reminder } = await getProjectRecurringReminder(project.id, profile.id, 'savings');
            setSavingsReminder(reminder);
        };
        loadRecurringReminder();
    }, [project, profile?.id]);

    useEffect(() => {
        priceNotificationSentRef.current = false;
    }, [projectId]);

    const getAcknowledgedPriceUpdate = useCallback(() => {
        if (typeof window === 'undefined') return null;
        const stored = localStorage.getItem(priceUpdateAckKey);
        if (!stored) return null;
        const parsed = new Date(stored);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }, [priceUpdateAckKey]);

    const acknowledgePriceUpdates = (date: Date) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(priceUpdateAckKey, date.toISOString());
    };

    const checkPriceUpdates = useCallback(async () => {
        if (items.length === 0) return;

        setIsPriceUpdateLoading(true);
        const materialCodes = Array.from(new Set(items.map((item) => item.material_id).filter(Boolean)));
        const { prices, error: priceError } = await getLatestWeeklyPrices(materialCodes);
        if (priceError) {
            setIsPriceUpdateLoading(false);
            return;
        }

        const acknowledgedAt = getAcknowledgedPriceUpdate();
        const updates: PriceUpdate[] = [];

        items.forEach((item) => {
            const latest = prices[item.material_id];
            if (!latest) return;
            const latestDate = new Date(latest.lastUpdated);
            if (acknowledgedAt && latestDate <= acknowledgedAt) return;

            const currentPrice = Number(item.unit_price_usd) || 0;
            const nextPrice = Number(latest.priceUsd);
            if (Math.abs(nextPrice - currentPrice) < 0.01) return;

            const deltaPercent = currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;
            updates.push({
                itemId: item.id,
                materialId: item.material_id,
                materialName: item.material_name,
                currentPriceUsd: currentPrice,
                newPriceUsd: nextPrice,
                deltaPercent,
                lastUpdated: latest.lastUpdated,
            });
        });

        setPriceUpdates(updates);
        setIsPriceUpdateLoading(false);
    }, [getAcknowledgedPriceUpdate, items]);

    const loadUsageData = useCallback(async () => {
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
    }, [projectId, stages]);

    useEffect(() => {
        if (!project?.usage_tracking_enabled) return;
        if (activeView !== 'procurement' && activeView !== 'boq' && activeView !== 'usage') return;
        loadUsageData();
    }, [activeView, project?.usage_tracking_enabled, loadUsageData]);

    useEffect(() => {
        if (!project || items.length === 0) return;
        checkPriceUpdates();
    }, [project, items, checkPriceUpdates]);

    useEffect(() => {
        if (!project || priceUpdates.length === 0 || !profile?.id) return;
        if (priceNotificationSentRef.current) return;
        if (project.owner_id !== profile.id) return;

        const notify = async () => {
            const { notification } = await getLatestProjectNotification(project.id, profile.id, 'price_update');
            if (notification) {
                const last = new Date(notification.created_at);
                const today = new Date();
                if (last.toDateString() === today.toDateString()) {
                    return;
                }
            }

            const preview = priceUpdates.slice(0, 3).map((update) => update.materialName).join(', ');
            const suffix = priceUpdates.length > 3 ? ` +${priceUpdates.length - 3} more` : '';
            await createProjectNotification({
                project_id: project.id,
                user_id: profile.id,
                type: 'price_update',
                title: 'Material prices updated',
                message: `New average prices available for ${preview}${suffix}. Review and update your BOQ averages.`,
            });
        };

        notify();
        priceNotificationSentRef.current = true;
    }, [priceUpdates, project, profile?.id]);

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

    const handleApplyPriceUpdates = async () => {
        if (priceUpdates.length === 0) return;
        setIsPriceUpdateLoading(true);

        const updatesById = new Map<string, PriceUpdate>();
        priceUpdates.forEach((update) => updatesById.set(update.itemId, update));
        try {
            await Promise.all(
                priceUpdates.map((update) =>
                    updateBOQItem(update.itemId, {
                        unit_price_usd: update.newPriceUsd,
                        unit_price_zwg: update.newPriceUsd * exchangeRate,
                    })
                )
            );

            const nextItems = items.map((item) => {
                const update = updatesById.get(item.id);
                if (!update) return item;
                return {
                    ...item,
                    unit_price_usd: update.newPriceUsd,
                    unit_price_zwg: update.newPriceUsd * exchangeRate,
                };
            });

            setItems(nextItems);

            const newTotal = nextItems.reduce((sum, item) => {
                const qty = Number(item.quantity) || 0;
                const priceUsd = Number(item.unit_price_usd) || 0;
                return sum + qty * priceUsd;
            }, 0);

            await updateProject(projectId, {
                total_usd: newTotal,
                total_zwg: newTotal * exchangeRate,
            });
            setProject(prev => prev ? { ...prev, total_usd: newTotal, total_zwg: newTotal * exchangeRate } : prev);

            if (latestPriceUpdateAt) {
                acknowledgePriceUpdates(latestPriceUpdateAt);
            }
            setPriceUpdates([]);
            success('Average prices updated');
        } catch {
            showError('Failed to update prices');
        } finally {
            setIsPriceUpdateLoading(false);
        }
    };

    const handleIgnorePriceUpdates = () => {
        if (latestPriceUpdateAt) {
            acknowledgePriceUpdates(latestPriceUpdateAt);
        }
        setPriceUpdates([]);
    };

    const handleStageUpdate = (updatedStage: ProjectStageWithTasks) => {
        setStages(prev => prev.map(s => s.id === updatedStage.id ? updatedStage : s));
    };

    const handleSavingsTargetDateChange = async (date: string) => {
        await handleProjectUpdate({ target_purchase_date: date });
    };

    const getNextRunAt = (frequency: 'daily' | 'weekly' | 'monthly', baseDate = new Date()) => {
        const next = new Date(baseDate);
        if (frequency === 'daily') next.setDate(next.getDate() + 1);
        if (frequency === 'weekly') next.setDate(next.getDate() + 7);
        if (frequency === 'monthly') next.setDate(next.getDate() + 30);
        next.setHours(9, 0, 0, 0);
        return next;
    };

    const handleSavingsReminder = async (
        frequency: 'daily' | 'weekly' | 'monthly',
        amount: number,
        channel: NotificationChannel,
        phoneOverride?: string
    ) => {
        if (!profile?.id) {
            showError('Please sign in again to set reminders.');
            return;
        }
        if (project?.owner_id && profile?.id && project.owner_id !== profile.id) {
            showError('Only the project owner can schedule reminders.');
            return;
        }

        const isMobileChannel = channel === 'sms' || channel === 'whatsapp' || channel === 'telegram';
        const effectivePhone = phoneOverride || profile?.phone_number || '';
        if (isMobileChannel && !effectivePhone) {
            showError('Add a phone number to schedule mobile reminders.');
            return;
        }

        const firstRunAt = getNextRunAt(frequency);
        const nextRunAt = getNextRunAt(frequency, firstRunAt);
        const targetDate = project?.target_purchase_date || null;

        if (targetDate && firstRunAt.toISOString().split('T')[0] > targetDate) {
            showError('Target date is before the next reminder date. Update the target date first.');
            return;
        }

        const stageLabel = STAGE_CATEGORIES.includes(activeTab as BOQCategory)
            ? categoryLabels[activeTab as BOQCategory]
            : 'Project';

        // Prepend channel to message since DB doesn't have a channel column yet
        const message = `[${channel.toUpperCase()}] Savings reminder for ${project?.name || 'Project'} (${stageLabel}): save ${formatPrice(amount, amount * exchangeRate)} ${frequency}.`;

        const { reminder, error: recurringError } = await upsertProjectRecurringReminder({
            project_id: projectId,
            user_id: profile.id,
            reminder_type: 'savings',
            frequency,
            channel,
            amount_usd: amount,
            target_date: targetDate,
            next_run_at: nextRunAt.toISOString(),
            is_active: true,
        });

        if (recurringError) {
            showError(`Failed to save recurring reminder: ${recurringError.message}`);
            return;
        }

        setSavingsReminder(reminder);
        setPreferredReminderChannel(channel);

        const { error: reminderError } = await createReminder({
            project_id: projectId,
            reminder_type: 'savings',
            message,
            scheduled_date: firstRunAt.toISOString(),
            phone_number: effectivePhone || '0000000000', // Fallback for email-only if DB requires phone
        });

        if (reminderError) {
            showError(`Failed to schedule reminder: ${reminderError.message}`);
            return;
        }

        success(`Reminder scheduled via ${channel} for ${firstRunAt.toISOString().split('T')[0]}`);
    };

    const handleToggleSavingsReminder = async (active: boolean) => {
        if (!savingsReminder) return;
        const nextRunAt = active ? getNextRunAt(savingsReminder.frequency as 'daily' | 'weekly' | 'monthly') : savingsReminder.next_run_at;
        const { reminder, error } = await updateProjectRecurringReminder(savingsReminder.id, {
            is_active: active,
            next_run_at: active ? (nextRunAt instanceof Date ? nextRunAt.toISOString() : nextRunAt) : savingsReminder.next_run_at,
        });
        if (error) {
            showError('Failed to update reminder status');
            return;
        }
        setSavingsReminder(reminder);
        success(active ? 'Reminder enabled' : 'Reminder disabled');
    };

    const handleRequestPhone = (payload?: {
        channel?: NotificationChannel;
        pendingReminder?: { frequency: 'daily' | 'weekly' | 'monthly'; amount: number };
    }) => {
        setRequestedChannel(payload?.channel ?? null);
        if (payload?.pendingReminder) {
            setPendingReminder({
                frequency: payload.pendingReminder.frequency,
                amount: payload.pendingReminder.amount,
                channel: payload.channel ?? preferredReminderChannel,
            });
        }
        setShowPhoneModal(true);
    };

    const handleSavePhoneNumber = async (phoneNumber: string) => {
        const { error } = await updateProfile({ phone_number: phoneNumber });
        if (error) {
            showError('Failed to save phone number. Please try again.');
            return;
        }

        success('Phone number saved');
        setShowPhoneModal(false);

        if (requestedChannel) {
            setPreferredReminderChannel(requestedChannel);
        }

        if (pendingReminder) {
            const reminder = { ...pendingReminder, channel: requestedChannel ?? pendingReminder.channel };
            setPendingReminder(null);
            setRequestedChannel(null);
            await handleSavingsReminder(reminder.frequency, reminder.amount, reminder.channel, phoneNumber);
            return;
        }

        setRequestedChannel(null);
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

    const refreshItems = useCallback(async () => {
        const { items: refreshed, error } = await getBOQItems(projectId);
        if (!error) {
            setItems(refreshed);
        }
    }, [projectId]);

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
                        gap: var(--space-4);
                        text-align: center;
                        color: var(--color-text-muted);
                        background: var(--color-surface);
                        border-radius: var(--card-radius);
                        border: 1px solid var(--color-border);
                        margin: var(--space-8);
                    }
                    h2 { color: var(--color-text); margin: 0; font-family: var(--font-heading); }
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

    const handleUsageRecorded = () => {
        loadUsageData();
    };

    // Get current stage
    const currentStage = stages.find(s => s.boq_category === activeTab);
    const applicableStages = stages.filter(s => s.is_applicable);
    const hasLabor = project.labor_preference === 'with_labor';

    const statusColors: Record<string, 'success' | 'accent' | 'default'> = {
        active: 'success',
        draft: 'default',
        completed: 'accent',
        archived: 'default',
    };

    return (
        <MainLayout title={project.name} fullWidth>
            <div className="flex bg-background min-h-[calc(100vh-64px)]">
                <SidebarSpine
                    project={project}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    isMobileOpen={isMobileSidebarOpen}
                    onMobileClose={() => setIsMobileSidebarOpen(false)}
                />

                <main className="flex-1 overflow-y-auto h-[calc(100vh-64px)] p-6 md:p-8 bg-background">
                    {/* OVERVIEW View */}
                    {activeView === 'overview' && (
                        <div className="space-y-8 max-w-6xl mx-auto reveal" data-delay="1">
                            <div className="flex justify-between items-start">
                                <div>
                                    {/* Breadcrumbs */}
                                    <div className="flex items-center gap-2 text-sm text-secondary mb-2">
                                        <Link
                                            href="/projects"
                                            className="hover:text-accent transition-colors"
                                        >
                                            My Projects
                                        </Link>
                                        <span className="text-secondary">/</span>
                                        <span className="text-primary font-medium">{project.name}</span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-primary font-heading">{project.name}</h1>
                                    <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                                        <MapPin size={16} />
                                        {project.location || 'No location set'}
                                        <span className="mx-2">•</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${statusColors[project.status]}-soft text-${statusColors[project.status]}`}>
                                            {project.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setShowShareModal(true)}
                                        icon={<ShareNetwork size={16} />}
                                    >
                                        Share
                                    </Button>
                                    <Link href={`/boq/edit/${project.id}`}>
                                        <Button
                                            size="sm"
                                            icon={<PencilSimple size={16} />}
                                        >
                                            Edit Project
                                        </Button>
                                    </Link>
                                </div>
                            </div>

                            {/* Price Update Alert */}
                            {priceUpdates.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 reveal" data-delay="2">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-white p-2 rounded-lg text-blue-600 shadow-sm">
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
                                            onClick={handleIgnorePriceUpdates}
                                            className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                                        >
                                            Ignore
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleApplyPriceUpdates}
                                            isLoading={isPriceUpdateLoading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white border-none"
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
                                    usageByStage={usageByStage}
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                />
                            </section>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column - Budget & Planning */}
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Budget Planner */}
                                    <section className="bg-surface border border-border rounded-xl p-6 shadow-card reveal" data-delay="4">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                                                <Wallet size={24} weight="duotone" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-primary font-heading">Budget Planner</h3>
                                                <p className="text-sm text-secondary">Track savings towards your construction goals</p>
                                            </div>
                                        </div>

                                        <BudgetPlanner
                                            totalCost={project.total_usd || 0}
                                            targetDate={project.target_purchase_date || null}
                                            onTargetDateChange={handleSavingsTargetDateChange}
                                            setReminder={handleSavingsReminder}
                                            onRequestPhone={handleRequestPhone}
                                            hasPhone={!!profile?.phone_number}
                                            scheduledReminder={savingsReminder}
                                            onToggleReminder={handleToggleSavingsReminder}
                                            currency="USD"
                                        />
                                    </section>

                                    {/* Recent Activity / Next Steps */}
                                    <section className="bg-surface border border-border rounded-xl p-6 shadow-card reveal" data-delay="5">
                                        <h3 className="text-lg font-bold text-primary mb-4 font-heading">Next Steps</h3>
                                        <div className="space-y-4">
                                            {items.filter(i => !i.is_purchased).slice(0, 3).map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-mist rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                                                        <span className="font-medium text-primary">{item.material_name}</span>
                                                    </div>
                                                    <Button size="sm" variant="secondary" onClick={() => setActiveView('procurement')}>
                                                        Purchase
                                                    </Button>
                                                </div>
                                            ))}
                                            {items.filter(i => !i.is_purchased).length === 0 && (
                                                <div className="text-center py-8 text-secondary">
                                                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                                                    <p>All items purchased! Great job.</p>
                                                </div>
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
                                                <span className="text-sm text-secondary">Total Budget</span>
                                                <span className="font-bold text-primary">
                                                    {formatPrice(project.total_usd, project.total_zwg)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-border-light">
                                                <span className="text-sm text-secondary">Est. Materials</span>
                                                <span className="font-medium text-primary">{items.length} Items</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-border-light">
                                                <span className="text-sm text-secondary">Completion</span>
                                                <span className="font-medium text-primary">
                                                    {(purchaseStats.totalItems > 0
                                                        ? (purchaseStats.purchasedItems / purchaseStats.totalItems) * 100
                                                        : 0
                                                    ).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="pt-2">
                                                <RunningTotalBar
                                                    total={purchaseStats.estimatedTotal}
                                                    current={purchaseStats.actualSpent}
                                                    label="Spend vs Budget"
                                                    currency="USD"
                                                />
                                            </div>
                                        </div>
                                    </Card>

                                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 reveal" data-delay="7">
                                        <div className="p-4">
                                            <h4 className="font-bold text-blue-900 mb-2">Pro Tip</h4>
                                            <p className="text-sm text-blue-700">
                                                Use the <strong>Procurement Hub</strong> to request quotes from multiple suppliers and get the best deals.
                                            </p>
                                            <Button
                                                size="sm"
                                                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white w-full border-none"
                                                onClick={() => setActiveView('procurement')}
                                            >
                                                Go to Procurement
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BOQ View */}
                    {activeView === 'boq' && (
                        <div className="space-y-6 max-w-full mx-auto reveal">
                            <StageTab
                                stages={stages}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                items={activeStageItems}
                                onUpdateItem={handleItemUpdate}
                                onDeleteItem={handleDeleteItem}
                                onAddItem={handleAddItem}
                                projectId={projectId}
                                category={activeTab as BOQCategory}
                                laborRate={project.labor_rate || 0}
                                showLabor={hasLabor}
                            />
                        </div>
                    )}

                    {/* PROCUREMENT View */}
                    {activeView === 'procurement' && (
                        <div className="reveal">
                            <UnifiedProcurementView
                                project={project}
                                items={items}
                                onItemsRefresh={refreshItems}
                            />
                        </div>
                    )}

                    {/* USAGE View */}
                    {activeView === 'usage' && (
                        <div className="reveal">
                            <ProjectUsageView
                                project={project}
                                items={items}
                                usageByItem={usageByItem}
                                onUsageTrackingToggle={handleUsageTrackingToggle}
                                onUsageRecorded={handleUsageRecorded}
                                stages={stages}
                            />
                        </div>
                    )}

                    {/* DOCUMENTS View */}
                    {activeView === 'documents' && (
                        <div className="reveal">
                            <DocumentsTab
                                projectId={projectId}
                                userId={profile?.id || ''}
                            />
                        </div>
                    )}

                    {/* SETTINGS View */}
                    {activeView === 'settings' && (
                        <div className="reveal">
                            <ProjectSettings
                                project={project}
                                onUpdate={handleProjectUpdate}
                                onDelete={() => router.push('/projects')}
                                stages={stages}
                                onStageUpdate={handleStageUpdate}
                            />
                        </div>
                    )}
                </main>
            </div>

            {/* Modals */}
            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                project={project}
                stats={{
                    total: formatPrice(project.total_usd, project.total_zwg),
                    items: items.length
                }}
            />

            <PhoneNumberModal
                isOpen={showPhoneModal}
                onClose={() => setShowPhoneModal(false)}
                onSave={handleSavePhoneNumber}
                isSaving={false}
            />

            {showCelebration && celebrationData && (
                <CelebrationModal
                    isOpen={showCelebration}
                    onClose={() => setShowCelebration(false)}
                    title={celebrationData.title}
                    message={celebrationData.message}
                    stats={celebrationData.stats}
                />
            )}

            <style jsx global>{`
                :root {
                    --background: var(--color-background);
                    --surface: var(--color-surface);
                    --primary: var(--color-primary);
                    --secondary: var(--color-text-secondary);
                    --border: var(--color-border);
                }
                
                body {
                    background-color: var(--background);
                    color: var(--color-text);
                }
                
                .bg-background { background-color: var(--color-background); }
                .bg-surface { background-color: var(--color-surface); }
                .bg-mist { background-color: var(--color-mist); }
                
                .text-primary { color: var(--color-text); }
                .text-secondary { color: var(--color-text-secondary); }
                .text-accent { color: var(--color-accent); }
                
                .border-border { border-color: var(--color-border); }
                .border-border-light { border-color: var(--color-border-light); }
                
                .shadow-card { box-shadow: var(--shadow-card); }
                
                .font-heading { font-family: var(--font-heading); }
            `}</style>
        </MainLayout>
    );
}

export default function ProjectDetailPage() {
    return (
        <ProtectedRoute>
            <ProjectDetailContent />
        </ProtectedRoute>
    );
}
