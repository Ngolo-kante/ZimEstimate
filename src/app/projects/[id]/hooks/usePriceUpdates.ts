'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import {
    getLatestWeeklyPrices,
    getLatestProjectNotification,
    createProjectNotification,
    updateProject,
    updateBOQItem,
} from '@/lib/services/projects';
import type { Project, BOQItem } from '@/lib/database.types';
import {
    applyPriceUpdatesToItems,
    estimateFromPrices,
    findPriceUpdates,
    latestPriceUpdateAt as newestPriceUpdateAt,
    parseAcknowledgedAt,
    priceUpdateAckKey as ackKeyFor,
    priceUpdatePreview as previewPriceUpdates,
    type PriceUpdate,
} from '@/lib/projects/priceUpdates';

/**
 * New average prices for the project's BOQ lines: checking for them, telling
 * the owner once a day, and applying or ignoring them.
 */
export function usePriceUpdates({
    projectId,
    project,
    setProject,
    items,
    setItems,
    profileId,
}: {
    projectId: string;
    project: Project | null;
    setProject: (update: (prev: Project | null) => Project | null) => void;
    items: BOQItem[];
    setItems: (items: BOQItem[]) => void;
    profileId: string | undefined;
}) {
    const { success, error: showError } = useToast();
    const { exchangeRate } = useCurrency();

    const [priceUpdates, setPriceUpdates] = useState<PriceUpdate[]>([]);
    const [isPriceUpdateLoading, setIsPriceUpdateLoading] = useState(false);
    const priceNotificationSentRef = useRef(false);

    const priceUpdateAckKey = useMemo(() => ackKeyFor(projectId), [projectId]);

    const priceUpdatePreview = useMemo(() => previewPriceUpdates(priceUpdates), [priceUpdates]);

    const latestPriceUpdateAt = useMemo(() => newestPriceUpdateAt(priceUpdates), [priceUpdates]);

    useEffect(() => {
        priceNotificationSentRef.current = false;
    }, [projectId]);

    const getAcknowledgedPriceUpdate = useCallback(() => {
        if (typeof window === 'undefined') return null;
        return parseAcknowledgedAt(localStorage.getItem(priceUpdateAckKey));
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
        const updates = findPriceUpdates(items, prices, acknowledgedAt);

        setPriceUpdates(updates);
        setIsPriceUpdateLoading(false);
    }, [getAcknowledgedPriceUpdate, items]);

    useEffect(() => {
        if (!project || items.length === 0) return;
        checkPriceUpdates();
    }, [project, items, checkPriceUpdates]);

    useEffect(() => {
        if (!project || priceUpdates.length === 0 || !profileId) return;
        if (priceNotificationSentRef.current) return;
        if (project.owner_id !== profileId) return;

        const notify = async () => {
            const { notification } = await getLatestProjectNotification(project.id, profileId, 'price_update');
            if (notification) {
                const last = new Date(notification.created_at);
                const today = new Date();
                if (last.toDateString() === today.toDateString()) {
                    return;
                }
            }

            await createProjectNotification({
                project_id: project.id,
                user_id: profileId,
                type: 'price_update',
                title: 'Material prices updated',
                message: `New average prices available for ${previewPriceUpdates(priceUpdates)}. Review and update your BOQ averages.`,
            });
        };

        notify();
        priceNotificationSentRef.current = true;
    }, [priceUpdates, project, profileId]);

    const handleApplyPriceUpdates = async () => {
        if (priceUpdates.length === 0) return;
        setIsPriceUpdateLoading(true);

        try {
            await Promise.all(
                priceUpdates.map((update) =>
                    updateBOQItem(update.itemId, {
                        unit_price_usd: update.newPriceUsd,
                        unit_price_zwg: update.newPriceUsd * exchangeRate,
                    })
                )
            );

            const nextItems = applyPriceUpdatesToItems(items, priceUpdates, exchangeRate);

            setItems(nextItems);

            const newTotal = estimateFromPrices(nextItems);

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

    return {
        priceUpdates,
        priceUpdatePreview,
        isPriceUpdateLoading,
        handleApplyPriceUpdates,
        handleIgnorePriceUpdates,
    };
}
