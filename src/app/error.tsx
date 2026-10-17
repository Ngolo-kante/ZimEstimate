'use client';

import { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { WarningCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { isClientBundleError } from '@/lib/clientBundleError';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // An open tab can retain a module graph from an older deployment. Missing
  // module factories sometimes throw a TypeError about `call` rather than a
  // named ChunkLoadError. Reload once to fetch a consistent set of assets.
  useEffect(() => {
    if (isClientBundleError(error) && typeof window !== 'undefined') {
      const reloadKey = `chunk_reload_${window.location.pathname}`;
      const lastReload = sessionStorage.getItem(reloadKey);
      if (!lastReload) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  const isChunkError = isClientBundleError(error);

  return (
    <MainLayout title="Something went wrong">
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <WarningCircle size={28} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            {isChunkError ? 'Refresh this page' : 'We hit a snag'}
          </h1>
        </div>
        <p style={{ color: '#64748b', marginTop: '0.75rem' }}>
          {isChunkError
            ? 'This page could not load all its code. Refresh to load a consistent version, then try the upload again.'
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
