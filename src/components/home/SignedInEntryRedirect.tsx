'use client';

// Someone already signed in who arrives at the site (types the address,
// opens a bookmark) goes straight to their projects — the owner's call: the
// home page is for people who have not started yet.
//
// Only on arrival. Clicking Home from inside the app still shows the home
// page, and so does a second visit in the same tab after being sent on once;
// otherwise Home would be unreachable for anyone signed in.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

const SENT_KEY = 'ze-home-sent-to-projects';

/** True when this tab's first page load was the home page itself. */
function arrivedAtHome(): boolean {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!entry) return false;
  const path = new URL(entry.name).pathname;
  return path === '/' || path === '/home';
}

export default function SignedInEntryRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user || !arrivedAtHome()) return;
    try {
      if (sessionStorage.getItem(SENT_KEY)) return;
      sessionStorage.setItem(SENT_KEY, '1');
    } catch {
      // Without storage, still redirect once per page load.
    }
    router.replace('/projects');
  }, [isLoading, user, router]);

  return null;
}
