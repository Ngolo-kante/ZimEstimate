import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true from the first client render
 * after it. For components whose first render depends on browser storage:
 * rendering that straight away made the server HTML and the client disagree.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
