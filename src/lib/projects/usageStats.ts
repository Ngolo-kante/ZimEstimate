// ─── Material usage sums ─────────────────────────────────────────────────────
// What the usage tracking view works out from BOQ lines and logged usage,
// moved out of ProjectUsageView unchanged so it can be tested on its own.

import { boqStage, materialsBeforeLabor } from '@/lib/boqPresentation';
import { isLaborCategory } from '@/lib/calculations/laborSubstages';
import type { BOQItem, MaterialUsage } from '@/lib/database.types';

export type UsageViewMode = 'daily' | 'weekly';

/** Date-only values are calendar days, not instants in the device's time zone. */
export const formatUsageDate = (date: string, options: Intl.DateTimeFormatOptions = {}) =>
    new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });

export function localToday(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type MaterialOptionGroup = { key: string; label: string; options: { id: string; label: string }[] };

/**
 * Options for "which material was used", grouped by stage and labelled with
 * quantity and what is left. A name used twice in a stage gets its note added
 * so the two can be told apart.
 */
export function materialOptionGroups(items: BOQItem[], usageByItem: Record<string, number>): MaterialOptionGroup[] {
    const STAGE_ORDER = ['substructure', 'superstructure', 'roofing', 'finishing', 'services', 'exterior', 'labor'];
    const STAGE_NAMES: Record<string, string> = {
        substructure: 'Foundations', superstructure: 'Walls & frame', roofing: 'Roofing',
        finishing: 'Finishes', services: 'Plumbing & electrical', exterior: 'Outside works', labor: 'Other labour',
    };
    const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const unitOf = (unit: string) => unit.replace(/^per\s+/i, '').replace(/^each$/i, '').trim();
    const groups = new Map<string, typeof items>();
    for (const item of items) {
        const key = boqStage(item.category);
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()]
        .sort(([a], [b]) => (STAGE_ORDER.indexOf(a) + 1 || 99) - (STAGE_ORDER.indexOf(b) + 1 || 99))
        .map(([key, stageItems]) => {
            const nameCount = new Map<string, number>();
            stageItems.forEach((i) => nameCount.set(i.material_name, (nameCount.get(i.material_name) ?? 0) + 1));
            return {
                key,
                label: STAGE_NAMES[key] ?? key.replace(/_/g, ' '),
                options: materialsBeforeLabor(stageItems).map((item) => {
                    const total = Number(item.actual_quantity ?? item.quantity ?? 0);
                    const left = Math.max(0, total - (usageByItem[item.id] || 0));
                    const unit = unitOf(item.unit);
                    const purpose = nameCount.get(item.material_name)! > 1 && item.notes ? ` (${item.notes.replace(/\[Enablement Cost\]\s*/g, '').trim()})` : '';
                    return {
                        id: item.id,
                        label: `${isLaborCategory(item.category) ? 'Labour · ' : ''}${item.material_name}${purpose} · ${fmt(total)}${unit ? ` ${unit}` : ''} · ${fmt(left)} left`,
                    };
                }),
            };
        });
}

/**
 * Usage grouped by day, or by the Monday that starts its week. Keys are
 * yyyy-mm-dd read in UTC, as the view always has.
 */
export function groupUsageByPeriod(usageHistory: MaterialUsage[], viewMode: UsageViewMode): Record<string, MaterialUsage[]> {
    const grouped: Record<string, MaterialUsage[]> = {};
    usageHistory.forEach((usage) => {
        const date = new Date(`${usage.usage_date.slice(0, 10)}T00:00:00Z`);
        let key = date.toISOString().split('T')[0];
        if (viewMode === 'weekly') {
            const weekStart = new Date(date);
            const day = weekStart.getUTCDay();
            const diff = (day === 0 ? -6 : 1) - day;
            weekStart.setUTCDate(weekStart.getUTCDate() + diff);
            key = weekStart.toISOString().split('T')[0];
        }
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(usage);
    });
    return grouped;
}

/** Value of what has been used, at the lines' average prices. */
export const usedValue = (items: BOQItem[], usageByItem: Record<string, number>): number =>
    items.reduce((sum, item) => {
        const used = usageByItem[item.id] || 0;
        return sum + used * Number(item.unit_price_usd);
    }, 0);

/** Value of what is left (bought or estimated, less used); can go below zero. */
export const remainingValue = (items: BOQItem[], usageByItem: Record<string, number>): number =>
    items.reduce((sum, item) => {
        const purchased = Number(item.actual_quantity ?? item.quantity);
        const used = usageByItem[item.id] || 0;
        return sum + (purchased - used) * Number(item.unit_price_usd);
    }, 0);

export type MaterialUsageStat = {
    item: BOQItem;
    availableQty: number;
    usedQty: number;
    remainingQty: number;
    usagePercent: number;
};

export function materialUsageStats(items: BOQItem[], usageByItem: Record<string, number>): MaterialUsageStat[] {
    return items.map((item) => {
        const availableQty = Number(item.actual_quantity ?? item.quantity) || 0;
        const usedQty = usageByItem[item.id] || 0;
        const remainingQty = Math.max(availableQty - usedQty, 0);
        const usagePercent = availableQty > 0 ? (usedQty / availableQty) * 100 : 0;
        return {
            item,
            availableQty,
            usedQty,
            remainingQty,
            usagePercent,
        };
    });
}

export type UsageSummary = {
    totalAvailable: number;
    totalUsed: number;
    totalRemaining: number;
    overallPercent: number;
    lowStockCount: number;
};

/** Totals across materials; low stock is at or under the threshold percent left. */
export function summariseUsage(usageStats: MaterialUsageStat[], usageThreshold: number): UsageSummary {
    const totalAvailable = usageStats.reduce((sum, s) => sum + s.availableQty, 0);
    const totalUsed = usageStats.reduce((sum, s) => sum + s.usedQty, 0);
    const totalRemaining = Math.max(totalAvailable - totalUsed, 0);
    const overallPercent = totalAvailable > 0 ? (totalUsed / totalAvailable) * 100 : 0;
    const lowStockCount = usageStats.filter((s) => {
        if (s.availableQty <= 0) return false;
        const remainingPercent = (s.remainingQty / s.availableQty) * 100;
        return remainingPercent <= usageThreshold;
    }).length;
    return {
        totalAvailable,
        totalUsed,
        totalRemaining,
        overallPercent,
        lowStockCount,
    };
}

const newestFirst = (a: MaterialUsage, b: MaterialUsage) =>
    new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime();

/** Each BOQ line's usage records, newest first. */
export function usageByMaterial(usageHistory: MaterialUsage[]): Record<string, MaterialUsage[]> {
    const grouped: Record<string, MaterialUsage[]> = {};
    usageHistory.forEach((usage) => {
        const itemId = usage.boq_item_id;
        if (!grouped[itemId]) grouped[itemId] = [];
        grouped[itemId].push(usage);
    });
    Object.keys(grouped).forEach(key => {
        grouped[key].sort(newestFirst);
    });
    return grouped;
}

/** All usage, newest first, grouped under a "Tue, 10 Nov 2026" heading. */
export function ledgerByDate(usageHistory: MaterialUsage[]): Record<string, MaterialUsage[]> {
    const grouped: Record<string, MaterialUsage[]> = {};
    [...usageHistory].sort(newestFirst).forEach((usage) => {
        const dateKey = formatUsageDate(usage.usage_date, {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(usage);
    });
    return grouped;
}
