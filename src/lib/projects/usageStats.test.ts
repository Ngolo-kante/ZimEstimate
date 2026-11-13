import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MaterialUsage } from '@/lib/database.types';
import {
    groupUsageByPeriod,
    formatUsageDate,
    localToday,
    ledgerByDate,
    materialOptionGroups,
    materialUsageStats,
    remainingValue,
    summariseUsage,
    usageByMaterial,
    usedValue,
} from './usageStats';
import { boqItem } from './testItems';

// Date-only usage values stay on their recorded day in every device time zone.
const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Africa/Harare'; });
afterAll(() => { process.env.TZ = originalTz; });

const usage = (overrides: Partial<MaterialUsage>): MaterialUsage => ({
    id: Math.random().toString(36).slice(2), project_id: 'p1', boq_item_id: 'a', recorded_by: 'u1',
    quantity_used: 1, usage_date: '2026-11-10', notes: null, created_at: '2026-11-10T10:00:00.000Z', ...overrides,
});

describe('material picker options', () => {
    it('groups by stage in building order, with quantity and what is left', () => {
        const groups = materialOptionGroups([
            boqItem({ id: 'r', category: 'roofing', material_name: 'Roof tile', quantity: 2400, unit: 'each' }),
            boqItem({ id: 'c', category: 'substructure', material_name: 'Cement', quantity: 120, unit: 'per 50kg bag' }),
        ], { c: 20.5 });
        expect(groups.map((g) => g.label)).toEqual(['Foundations', 'Roofing']);
        expect(groups[0].options[0].label).toMatch(/^Cement · 120 50kg bag · 99[.,]5 left$/);
        expect(groups[1].options[0].label).toMatch(/^Roof tile · 2[,.]?400 · 2[,.]?400 left$/);
    });

    it('adds the note when a name repeats within a stage, and marks labour', () => {
        const groups = materialOptionGroups([
            boqItem({ id: 'a', category: 'substructure', material_name: 'Cement', notes: '[Enablement Cost] Access road' }),
            boqItem({ id: 'b', category: 'substructure', material_name: 'Cement', notes: 'Footings' }),
            boqItem({ id: 'l', category: 'labor_substructure', material_id: 'labor-excavation', material_name: 'Excavation' }),
        ], {});
        const labels = groups.flatMap((g) => g.options.map((o) => o.label));
        expect(labels.some((l) => l.startsWith('Cement (Access road)'))).toBe(true);
        expect(labels.some((l) => l.startsWith('Cement (Footings)'))).toBe(true);
        expect(labels.some((l) => l.startsWith('Labour · Excavation'))).toBe(true);
    });

    it('never shows less than nothing left', () => {
        const [group] = materialOptionGroups([boqItem({ id: 'a', quantity: 5, unit: 'each' })], { a: 9 });
        expect(group.options[0].label.endsWith('· 0 left')).toBe(true);
    });
});

describe('grouping usage by period', () => {
    const history = [
        usage({ usage_date: '2026-11-10' }), // Tuesday
        usage({ usage_date: '2026-11-12' }),
        usage({ usage_date: '2026-11-16' }), // next Monday
    ];

    it('groups by day', () => {
        expect(Object.keys(groupUsageByPeriod(history, 'daily'))).toEqual(['2026-11-10', '2026-11-12', '2026-11-16']);
    });

    it('groups by the Monday that starts the week', () => {
        const weekly = groupUsageByPeriod(history, 'weekly');
        expect(Object.keys(weekly).length).toBe(2);
        expect(Object.values(weekly).map((rows) => rows.length).sort()).toEqual([1, 2]);
    });
});

describe('usage value', () => {
    const items = [
        boqItem({ id: 'a', quantity: 10, unit_price_usd: 5 }),
        boqItem({ id: 'b', quantity: 4, actual_quantity: 6, unit_price_usd: 2 }),
    ];

    it('values what was used at average prices', () => {
        expect(usedValue(items, { a: 3, b: 1 })).toBe(17);
    });

    it('values what is left from the bought quantity, and lets overuse go negative', () => {
        expect(remainingValue(items, { a: 3, b: 1 })).toBe(45);
        expect(remainingValue([boqItem({ id: 'a', quantity: 1, unit_price_usd: 10 })], { a: 3 })).toBe(-20);
    });
});

