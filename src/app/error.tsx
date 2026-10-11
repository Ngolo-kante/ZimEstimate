'use client';

import { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { WarningCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // Next.js chunk-loading errors happen when a new deployment invalidates
  // old JavaScript chunk hashes while a user has an older version open in their browser.
  // Automatically reload the page once so the browser fetches the fresh deployment's chunks.
  useEffect(() => {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Loading chunk .* failed/i.test(error?.message || '');

    if (isChunkError && typeof window !== 'undefined') {
      const reloadKey = `chunk_reload_${window.location.pathname}`;
      const lastReload = sessionStorage.getItem(reloadKey);
      if (!lastReload || Date.now() - Number(lastReload) > 10_000) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    /Loading chunk .* failed/i.test(error?.message || '');

  return (
    <MainLayout title="Something went wrong">
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <WarningCircle size={28} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            {isChunkError ? 'New update available' : 'We hit a snag'}
          </h1>
        </div>
        <p style={{ color: '#64748b', marginTop: '0.75rem' }}>
          {isChunkError
            ? 'The app was updated. Refresh the page to load the latest version.'
            : (error?.message || 'Unexpected error occurred. Please try again.')}
        </p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <Button onClick={() => (isChunkError ? window.location.reload() : reset())}>
            {isChunkError ? 'Refresh page' : 'Try again'}
          </Button>
          <Button variant="secondary" onClick={() => router.push('/')}>
            Go home
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
