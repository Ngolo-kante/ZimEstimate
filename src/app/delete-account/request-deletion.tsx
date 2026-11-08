'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function RequestDeletion() {
  const { user, profile, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ email: string; reference: string | null } | null>(null);

  async function requestDeletion() {
    if (isSubmitting || confirmation || !user) return;
    setError('');
    setIsSubmitting(true);

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const session = data.session;
      if (sessionError || !session || session.user.id !== user.id || !session.user.email) {
        setError('Please sign in again before requesting deletion, or email support@zimestimate.com.');
        return;
      }

      const contactEmail = session.user.email;
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contactName: profile?.full_name ?? '',
          contactEmail,
          category: 'privacy',
          subject: 'Account deletion request',
          description: `Please delete my ZimEstimate account and associated data, including projects, BOQs, uploaded plans and photos, and saved settings. My account email is ${contactEmail}.`,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        setError(result.error || 'Could not submit your request. Please try again.');
        return;
      }

      setConfirmation({ email: contactEmail, reference: result.reference ?? null });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <div role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-success-bg)] p-4">
        <p className="font-bold">Deletion request received</p>
        <p className="mt-2 text-sm leading-relaxed">
          Our team will review your request and reply to <strong>{confirmation.email}</strong>.
          Your account has not been deleted yet.
          {confirmation.reference && <> Your reference is <strong className="font-mono">{confirmation.reference}</strong>.</>}
        </p>
      </div>
    );
  }

  return (
    <div>
      {isLoading ? (
        <p role="status" className="text-sm text-[var(--color-text-secondary)]">Checking sign-in status…</p>
      ) : user ? (
        <>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            Request deletion for <strong>{user.email}</strong>.
          </p>
          <Button onClick={requestDeletion} loading={isSubmitting} disabled={isSubmitting}>
            Request deletion
          </Button>
        </>
      ) : (
        <Link href="/auth/login?redirect=%2Fdelete-account" className="text-sm font-semibold text-[var(--color-accent)] underline">
          Sign in to request deletion
        </Link>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
