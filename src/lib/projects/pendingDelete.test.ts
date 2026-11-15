import { describe, expect, it, vi } from 'vitest';
import { createPendingDelete, restoreDeletedItem } from './pendingDelete';

describe('pending BOQ deletion', () => {
    it('restores on Undo without committing, even if the toast then closes', async () => {
        const commit = vi.fn(async () => {});
        const restore = vi.fn();
        const pending = createPendingDelete(commit, restore);
        pending.undo();
        pending.undo();
        await pending.commit();
        expect(restore).toHaveBeenCalledTimes(1);
        expect(commit).not.toHaveBeenCalled();
    });
    it('commits only once across dismiss, auto close and page exit', async () => {
        const commit = vi.fn(async () => {});
        const restore = vi.fn();
        const pending = createPendingDelete(commit, restore);
        await Promise.all([pending.commit(), pending.commit(), pending.commit()]);
        pending.undo();
        expect(commit).toHaveBeenCalledTimes(1);
        expect(restore).not.toHaveBeenCalled();
    });
    it('reports a failed commit once so the caller can restore the line', async () => {
        const commit = vi.fn(async () => { throw new Error('offline'); });
        const pending = createPendingDelete(commit, vi.fn());
        await expect(pending.commit()).rejects.toThrow('offline');
        await pending.commit();
        expect(commit).toHaveBeenCalledTimes(1);
    });
    it('restores adjacent lines in original order and never duplicates a line', () => {
        const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
        const order = ['a', 'b', 'c'];
        const restored = restoreDeletedItem(restoreDeletedItem([c], b, order), a, order);
        expect(restored).toEqual([a, b, c]);
        expect(restoreDeletedItem(restored, a, order)).toEqual(restored);
    });
});
