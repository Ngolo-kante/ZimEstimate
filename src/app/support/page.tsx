'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, LifebuoyIcon, PaperPlaneTilt, Warning } from '@phosphor-icons/react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Support intake.
 *
 * This page used to be three cards listing email addresses. Those addresses
 * have no MX records behind them, so every one of them bounced — and there was
 * no form, and support_tickets required an account. Between them that left no
 * working way to reach anyone, including for the people most likely to need it:
 * someone locked out, or someone whose problem is the sign-up itself.
 *
 * The form works signed out. It posts to /api/support, which rate-limits and
 * inserts server-side, and the ticket lands in the existing admin queue.
 */

const CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'account', label: 'Account or sign-in' },
  { value: 'billing', label: 'Billing' },
  { value: 'supplier', label: 'Supplier registration or catalogue' },
  { value: 'contractor', label: 'Contractor account' },
  { value: 'bug', label: 'Something is broken' },
  { value: 'privacy', label: 'Privacy or data request' },
] as const;

const INPUT =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 ' +
  'text-sm text-[var(--color-text)] transition focus:border-[var(--color-accent)] focus:outline-none ' +
  'focus:ring-2 focus:ring-[var(--color-accent)]/20';

const LABEL = 'mb-1.5 block text-xs font-bold text-[var(--color-text-secondary)]';

function SupportForm() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();

  // Contextual links carry where the person came from, so the ticket queue
  // records which surface caused the problem instead of everything landing as
  // "general". Derived, not copied into state — an unrecognised value falls
  // back rather than selecting nothing.
  const paramCategory = searchParams.get('category');
  const paramSubject = searchParams.get('subject');

  // null means "not touched yet", so the profile fills the gap until the user
  // types. Derived rather than synced in an effect: auth resolves after the
  // first render, and copying it into state then would either clobber typing
  // or need a guard for it.
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const contactName = nameInput ?? profile?.full_name ?? '';
  const contactEmail = emailInput ?? user?.email ?? '';

  const [categoryInput, setCategoryInput] = useState<string | null>(null);
  const [subjectInput, setSubjectInput] = useState<string | null>(null);
  const category =
    categoryInput ??
    (CATEGORIES.some((c) => c.value === paramCategory) ? (paramCategory as string) : 'general');
  const subject = subjectInput ?? paramSubject ?? '';
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!subject.trim()) return setError('Tell us what this is about.');
    if (description.trim().length < 10) return setError('Add a few more details so we can actually help.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return setError('Enter an email address we can reply to.');
    }

    setIsSubmitting(true);

    try {
      // Passed through so a ticket from a signed-in user is attached to their
      // account and shows in their history; absence just means anonymous.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ contactName, contactEmail, category, subject, description }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'Could not submit your message. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setReference(result.reference ?? null);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  if (reference !== null) {
    return (
      <MainLayout title="Support">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <CheckCircle size={44} weight="duotone" className="mx-auto text-[var(--color-success)]" />
            <h1 className="mt-3 text-xl font-bold text-[var(--color-text)]">Message received</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
              We will reply to <strong>{contactEmail}</strong>. Quote reference{' '}
              <strong className="font-mono">{reference}</strong> if you need to follow up.
            </p>
            <Link
              href="/home"
              className="mt-5 inline-flex rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Back to ZimEstimate
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Support">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-bg)] px-3 py-1 text-xs font-bold text-[var(--color-accent)]">
            <LifebuoyIcon size={14} weight="fill" />
            Support
          </div>
          <h1 className="mt-3 text-2xl font-black text-[var(--color-text)] sm:text-3xl">
            How can we help?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Account problems, pricing questions, supplier or contractor registration, or anything
            that looks broken. You do not need an account to send this.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Your name"
              placeholder="Optional"
              value={contactName}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <Input
              label="Email *"
              type="email"
              placeholder="you@example.com"
              value={contactEmail}
              onChange={(e) => setEmailInput(e.target.value)}
              hint="Where we send the reply."
            />
          </div>

          <div>
            <label htmlFor="category" className={LABEL}>
              What is it about?
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategoryInput(e.target.value)}
              className={INPUT}
            >
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Subject *"
            placeholder="One line on what is happening"
            value={subject}
            onChange={(e) => setSubjectInput(e.target.value)}
          />

          <div>
            <label htmlFor="description" className={LABEL}>
              Details *
            </label>
            <textarea
              id="description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What were you doing, what happened, and what did you expect? Include the project or supplier name, and a screenshot description or rough time if it helps."
              className={`${INPUT} resize-y`}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              The more specific, the faster this gets resolved.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3">
              <Warning size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-error)]" />
              <p className="text-xs text-[var(--color-error)]">{error}</p>
            </div>
          )}

          <Button type="submit" loading={isSubmitting} disabled={isSubmitting} icon={<PaperPlaneTilt size={16} />}>
            Send message
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <MainLayout title="Support">
          <div className="mx-auto max-w-2xl px-4 py-12 text-center text-sm text-[var(--color-text-secondary)]">
            Loading…
          </div>
        </MainLayout>
      }
    >
      <SupportForm />
    </Suspense>
  );
}
