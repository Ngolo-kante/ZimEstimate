/** A single-use delete: Undo cancels it; any close or exit commits it once. */
export function createPendingDelete(commit: () => Promise<void>, restore: () => void) {
    let state: 'pending' | 'undone' | 'committed' = 'pending';
    return {
        undo() {
            if (state !== 'pending') return;
            state = 'undone';
            restore();
        },
        async commit() {
            if (state !== 'pending') return;
            state = 'committed';
            await commit();
        },
    };
}

/** Keep the original order even when several adjacent removals are undone. */
export function restoreDeletedItem<T extends { id: string }>(items: T[], item: T, order: string[]) {
    if (items.some(current => current.id === item.id)) return items;
    const rank = order.indexOf(item.id);
    const next = items.findIndex(current => order.indexOf(current.id) > rank);
    const result = [...items];
    result.splice(next < 0 ? result.length : next, 0, item);
    return result;
}
