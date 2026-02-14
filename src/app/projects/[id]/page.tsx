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
import { supabase } from '@/lib/supabase';
import { clearCreatedProjectSnapshot, getCreatedProjectSnapshot } from '@/lib/projectCreationCache';
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
    Warning,
    List,
    Wallet,
    TrendUp,
    CheckCircle,
    PencilSimple,
} from '@phosphor-icons/react';
import { ProjectDetailSkeleton } from '@/components/ui/Skeleton';

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
    const projectRealtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stagesRealtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const applyStages = useCallback((nextStages: ProjectStageWithTasks[], forcePrimaryStage = false) => {
        setStages(nextStages);
        const firstApplicable = nextStages.find((stage) => stage.is_applicable);
        if (!firstApplicable) return;

        setActiveTab((currentTab) => {
            if (forcePrimaryStage) return firstApplicable.boq_category;
            const stillApplicable = nextStages.some(
                (stage) => stage.is_applicable && stage.boq_category === currentTab
            );
            return stillApplicable ? currentTab : firstApplicable.boq_category;
        });
    }, []);

    const refreshStages = useCallback(async (forcePrimaryStage = false) => {
        const stagesResult = await getProjectStages(projectId);
        if (!stagesResult.error) {
            applyStages(stagesResult.stages, forcePrimaryStage);
        }
    }, [applyStages, projectId]);

    const loadProjectData = useCallback(async (showLoading = true, forcePrimaryStage = false) => {
        if (showLoading) {
            setIsLoading(true);
            setError(null);
        }

        const [projectResult, stagesResult] = await Promise.all([
            getProjectWithItems(projectId),
            getProjectStages(projectId),
        ]);

        if (projectResult.error) {
            if (showLoading) setError(projectResult.error.message);
        } else if (projectResult.project) {
            setProject(projectResult.project);
            setItems(projectResult.items);
            clearCreatedProjectSnapshot(projectResult.project.id);
        } else if (showLoading) {
            setError('Project not found');
        }

        if (!stagesResult.error) {
            applyStages(stagesResult.stages, forcePrimaryStage);
        }

        if (showLoading) {
            setIsLoading(false);
        }
    }, [applyStages, projectId]);

    const hydrateFromCreatedSnapshot = useCallback(() => {
        const snapshot = getCreatedProjectSnapshot(projectId);
        if (!snapshot) return false;

        setProject(snapshot.project);
        setItems(snapshot.items);
        setError(null);
        setIsLoading(false);
        return true;
    }, [projectId]);

    // Load project data
    useEffect(() => {
        const hydrated = hydrateFromCreatedSnapshot();
        loadProjectData(!hydrated, true);
    }, [hydrateFromCreatedSnapshot, loadProjectData]);

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

    // Realtime sync for project detail data
    useEffect(() => {
        const shouldRefreshUsage =
            project?.usage_tracking_enabled &&
            (activeView === 'procurement' || activeView === 'boq' || activeView === 'usage');

        const scheduleProjectRefresh = () => {
            if (projectRealtimeTimeoutRef.current) {
                clearTimeout(projectRealtimeTimeoutRef.current);
            }
            projectRealtimeTimeoutRef.current = setTimeout(() => {
                void loadProjectData(false, false);
                if (shouldRefreshUsage) {
                    void loadUsageData();
                }
            }, 250);
        };

        const scheduleStageRefresh = () => {
            if (stagesRealtimeTimeoutRef.current) {
                clearTimeout(stagesRealtimeTimeoutRef.current);
            }
            stagesRealtimeTimeoutRef.current = setTimeout(() => {
                void refreshStages(false);
                if (shouldRefreshUsage) {
                    void loadUsageData();
                }
            }, 250);
        };

        const channel = supabase
            .channel(`project-detail-${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'projects',
                    filter: `id=eq.${projectId}`,
                },
                () => {
                    scheduleProjectRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'boq_items',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleProjectRefresh();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_stages',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    scheduleStageRefresh();
                }
            )
            .subscribe();

        return () => {
            if (projectRealtimeTimeoutRef.current) {
                clearTimeout(projectRealtimeTimeoutRef.current);
                projectRealtimeTimeoutRef.current = null;
            }
            if (stagesRealtimeTimeoutRef.current) {
                clearTimeout(stagesRealtimeTimeoutRef.current);
                stagesRealtimeTimeoutRef.current = null;
            }
            void supabase.removeChannel(channel);
        };
    }, [activeView, loadProjectData, loadUsageData, project?.usage_tracking_enabled, projectId, refreshStages]);

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
    const hasLabor = project.labor_preference === 'with_labor';

    const statusBadgeStyles: Record<string, { background: string; color: string }> = {
        active: { background: 'rgba(22, 163, 74, 0.12)', color: 'var(--color-emerald)' },
        draft: { background: 'var(--color-mist)', color: 'var(--color-text-secondary)' },
        completed: { background: 'rgba(46, 108, 246, 0.12)', color: 'var(--color-accent)' },
        archived: { background: 'var(--color-mist)', color: 'var(--color-text-muted)' },
    };
    const completionRate = purchaseStats.totalItems > 0
        ? Math.round((purchaseStats.purchasedItems / purchaseStats.totalItems) * 100)
        : 0;
    const pendingItemsCount = Math.max(items.length - purchaseStats.purchasedItems, 0);
    const viewDetails: Record<Exclude<ProjectView, 'overview'>, { title: string; description: string }> = {
        budget: {
            title: 'Planner',
            description: 'Shape your savings pace and stay aligned to your target purchase date.',
        },
        boq: {
            title: 'Bill of Quantities',
            description: 'Manage stage timelines, tasks, and material line items in one place.',
        },
        procurement: {
            title: 'Procurement Hub',
            description: 'Track purchases, RFQs, and suppliers with real-time cost visibility.',
        },
        usage: {
            title: 'Usage Tracking',
            description: 'Log site consumption and monitor burn-down before materials run low.',
        },
        documents: {
            title: 'Documents',
            description: 'Store plans, permits, receipts, and site records for your team.',
        },
        settings: {
            title: 'Configurations',
            description: 'Adjust project scope, visibility, and low-stock alert settings.',
        },
    };
    const activeViewDetails = activeView === 'overview' ? null : viewDetails[activeView];

    return (
        <MainLayout title={project.name} fullWidth>
            <div className="project-shell project-dashboard-shell">
                <SidebarSpine
                    project={project}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    isMobileOpen={isMobileSidebarOpen}
                    onMobileClose={() => setIsMobileSidebarOpen(false)}
                />

                <main className="project-main">
                    {activeViewDetails && (
                        <section className="view-header reveal">
                            <div>
                                <p className="view-eyebrow">{project.name}</p>
                                <h1 className="view-title">{activeViewDetails.title}</h1>
                                <p className="view-description">{activeViewDetails.description}</p>
                            </div>
                            <div className="view-stats">
                                <div className="view-stat">
                                    <span>Materials</span>
                                    <strong>{items.length}</strong>
                                </div>
                                <div className="view-stat">
                                    <span>Pending</span>
                                    <strong>{pendingItemsCount}</strong>
                                </div>
                                <div className="view-stat">
                                    <span>Completion</span>
                                    <strong>{completionRate}%</strong>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* OVERVIEW View */}
                    {activeView === 'overview' && (
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
                                    <h1 className="text-3xl font-bold text-primary font-heading">{project.name}</h1>
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
                                            onClick={handleIgnorePriceUpdates}
                                            className="bg-white text-blue-700 border-blue-200"
                                        >
                                            Ignore
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleApplyPriceUpdates}
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
                            </section>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column - Budget & Planning */}
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Budget Planner */}
                                    <section className="overview-card reveal" data-delay="4">
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
                                    </section>

                                    {/* Recent Activity / Next Steps */}
                                    <section className="overview-card reveal" data-delay="5">
                                        <h3 className="text-lg font-bold text-primary mb-4 font-heading">Next Steps</h3>
                                        <div className="space-y-4">
                                            {items.filter(i => !i.is_purchased).slice(0, 3).map(item => (
                                                <div key={item.id} className="next-step-item">
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

                                    <Card className="pro-tip-card reveal" data-delay="7">
                                        <div className="p-4">
                                            <h4 className="font-bold text-blue-900 mb-2">Pro Tip</h4>
                                            <p className="text-sm text-blue-700">
                                                Use the <strong>Procurement Hub</strong> to request quotes from multiple suppliers and get the best deals.
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
                    )}

                    {/* BOQ View */}
                    {activeView === 'boq' && (
                        <div className="view-panel space-y-6 max-w-full mx-auto reveal">
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

                    {/* PROCUREMENT View */}
                    {activeView === 'procurement' && (
                        <div className="view-panel reveal">
                            <UnifiedProcurementView
                                project={project}
                                items={items}
                                onItemsRefresh={refreshItems}
                            />
                        </div>
                    )}

                    {/* USAGE View */}
                    {activeView === 'usage' && (
                        <div className="view-panel space-y-6 reveal">
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
                                <div className="bg-surface border border-border rounded-xl p-6 shadow-card">
                                    <h3 className="text-lg font-semibold text-primary mb-2">Enable usage tracking</h3>
                                    <p className="text-secondary mb-4">
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

                    {/* DOCUMENTS View */}
                    {activeView === 'documents' && (
                        <div className="view-panel space-y-6 reveal">
                            <DocumentsTab projectId={projectId} />
                        </div>
                    )}

                    {/* BUDGET View */}
                    {activeView === 'budget' && (
                        <div className="view-panel space-y-6 reveal">
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
                        <div className="view-panel reveal">
                            <ProjectSettings
                                project={project}
                                onUpdate={handleProjectUpdate}
                            />
                        </div>
                    )}
                </main>
            </div>

            {/* Mobile hamburger FAB */}
            {isMobileDetail && (
                <button
                    className="mobile-sidebar-fab"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    aria-label="Open navigation"
                >
                    <List size={24} weight="bold" />
                </button>
            )}

            {/* Modals */}
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

            <CelebrationModal
                isOpen={showCelebration}
                onClose={() => {
                    setShowCelebration(false);
                    setCelebrationData(null);
                }}
                title={celebrationData?.title || ''}
                message={celebrationData?.message || ''}
                stats={celebrationData?.stats}
                variant="stage-complete"
                actionLabel="Continue Building"
                onAction={() => {
                    setShowCelebration(false);
                    setCelebrationData(null);
                    setActiveView('boq');
                }}
            />

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

                .project-dashboard-shell {
                    --dashboard-ease: cubic-bezier(0.22, 1, 0.36, 1);
                    --dashboard-fast: 180ms;
                    --dashboard-medium: 280ms;
                }

                .project-dashboard-shell h1,
                .project-dashboard-shell h2,
                .project-dashboard-shell h3,
                .project-dashboard-shell h4 {
                    letter-spacing: -0.015em;
                    line-height: 1.18;
                }

                .project-dashboard-shell p {
                    line-height: 1.55;
                }

                .project-dashboard-shell button,
                .project-dashboard-shell a,
                .project-dashboard-shell input,
                .project-dashboard-shell select,
                .project-dashboard-shell textarea {
                    transition:
                        transform var(--dashboard-fast) var(--dashboard-ease),
                        box-shadow var(--dashboard-fast) var(--dashboard-ease),
                        border-color var(--dashboard-fast) var(--dashboard-ease),
                        background-color var(--dashboard-fast) var(--dashboard-ease),
                        color var(--dashboard-fast) var(--dashboard-ease),
                        opacity var(--dashboard-fast) var(--dashboard-ease);
                }

                .project-dashboard-shell button:focus-visible,
                .project-dashboard-shell a:focus-visible,
                .project-dashboard-shell input:focus-visible,
                .project-dashboard-shell select:focus-visible,
                .project-dashboard-shell textarea:focus-visible {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(78, 154, 247, 0.24);
                }
            `}</style>
            <style jsx>{`
                .project-shell {
                    display: flex;
                    background:
                        radial-gradient(1200px 480px at 80% -140px, rgba(78, 154, 247, 0.18), transparent 62%),
                        radial-gradient(900px 400px at -10% -120px, rgba(6, 20, 47, 0.07), transparent 55%),
                        var(--color-background);
                    min-height: calc(100vh - 64px);
                }

                .project-main {
                    flex: 1;
                    overflow-y: auto;
                    height: calc(100vh - 64px);
                    padding: 24px 28px 48px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .view-header {
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                    background: rgba(255, 255, 255, 0.76);
                    border: 1px solid rgba(211, 211, 215, 0.8);
                    border-radius: 24px;
                    padding: 20px 24px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 20px;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    box-shadow: 0 16px 30px rgba(6, 20, 47, 0.05);
                    transition:
                        transform var(--dashboard-medium) var(--dashboard-ease),
                        box-shadow var(--dashboard-medium) var(--dashboard-ease);
                }

                .view-eyebrow {
                    margin: 0 0 6px 0;
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--color-text-secondary);
                    font-weight: 700;
                }

                .view-title {
                    margin: 0;
                    font-size: clamp(1.5rem, 2vw, 2rem);
                    line-height: 1.1;
                    color: var(--color-text);
                    letter-spacing: -0.02em;
                }

                .view-description {
                    margin: 10px 0 0 0;
                    color: #5f6b7e;
                    max-width: 680px;
                }

                .view-stats {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                .view-stat {
                    min-width: 108px;
                    background: #f3f8ff;
                    border: 1px solid #d6e8ff;
                    border-radius: 14px;
                    padding: 10px 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    text-align: right;
                }

                .view-stat span {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #53739a;
                    font-weight: 700;
                }

                .view-stat strong {
                    font-size: 1rem;
                    color: #16385d;
                }

                .view-panel {
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                    padding: 2px 2px 4px;
                    border-radius: 26px;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.4));
                    border: 1px solid rgba(211, 211, 215, 0.55);
                    box-shadow: 0 14px 28px rgba(6, 20, 47, 0.03);
                    transition:
                        transform var(--dashboard-medium) var(--dashboard-ease),
                        box-shadow var(--dashboard-medium) var(--dashboard-ease);
                }

                .overview-view {
                    padding: 8px 2px;
                }

                .overview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 18px;
                    flex-wrap: wrap;
                }

                .overview-breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                    font-size: 0.88rem;
                    color: var(--color-text-secondary);
                }

                .overview-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .price-update-alert {
                    background: linear-gradient(135deg, #eaf3ff, #f3f8ff);
                    border: 1px solid #cfe2fb;
                    border-radius: 16px;
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    justify-content: space-between;
                    transition:
                        transform var(--dashboard-medium) var(--dashboard-ease),
                        box-shadow var(--dashboard-medium) var(--dashboard-ease);
                }

                .price-update-icon {
                    background: rgba(255, 255, 255, 0.95);
                    border: 1px solid rgba(159, 200, 248, 0.7);
                    padding: 8px;
                    border-radius: 10px;
                    color: #2e6cf6;
                    box-shadow: 0 3px 10px rgba(46, 108, 246, 0.12);
                }

                .overview-card {
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(211, 211, 215, 0.7);
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 8px 20px rgba(6, 20, 47, 0.03);
                    transition:
                        transform var(--dashboard-medium) var(--dashboard-ease),
                        box-shadow var(--dashboard-medium) var(--dashboard-ease),
                        border-color var(--dashboard-medium) var(--dashboard-ease);
                }

                .next-step-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px 14px;
                    background: #f7faff;
                    border: 1px solid #dceafb;
                    border-radius: 12px;
                    transition:
                        transform var(--dashboard-fast) var(--dashboard-ease),
                        border-color var(--dashboard-fast) var(--dashboard-ease),
                        box-shadow var(--dashboard-fast) var(--dashboard-ease);
                }

                .pro-tip-card {
                    background: linear-gradient(145deg, #eef6ff, #f8fbff) !important;
                    border: 1px solid #d1e6ff !important;
                    transition:
                        transform var(--dashboard-medium) var(--dashboard-ease),
                        box-shadow var(--dashboard-medium) var(--dashboard-ease),
                        border-color var(--dashboard-medium) var(--dashboard-ease);
                }

                .view-header:hover,
                .view-panel:hover,
                .overview-card:hover,
                .price-update-alert:hover,
                .pro-tip-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 20px 30px rgba(6, 20, 47, 0.08);
                }

                .next-step-item:hover {
                    transform: translateY(-1px);
                    border-color: #b7d7f7;
                    box-shadow: 0 10px 18px rgba(17, 56, 95, 0.08);
                }

                .mobile-sidebar-fab {
                    display: none;
                }

                @media (max-width: 1024px) {
                    .project-main {
                        padding: 18px 16px 40px;
                        gap: 16px;
                    }
                }

                @media (max-width: 768px) {
                    .project-main {
                        padding: 14px 12px 34px;
                        gap: 14px;
                    }

                    .view-header {
                        padding: 16px;
                        border-radius: 18px;
                        align-items: flex-start;
                    }

                    .view-stats {
                        width: 100%;
                        justify-content: flex-start;
                    }

                    .view-panel {
                        border-radius: 18px;
                    }

                    .next-step-item {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .mobile-sidebar-fab {
                        display: flex;
                        position: fixed;
                        bottom: 24px;
                        left: 16px;
                        z-index: 100;
                        width: 56px;
                        height: 56px;
                        border-radius: 50%;
                        background: var(--color-accent);
                        color: white;
                        border: none;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 14px rgba(46, 108, 246, 0.4);
                        cursor: pointer;
                    }

                    .mobile-sidebar-fab:active {
                        transform: scale(0.95);
                    }
                }

                @media (max-width: 640px) {
                    .view-title {
                        font-size: 1.38rem;
                    }

                    .view-description {
                        font-size: 0.9rem;
                    }

                    .overview-breadcrumb {
                        font-size: 0.8rem;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .view-header,
                    .view-panel,
                    .overview-card,
                    .price-update-alert,
                    .next-step-item,
                    .pro-tip-card {
                        transition: none;
                        transform: none !important;
                    }
                }
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
