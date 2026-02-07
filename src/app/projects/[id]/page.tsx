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
import BudgetPlanner, { NotificationChannel } from '@/components/ui/BudgetPlanner';
import PhoneNumberModal from '@/components/ui/PhoneNumberModal';
import ProjectUsageView from '@/components/projects/ProjectUsageView';
import ProjectProcurementView from '@/components/projects/ProjectProcurementView';
import ProjectTrackingView from '@/components/projects/ProjectTrackingView';
import SidebarSpine, { ProjectView } from '@/components/projects/SidebarSpine';
import ProjectSettings from '@/components/projects/ProjectSettings';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
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
    CircleNotch,
    Warning,
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

    // View state
    const [activeView, setActiveView] = useState<ProjectView>('overview');
    const [activeTab, setActiveTab] = useState<BOQCategory>('substructure');

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        if (activeView !== 'tracking' && activeView !== 'boq' && activeView !== 'usage') return;
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
                                    <CardHeader><CardTitle>Actual Total</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className="text-3xl font-bold text-blue-600">
                                            <PriceDisplay priceUsd={purchaseStats.actualTotal} priceZwg={purchaseStats.actualTotal * exchangeRate} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">
                                            <span className={purchaseStats.totalVariance <= 0 ? 'text-green-600' : 'text-red-500'}>
                                                {purchaseStats.totalVariance <= 0 ? 'Under' : 'Over'} Budget
                                            </span> by <PriceDisplay priceUsd={Math.abs(purchaseStats.totalVariance)} priceZwg={Math.abs(purchaseStats.totalVariance) * exchangeRate} />
                                        </p>
                                    </div>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Total Variance</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className={`text-3xl font-bold ${purchaseStats.totalVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {purchaseStats.totalVariance >= 0 ? '+' : ''}
                                            <PriceDisplay priceUsd={Math.abs(purchaseStats.totalVariance)} priceZwg={Math.abs(purchaseStats.totalVariance) * exchangeRate} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {purchaseStats.totalVariancePercent >= 0 ? '+' : ''}
                                            {purchaseStats.totalVariancePercent.toFixed(1)}% vs estimate
                                        </p>
                                    </div>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Price Variance</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className={`text-3xl font-bold ${purchaseStats.priceVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {purchaseStats.priceVariance >= 0 ? '+' : ''}
                                            <PriceDisplay priceUsd={Math.abs(purchaseStats.priceVariance)} priceZwg={Math.abs(purchaseStats.priceVariance) * exchangeRate} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {purchaseStats.priceVariancePercent >= 0 ? '+' : ''}
                                            {purchaseStats.priceVariancePercent.toFixed(1)}% from unit price changes
                                        </p>
                                    </div>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Qty Variance</CardTitle></CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className={`text-3xl font-bold ${purchaseStats.qtyVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {purchaseStats.qtyVariance >= 0 ? '+' : ''}
                                            <PriceDisplay priceUsd={Math.abs(purchaseStats.qtyVariance)} priceZwg={Math.abs(purchaseStats.qtyVariance) * exchangeRate} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {purchaseStats.qtyVariancePercent >= 0 ? '+' : ''}
                                            {purchaseStats.qtyVariancePercent.toFixed(1)}% from quantity changes
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
                            {priceUpdates.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-amber-900">
                                                Material prices changed
                                            </h3>
                                            <p className="text-sm text-amber-700 mt-1">
                                                New average prices are available for {priceUpdates.length} items
                                                {priceUpdatePreview ? `: ${priceUpdatePreview}` : ''}.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleApplyPriceUpdates}
                                                loading={isPriceUpdateLoading}
                                            >
                                                Update average prices
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={handleIgnorePriceUpdates}
                                            >
                                                Keep current
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-amber-700">
                                        Prices shown are estimates/averages. For exact prices, confirm with suppliers.
                                    </p>
                                </div>
                            )}
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
                                    usageByItem={usageByItem}
                                    usageTrackingEnabled={project.usage_tracking_enabled}
                                />
                            )}
                        </div>
                    )}

                    {/* TRACKING View */}
                    {activeView === 'tracking' && (
                        <div className="space-y-6">
                            <ProjectTrackingView
                                projectId={projectId}
                                items={items}
                                onItemsRefresh={refreshItems}
                            />
                        </div>
                    )}

                    {/* USAGE View */}
                    {activeView === 'usage' && (
                        <div className="space-y-6">
                            {project.usage_tracking_enabled ? (
                                <ProjectUsageView
                                    project={project}
                                    items={items}
                                    usageByItem={usageByItem}
                                    onUsageRecorded={handleUsageRecorded}
                                    onRequestPhone={handleRequestPhone}
                                    canUseMobileReminders={Boolean(profile?.phone_number)}
                                />
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Enable usage tracking</h3>
                                    <p className="text-slate-500 mb-4">
                                        Turn on usage tracking to log materials used by builders.
                                    </p>
                                    <Button
                                        variant="primary"
                                        onClick={() => handleUsageTrackingToggle(true)}
                                    >
                                        Enable Usage Tracking
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PROCUREMENT View */}
                    {activeView === 'procurement' && (
                        <div className="space-y-6">
                            <ProjectProcurementView
                                project={project}
                                items={items}
                            />
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
                                canUseMobileReminders={Boolean(profile?.phone_number)}
                                defaultChannel={preferredReminderChannel}
                                onRequestPhone={handleRequestPhone}
                                reminderActive={Boolean(savingsReminder?.is_active)}
                                reminderFrequency={(savingsReminder?.frequency as 'daily' | 'weekly' | 'monthly' | null) ?? null}
                                onToggleReminder={handleToggleSavingsReminder}
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

            <PhoneNumberModal
                isOpen={showPhoneModal}
                onClose={() => {
                    setShowPhoneModal(false);
                    setPendingReminder(null);
                    setRequestedChannel(null);
                }}
                onSave={handleSavePhoneNumber}
                initialValue={profile?.phone_number || ''}
            />

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
