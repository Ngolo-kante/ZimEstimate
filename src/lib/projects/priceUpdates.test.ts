import { describe, expect, it } from 'vitest';
import {
    applyPriceUpdatesToItems,
    estimateFromPrices,
    findPriceUpdates,
    latestPriceUpdateAt,
    parseAcknowledgedAt,
    priceUpdateAckKey,
    priceUpdatePreview,
    type PriceUpdate,
} from './priceUpdates';
import { boqItem } from './testItems';

const update = (overrides: Partial<PriceUpdate> = {}): PriceUpdate => ({
    itemId: 'a', materialId: 'cement-325', materialName: 'Cement', currentPriceUsd: 10, newPriceUsd: 11,
    deltaPercent: 10, lastUpdated: '2026-11-07T06:00:00.000Z', ...overrides,
});

describe('storage keys', () => {
    it('names one key per project', () => {
        expect(priceUpdateAckKey('p1')).toBe('boq_price_update_ack_p1');
    });
});

describe('reading the acknowledgement', () => {
    it('reads a stored date', () => {
        expect(parseAcknowledgedAt('2026-11-07T06:00:00.000Z')?.toISOString()).toBe('2026-11-07T06:00:00.000Z');
    });

    it('treats nothing or junk as never acknowledged', () => {
        expect(parseAcknowledgedAt(null)).toBeNull();
        expect(parseAcknowledgedAt('')).toBeNull();
        expect(parseAcknowledgedAt('not a date')).toBeNull();
    });
});

describe('finding price updates', () => {
    const prices = { 'cement-325': { priceUsd: 12.5, lastUpdated: '2026-11-07T06:00:00.000Z' } };

    it('offers the new price with the change in percent', () => {
        const item = boqItem({ id: 'a', unit_price_usd: 10 });
        expect(findPriceUpdates([item], prices, null)).toEqual([{
            itemId: 'a', materialId: 'cement-325', materialName: 'Standard Cement 32.5N',
            currentPriceUsd: 10, newPriceUsd: 12.5, deltaPercent: 25, lastUpdated: '2026-11-07T06:00:00.000Z',
        }]);
    });

    it('ignores lines without a latest price, and changes under a cent', () => {
        expect(findPriceUpdates([boqItem({ material_id: 'paint-pva' })], prices, null)).toEqual([]);
        expect(findPriceUpdates([boqItem({ unit_price_usd: 12.495 })], prices, null)).toEqual([]);
    });

    it('skips prices no newer than the acknowledgement, the same moment included', () => {
        const item = boqItem({ unit_price_usd: 10 });
        expect(findPriceUpdates([item], prices, new Date('2026-11-07T06:00:00.000Z'))).toEqual([]);
        expect(findPriceUpdates([item], prices, new Date('2026-11-07T05:59:59.000Z'))).toHaveLength(1);
    });

    it('gives a 0% change for a line priced at zero', () => {
        expect(findPriceUpdates([boqItem({ unit_price_usd: 0 })], prices, null)[0].deltaPercent).toBe(0);
    });

    it('updates every affected line but names the material only once in the banner', () => {
        const lines = [boqItem({ category: 'substructure' }), boqItem({ category: 'superstructure' })];
        const updates = findPriceUpdates(lines, prices, null);
        expect(updates.map((u) => u.materialName)).toEqual(['Standard Cement 32.5N', 'Standard Cement 32.5N']);
        expect(priceUpdatePreview(updates)).toBe('Standard Cement 32.5N');
    });
});

describe('the preview line', () => {
    it('is empty with no updates', () => {
        expect(priceUpdatePreview([])).toBe('');
    });

    it('names up to three materials and counts the rest', () => {
        const names = ['A', 'B', 'C', 'D', 'E'].map((materialName) => update({ materialName }));
        expect(priceUpdatePreview(names.slice(0, 3))).toBe('A, B, C');
        expect(priceUpdatePreview([...names, ...names])).toBe('A, B, C +2 more');
    });
});

describe('the newest update date', () => {
    it('is null with no updates', () => {
        expect(latestPriceUpdateAt([])).toBeNull();
    });

    it('picks the newest date', () => {
        const at = latestPriceUpdateAt([
            update({ lastUpdated: '2026-11-01T00:00:00.000Z' }),
            update({ lastUpdated: '2026-11-07T00:00:00.000Z' }),
            update({ lastUpdated: '2026-11-03T00:00:00.000Z' }),
        ]);
        expect(at?.toISOString()).toBe('2026-11-07T00:00:00.000Z');
    });

    it('keeps an unreadable first date, because nothing compares greater than it', () => {
        const at = latestPriceUpdateAt([update({ lastUpdated: 'junk' }), update({ lastUpdated: '2026-11-07T00:00:00.000Z' })]);
        expect(Number.isNaN(at?.getTime())).toBe(true);
    });
});

describe('applying updates', () => {
    it('sets USD and ZWG prices on the updated lines only', () => {
        const a = boqItem({ id: 'a', unit_price_usd: 10, quantity: 2 });
        const b = boqItem({ id: 'b', unit_price_usd: 4, quantity: 3 });
        const next = applyPriceUpdatesToItems([a, b], [update({ itemId: 'a', newPriceUsd: 12 })], 26.9);
        expect(next[0]).toMatchObject({ unit_price_usd: 12, unit_price_zwg: 12 * 26.9 });
        expect(next[1]).toBe(b);
        expect(estimateFromPrices(next)).toBe(36);
    });

    it('leaves stored line totals alone (the estimate is worked out from prices)', () => {
        const a = boqItem({ id: 'a', unit_price_usd: 10, quantity: 2, total_usd: 20 });
        expect(applyPriceUpdatesToItems([a], [update({ itemId: 'a', newPriceUsd: 12 })], 1)[0].total_usd).toBe(20);
    });
});
