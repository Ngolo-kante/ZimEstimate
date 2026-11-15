import { describe, expect, it } from 'vitest';
import { getItemStatus, getStatusConfig, isEnablementItem, stripEnablementTag } from './itemStatus';
import { boqItem, purchaseRecord } from './testItems';

describe('purchase status of a line', () => {
    const line = boqItem({ id: 'a', quantity: 10 });

    it('is pending with nothing bought', () => {
        expect(getItemStatus(line, [])).toBe('pending');
        expect(getItemStatus(line, [purchaseRecord({ boq_item_id: 'other', quantity: 10 })])).toBe('pending');
    });

    it('is in progress part way', () => {
        expect(getItemStatus(line, [purchaseRecord({ boq_item_id: 'a', quantity: 4 })])).toBe('in_progress');
    });

    it('adds purchases together and allows 0.01 either side of the estimate', () => {
        const parts = [purchaseRecord({ boq_item_id: 'a', quantity: 6 }), purchaseRecord({ boq_item_id: 'a', quantity: 3.995 })];
        expect(getItemStatus(line, parts)).toBe('purchased');
        expect(getItemStatus(line, [purchaseRecord({ boq_item_id: 'a', quantity: 10.01 })])).toBe('purchased');
    });

    it('is over purchased beyond the estimate', () => {
        expect(getItemStatus(line, [purchaseRecord({ boq_item_id: 'a', quantity: 10.02 })])).toBe('over_purchased');
    });

    it('takes the larger of logged purchases and the actual quantity', () => {
        expect(getItemStatus(boqItem({ id: 'a', quantity: 10, actual_quantity: 10 }), [purchaseRecord({ boq_item_id: 'a', quantity: 2 })])).toBe('purchased');
    });

    it('counts a typed-in actual quantity as bought even with no purchase logged (odd but long-standing)', () => {
        expect(getItemStatus(boqItem({ quantity: 10, actual_quantity: 10 }), [])).toBe('purchased');
    });

    it('treats any purchase of a zero-quantity line as over purchased', () => {
        expect(getItemStatus(boqItem({ id: 'z', quantity: 0 }), [purchaseRecord({ boq_item_id: 'z', quantity: 1 })])).toBe('over_purchased');
    });
});

describe('status labels', () => {
    it('gives a label and class for each status', () => {
        expect(getStatusConfig('pending')).toEqual({ label: 'Pending', className: 'pending' });
        expect(getStatusConfig('in_progress')).toEqual({ label: 'In progress', className: 'in-progress' });
        expect(getStatusConfig('purchased')).toEqual({ label: 'Purchased', className: 'purchased' });
        expect(getStatusConfig('over_purchased')).toEqual({ label: 'Over-purchased', className: 'over-purchased' });
    });
});

describe('enablement lines', () => {
    it('is marked by a tag at the start of the note', () => {
        expect(isEnablementItem('[Enablement Cost] Access road')).toBe(true);
        expect(isEnablementItem('Access road [Enablement Cost]')).toBe(false);
        expect(isEnablementItem(null)).toBe(false);
    });

    it('shows the note without the tag', () => {
        expect(stripEnablementTag('[Enablement Cost] Access road')).toBe('Access road');
        expect(stripEnablementTag('Plain note')).toBe('Plain note');
        expect(stripEnablementTag(undefined)).toBe('');
    });
});
