'use client';

import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { WarningCircle } from '@phosphor-icons/react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <MainLayout title="Something went wrong">
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <WarningCircle size={28} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            We hit a snag
          </h1>
        </div>
        <p style={{ color: '#64748b', marginTop: '0.75rem' }}>
          {error?.message || 'Unexpected error occurred. Please try again.'}
        </p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => window.location.href = '/'}>
            Go home
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