describe('per-material stats and the summary', () => {
    it('works out used, left and percent per line', () => {
        const [stat] = materialUsageStats([boqItem({ id: 'a', quantity: 10 })], { a: 4 });
        expect(stat).toMatchObject({ availableQty: 10, usedQty: 4, remainingQty: 6, usagePercent: 40 });
    });

    it('counts low stock at or under the threshold, skipping lines with nothing available', () => {
        const stats = materialUsageStats([
            boqItem({ id: 'a', quantity: 10 }),
            boqItem({ id: 'b', quantity: 10 }),
            boqItem({ id: 'c', quantity: 0 }),
        ], { a: 8, b: 7 });
        const summary = summariseUsage(stats, 20);
        expect(summary.lowStockCount).toBe(1);
        expect(summary.totalAvailable).toBe(20);
        expect(summary.totalUsed).toBe(15);
        expect(summary.totalRemaining).toBe(5);
        expect(summary.overallPercent).toBe(75);
    });
});

describe('history views', () => {
    it('lists each line newest first', () => {
        const byLine = usageByMaterial([
            usage({ boq_item_id: 'a', usage_date: '2026-11-01' }),
            usage({ boq_item_id: 'a', usage_date: '2026-11-09' }),
            usage({ boq_item_id: 'b', usage_date: '2026-11-05' }),
        ]);
        expect(byLine.a.map((u) => u.usage_date)).toEqual(['2026-11-09', '2026-11-01']);
        expect(byLine.b).toHaveLength(1);
    });

    it('groups the ledger by day, newest day first, with an English day heading', () => {
        const ledger = ledgerByDate([
            usage({ usage_date: '2026-11-01' }),
            usage({ usage_date: '2026-11-10' }),
            usage({ usage_date: '2026-11-10' }),
        ]);
        const keys = Object.keys(ledger);
        expect(keys).toHaveLength(2);
        expect(keys[0]).toMatch(/10 Nov 2026/);
        expect(ledger[keys[0]]).toHaveLength(2);
    });
});

describe('calendar dates across time zones', () => {
    it.each(['America/New_York', 'Pacific/Honolulu', 'Pacific/Kiritimati', 'Africa/Harare'])('keeps dates stable in %s, including DST and year boundaries', (zone) => {
        process.env.TZ = zone;
        expect(formatUsageDate('2026-11-10', { day: '2-digit', month: 'short', year: 'numeric' })).toBe('10 Nov 2026');
        const weekly = groupUsageByPeriod([usage({ usage_date: '2026-11-01' }), usage({ usage_date: '2026-11-02' }), usage({ usage_date: '2027-01-01' })], 'weekly');
        expect(Object.keys(weekly)).toEqual(['2026-10-26', '2026-11-02', '2026-12-28']);
        expect(localToday(new Date(2026, 10, 10, 23, 30))).toBe('2026-11-10');
    });
    afterAll(() => { process.env.TZ = 'Africa/Harare'; });

    it('keeps the recorded day on a device west of UTC', () => {
        process.env.TZ = 'America/New_York';
        const ledger = ledgerByDate([usage({ usage_date: '2026-11-10' })]);
        expect(Object.keys(ledger)[0]).toMatch(/10 Nov 2026/);
    });

    it('keeps Monday in the correct week west of UTC', () => {
        process.env.TZ = 'America/New_York';
        // Tue 10, Thu 12 and Mon 16 November must remain in two separate weeks.
        const weekly = groupUsageByPeriod([
            usage({ usage_date: '2026-11-10' }), usage({ usage_date: '2026-11-12' }), usage({ usage_date: '2026-11-16' }),
        ], 'weekly');
        expect(Object.keys(weekly)).toEqual(['2026-11-09', '2026-11-16']);
    });
});
